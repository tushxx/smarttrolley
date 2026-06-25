"""
HX711 load-cell interface for Raspberry Pi (BCM numbering).

Wiring (as configured for SmartTrolley):
  DOUT (data) → GPIO 17
  PD_SCK (clock) → GPIO 27

Calibration: write weight_calibration.json next to this file (or path in HX711_CALIBRATION_PATH):
  { "scale": 215.0, "offset": 0 }
  weight_g = (raw - offset) / scale

If RPi.GPIO is unavailable (e.g. Mac dev), the reader returns sensor_ok=false and weight_g=0.
"""

from __future__ import annotations

import json
import os
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any

# BCM pins (user-specified)
DEFAULT_DOUT = 17
DEFAULT_PD_SCK = 27

CALIB_PATH = os.environ.get(
    "HX711_CALIBRATION_PATH",
    str(Path(__file__).resolve().parent / "weight_calibration.json"),
)

_lock = threading.Lock()
_raw_samples: deque[int] = deque(maxlen=12)
_offset = 0.0
# Raw counts per gram until you run POST /weight/calibrate (typical cells: ~100–400).
_scale = float(os.environ.get("HX711_DEFAULT_SCALE", "256.0"))
# Minimum |raw − offset| to accept calibration (counts). Lower if your cell is low-sensitivity.
_MIN_CALIB_DELTA_RAW = int(os.environ.get("HX711_MIN_CALIB_RAW_DELTA", "20"))
_sensor_ok = False
_reader_thread: threading.Thread | None = None
_stop_reader = threading.Event()


def _load_calibration() -> None:
    global _offset, _scale
    try:
        p = Path(CALIB_PATH)
        if p.is_file():
            data = json.loads(p.read_text())
            _offset = float(data.get("offset", 0))
            s = float(data.get("scale", 0))
            if s > 0:
                _scale = s
    except Exception:
        pass


def _save_calibration() -> None:
    try:
        Path(CALIB_PATH).write_text(
            json.dumps({"offset": _offset, "scale": _scale}, indent=2)
        )
    except Exception as e:
        print(f"[HX711] Could not save calibration: {e}")


def _read_raw_once(gpio_mod: Any, dout: int, pd_sck: int) -> int | None:
    """One signed 24-bit conversion (channel A, gain 128)."""
    # Wait until DOUT goes low (data ready)
    for _ in range(80):
        if gpio_mod.input(dout) == 0:
            break
        time.sleep(0.001)
    else:
        return None

    value = 0
    for _ in range(24):
        gpio_mod.output(pd_sck, True)
        gpio_mod.output(pd_sck, False)
        value = (value << 1) | gpio_mod.input(dout)

    # 25th pulse: channel A gain 128
    gpio_mod.output(pd_sck, True)
    gpio_mod.output(pd_sck, False)

    # sign extend 24-bit
    if value & 0x800000:
        value |= ~0xFFFFFF
    return value


def _reader_loop(dout: int, pd_sck: int) -> None:
    global _sensor_ok
    try:
        import RPi.GPIO as GPIO  # type: ignore

        GPIO.setmode(GPIO.BCM)
        GPIO.setup(pd_sck, GPIO.OUT, initial=False)
        GPIO.setup(dout, GPIO.IN)

        _sensor_ok = True
        while not _stop_reader.is_set():
            raw = _read_raw_once(GPIO, dout, pd_sck)
            if raw is not None:
                with _lock:
                    _raw_samples.append(raw)
            time.sleep(0.05)

    except ImportError:
        print("[HX711] RPi.GPIO not installed — weight sensor disabled (install on Pi).")
        _sensor_ok = False
    except Exception as e:
        print(f"[HX711] Reader stopped: {e}")
        _sensor_ok = False


