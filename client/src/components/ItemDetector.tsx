import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Loader2, CheckCircle, X } from "lucide-react";

interface Detection {
  class: string;
  confidence: number;
}

interface DetectionResult {
  detected: boolean;
  class?: string;
  confidence?: number;
  productFound?: boolean;
  product?: {
    id: string;
    name: string;
    brand: string | null;
    price: string;
    imageUrl: string | null;
    detectionClass: string;
  };
  allDetections?: Detection[];
  message?: string;
}

interface ItemDetectorProps {
  onItemDetected: (product: DetectionResult["product"]) => void;
  onClose: () => void;
}

const FRAME_INTERVAL_MS = 1500;   // send frame every 1.5 s
const CONFIRM_FRAMES    = 2;       // consecutive detections before auto-confirm

export default function ItemDetector({ onItemDetected, onClose }: ItemDetectorProps) {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const intervalRef     = useRef<NodeJS.Timeout | null>(null);
  const confirmsRef     = useRef<Record<string, number>>({});
  const stoppedRef      = useRef(false);

  const [cameraActive,   setCameraActive]   = useState(false);
  const [detecting,      setDetecting]      = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [liveResult,     setLiveResult]     = useState<DetectionResult | null>(null);
  const [confirmedItem,  setConfirmedItem]  = useState<DetectionResult | null>(null);
  const [serviceOnline,  setServiceOnline]  = useState<boolean | null>(null);

  // Check whether the detection service is running
  useEffect(() => {
    fetch("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "" }),
    })
      .then(() => setServiceOnline(true))
      .catch(() => setServiceOnline(false));
  }, []);

  const stopCamera = useCallback(() => {
    stoppedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setDetecting(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    stoppedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (e: any) {
      setError(`Camera error: ${e.message}`);
    }
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    // Return as JPEG base64 (smaller than PNG)
    return canvas.toDataURL("image/jpeg", 0.7);
  }, []);

  const sendFrame = useCallback(async () => {
    if (stoppedRef.current) return;
    const frame = captureFrame();
    if (!frame) return;

    setDetecting(true);
    try {
      const resp = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: frame }),
      });
      if (!resp.ok) return;

      const data: DetectionResult = await resp.json();
      if (stoppedRef.current) return;

      setLiveResult(data);

      if (data.detected && data.productFound && data.class) {
        // Track consecutive detections of the same class
        confirmsRef.current[data.class] = (confirmsRef.current[data.class] || 0) + 1;

        if (confirmsRef.current[data.class] >= CONFIRM_FRAMES) {
          // Confirmed — stop scanning and bubble up
          stopCamera();
          setConfirmedItem(data);
        }
      } else {
        // Reset counters for stale classes
        confirmsRef.current = {};
      }
    } catch {
      // network error — keep scanning
    } finally {
      setDetecting(false);
    }
  }, [captureFrame, stopCamera]);

  // Start sending frames once camera is active
  useEffect(() => {
    if (!cameraActive) return;
    confirmsRef.current = {};
    intervalRef.current = setInterval(sendFrame, FRAME_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cameraActive, sendFrame]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleConfirm = () => {
    if (confirmedItem?.product) {
      onItemDetected(confirmedItem.product);
    }
  };

  const handleRescan = () => {
    setConfirmedItem(null);
    setLiveResult(null);
    confirmsRef.current = {};
    stoppedRef.current = false;
    startCamera();
  };

  const confidencePct = liveResult?.confidence
    ? Math.round(liveResult.confidence * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Service status */}
      {serviceOnline === false && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          ⚠️ Detection service is starting up. Camera detection will begin shortly.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Confirmed item card */}
      {confirmedItem?.product ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <CheckCircle className="w-5 h-5" />
              Item Detected!
            </div>
            {confirmedItem.product.imageUrl && (
              <img
                src={confirmedItem.product.imageUrl}
                alt={confirmedItem.product.name}
                className="w-24 h-24 object-cover rounded-lg mx-auto"
              />
            )}
            <div className="text-center">
              <p className="font-bold text-lg">{confirmedItem.product.name}</p>
              {confirmedItem.product.brand && (
                <p className="text-sm text-muted-foreground">{confirmedItem.product.brand}</p>
              )}
              <p className="text-xl font-bold text-green-700 mt-1">
                ₹{parseFloat(confirmedItem.product.price).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleConfirm}>
                Add to Cart
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleRescan}>
                Rescan
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Camera viewport */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />

            {/* Scanning overlay */}
            {cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-4 border-white/70 rounded-2xl relative">
                  {/* Corner accents */}
                  {["top-0 left-0","top-0 right-0","bottom-0 left-0","bottom-0 right-0"].map((pos, i) => (
                    <div key={i} className={`absolute ${pos} w-6 h-6 border-4 border-blue-400 rounded-sm`} />
                  ))}
                </div>
                <p className="mt-3 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                  Point camera at product
                </p>
              </div>
            )}

            {/* Detection badge */}
            {cameraActive && liveResult && (
              <div className="absolute top-2 right-2">
                {liveResult.detected && liveResult.productFound ? (
                  <Badge className="bg-green-500 text-white">
                    {liveResult.class} · {confidencePct}%
                  </Badge>
                ) : liveResult.detected ? (
                  <Badge variant="secondary">{liveResult.class} (no product)</Badge>
                ) : (
                  <Badge variant="outline" className="bg-white/80">Scanning…</Badge>
                )}
              </div>
            )}

            {/* Detecting spinner */}
            {detecting && (
              <div className="absolute bottom-2 left-2">
                <Badge variant="outline" className="bg-white/80 gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Analyzing
                </Badge>
              </div>
            )}

            {/* Placeholder when camera is off */}
            {!cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white/60">
                  <CameraOff className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Camera is off</p>
                </div>
              </div>
            )}
          </div>

          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Controls */}
          <div className="flex gap-2">
            {!cameraActive ? (
              <Button className="flex-1 gap-2" onClick={startCamera}>
                <Camera className="w-4 h-4" />
                Start Camera
              </Button>
            ) : (
              <Button variant="outline" className="flex-1 gap-2" onClick={stopCamera}>
                <CameraOff className="w-4 h-4" />
                Stop Camera
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Live detections list */}
          {liveResult?.allDetections && liveResult.allDetections.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">All detections:</p>
              {liveResult.allDetections.map((d, i) => (
                <span key={i} className="inline-block mr-2 mb-1 bg-muted px-2 py-0.5 rounded-full">
                  {d.class} {Math.round(d.confidence * 100)}%
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
