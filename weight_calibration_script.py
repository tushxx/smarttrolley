#!/usr/bin/env python3
"""
HX711 Load Cell Calibration Script
====================================
Run this ON the Raspberry Pi with the load cell connected.

  python3 weight_calibration.py

Steps:
  1. Reads raw ADC values to verify wiring
  2. Tares (zeros) the scale with nothing on it
  3. Asks you to place a KNOWN weight (e.g., 100g water bottle)
  4. Calculates and saves calibration factor to weight_calibration.json
  5. Verifies by reading the known weight back

After calibration, the main detection_service.py will auto-load
the calibration and use it for two-factor (camera + weight) detection.

GPIO wiring (BCM numbering):
  HX711 DOUT → GPIO 5  (pin 29)
  HX711 SCK  → GPIO 6  (pin 31)
  HX711 VCC  → 5V      (pin 2 or 4)
  HX711 GND  → GND     (pin 6 or 9)

Change DOUT_PIN and SCK_PIN below if you used different GPIO pins.
"""

import sys
import time

# ── Configuration ────────────────────────────────────────────────────────────
DOUT_PIN = 11   # GPIO pin connected to HX711 DOUT
SCK_PIN  = 13   # GPIO pin connected to HX711 SCK
GAIN     = 128  # Channel A, gain 128 (most common for single load cell)


def print_header():
    print()
    print("=" * 60)
    print("   HX711 LOAD CELL CALIBRATION")
    print("   Smart Trolley Weight Sensor")
    print("=" * 60)
    print()
    print(f"   DOUT pin : GPIO {DOUT_PIN}")
    print(f"   SCK  pin : GPIO {SCK_PIN}")
    print(f"   Gain     : {GAIN}")
    print()


