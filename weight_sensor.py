"""
HX711 Load Cell Driver — Pure RPi.GPIO implementation
======================================================
No third-party hx711 library needed. Talks directly to the HX711 ADC
via bit-bang on two GPIO pins (DOUT and SCK).

Wiring:
  HX711 VCC  → Pi 5V (or 3.3V)
  HX711 GND  → Pi GND
  HX711 DOUT → GPIO pin (default: 5)
  HX711 SCK  → GPIO pin (default: 6)
  Load cell wires → HX711 E+/E-/A+/A- as per your cell's datasheet

Usage:
  from weight_sensor import WeightSensor
  sensor = WeightSensor(dout_pin=5, sck_pin=6)
  sensor.tare(times=20)
  weight = sensor.get_weight_grams(times=5)
"""

import time
import json
import os
import statistics

# ── GPIO setup ───────────────────────────────────────────────────────────────
try:
    import RPi.GPIO as GPIO  # type: ignore
    GPIO_OK = True
except ImportError:
    GPIO_OK = False
    print("[WARN] RPi.GPIO not available — weight sensor will run in SIMULATION mode")


# Default GPIO pins (BCM numbering)
DEFAULT_DOUT = 11    # HX711 data out
DEFAULT_SCK  = 13    # HX711 clock

# Calibration file path
CALIBRATION_FILE = os.path.join(os.path.dirname(__file__), "weight_calibration.json")


