import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError: (error: Error) => void;
}

export default function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsScanning(true);
        
        // Start scanning after video loads
        videoRef.current.addEventListener('loadedmetadata', () => {
          scanForBarcode();
        });
      }
    } catch (error) {
      onError(new Error("Camera access denied or not available"));
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  const scanForBarcode = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for barcode detection
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Simple barcode detection simulation
    // In a real implementation, you would use a library like ZXing or QuaggaJS
    simulateBarcodeDetection(imageData);

    // Continue scanning
    if (isScanning) {
      setTimeout(() => scanForBarcode(), 100);
    }
  };

  const simulateBarcodeDetection = (imageData: ImageData) => {
    // This is a simplified simulation
    // In production, use a proper barcode detection library
    
    // For demo purposes, detect "barcode" patterns by looking for high contrast regions
    const data = imageData.data;
    let highContrastRegions = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;
      
      if (brightness < 50 || brightness > 200) {
        highContrastRegions++;
      }
    }
    
    // If we detect enough high contrast regions, simulate finding a barcode
    if (highContrastRegions > data.length / 20) {
      // Simulate different sample barcodes for testing
      const sampleBarcodes = ["123456789012", "234567890123", "345678901234"];
      const randomBarcode = sampleBarcodes[Math.floor(Math.random() * sampleBarcodes.length)];
      
      // Stop scanning and report the barcode
      setIsScanning(false);
      onScan(randomBarcode);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 relative overflow-hidden">
      {/* Video element for camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full max-w-sm mx-auto rounded-lg"
        data-testid="video-camera"
      />
      
      {/* Hidden canvas for image processing */}
      <canvas
        ref={canvasRef}
        className="hidden"
      />
      
      {/* Scanner overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-64 h-64 max-w-full max-h-full">
          {/* Scanning frame */}
          <div className="absolute inset-0 border-2 border-accent rounded-lg">
            {/* Corner indicators */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent"></div>
            
            {/* Scanning line */}
            {isScanning && (
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-accent shadow-lg shadow-accent/50 animate-pulse"></div>
            )}
          </div>
        </div>
      </div>
      
      {/* Camera status */}
      <div className="absolute top-4 left-4 flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-accent animate-pulse' : 'bg-gray-500'}`}></div>
        <span className="text-white text-xs">
          {isScanning ? 'Camera Active' : 'Camera Inactive'}
        </span>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-white text-sm">Align barcode within the frame</p>
      </div>
      
      {/* Control button */}
      <div className="mt-4 text-center">
        <Button
          onClick={isScanning ? stopCamera : startCamera}
          variant={isScanning ? "destructive" : "default"}
          size="sm"
          data-testid="button-camera-toggle"
        >
          {isScanning ? (
            <>
              <CameraOff className="mr-2 h-4 w-4" />
              Stop Camera
            </>
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              Start Camera
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