def main():
    print_header()

    # Import the sensor module
    try:
        from weight_sensor import WeightSensor
    except ImportError as e:
        print(f"❌ Cannot import weight_sensor: {e}")
        print("   Make sure weight_sensor.py is in the same directory")
        sys.exit(1)

    sensor = WeightSensor(dout_pin=DOUT_PIN, sck_pin=SCK_PIN, gain=GAIN)

    # ── Step 1: Test raw readings ────────────────────────────────────────────
    print("─" * 60)
    print("STEP 1: Testing HX711 connection")
    print("─" * 60)
    print()
    print("Reading 5 raw values to verify wiring...")
    print()

    try:
        for i in range(5):
            raw = sensor._read_raw()
            print(f"  Reading {i+1}: {raw:>10}")
            time.sleep(0.2)
    except TimeoutError as e:
        print(f"\n❌ ERROR: {e}")
        print()
        print("Troubleshooting:")
        print("  1. Check HX711 DOUT is connected to GPIO {DOUT_PIN}")
        print("  2. Check HX711 SCK  is connected to GPIO {SCK_PIN}")
        print("  3. Check HX711 VCC  is connected to 5V or 3.3V")
        print("  4. Check HX711 GND  is connected to Pi GND")
        print("  5. Check load cell wires to HX711 E+/E-/A+/A-")
        sys.exit(1)

    print()
    print("✅ HX711 is responding!")
    print()

    # ── Step 2: Tare ─────────────────────────────────────────────────────────
    print("─" * 60)
    print("STEP 2: Tare (zero the scale)")
    print("─" * 60)
    print()
    input("👉 Remove EVERYTHING from the scale, then press ENTER...")
    print()

    print("Taring (averaging 30 samples for accuracy)...")
    sensor.tare(times=30)
    print()
    print(f"✅ Tare complete! Offset = {sensor.offset:.0f}")
    print()

    # Verify tare is stable
    print("Verifying tare stability (5 readings should be near 0)...")
    for i in range(5):
        raw = sensor.get_raw_minus_offset(times=3)
        grams_uncal = raw  # before calibration, just raw units
        print(f"  Reading {i+1}: {raw:>10.0f} raw units")
        time.sleep(0.3)
    print()

    # ── Step 3: Calibration with known weight ────────────────────────────────
    print("─" * 60)
    print("STEP 3: Calibration with known weight")
    print("─" * 60)
    print()
    print("You need a reference object with a KNOWN weight.")
    print("Examples:")
    print("  • 500ml water bottle (full) = 500g")
    print("  • 200ml Frooti pack         = 210g")
    print("  • Standard smartphone       = 150-200g")
    print("  • Kitchen scale weights      = exact")
    print()

    while True:
        try:
            known_weight = float(input("👉 Enter the known weight in GRAMS: ").strip())
            if known_weight <= 0:
                print("   Weight must be positive!")
                continue
            break
        except ValueError:
            print("   Please enter a number (e.g., 500)")

    print()
    input(f"👉 Place the {known_weight}g object on the scale, then press ENTER...")
    print()

    print("Wait... let the reading stabilize (3 seconds)...")
    time.sleep(3)

    print("Calibrating (averaging 30 samples)...")
    try:
        sensor.calibrate(known_weight_grams=known_weight, times=30)
    except ValueError as e:
        print(f"\n❌ Calibration failed: {e}")
        print("   The load cell may not be wired correctly.")
        sys.exit(1)

    print()
    print(f"✅ Calibration factor = {sensor.calibration_factor:.4f} raw_units/gram")
    print()

    # ── Step 4: Verify ───────────────────────────────────────────────────────
    print("─" * 60)
    print("STEP 4: Verification")
    print("─" * 60)
    print()
    print(f"The {known_weight}g object should still be on the scale.")
    print("Reading weight 5 times to verify accuracy...")
    print()

    weights = []
    for i in range(5):
        w = sensor.get_weight_grams(times=5)
        weights.append(w)
        error = abs(w - known_weight)
        pct   = (error / known_weight) * 100
        status = "✅" if pct < 5 else "⚠️" if pct < 10 else "❌"
        print(f"  Reading {i+1}: {w:>8.1f}g  (error: {error:.1f}g = {pct:.1f}%)  {status}")
        time.sleep(0.5)

    avg = sum(weights) / len(weights)
    avg_error = abs(avg - known_weight)
    avg_pct   = (avg_error / known_weight) * 100

    print()
    print(f"  Average:  {avg:.1f}g  (error: {avg_error:.1f}g = {avg_pct:.1f}%)")
    print()

    if avg_pct < 5:
        print("🎉 EXCELLENT! Calibration is accurate (< 5% error)")
    elif avg_pct < 10:
        print("✅ GOOD. Calibration is acceptable (< 10% error)")
        print("   For better accuracy, try re-running with a heavier reference weight.")
    else:
        print("⚠️  HIGH ERROR. Calibration may be inaccurate.")
        print("   Suggestions:")
        print("   • Use a heavier reference weight (500g+)")
        print("   • Check load cell is firmly bolted at both ends")
        print("   • Check wiring (red→E+, black→E-, white→A+, green→A-)")
        print("   • Make sure the scale surface is level")

    # ── Step 5: Remove object ────────────────────────────────────────────────
    print()
    input("👉 Remove the object from the scale, then press ENTER...")
    print()

    print("Zero check (should read ~0g)...")
    for i in range(3):
        w = sensor.get_weight_grams(times=5)
        print(f"  Reading {i+1}: {w:>8.1f}g")
        time.sleep(0.3)

    print()

    # ── Step 6: Live monitoring mode ─────────────────────────────────────────
    print("─" * 60)
    print("STEP 5: Live weight monitor (Ctrl+C to exit)")
    print("─" * 60)
    print()
    print("Place items on/off the scale to test. Press Ctrl+C to stop.")
    print()

    try:
        while True:
            w = sensor.get_weight_grams(times=3)
            bar_len = max(0, min(int(w / 10), 50))
            bar = "█" * bar_len
            print(f"\r  Weight: {w:>8.1f}g  {bar:<50s}", end="", flush=True)
            time.sleep(0.3)
    except KeyboardInterrupt:
        print("\n")
        print("✅ Calibration complete! Data saved to weight_calibration.json")
        print()
        print("The detection service will auto-load this calibration on startup.")
        print("Run the trolley app normally:  npm run dev")
        print()

    sensor.cleanup()


if __name__ == "__main__":
    main()
