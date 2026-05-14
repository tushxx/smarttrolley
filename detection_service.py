"""
YOLO Item Detection Service — with Pi Camera streaming + ONNX acceleration
============================================================================
Runs on port 8001.

Architecture:
─────────────
• A single background thread opens the Pi camera ONCE and continuously
  captures frames, compressing each to JPEG and storing it in
  `_latest_jpeg` (bytes). This avoids any re-open / lock-contention issues.
• GET /stream   — MJPEG multipart stream served directly from `_latest_jpeg`
• GET /capture  — Returns latest frame as base64 JSON for YOLO detection
• POST /detect  — Receives a base64 image and runs YOLO inference
• GET /health   — Service health status
• GET /model-info — Detailed model + performance info

Performance targets (Raspberry Pi 5, no GPU):
  • PyTorch path:  ~300-500 ms per frame
  • ONNX path:     ~50-150 ms per frame  ← preferred
"""

import sys
import os
import base64
import io
import subprocess
import traceback
import threading
import time
from pathlib import Path

# ── Auto-install ultralytics if missing ──────────────────────────────────────
def _pip_install(*packages):
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", *packages, "--quiet", "--no-warn-script-location"],
        capture_output=True, text=True, timeout=300
    )
    return result.returncode == 0, result.stderr[-500:]

def _ensure_ultralytics():
    try:
        import cv2  # noqa: F401
        import ultralytics  # noqa: F401
        return True
    except ImportError:
        pass
    except Exception as e:
        if "libGL" in str(e) or "libGL" in repr(e):
            print("[INFO] OpenCV needs headless variant — installing opencv-python-headless...")
            ok, err = _pip_install("opencv-python-headless")
            if not ok:
                print(f"[WARN] headless OpenCV install failed: {err}")

    try:
        import ultralytics  # noqa: F401
        return True
    except ImportError:
        print("[INFO] ultralytics not found — attempting pip install (this may take a minute)...")

    ok, err = _pip_install("ultralytics")
    if ok:
        try:
            import cv2 # type: ignore  # noqa: F401
        except Exception as e2:
            if "libGL" in str(e2):
                print("[INFO] Switching to opencv-python-headless...")
                _pip_install("opencv-python-headless")
                subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "opencv-python"],
                               capture_output=True)
        print("[INFO] ✅ ultralytics installed successfully")
        return True
    else:
        print(f"[WARN] pip install failed: {err}")
        return False

ULTRALYTICS_OK = _ensure_ultralytics()

# ── Flask ────────────────────────────────────────────────────────────────────
try:
    from flask import Flask, request, jsonify, Response, stream_with_context
except ImportError:
    print("[ERROR] Flask not installed.")
    sys.exit(1)

# ── PIL ──────────────────────────────────────────────────────────────────────
try:
    from PIL import Image    # type: ignore
    PIL_OK = True
except ImportError:
    PIL_OK = False
    print("[WARN] Pillow not installed. Image decoding will fail.")

# ── ONNX Runtime (optional — huge speed boost on Pi) ─────────────────────────
ONNX_OK = False
ort_session = None
try:
    import onnxruntime as ort  # type: ignore
    ONNX_OK = True
    print("[INFO] ✅ onnxruntime available — will use ONNX acceleration if model exists")
except ImportError:
    print("[INFO] onnxruntime not installed — using PyTorch inference (slower)")
    print("[TIP]  pip install onnxruntime  for 2-5x faster inference on Pi")

import numpy as np  # type: ignore

# ── YOLO Model ───────────────────────────────────────────────────────────────
MODEL_LOADED = False
model = None
model_names = {}  # class_id → class_name mapping
INFERENCE_ENGINE = "none"  # "onnx" | "pytorch" | "none"

MODEL_PATHS = [
    "attached_assets/my_model (1).pt",
    "attached_assets/my_model.pt",
    "my_model.pt",
    "model.pt",
]

INFERENCE_SIZE = 320       # Smaller = faster inference; YOLO handles downscale well
CONFIDENCE_THRESHOLD = 0.45  # Low threshold; frontend multi-frame logic filters noise

# ── Performance tracking ─────────────────────────────────────────────────────
_inference_times = []  # last N inference durations in ms
_MAX_TIMING_SAMPLES = 50


def _record_timing(ms: float):
    _inference_times.append(ms)
    if len(_inference_times) > _MAX_TIMING_SAMPLES:
        _inference_times.pop(0)


