import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CameraOff, Zap, CheckCircle, AlertCircle } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError: (error: Error) => void;
}

export default function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = "barcode-scanner-region";

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);
      setIsScanning(true); // Set this first so the div renders
      
      // Wait for the DOM element to be available
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // First, check if we have permission
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // Request camera permission explicitly
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
          });
          // Stop the test stream
          stream.getTracks().forEach(track => track.stop());
        } catch (permError: any) {
          console.error("Camera permission error:", permError);
          throw new Error("Camera permission denied. Please allow camera access in your browser settings and refresh the page.");
        }
      }
      
      // Check if element exists
      const element = document.getElementById(scannerDivId);
      if (!element) {
        throw new Error("Scanner element not ready. Please try again.");
      }
      
      // Initialize Html5Qrcode if not already done
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerDivId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ]
        });
      }

      // Start scanning
      await html5QrCodeRef.current.start(
        { facingMode: "environment" }, // Use back camera on mobile
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.7777778,
        },
        (decodedText, decodedResult) => {
          // Success callback when barcode is scanned
          console.log(`Barcode scanned: ${decodedText}`, decodedResult);
          handleSuccessfulScan(decodedText);
        },
        (errorMessage) => {
          // Error callback (called continuously when no barcode is found)
          // We don't want to show these errors as they're normal
        }
      );

    } catch (error: any) {
      console.error("Camera start error:", error);
      let errorMessage = "Unable to start camera. ";
      
      const errorMsg = error?.message || String(error) || "";
      
      if (errorMsg.includes("permission") || errorMsg.includes("denied") || errorMsg.includes("NotAllowedError")) {
        errorMessage = "Camera permission denied. Please:\n1. Allow camera access in browser settings\n2. Make sure you're using HTTPS\n3. Refresh the page and try again";
      } else if (errorMsg.includes("NotFoundError") || errorMsg.includes("no camera") || errorMsg.includes("OverconstrainedError")) {
        errorMessage = "No camera found. Please check if your device has a camera.";
      } else if (errorMsg.includes("not found") || errorMsg.includes("not ready")) {
        errorMessage = "Scanner not ready. Please wait a moment and try again.";
      } else if (errorMsg) {
        errorMessage += errorMsg;
      } else {
        errorMessage += "Please try again.";
      }
      
      setCameraError(errorMessage);
      onError(new Error(errorMessage));
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    try {
      if (html5QrCodeRef.current && isScanning) {
        await html5QrCodeRef.current.stop();
        setScanResult(null);
      }
    } catch (error) {
      console.error("Error stopping camera:", error);
    }
    setIsScanning(false);
    setCameraError(null);
  };

  const handleSuccessfulScan = (barcode: string) => {
    setScanResult(`Scanned: ${barcode}`);
    
    // Stop scanning briefly to show success message
    setTimeout(() => {
      setIsScanning(false);
      stopCamera().then(() => {
        onScan(barcode);
      });
    }, 1000);
  };

  // Sample products for demonstration
  const sampleProducts = [
    { barcode: "123456789012", name: "Nike Air Max 270", price: "₹12,999" },
    { barcode: "234567890123", name: "Organic Bananas", price: "₹349" },
    { barcode: "345678901234", name: "Wireless Headphones", price: "₹8,999" }
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
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-4 relative overflow-hidden min-h-[300px] flex items-center justify-center border border-green-500/20 shadow-2xl">
            {cameraError ? (
              <div className="text-center text-white px-4">
                <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
                <p className="text-sm mb-4 whitespace-pre-line">{cameraError}</p>
                <div className="space-y-2">
                  <Button onClick={startCamera} size="sm" variant="outline" className="bg-white text-black hover:bg-gray-100">
                    Try Again
                  </Button>
                  <p className="text-xs text-gray-400 mt-2">
                    Or use the test barcodes below
                  </p>
                </div>
              </div>
            ) : !isScanning ? (
              <div className="text-center text-white">
                <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm mb-2">Ready to scan barcodes</p>
                <p className="text-xs text-gray-400 mb-4">Camera will activate when you start scanning</p>
                <Button onClick={startCamera} size="sm" data-testid="button-start-camera">
                  <Camera className="mr-2 h-4 w-4" />
                  Start Scanning
                </Button>
              </div>
            ) : (
              <div className="w-full relative">
                {/* Scanner container */}
                <div id={scannerDivId} className="w-full max-w-md mx-auto"></div>
                
                {/* Camera status */}
                <div className="absolute top-4 left-4 flex items-center space-x-2 z-10">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">Camera Active</span>
                </div>
                
                {/* Scan result */}
                {scanResult && (
                  <div className="absolute bottom-4 left-0 right-0 text-center z-10">
                    <div className="inline-flex items-center space-x-2 bg-green-500 text-white px-4 py-2 rounded-lg">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">{scanResult}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Control buttons */}
          {isScanning && (
            <div className="mt-4 flex justify-center space-x-3">
              <Button
                onClick={stopCamera}
                variant="destructive"
                size="sm"
                data-testid="button-stop-camera"
              >
                <CameraOff className="mr-2 h-4 w-4" />
                Stop Scanning
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
            Don't have a barcode? Use these test products:
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
