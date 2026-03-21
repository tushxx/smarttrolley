import { useRef, useState, useEffect, useCallback } from "react";
import { CheckCircle, RotateCcw, Loader2, CameraOff } from "lucide-react";

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

// Confirm instantly if confidence ≥ this
const HIGH_CONF  = 0.82;
// Confirm after CONFIRM_FRAMES consecutive hits if confidence ≥ MED_CONF
const MED_CONF   = 0.50;
const CONFIRM_FRAMES = 2;
// Capture at this size before sending — smaller = faster inference
const CAPTURE_W  = 320;
const CAPTURE_H  = 240;

const PRODUCT_IMAGES: Record<string, string> = {
  Perfume:  "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=120&h=120&fit=crop",
  Cards:    "https://images.unsplash.com/photo-1612404730960-5c71577fca11?w=120&h=120&fit=crop",
  Facewash: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=120&h=120&fit=crop",
  Earbuds:  "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=120&h=120&fit=crop",
  Shampoo:  "https://images.unsplash.com/photo-1631390015880-e37a6f7bede5?w=120&h=120&fit=crop",
};

type Phase = "starting" | "scanning" | "confirmed" | "adding";

export default function ItemDetector({ onItemDetected, onClose }: ItemDetectorProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const runningRef  = useRef(false);   // controls the scan loop
  const hitsRef     = useRef<Record<string, number>>({});

  const [phase,      setPhase]      = useState<Phase>("starting");
  const [liveLabel,  setLiveLabel]  = useState<string | null>(null);
  const [liveConf,   setLiveConf]   = useState(0);
  const [hitCount,   setHitCount]   = useState(0);  // for progress indicator
  const [confirmed,  setConfirmed]  = useState<DetectionResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // ── Capture a downscaled JPEG frame ────────────────────────────────────────
  const captureFrame = useCallback((): string | null => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.readyState < 2 || v.videoWidth === 0) return null;
    c.width  = CAPTURE_W;
    c.height = CAPTURE_H;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, CAPTURE_W, CAPTURE_H);
    return c.toDataURL("image/jpeg", 0.5);   // low quality = small payload
  }, []);

  // ── Confirm a detection ─────────────────────────────────────────────────────
  const confirm = useCallback((data: DetectionResult) => {
    runningRef.current = false;
    // Stop camera tracks
    streamRef.current?.getTracks().forEach(t => t.stop());
    setConfirmed(data);
    setPhase("confirmed");
  }, []);

  // ── Continuous scan loop — fires next frame as soon as previous returns ─────
  const scanLoop = useCallback(async () => {
    runningRef.current = true;
    hitsRef.current = {};

    while (runningRef.current) {
      const frame = captureFrame();
      if (!frame) {
        await new Promise(r => setTimeout(r, 80));  // wait for video ready
        continue;
      }

      try {
        const resp = await fetch("/api/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: frame }),
          signal: AbortSignal.timeout(4000),
        });

        if (!runningRef.current) break;
        if (!resp.ok) continue;

        const data: DetectionResult = await resp.json();
        if (!runningRef.current) break;

        if (data.detected && data.productFound && data.class && data.confidence) {
          const conf = data.confidence;
          setLiveLabel(data.class);
          setLiveConf(Math.round(conf * 100));

          // ── Instant confirm at high confidence ──────────────────────────
          if (conf >= HIGH_CONF) {
            confirm(data);
            return;
          }

          // ── Accumulate hits at medium confidence ──────────────────────
          if (conf >= MED_CONF) {
            const prev = hitsRef.current[data.class] || 0;
            hitsRef.current[data.class] = prev + 1;
            setHitCount(hitsRef.current[data.class]);
            if (hitsRef.current[data.class] >= CONFIRM_FRAMES) {
              confirm(data);
              return;
            }
          }
        } else {
          // No detection — reset counters
          hitsRef.current = {};
          setHitCount(0);
          setLiveLabel(null);
          setLiveConf(0);
        }
      } catch {
        // network error / timeout — just retry immediately
        if (!runningRef.current) break;
      }
    }
  }, [captureFrame, confirm]);

  // ── Start camera + scan loop on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play();
        }
        setPhase("scanning");
        scanLoop();  // fire and forget
      } catch (e: any) {
        if (!cancelled) setError(`Camera error: ${e.message}`);
      }
    };

    start();

    return () => {
      cancelled = true;
      runningRef.current = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [scanLoop]);

  // ── Rescan: restart everything ──────────────────────────────────────────────
  const handleRescan = useCallback(async () => {
    runningRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    hitsRef.current = {};
    setConfirmed(null);
    setLiveLabel(null);
    setLiveConf(0);
    setHitCount(0);
    setError(null);

    await new Promise(r => setTimeout(r, 150));

    try {
      setPhase("starting");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) { v.srcObject = stream; await v.play(); }
      setPhase("scanning");
      scanLoop();
    } catch (e: any) {
      setError(`Camera error: ${e.message}`);
    }
  }, [scanLoop]);

  const handleAdd = () => {
    if (!confirmed?.product || phase === "adding") return;
    setPhase("adding");
    onItemDetected(confirmed.product);
  };

  // ── Progress indicator (0–100%) ─────────────────────────────────────────────
  const progress = phase === "scanning" && liveLabel
    ? Math.min(100, (hitCount / CONFIRM_FRAMES) * 100)
    : 0;

  const productImg = confirmed?.product
    ? (confirmed.product.imageUrl || PRODUCT_IMAGES[confirmed.product.detectionClass] || "")
    : "";

  return (
    <div className="flex flex-col gap-4">

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Confirmed state ── */}
      {(phase === "confirmed" || phase === "adding") && confirmed?.product ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
            <CheckCircle className="w-4 h-4" />
            Detected — {liveConf}% confidence
          </div>

          <div className="flex items-center gap-4">
            {productImg && (
              <img
                src={productImg}
                alt={confirmed.product.name}
                className="w-16 h-16 rounded-xl object-cover shrink-0 bg-white"
              />
            )}
            <div>
              <p className="font-bold text-gray-900 text-base">{confirmed.product.name}</p>
              {confirmed.product.brand && (
                <p className="text-sm text-gray-500 mt-0.5">{confirmed.product.brand}</p>
              )}
              <p className="text-xl font-extrabold text-green-700 mt-1">
                ₹{parseFloat(confirmed.product.price).toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={phase === "adding"}
              className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {phase === "adding"
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</>
                : "Add to Cart"}
            </button>
            <button
              onClick={handleRescan}
              disabled={phase === "adding"}
              className="flex-1 py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Rescan
            </button>
          </div>
        </div>

      ) : (
        <>
          {/* ── Camera viewport ── */}
          <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />

            {/* Starting overlay */}
            {phase === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <p className="text-white text-sm">Starting camera…</p>
              </div>
            )}

            {/* Scanning overlay */}
            {phase === "scanning" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {/* Corner brackets */}
                <div className="relative w-44 h-44">
                  {/* Top-left */}
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-white rounded-tl-md" />
                  {/* Top-right */}
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-white rounded-tr-md" />
                  {/* Bottom-left */}
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-white rounded-bl-md" />
                  {/* Bottom-right */}
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-white rounded-br-md" />

                  {/* Scan line animation */}
                  <div
                    className="absolute left-1 right-1 h-0.5 bg-green-400/80"
                    style={{ animation: "scanLine 1.5s ease-in-out infinite", top: "50%" }}
                  />
                </div>

                {/* Status pill */}
                <div className="mt-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  {liveLabel ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="text-white text-xs font-medium">{liveLabel} — {liveConf}%</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 bg-white/50 rounded-full"></span>
                      <span className="text-white/70 text-xs">Point at product</span>
                    </>
                  )}
                </div>

                {/* Confidence bar — only shows when detecting */}
                {liveLabel && progress > 0 && (
                  <div className="mt-3 w-44 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-400 rounded-full transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Hint text */}
          <p className="text-center text-xs text-gray-400">
            {phase === "scanning"
              ? liveLabel
                ? "Hold still — locking in…"
                : "Hold a product in front of the camera"
              : "Preparing camera…"}
          </p>
        </>
      )}

      {/* Scan line CSS */}
      <style>{`
        @keyframes scanLine {
          0%   { top: 10%; opacity: 1; }
          50%  { top: 90%; opacity: 1; }
          100% { top: 10%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