def _get_timing_stats():
    if not _inference_times:
        return {"avg_ms": 0, "min_ms": 0, "max_ms": 0, "samples": 0}
    return {
        "avg_ms": round(sum(_inference_times) / len(_inference_times), 1),
        "min_ms": round(min(_inference_times), 1),
        "max_ms": round(max(_inference_times), 1),
        "samples": len(_inference_times),
    }


# ── ONNX Export ──────────────────────────────────────────────────────────────
def _try_export_onnx(pt_path: str) -> str | None:
    """Try to export .pt → .onnx for faster inference. Returns .onnx path or None."""
    onnx_path = pt_path.rsplit(".", 1)[0] + ".onnx"
    if os.path.exists(onnx_path):
        print(f"[ONNX] Found existing: {onnx_path}")
        return onnx_path

    if not ULTRALYTICS_OK:
        return None

    print(f"[ONNX] Exporting {pt_path} → ONNX (one-time, may take 30-60s)...")
    try:
        from ultralytics import YOLO  # type: ignore
        temp_model = YOLO(pt_path)
        export_path = temp_model.export(format="onnx", imgsz=320, half=False, simplify=True)
        if export_path and os.path.exists(export_path):
            print(f"[ONNX] ✅ Exported to: {export_path}")
            return str(export_path)
        # Sometimes ultralytics returns a different path pattern
        if os.path.exists(onnx_path):
            return onnx_path
    except Exception as e:
        print(f"[ONNX] Export failed (will use PyTorch): {e}")

    return None


# ── ONNX Inference helpers ───────────────────────────────────────────────────
def _load_onnx_session(onnx_path: str):
    """Load ONNX model into onnxruntime InferenceSession."""
    global ort_session
    providers = ["CPUExecutionProvider"]
    # Try CoreML on macOS for extra speed
    try:
        if "CoreMLExecutionProvider" in ort.get_available_providers():
            providers.insert(0, "CoreMLExecutionProvider")
    except Exception:
        pass

    sess_opts = ort.SessionOptions()
    sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    sess_opts.intra_op_num_threads = 4  # Pi 5 has 4 cores
    sess_opts.inter_op_num_threads = 1

    ort_session = ort.InferenceSession(onnx_path, sess_options=sess_opts, providers=providers)
    print(f"[ONNX] ✅ Session loaded — providers: {ort_session.get_providers()}")


# Pre-allocated buffer for ONNX input — avoids GC pressure on every frame
_onnx_input_buf = np.zeros((1, 3, INFERENCE_SIZE, INFERENCE_SIZE), dtype=np.float32)


def _onnx_preprocess_cv2(jpeg_bytes: bytes) -> np.ndarray:
    """JPEG bytes → ONNX-ready float32 tensor [1, 3, H, W] using cv2 (fast)."""
    import cv2  # type: ignore
    arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)        # BGR HWC
    img = cv2.resize(img, (INFERENCE_SIZE, INFERENCE_SIZE), interpolation=cv2.INTER_LINEAR)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)       # RGB HWC
    buf = _onnx_input_buf
    buf[0] = img.transpose(2, 0, 1).astype(np.float32) / 255.0  # CHW
    return buf


