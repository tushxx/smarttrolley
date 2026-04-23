"""
YOLO Item Detection Service — with Pi Camera streaming
=======================================================
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
            import cv2  # noqa: F401
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
    from PIL import Image
    PIL_OK = True
except ImportError:
    PIL_OK = False
    print("[WARN] Pillow not installed. Image decoding will fail.")

# ── YOLO Model ───────────────────────────────────────────────────────────────
MODEL_LOADED = False
model = None

MODEL_PATHS = [
    "attached_assets/my_model_1774040104348.pt",
    "my_model.pt",
    "model.pt",
]

INFERENCE_SIZE = 320
CONFIDENCE_THRESHOLD = 0.62


def load_model():
    global model, MODEL_LOADED
    if not ULTRALYTICS_OK:
        print("[WARN] ultralytics unavailable.")
        return
    try:
        from ultralytics import YOLO
        import numpy as np
        for path in MODEL_PATHS:
            if os.path.exists(path):
                print(f"[INFO] Loading YOLO model from: {path}")
                model = YOLO(path)
                MODEL_LOADED = True
                print(f"[INFO] ✅ Model loaded. Classes: {model.names}")

                # Warmup
                print("[INFO] Warming up model…")
                dummy = Image.fromarray(
                    __import__("numpy").zeros((INFERENCE_SIZE, INFERENCE_SIZE, 3), dtype="uint8")
                )
                model(dummy, verbose=False, imgsz=INFERENCE_SIZE)
                print("[INFO] ✅ Model warm — first real inference will be fast")
                return
        print("[WARN] No model file found. Looked for:", MODEL_PATHS)
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
        from picamera2 import Picamera2
        import cv2

        cam = Picamera2()
        cfg = cam.create_video_configuration(
            main={"size": (640, 360), "format": "RGB888"},
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
        import cv2

        for idx in range(4):
            cap = cv2.VideoCapture(idx)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 360)
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
        "inference_size": INFERENCE_SIZE,
        "model_classes": list(model.names.values()) if MODEL_LOADED else [],
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

    if image.width > INFERENCE_SIZE or image.height > INFERENCE_SIZE:
        image = image.resize((INFERENCE_SIZE, INFERENCE_SIZE), Image.BILINEAR)

    if not MODEL_LOADED or model is None:
        return jsonify({"detected": False, "message": "Model not loaded"})

    try:
        results = model(image, verbose=False, imgsz=INFERENCE_SIZE)
    except Exception as e:
        return jsonify({"error": f"Inference failed: {e}"}), 500

    all_detections = []
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            conf    = float(box.conf[0])
            cls_id  = int(box.cls[0])
            cls_name = model.names.get(cls_id, str(cls_id))
            if conf >= CONFIDENCE_THRESHOLD:
                all_detections.append({
                    "class":      cls_name,
                    "confidence": round(conf, 3),
                    "class_id":   cls_id,
                })

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
    This eliminates the extra HTTP round-trip of capture → detect."""
    t0 = time.time()

    if not _cam_ok or not _latest_jpeg:
        return jsonify({"detected": False, "message": "Camera not ready"})

    if not MODEL_LOADED or model is None:
        return jsonify({"detected": False, "message": "Model not loaded"})

    if not PIL_OK:
        return jsonify({"error": "Pillow not installed"}), 500

    try:
        image = Image.open(io.BytesIO(_latest_jpeg)).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"Frame decode failed: {e}"}), 500

    if image.width > INFERENCE_SIZE or image.height > INFERENCE_SIZE:
        image = image.resize((INFERENCE_SIZE, INFERENCE_SIZE), Image.BILINEAR)

    try:
        results = model(image, verbose=False, imgsz=INFERENCE_SIZE)
    except Exception as e:
        return jsonify({"error": f"Inference failed: {e}"}), 500

    all_detections = []
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            conf     = float(box.conf[0])
            cls_id   = int(box.cls[0])
            cls_name = model.names.get(cls_id, str(cls_id))
            if conf >= CONFIDENCE_THRESHOLD:
                all_detections.append({
                    "class":      cls_name,
                    "confidence": round(conf, 3),
                    "class_id":   cls_id,
                })

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
    })


if __name__ == "__main__":
    port = int(os.environ.get("DETECTION_PORT", 8001))
    print(f"[INFO] 🚀 Detection service starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
