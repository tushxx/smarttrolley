import cv2
from ultralytics import YOLO

# Load your trained model
MODEL_PATH = "my_model.pt"
model = YOLO(MODEL_PATH)
print(f"[INFO] Loaded model: {MODEL_PATH}")

# Open webcam (0 = default camera)
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("[ERROR] Could not open camera.")
    exit(1)

print("[INFO] Camera opened. Press 'q' to quit.")

while True:
    ret, frame = cap.read()
    if not ret:
        print("[ERROR] Failed to grab frame.")
        break

    # Run inference
    results = model(frame, verbose=False)

    # Draw results on frame
    annotated_frame = results[0].plot()

    # Show the frame
    cv2.imshow("YOLO Detection - Press Q to Quit", annotated_frame)

    # Quit on 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("[INFO] Camera closed.")