def _onnx_preprocess(image: Image.Image) -> np.ndarray:
    """PIL Image → ONNX-ready float32 tensor [1, 3, H, W] (fallback)."""
    target = INFERENCE_SIZE
    img = image.resize((target, target), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0   # HWC 0-1
    arr = arr.transpose(2, 0, 1)                     # CHW
    arr = np.expand_dims(arr, axis=0)                # NCHW
    return np.ascontiguousarray(arr)


def _onnx_postprocess(output: np.ndarray, conf_threshold: float) -> list:
    """Parse ONNX YOLO output [1, 5+nc, N] → list of detections."""
    # output shape: (1, 4+nc, num_boxes) — transpose to (num_boxes, 4+nc)
    if output.ndim == 3:
        output = output[0]  # remove batch dim
    if output.shape[0] < output.shape[1]:
        output = output.T   # now (num_boxes, 4+nc)

    detections = []
    for row in output:
        # row = [cx, cy, w, h, class0_conf, class1_conf, ...]
        class_scores = row[4:]
        max_conf = float(np.max(class_scores))
        if max_conf >= conf_threshold:
            cls_id = int(np.argmax(class_scores))
            cls_name = model_names.get(cls_id, str(cls_id))
            detections.append({
                "class": cls_name,
                "confidence": round(max_conf, 3),
                "class_id": cls_id,
            })

    return detections


def _run_onnx_inference(image: Image.Image) -> list:
    """Full ONNX inference pipeline (PIL input)."""
    if ort_session is None:
        return []
    inp = _onnx_preprocess(image)
    input_name = ort_session.get_inputs()[0].name
    outputs = ort_session.run(None, {input_name: inp})
    return _onnx_postprocess(outputs[0], CONFIDENCE_THRESHOLD)


def _run_onnx_inference_fast(jpeg_bytes: bytes) -> list:
    """ONNX inference directly from JPEG bytes — skips PIL entirely."""
    if ort_session is None:
        return []
    inp = _onnx_preprocess_cv2(jpeg_bytes)
    input_name = ort_session.get_inputs()[0].name
    outputs = ort_session.run(None, {input_name: inp})
    return _onnx_postprocess(outputs[0], CONFIDENCE_THRESHOLD)


# ── PyTorch (ultralytics) inference ──────────────────────────────────────────
def _run_pytorch_inference(image: Image.Image) -> list:
    """Standard ultralytics YOLO inference."""
    if model is None:
        return []

    # Always resize to INFERENCE_SIZE for speed
    if image.width != INFERENCE_SIZE or image.height != INFERENCE_SIZE:
        image = image.resize((INFERENCE_SIZE, INFERENCE_SIZE), Image.BILINEAR)

    results = model(image, verbose=False, imgsz=INFERENCE_SIZE)
    detections = []
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = model.names.get(cls_id, str(cls_id))
            if conf >= CONFIDENCE_THRESHOLD:
                detections.append({
                    "class": cls_name,
                    "confidence": round(conf, 3),
                    "class_id": cls_id,
                })
    return detections


def _run_pytorch_inference_fast(jpeg_bytes: bytes) -> list:
    """PyTorch inference directly from JPEG bytes — uses cv2 decode (faster than PIL)."""
    if model is None:
        return []
    import cv2  # type: ignore
    arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)  # BGR
    img = cv2.resize(img, (INFERENCE_SIZE, INFERENCE_SIZE), interpolation=cv2.INTER_LINEAR)
    # ultralytics accepts numpy BGR arrays directly
    results = model(img, verbose=False, imgsz=INFERENCE_SIZE)
    detections = []
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = model.names.get(cls_id, str(cls_id))
            if conf >= CONFIDENCE_THRESHOLD:
                detections.append({
                    "class": cls_name,
                    "confidence": round(conf, 3),
                    "class_id": cls_id,
                })
    return detections


# ── Unified inference ────────────────────────────────────────────────────────
def run_inference(image: Image.Image) -> list:
    """Run inference using the best available engine (ONNX or PyTorch). PIL input."""
    t0 = time.time()
    if INFERENCE_ENGINE == "onnx":
        dets = _run_onnx_inference(image)
    elif INFERENCE_ENGINE == "pytorch":
        dets = _run_pytorch_inference(image)
    else:
        return []
    elapsed = (time.time() - t0) * 1000
    _record_timing(elapsed)
    return dets


def run_inference_from_jpeg(jpeg_bytes: bytes) -> list:
    """Run inference directly from JPEG bytes — fastest path, skips PIL."""
    t0 = time.time()
    if INFERENCE_ENGINE == "onnx":
        dets = _run_onnx_inference_fast(jpeg_bytes)
    elif INFERENCE_ENGINE == "pytorch":
        dets = _run_pytorch_inference_fast(jpeg_bytes)
    else:
        return []
    elapsed = (time.time() - t0) * 1000
    _record_timing(elapsed)
    return dets


