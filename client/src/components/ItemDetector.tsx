import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Loader2, CheckCircle, RotateCcw } from "lucide-react";

interface DetectionProduct {
  id: string;
  name: string;
  brand: string | null;
  price: string;
  imageUrl: string | null;
  detectionClass: string;
}

interface DetectionResult {
  detected: boolean;
  class?: string;
  confidence?: number;
  productFound?: boolean;
  product?: DetectionProduct;
  message?: string;
}

interface ItemDetectorProps {
  onItemDetected: (product: DetectionProduct) => void;
  onClose: () => void;
}

const FRAME_INTERVAL_MS = 1500;
const CONFIRM_FRAMES    = 2;

type Phase = "idle" | "scanning" | "confirmed" | "adding";

export default function ItemDetector({ onItemDetected, onClose }: ItemDetectorProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hitsRef     = useRef<Record<string, number>>({});
  const lockedRef   = useRef(false);

  const [phase,       setPhase]       = useState<Phase>("idle");
  const [liveLabel,   setLiveLabel]   = useState<string | null>(null);
  const [confidence,  setConfidence]  = useState(0);
  const [confirmed,   setConfirmed]   = useState<DetectionResult | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    lockedRef.current = false;
    hitsRef.current = {};
    setConfirmed(null);
    setLiveLabel(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("scanning");
    } catch (e: any) {
      setError(`Camera error: ${e.message}`);
    }
  }, []);

  const captureFrame = useCallback((): string | null => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || v.readyState < 2) return null;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", 0.7);
  }, []);

  const sendFrame = useCallback(async () => {
    if (lockedRef.current) return;
    const frame = captureFrame();
    if (!frame) return;

    try {
      const resp = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: frame }),
      });
      if (!resp.ok || lockedRef.current) return;

      const data: DetectionResult = await resp.json();
      if (lockedRef.current) return;

      if (data.detected && data.productFound && data.class) {
        setLiveLabel(data.class);
        setConfidence(data.confidence ? Math.round(data.confidence * 100) : 0);

        hitsRef.current[data.class] = (hitsRef.current[data.class] || 0) + 1;

        if (hitsRef.current[data.class] >= CONFIRM_FRAMES) {
          // Lock immediately — no more frames will be processed
          lockedRef.current = true;
          stopCamera();
          setConfirmed(data);
          setPhase("confirmed");
        }
      } else {
        // No confident detection — clear counter for stale classes
        hitsRef.current = {};
        setLiveLabel(null);
      }
    } catch {
      // network glitch — keep scanning
    }
  }, [captureFrame, stopCamera]);

  // Send frames while scanning
  useEffect(() => {
    if (phase !== "scanning") return;
    intervalRef.current = setInterval(sendFrame, FRAME_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, sendFrame]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleAddToCart = () => {
    if (!confirmed?.product || phase === "adding") return;
    setPhase("adding");
    onItemDetected(confirmed.product);
  };

  const handleRescan = () => {
    stopCamera();
    setPhase("idle");
    setConfirmed(null);
    setLiveLabel(null);
    // Small delay so camera permission resets cleanly
    setTimeout(startCamera, 200);
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Confirmed item ── */}
      {phase === "confirmed" || phase === "adding" ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <CheckCircle className="w-5 h-5" />
              Item Detected!
            </div>
            {confirmed?.product?.imageUrl && (
              <img
                src={confirmed.product.imageUrl}
                alt={confirmed.product.name}
                className="w-24 h-24 object-cover rounded-xl mx-auto"
              />
            )}
            <div className="text-center">
              <p className="font-bold text-lg">{confirmed?.product?.name}</p>
              {confirmed?.product?.brand && (
                <p className="text-sm text-muted-foreground">{confirmed.product.brand}</p>
              )}
              <p className="text-2xl font-bold text-green-700 mt-1">
                ₹{parseFloat(confirmed?.product?.price || "0").toLocaleString("en-IN")}
              </p>
              {confidence > 0 && (
                <p className="text-xs text-gray-500 mt-1">Confidence: {confidence}%</p>
              )}
            </div>
            <div className="flex gap-2 mt-1">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleAddToCart}
                disabled={phase === "adding"}
              >
                {phase === "adding" ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Adding…</>
                ) : "Add to Cart"}
              </Button>
              <Button variant="outline" className="flex-1 gap-1" onClick={handleRescan} disabled={phase === "adding"}>
                <RotateCcw className="w-4 h-4" /> Rescan
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Camera viewport ── */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

            {/* Scanning frame overlay */}
            {phase === "scanning" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-4 border-white/60 rounded-2xl relative">
                  {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
                    <div key={i} className={`absolute ${pos} w-6 h-6 border-4 border-green-400 rounded-sm`} />
                  ))}
                </div>
                <p className="mt-3 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                  {liveLabel ? `Detecting: ${liveLabel}…` : "Point camera at product"}
                </p>
              </div>
            )}

            {/* Live detection badge */}
            {phase === "scanning" && liveLabel && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-green-500 text-white animate-pulse">
                  {liveLabel} · {confidence}%
                </Badge>
              </div>
            )}

            {/* Camera off placeholder */}
            {phase === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white/50">
                  <CameraOff className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Camera off</p>
                </div>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Controls */}
          <div className="flex gap-2">
            {phase === "idle" ? (
              <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={startCamera}>
                <Camera className="w-4 h-4" />
                Start Camera
              </Button>
            ) : (
              <Button variant="outline" className="flex-1 gap-2" onClick={() => { stopCamera(); setPhase("idle"); setLiveLabel(null); }}>
                <CameraOff className="w-4 h-4" />
                Stop
              </Button>
            )}
            <Button variant="ghost" className="px-4 text-gray-500" onClick={onClose}>
              Cancel
            </Button>
          </div>

          {phase === "scanning" && (
            <p className="text-center text-xs text-gray-400">
              Hold the product steady — detection takes about 3 seconds
            </p>
          )}
        </>
      )}
    </div>
  );
}