class WeightSensor:
    """
    HX711 load cell interface.

    After construction, call .tare() to zero the scale, then .get_weight_grams()
    to read the current weight.  If a calibration file exists it is loaded
    automatically; otherwise raw ADC counts are returned until you calibrate.
    """

    def __init__(self, dout_pin: int = DEFAULT_DOUT, sck_pin: int = DEFAULT_SCK,
                 gain: int = 128, calibration_file: str = CALIBRATION_FILE):
        self.dout_pin = dout_pin
        self.sck_pin  = sck_pin
        self.gain     = gain  # 128 = Channel A gain 128 (most common)

        # Calibration state
        self.offset           = 0       # raw tare value
        self.calibration_factor = 1.0   # raw_units per gram
        self.calibrated       = False
        self.calibration_file = calibration_file

        # Gain → number of extra pulses after the 24 data bits
        #   gain 128 → 1 pulse  (Channel A, gain 128)
        #   gain  64 → 3 pulses (Channel A, gain 64)
        #   gain  32 → 2 pulses (Channel B, gain 32)
        self._gain_pulses = {128: 1, 64: 3, 32: 2}.get(gain, 1)

        if GPIO_OK:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            GPIO.setup(self.dout_pin, GPIO.IN)
            GPIO.setup(self.sck_pin,  GPIO.OUT)
            GPIO.output(self.sck_pin, False)
            print(f"[WEIGHT] GPIO initialized — DOUT={dout_pin}, SCK={sck_pin}, gain={gain}")
        else:
            print("[WEIGHT] Running in simulation mode (no GPIO)")

        # Load calibration if available
        self._load_calibration()

    # ── Raw HX711 read ───────────────────────────────────────────────────────
    def _read_raw(self) -> int:
        """Read one raw 24-bit signed value from the HX711."""
        if not GPIO_OK:
            # Simulation: return a fake value that drifts slightly
            import random
            return 500000 + random.randint(-200, 200)

        # Wait for DOUT to go LOW (data ready)
        timeout = time.time() + 2.0
        while GPIO.input(self.dout_pin):
            if time.time() > timeout:
                raise TimeoutError("HX711 not responding (DOUT stuck HIGH). Check wiring.")
            time.sleep(0.001)

        # Clock out 24 bits (MSB first)
        value = 0
        for _ in range(24):
            GPIO.output(self.sck_pin, True)
            time.sleep(0.000001)  # 1 μs pulse
            value = (value << 1) | GPIO.input(self.dout_pin)
            GPIO.output(self.sck_pin, False)
            time.sleep(0.000001)

        # Extra pulses to set gain for NEXT read
        for _ in range(self._gain_pulses):
            GPIO.output(self.sck_pin, True)
            time.sleep(0.000001)
            GPIO.output(self.sck_pin, False)
            time.sleep(0.000001)

        # Convert 24-bit two's complement to signed int
        if value & 0x800000:
            value -= 0x1000000

        return value

    def read_raw_average(self, times: int = 10) -> float:
        """Read multiple raw values, discard outliers, return the median."""
        readings = []
        for _ in range(times):
            try:
                readings.append(self._read_raw())
            except TimeoutError:
                continue
            time.sleep(0.01)  # HX711 sample rate is 10 or 80 Hz

        if not readings:
            raise RuntimeError("No valid readings from HX711")

        # Use median to reject outliers (much more robust than mean)
        return statistics.median(readings)

    # ── Tare (zero the scale) ────────────────────────────────────────────────
    def tare(self, times: int = 20):
        """Zero the scale. Call with nothing on the scale."""
        print(f"[WEIGHT] Taring (averaging {times} samples)...")
        self.offset = self.read_raw_average(times)
        print(f"[WEIGHT] Tare offset = {self.offset:.0f}")

    # ── Weight reading ───────────────────────────────────────────────────────
    def get_raw_minus_offset(self, times: int = 5) -> float:
        """Get raw reading minus tare offset."""
        return self.read_raw_average(times) - self.offset

    def get_weight_grams(self, times: int = 5) -> float:
        """Get weight in grams. Requires calibration."""
        raw = self.get_raw_minus_offset(times)
        if self.calibration_factor == 0:
            return 0.0
        grams = raw / self.calibration_factor
        return round(grams, 1)

    # ── Calibration ──────────────────────────────────────────────────────────
    def calibrate(self, known_weight_grams: float, times: int = 20):
        """
        Calibrate using a known weight.
        Call .tare() first with empty scale, then place the known weight
        and call this method.
        """
        print(f"[WEIGHT] Calibrating with {known_weight_grams}g reference...")
        raw = self.get_raw_minus_offset(times)
        if raw == 0:
            raise ValueError("Raw reading is 0 — load cell not responding or weight too light")
        self.calibration_factor = raw / known_weight_grams
        self.calibrated = True
        print(f"[WEIGHT] Calibration factor = {self.calibration_factor:.2f} raw_units/gram")
        self._save_calibration()

    def _save_calibration(self):
        """Save calibration data to JSON file."""
        data = {
            "offset": self.offset,
            "calibration_factor": self.calibration_factor,
            "gain": self.gain,
            "dout_pin": self.dout_pin,
            "sck_pin": self.sck_pin,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        with open(self.calibration_file, "w") as f:
            json.dump(data, f, indent=2)
        print(f"[WEIGHT] ✅ Calibration saved to {self.calibration_file}")

    def _load_calibration(self):
        """Load calibration data from JSON file if it exists."""
        if not os.path.exists(self.calibration_file):
            print("[WEIGHT] No calibration file found — run weight_calibration.py first")
            return

        try:
            with open(self.calibration_file) as f:
                data = json.load(f)
            self.offset             = data["offset"]
            self.calibration_factor = data["calibration_factor"]
            self.calibrated         = True
            print(f"[WEIGHT] ✅ Loaded calibration — factor={self.calibration_factor:.2f}, offset={self.offset:.0f}")
        except Exception as e:
            print(f"[WEIGHT] Failed to load calibration: {e}")

    # ── Power management ─────────────────────────────────────────────────────
    def power_down(self):
        """Put HX711 to sleep (pull SCK high for >60μs)."""
        if GPIO_OK:
            GPIO.output(self.sck_pin, True)
            time.sleep(0.0001)

    def power_up(self):
        """Wake HX711 from sleep."""
        if GPIO_OK:
            GPIO.output(self.sck_pin, False)
            time.sleep(0.001)

    def cleanup(self):
        """Release GPIO resources."""
        if GPIO_OK:
            GPIO.cleanup([self.dout_pin, self.sck_pin])
            print("[WEIGHT] GPIO cleaned up")

    def __del__(self):
        try:
            self.cleanup()
        except Exception:
            pass