# ── Model loading ────────────────────────────────────────────────────────────
def load_model():
    global model, MODEL_LOADED, model_names, INFERENCE_ENGINE

    if not ULTRALYTICS_OK:
        print("[WARN] ultralytics unavailable.")
        return

    try:
        from ultralytics import YOLO  # type: ignore

        pt_path = None
        for path in MODEL_PATHS:
            if os.path.exists(path):
                pt_path = path
                break

        if not pt_path:
            print("[WARN] No model file found. Looked for:", MODEL_PATHS)
            return

        print(f"[INFO] Loading YOLO model from: {pt_path}")
        model = YOLO(pt_path)
        model_names = dict(model.names)
        MODEL_LOADED = True
        print(f"[INFO] ✅ Model loaded. Classes: {model_names}")

        # ── Try ONNX acceleration ────────────────────────────────────────
        if ONNX_OK:
            onnx_path = _try_export_onnx(pt_path)
            if onnx_path:
                try:
                    _load_onnx_session(onnx_path)
                    INFERENCE_ENGINE = "onnx"
                    print("[INFO] 🚀 Using ONNX Runtime for inference (fast mode)")
                except Exception as e:
                    print(f"[WARN] ONNX session load failed, falling back to PyTorch: {e}")
                    INFERENCE_ENGINE = "pytorch"
            else:
                INFERENCE_ENGINE = "pytorch"
        else:
            INFERENCE_ENGINE = "pytorch"

        # ── Warmup ───────────────────────────────────────────────────────
        print(f"[INFO] Warming up model ({INFERENCE_ENGINE})…")
        dummy = Image.fromarray(np.zeros((INFERENCE_SIZE, INFERENCE_SIZE, 3), dtype="uint8"))
        run_inference(dummy)
        print(f"[INFO] ✅ Model warm — inference engine: {INFERENCE_ENGINE}")

        stats = _get_timing_stats()
        if stats["samples"] > 0:
            print(f"[INFO] Warmup inference: {stats['avg_ms']:.0f}ms")

    except Exception as e:
        print(f"[ERROR] Failed to load model: {e}")
        traceback.print_exc()


load_model()

# ── Flask app ────────────────────────────────────────────────────────────────
app = Flask(__name__)

# ──────────────────────────────────────────────────────────────────────────────
#  Pi Camera — single background capture thread
#  One thread opens picamera2/OpenCV ONCE and continuously reads frames.
#  Latest JPEG bytes are stored in _latest_jpeg. No re-opening, no locking per-request.
# ──────────────────────────────────────────────────────────────────────────────
_latest_jpeg: bytes = b""          # latest compressed frame
_frame_event  = threading.Event()  # set whenever a new frame is available
_cam_mode: str = "none"            # "picamera2" | "opencv" | "none"
_cam_ok: bool  = False


def _camera_thread():
    """Background thread: opens camera once and pushes frames continuously."""
    global _latest_jpeg, _cam_mode, _cam_ok

    # ── Try picamera2 first ──────────────────────────────────────────────────
    try:
        from picamera2 import Picamera2 # type: ignore
        import cv2 # type: ignore

        cam = Picamera2()
        cfg = cam.create_video_configuration(
            main={"size": (1280, 720), "format": "RGB888"},
            controls={"FrameDurationLimits": (33333, 33333)},  # ~30 fps
        )
        cam.configure(cfg)
        cam.start()
        time.sleep(1.0)   # let AE/AWB settle

        _cam_mode = "picamera2"
        _cam_ok   = True
        print("[CAM] ✅ picamera2 running")

        while True:
            try:
                rgb   = cam.capture_array()
                bgr   = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
                ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if ok:
                    _latest_jpeg = bytes(buf)
                    _frame_event.set()
                    _frame_event.clear()
            except Exception as inner:
                print(f"[CAM] picamera2 capture error: {inner}")
                time.sleep(0.1)

    except Exception as e:
        print(f"[CAM] picamera2 unavailable: {e} — trying OpenCV…")

    # ── Fallback: OpenCV VideoCapture ────────────────────────────────────────
    try:
        import cv2 # type: ignore

        for idx in range(4):
            cap = cv2.VideoCapture(idx)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                cap.set(cv2.CAP_PROP_FPS, 30)
                _cam_mode = "opencv"
                _cam_ok   = True
                print(f"[CAM] ✅ OpenCV VideoCapture on /dev/video{idx}")
                break
        else:
            print("[CAM] ❌ No camera device found.")
            return

        while True:
            ok, frame = cap.read()
            if ok:
                _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                _latest_jpeg = bytes(buf)
                _frame_event.set()
                _frame_event.clear()
            else:
                time.sleep(0.05)

    except Exception as e2:
        print(f"[CAM] OpenCV also failed: {e2}")
        _cam_ok = False


# Start background capture thread on service startup
_t = threading.Thread(target=_camera_thread, daemon=True)
_t.start()
# Give the camera ~2s to initialise before Flask starts serving
time.sleep(2.0)


# ── MJPEG stream ────────────────────────────────────────────────────────────
def _mjpeg_gen():
    """Yield MJPEG multipart frames from the shared buffer."""
    while True:
        jpeg = _latest_jpeg
        if jpeg:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
            )
        time.sleep(0.033)   # ~30 fps cap for clients


