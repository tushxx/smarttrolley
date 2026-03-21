#!/usr/bin/env python3
"""
SmartCart — Raspberry Pi PIR + Camera detection script
=======================================================
This script runs on the Raspberry Pi. It:
  1. Waits for the PIR sensor to detect a hand / motion
  2. Activates the Pi camera and captures frames
  3. Sends each frame to the local YOLO detection service (Flask on port 8001)
  4. Applies the same smart confidence logic as the web app frontend
  5. When an item is confirmed, calls the SmartCart server to add it to the cart
  6. Goes back to waiting for the next PIR trigger

WIRING (BCM pin numbers):
  PIR sensor OUT → GPIO 17  (change PIR_PIN below if different)
  Pi camera     → CSI ribbon cable (standard)

SETUP ON PI:
  pip install RPi.GPIO picamera2 requests pillow
  # Then run:
  python3 pi_sensor.py

FIRST TIME: Edit the CONFIG section below.
"""

import time
import base64
import io
import os
import sys
import logging
import requests
from PIL import Image

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
)
log = logging.getLogger("smartcart")

# ═══════════════════════════════════════════════════════════════════
#  CONFIG — edit these before running on the Pi
# ═══════════════════════════════════════════════════════════════════

# SmartCart server URL (Pi and iPad must be on the same WiFi)
SERVER_URL = os.environ.get("SMARTCART_URL", "http://smarttrolley.local:5000")

# Must match IOT_SECRET env var on the server (default: smarttrolley_iot_2024)
IOT_SECRET = os.environ.get("IOT_SECRET", "smarttrolley_iot_2024")

# The phone number used to log in on the iPad
PHONE_NUMBER = os.environ.get("SMARTCART_PHONE", "")

# GPIO BCM pin that the PIR sensor OUT is connected to
PIR_PIN = int(os.environ.get("PIR_PIN", "17"))

# Local YOLO detection service (Flask) — runs on the Pi itself
DETECTION_URL = os.environ.get("DETECTION_URL", "http://127.0.0.1:8001/detect")

# ── Detection thresholds (match the frontend) ──────────────────────
HIGH_CONF      = 0.90   # single frame instant confirm
MED_CONF       = 0.65   # needs CONFIRM_FRAMES consecutive hits
CONFIRM_FRAMES = 3

# ── Timing ─────────────────────────────────────────────────────────
COOLDOWN_SECS    = 4.0   # pause after a confirmed detection before listening again
PIR_DEBOUNCE_S   = 0.5   # wait after PIR first triggers before starting scan (debounce)
CAMERA_WARMUP_S  = 1.5   # seconds to let camera auto-expose before first capture
MAX_SCAN_SECS    = 20.0  # abort scan if nothing confirmed within this time

# ── Image capture settings ─────────────────────────────────────────
CAPTURE_W     = 640
CAPTURE_H     = 480
SEND_W        = 320      # resize to this before sending (smaller → faster)
SEND_H        = 240
JPEG_QUALITY  = 50

# ═══════════════════════════════════════════════════════════════════


def validate_config():
    if not PHONE_NUMBER:
        log.error("PHONE_NUMBER is not set!")
        log.error("  Edit PHONE_NUMBER in pi_sensor.py  OR")
        log.error("  Run:  SMARTCART_PHONE=9876543210 python3 pi_sensor.py")
        sys.exit(1)
    log.info(f"Server:  {SERVER_URL}")
    log.info(f"Phone:   {PHONE_NUMBER}")
    log.info(f"PIR pin: GPIO{PIR_PIN} (BCM)")


def frame_to_b64(array) -> str:
    img = Image.fromarray(array).resize((SEND_W, SEND_H))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY)
    return base64.b64encode(buf.getvalue()).decode()


def send_to_detection(frame_b64: str) -> dict:
    try:
        resp = requests.post(
            DETECTION_URL,
            json={"image": frame_b64},
            timeout=5,
        )
        if resp.ok:
            return resp.json()
    except requests.exceptions.ConnectionError:
        log.warning("Detection service not responding — is Flask running?")
    except Exception as e:
        log.warning(f"Detection request failed: {e}")
    return {"detected": False}


def notify_server(detection_class: str, confidence: float) -> dict | None:
    try:
        resp = requests.post(
            f"{SERVER_URL}/api/iot/detect",
            json={
                "iot_secret":      IOT_SECRET,
                "phone_number":    PHONE_NUMBER,
                "detection_class": detection_class,
                "confidence":      confidence,
            },
            timeout=8,
        )
        data = resp.json()
        if not resp.ok:
            log.warning(f"Server rejected detection: {data.get('message')}")
        return data
    except Exception as e:
        log.warning(f"Could not reach server: {e}")
        return None