def start_weight_reader(
    dout: int = DEFAULT_DOUT,
    pd_sck: int = DEFAULT_PD_SCK,
) -> None:
    """Start background sampling (idempotent)."""
    global _reader_thread
    _load_calibration()
    if _reader_thread and _reader_thread.is_alive():
        return
    _stop_reader.clear()
    _reader_thread = threading.Thread(
        target=_reader_loop, args=(dout, pd_sck), daemon=True, name="hx711-reader"
    )
    _reader_thread.start()


def stop_weight_reader() -> None:
    _stop_reader.set()
    if _reader_thread:
        _reader_thread.join(timeout=2.0)


def get_smoothed_raw() -> int | None:
    with _lock:
        if len(_raw_samples) < 3:
            return None
        sorted_samples = sorted(_raw_samples)
        # median of inner values (trim extremes)
        core = sorted_samples[1:-1] if len(sorted_samples) > 4 else sorted_samples
        return int(sum(core) / len(core))


def get_weight_grams() -> tuple[float, int | None, bool]:
    """
    Returns (weight_g, raw_or_none, sensor_ok).
    """
    sim = os.environ.get("WEIGHT_SIMULATION_G")
    if sim is not None:
        try:
            return float(sim), None, True
        except ValueError:
            pass

    raw = get_smoothed_raw()
    if raw is None:
        return 0.0, None, _sensor_ok

    w = (_offset - raw) / _scale if _scale else 0.0
return round(float(w), 1), raw, _sensor_ok


def tare() -> dict[str, Any]:
    """Set current smoothed raw as offset (zero displayed weight)."""
    global _offset
    raw = get_smoothed_raw()
    if raw is None:
        return {"ok": False, "message": "No stable reading yet — wait a moment."}
    with _lock:
        _offset = float(raw)
    _save_calibration()
    return {"ok": True, "offset": _offset}


def calibrate_with_known_mass(known_mass_g: float) -> dict[str, Any]:
    """
    Place a known mass (grams) on the scale, then call this (after tare with empty platform).
    Updates scale so displayed weight matches known_mass_g.
    """
    global _scale
    if known_mass_g <= 0:
        return {"ok": False, "message": "known_mass_g must be positive"}

    raw = get_smoothed_raw()
    if raw is None:
        return {
            "ok": False,
            "message": "No stable reading yet — wait 2–3 s after placing weight, then retry.",
            "samples": len(_raw_samples),
        }

    delta_raw = _offset - raw
    if abs(delta_raw) < _MIN_CALIB_DELTA_RAW:
        hint = (
            "The scale reading barely changed vs your last tare. "
            "1) Tare with ONLY the empty basket/platform (no calibration weight). "
            "2) Put the known weight on — do NOT tare again. "
            "3) Wait 2–3 seconds, then POST calibrate again. "
            "If raw/offset are identical, check HX711 wiring (DOUT/SCK swapped is common) "
            "or set HX711_MIN_CALIB_RAW_DELTA=10 if the cell moves very little in raw counts."
        )
        return {
            "ok": False,
            "message": "Raw change too small for calibration",
            "hint": hint,
            "raw_smoothed": raw,
            "offset_from_tare": _offset,
            "delta_raw": delta_raw,
            "min_delta_required": _MIN_CALIB_DELTA_RAW,
        }

    _scale = delta_raw / known_mass_g
    _save_calibration()
    return {"ok": True, "scale": _scale, "message": f"Calibrated: {known_mass_g}g → scale={_scale:.6f}"}


def debug_snapshot() -> dict[str, Any]:
    """For GET /weight/debug — thread-safe peek at internals."""
    with _lock:
        samples = list(_raw_samples)
    raw = get_smoothed_raw()
    w_g, _, ok = get_weight_grams()
    return {
        "sensor_ok": ok,
        "weight_g": w_g,
        "raw_smoothed": raw,
        "offset": _offset,
        "scale": _scale,
        "recent_raw_samples": samples[-12:],
        "sample_count": len(samples),
        "min_calib_delta_raw": _MIN_CALIB_DELTA_RAW,
    }