@app.route("/stream", methods=["GET"])
def stream():
    if not _cam_ok:
        return jsonify({"error": "Pi camera not available"}), 503
    return Response(
        stream_with_context(_mjpeg_gen()),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@app.route("/capture", methods=["GET"])
def capture():
    """Return latest frame as base64 JSON for YOLO detection."""
    if not _cam_ok or not _latest_jpeg:
        return jsonify({"error": "Pi camera not ready"}), 503
    b64 = base64.b64encode(_latest_jpeg).decode()
    return jsonify({"image": f"data:image/jpeg;base64,{b64}"})


# ── Health ───────────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "cam_mode": _cam_mode,
        "cam_ok": _cam_ok,
        "model_loaded": MODEL_LOADED,
        "ultralytics_ok": ULTRALYTICS_OK,
        "inference_engine": INFERENCE_ENGINE,
        "inference_size": INFERENCE_SIZE,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "model_classes": list(model_names.values()),
    })


# ── Model Info (detailed) ───────────────────────────────────────────────────
@app.route("/model-info", methods=["GET"])
def model_info():
    """Detailed model and performance information for the frontend."""
    stats = _get_timing_stats()
    return jsonify({
        "model_loaded": MODEL_LOADED,
        "inference_engine": INFERENCE_ENGINE,
        "onnx_available": ONNX_OK,
        "inference_size": INFERENCE_SIZE,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "classes": model_names,
        "class_count": len(model_names),
        "timing": stats,
        "cam_mode": _cam_mode,
        "cam_ok": _cam_ok,
    })


# ── YOLO Detection ────────────────────────────────────────────────────────────
@app.route("/detect", methods=["POST"])
def detect():
    if not PIL_OK:
        return jsonify({"error": "Pillow not installed"}), 500

    data = request.get_json(silent=True)
    if not data or "image" not in data:
        return jsonify({"error": "No image in request body"}), 400

    # Decode base64 → PIL Image
    try:
        img_data = data["image"]
        if "," in img_data:
            img_data = img_data.split(",", 1)[1]
        img_bytes = base64.b64decode(img_data)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"Invalid image data: {e}"}), 400

    if not MODEL_LOADED:
        return jsonify({"detected": False, "message": "Model not loaded"})

    try:
        all_detections = run_inference(image)
    except Exception as e:
        return jsonify({"error": f"Inference failed: {e}"}), 500

    if not all_detections:
        return jsonify({"detected": False, "all_detections": []})

    best = max(all_detections, key=lambda d: d["confidence"])
    return jsonify({
        "detected":       True,
        "class":          best["class"],
        "confidence":     best["confidence"],
        "all_detections": all_detections,
    })


# ── Combined Capture + Detect (single round-trip) ────────────────────────────
@app.route("/capture-and-detect", methods=["POST"])
def capture_and_detect():
    """Grab the latest camera frame AND run YOLO in one call.
    Uses the fast JPEG→cv2 path — no PIL, no base64, no extra copies."""
    t0 = time.time()

    if not _cam_ok or not _latest_jpeg:
        return jsonify({"detected": False, "message": "Camera not ready"})

    if not MODEL_LOADED:
        return jsonify({"detected": False, "message": "Model not loaded"})

    # Fast path: decode JPEG with cv2 directly — skips PIL entirely
    jpeg_snap = _latest_jpeg  # snapshot to avoid race
    try:
        all_detections = run_inference_from_jpeg(jpeg_snap)
    except Exception as e:
        return jsonify({"error": f"Inference failed: {e}"}), 500

    elapsed_ms = round((time.time() - t0) * 1000)

    if not all_detections:
        return jsonify({"detected": False, "all_detections": [], "ms": elapsed_ms})

    best = max(all_detections, key=lambda d: d["confidence"])
    return jsonify({
        "detected":       True,
        "class":          best["class"],
        "confidence":     best["confidence"],
        "all_detections": all_detections,
        "ms":             elapsed_ms,
        "engine":         INFERENCE_ENGINE,
    })


if __name__ == "__main__":
    port = int(os.environ.get("DETECTION_PORT", 8001))
    print(f"[INFO] 🚀 Detection service starting on port {port}")
    print(f"[INFO]    Engine: {INFERENCE_ENGINE} | Classes: {list(model_names.values())}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