def scan_loop(camera) -> tuple[str, float] | None:
    """
    Capture frames and run detection until an item is confirmed.
    Returns (class_name, confidence) or None if timed out.
    """
    hits       = 0
    last_class = None
    started_at = time.time()

    log.info("Scanning for items...")

    while True:
        if time.time() - started_at > MAX_SCAN_SECS:
            log.info(f"No item confirmed after {MAX_SCAN_SECS}s — giving up")
            return None

        try:
            frame_array = camera.capture_array()
        except Exception as e:
            log.warning(f"Camera capture failed: {e}")
            time.sleep(0.1)
            continue

        frame_b64 = frame_to_b64(frame_array)
        result    = send_to_detection(frame_b64)

        if result.get("detected") and result.get("confidence", 0) >= 0.62:
            cls  = result["class"]
            conf = result["confidence"]

            # Class changed → reset streak
            if cls != last_class:
                hits       = 0
                last_class = cls
                log.info(f"New class: {cls}  ({conf:.0%})")

            # Instant confirm at very high confidence
            if conf >= HIGH_CONF:
                log.info(f"Confirmed (instant): {cls}  ({conf:.0%})")
                return cls, conf

            # Accumulate strictly consecutive hits
            if conf >= MED_CONF:
                hits += 1
                log.info(f"{cls}  hit {hits}/{CONFIRM_FRAMES}  ({conf:.0%})")
                if hits >= CONFIRM_FRAMES:
                    log.info(f"Confirmed (consecutive): {cls}  ({conf:.0%})")
                    return cls, conf
            else:
                # Confidence dipped below threshold — reset streak
                hits = 0

        else:
            # Nothing detected
            if last_class:
                log.info("Lost detection — resetting")
            hits       = 0
            last_class = None


def run_with_gpio():
    import RPi.GPIO as GPIO
    from picamera2 import Picamera2

    GPIO.setmode(GPIO.BCM)
    GPIO.setup(PIR_PIN, GPIO.IN)

    cam = Picamera2()
    cfg = cam.create_preview_configuration(main={"size": (CAPTURE_W, CAPTURE_H)})
    cam.configure(cfg)
    cam.start()
    time.sleep(CAMERA_WARMUP_S)

    log.info("=" * 50)
    log.info("SmartCart PIR sensor ready")
    log.info(f"Waiting for motion on GPIO{PIR_PIN}...")
    log.info("=" * 50)

    try:
        while True:
            if GPIO.input(PIR_PIN):
                log.info(">>> PIR triggered — hand detected!")
                time.sleep(PIR_DEBOUNCE_S)   # debounce

                result = scan_loop(cam)

                if result:
                    cls, conf = result
                    log.info(f"Notifying server: {cls}  ({conf:.0%})")
                    server_resp = notify_server(cls, conf)
                    if server_resp:
                        if server_resp.get("alreadyInCart"):
                            log.info(f"Already in cart: {server_resp.get('message')}")
                        else:
                            log.info(f"Cart updated: {server_resp.get('message')}")
                else:
                    log.info("Scan timed out — returning to standby")

                log.info(f"Cooldown {COOLDOWN_SECS}s...")
                time.sleep(COOLDOWN_SECS)

                # Wait for PIR to go LOW before re-arming (prevents re-trigger)
                while GPIO.input(PIR_PIN):
                    time.sleep(0.1)

                log.info("Waiting for next motion...")

            time.sleep(0.05)   # poll at 20 Hz

    finally:
        cam.stop()
        GPIO.cleanup()
        log.info("GPIO cleaned up")


def run_demo_mode():
    """
    Demo/test mode when GPIO is not available (e.g. running on a laptop).
    Simulates a PIR trigger immediately to test the server connection.
    """
    log.warning("=" * 50)
    log.warning("DEMO MODE — GPIO / picamera2 not available")
    log.warning("Simulating a detection for testing purposes...")
    log.warning("=" * 50)

    test_class = "Facewash"
    test_conf  = 0.91
    log.info(f"Simulated detection: {test_class}  ({test_conf:.0%})")
    log.info(f"Notifying server at {SERVER_URL}...")

    result = notify_server(test_class, test_conf)
    if result:
        log.info(f"Server response: {result}")
    else:
        log.error("Could not reach server. Is it running?")


def main():
    validate_config()

    try:
        import RPi.GPIO          # noqa: F401
        from picamera2 import Picamera2  # noqa: F401
        run_with_gpio()
    except ImportError as e:
        log.warning(f"Hardware library not found ({e})")
        run_demo_mode()
    except KeyboardInterrupt:
        log.info("Stopped by user")


if __name__ == "__main__":
    main()
