"""
YOLO Item Detection Service
Runs on port 8001, receives base64 image frames from the Express server,
runs inference using the trained YOLO model, and returns detected class names.
Optimised for low-latency inference:
  - Threaded Flask (no request queuing)
  - Image resized to 320x320 before inference
  - Model warmed up on startup (eliminates first-request lag)
"""

import sys
import os
import base64
import io
import subprocess
import traceback
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

# ── Pi Camera Setup ──────────────────────────────────────────────────────────
import threading
import time

camera_lock  = threading.Lock()
_pi_camera   = None   # picamera2 instance
_cv_camera   = None   # OpenCV VideoCapture fallback
_cam_mode    = None   # "picamera2" | "opencv" | None

def _init_camera():
    global _pi_camera, _cv_camera, _cam_mode
    # Try picamera2 first (native Pi camera)
    try:
        from picamera2 import Picamera2
        cam = Picamera2()
        config = cam.create_video_configuration(
            main={"size": (640, 480), "format": "RGB888"}
        )
        cam.configure(config)
        cam.start()
        time.sleep(0.5)  # warm-up
        _pi_camera = cam
        _cam_mode  = "picamera2"
        print("[INFO] ✅ Pi camera initialised via picamera2")
        return
    except Exception as e:
        print(f"[INFO] picamera2 unavailable ({e}), trying OpenCV…")

    # Fallback: OpenCV VideoCapture (USB or CSI with v4l2)
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        if cap.isOpened():
            cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            _cv_camera = cap
            _cam_mode  = "opencv"
            print("[INFO] ✅ Pi camera initialised via OpenCV VideoCapture")
            return
    except Exception as e2:
        print(f"[WARN] OpenCV camera also unavailable: {e2}")

    print("[WARN] No Pi camera found — /stream and /capture will return errors.")

_init_camera()

def _capture_frame_jpeg(quality: int = 80):
    """Capture one frame from the Pi camera and return raw JPEG bytes."""
    with camera_lock:
        if _cam_mode == "picamera2":
            import numpy as np, cv2
            frame = _pi_camera.capture_array()
            # picamera2 gives RGB — convert to BGR for cv2.imencode
            bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
            return bytes(buf) if ok else None
        elif _cam_mode == "opencv":
            import cv2
            ok, frame = _cv_camera.read()
            if not ok:
                return None
            ok2, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
            return bytes(buf) if ok2 else None
    return None

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

INFERENCE_SIZE = 320        # px — smaller = faster, still accurate
CONFIDENCE_THRESHOLD = 0.62   # raise floor — eliminates weak ghost detections


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

                # ── Warmup: run one blank inference to JIT-compile the model ──
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

# ── Flask app (threaded=True → concurrent requests, no queuing) ─────────────
app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": MODEL_LOADED,
        "ultralytics_ok": ULTRALYTICS_OK,
        "inference_size": INFERENCE_SIZE,
        "model_classes": list(model.names.values()) if MODEL_LOADED else [],
    })


@app.route("/detect", methods=["POST"])
def detect():
    if not PIL_OK:
        return jsonify({"error": "Pillow not installed"}), 500

    data = request.get_json(silent=True)
    if not data or "image" not in data:
        return jsonify({"error": "No image in request body"}), 400

    # ── Decode base64 → PIL Image ─────────────────────────────────────────────
    try:
        img_data = data["image"]
        if "," in img_data:
            img_data = img_data.split(",", 1)[1]
        img_bytes = base64.b64decode(img_data)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"Invalid image data: {e}"}), 400

    # ── Resize to inference size for speed ────────────────────────────────────
    if image.width > INFERENCE_SIZE or image.height > INFERENCE_SIZE:
        image = image.resize((INFERENCE_SIZE, INFERENCE_SIZE), Image.BILINEAR)

    if not MODEL_LOADED or model is None:
        return jsonify({"detected": False, "message": "Model not loaded"})

    # ── YOLO inference ────────────────────────────────────────────────────────
    try:
        results = model(image, verbose=False, imgsz=INFERENCE_SIZE)
    except Exception as e:
        return jsonify({"error": f"Inference failed: {e}"}), 500

    # ── Parse detections ──────────────────────────────────────────────────────
    all_detections = []
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = model.names.get(cls_id, str(cls_id))
            if conf >= CONFIDENCE_THRESHOLD:
                all_detections.append({
                    "class": cls_name,
                    "confidence": round(conf, 3),
                    "class_id": cls_id,
                })

    if not all_detections:
        return jsonify({"detected": False, "all_detections": []})

    best = max(all_detections, key=lambda d: d["confidence"])
    return jsonify({
        "detected": True,
        "class": best["class"],
        "confidence": best["confidence"],
        "all_detections": all_detections,
    })


# ── Pi Camera Streaming Endpoints ────────────────────────────────────────────

@app.route("/capture", methods=["GET"])
def capture():
    """Return a single JPEG frame as base64 JSON for YOLO detection."""
    if _cam_mode is None:
        return jsonify({"error": "No Pi camera available"}), 503
    jpeg = _capture_frame_jpeg(quality=70)
    if jpeg is None:
        return jsonify({"error": "Failed to capture frame"}), 500
    b64 = base64.b64encode(jpeg).decode()
    return jsonify({"image": f"data:image/jpeg;base64,{b64}"})


def _mjpeg_generator():
    """Yield MJPEG multipart frames continuously."""
    while True:
        jpeg = _capture_frame_jpeg(quality=60)
        if jpeg:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
            )
        else:
            time.sleep(0.05)


@app.route("/stream", methods=["GET"])
def stream():
    """MJPEG live stream from the Pi camera."""
    if _cam_mode is None:
        return jsonify({"error": "No Pi camera available"}), 503
    return Response(
        stream_with_context(_mjpeg_generator()),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


if __name__ == "__main__":
    port = int(os.environ.get("DETECTION_PORT", 8001))
    print(f"[INFO] 🚀 Detection service starting on port {port}")
    # threaded=True: each request handled in its own thread → no blocking
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
