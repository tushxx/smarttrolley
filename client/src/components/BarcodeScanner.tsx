import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CameraOff, Zap, CheckCircle } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError: (error: Error) => void;
}

export default function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);
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
      }
    } catch (error) {
      const errorMessage = "Camera access denied. Please allow camera permission and try again.";
      setCameraError(errorMessage);
      onError(new Error(errorMessage));
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
    setScanResult(null);
  };

  // Sample products for demonstration
  const sampleProducts = [
    { barcode: "123456789012", name: "Nike Air Max 270", price: "₹129.99" },
    { barcode: "234567890123", name: "Organic Bananas", price: "₹3.49" },
    { barcode: "345678901234", name: "Wireless Headphones", price: "₹89.99" }
  ];

  const simulateBarcodeScan = (barcode: string) => {
    const product = sampleProducts.find(p => p.barcode === barcode);
    if (product) {
      setScanResult(`Found: ${product.name} - ${product.price}`);
      setTimeout(() => {
        setIsScanning(false);
        onScan(barcode);
      }, 1500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Camera Section */}
      <Card>
        <CardContent className="p-6">
          <div className="bg-gray-900 rounded-lg p-4 relative overflow-hidden min-h-[300px] flex items-center justify-center">
            {cameraError ? (
              <div className="text-center text-white">
                <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm mb-4">{cameraError}</p>
                <Button onClick={startCamera} size="sm">
                  Try Again
                </Button>
              </div>
            ) : !isScanning ? (
              <div className="text-center text-white">
                <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm mb-4">Ready to scan barcodes</p>
                <Button onClick={startCamera} size="sm" data-testid="button-start-camera">
                  <Camera className="mr-2 h-4 w-4" />
                  Start Camera
                </Button>
              </div>
            ) : (
              <>
                {/* Video element for camera feed */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-w-sm mx-auto rounded-lg"
                  data-testid="video-camera"
                />
                
                {/* Scanner overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-64 h-48 max-w-full max-h-full">
                    {/* Scanning frame */}
                    <div className="absolute inset-0 border-2 border-accent rounded-lg">
                      {/* Corner indicators */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent"></div>
                      
                      {/* Scanning line */}
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-accent shadow-lg shadow-accent/50 animate-pulse"></div>
                    </div>
                  </div>
                </div>
                
                {/* Camera status */}
                <div className="absolute top-4 left-4 flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                  <span className="text-white text-xs">Camera Active</span>
                </div>
                
                {/* Scan result */}
                {scanResult && (
                  <div className="absolute bottom-16 left-0 right-0 text-center">
                    <div className="inline-flex items-center space-x-2 bg-success text-white px-4 py-2 rounded-lg">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">{scanResult}</span>
                    </div>
                  </div>
                )}
                
                {/* Instructions */}
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <p className="text-white text-sm">
                    {scanResult ? "Adding to cart..." : "Align barcode within the frame"}
                  </p>
                </div>
              </>
            )}
          </div>
          
          {/* Control buttons */}
          {isScanning && (
            <div className="mt-4 flex justify-center">
              <Button
                onClick={stopCamera}
                variant="destructive"
                size="sm"
                data-testid="button-stop-camera"
              >
                <CameraOff className="mr-2 h-4 w-4" />
                Stop Camera
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Test Section */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="mr-2 h-5 w-5 text-primary" />
            Test Barcode Scanner
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Click any button below to simulate scanning a barcode:
          </p>
          <div className="grid grid-cols-1 gap-3">
            {sampleProducts.map((product) => (
              <Button
                key={product.barcode}
                onClick={() => simulateBarcodeScan(product.barcode)}
                variant="outline"
                className="justify-start text-left h-auto p-4"
                data-testid={`button-scan-${product.barcode}`}
              >
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-gray-500">
                    Barcode: {product.barcode} • {product.price}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}