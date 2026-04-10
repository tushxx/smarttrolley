import { useState, useEffect, useCallback, useRef } from "react";
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

// Confirm instantly if confidence ≥ this (single frame)
const HIGH_CONF  = 0.90;
// Confirm after CONFIRM_FRAMES *strictly consecutive* hits of the SAME class
const MED_CONF   = 0.65;
const CONFIRM_FRAMES = 3;

const PRODUCT_IMAGES: Record<string, string> = {
  Perfume:  "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=120&h=120&fit=crop",
  Cards:    "https://images.unsplash.com/photo-1612404730960-5c71577fca11?w=120&h=120&fit=crop",
  Facewash: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=120&h=120&fit=crop",
  Earbuds:  "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=120&h=120&fit=crop",
  Shampoo:  "https://images.unsplash.com/photo-1631390015880-e37a6f7bede5?w=120&h=120&fit=crop",
};

type Phase = "starting" | "scanning" | "confirmed" | "adding" | "error";

export default function ItemDetector({ onItemDetected, onClose }: ItemDetectorProps) {
  const runningRef     = useRef(false);
  const hitsRef        = useRef(0);
  const lastClassRef   = useRef<string | null>(null);

  const [phase,      setPhase]      = useState<Phase>("starting");
  const [liveLabel,  setLiveLabel]  = useState<string | null>(null);
  const [liveConf,   setLiveConf]   = useState(0);
  const [hitCount,   setHitCount]   = useState(0);
  const [confirmed,  setConfirmed]  = useState<DetectionResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [streamKey,  setStreamKey]  = useState(0); // forces reload of MJPEG img

  // ── Capture a frame from Pi camera via /api/pi-capture ─────────────────────
  const captureFrame = useCallback(async (): Promise<string | null> => {
    try {
      const resp = await fetch("/api/pi-capture", {
        credentials: "include",
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.image ?? null;  // "data:image/jpeg;base64,..."
    } catch {
      return null;
    }
  }, []);

  // ── Confirm a detection ─────────────────────────────────────────────────────
  const confirm = useCallback((data: DetectionResult) => {
    runningRef.current = false;
    setConfirmed(data);
    setPhase("confirmed");
  }, []);

  // ── Continuous scan loop — grabs Pi camera frames and runs detection ─────────
  const scanLoop = useCallback(async () => {
    runningRef.current   = true;
    hitsRef.current      = 0;
    lastClassRef.current = null;

    const reset = () => {
      hitsRef.current      = 0;
      lastClassRef.current = null;
      setHitCount(0);
      setLiveLabel(null);
      setLiveConf(0);
    };

    while (runningRef.current) {
      const frame = await captureFrame();
      if (!frame) {
        await new Promise(r => setTimeout(r, 150));
        continue;
      }

      try {
        const resp = await fetch("/api/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: frame }),
          credentials: "include",
          signal: AbortSignal.timeout(5000),
        });

        if (!runningRef.current) break;
        if (!resp.ok) { reset(); continue; }

        const data: DetectionResult = await resp.json();
        if (!runningRef.current) break;

        if (data.detected && data.productFound && data.class && data.confidence) {
          const conf = data.confidence;
          const cls  = data.class;

          if (cls !== lastClassRef.current) {
            hitsRef.current      = 0;
            lastClassRef.current = cls;
          }

          setLiveLabel(cls);
          setLiveConf(Math.round(conf * 100));

          // Instant confirm at very high confidence
          if (conf >= HIGH_CONF) {
            confirm(data);
            return;
          }

          // Accumulate consecutive frames of same class
          if (conf >= MED_CONF) {
            hitsRef.current += 1;
            setHitCount(hitsRef.current);
            if (hitsRef.current >= CONFIRM_FRAMES) {
              confirm(data);
              return;
            }
          } else {
            hitsRef.current = 0;
            setHitCount(0);
          }
        } else {
          reset();
        }
      } catch {
        if (!runningRef.current) break;
      }
    }
  }, [captureFrame, confirm]);

  // ── Verify Pi camera is reachable, then start scan loop ────────────────────
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const health = await fetch("/api/pi-capture", {
          credentials: "include",
          signal: AbortSignal.timeout(4000),
        });
        if (!health.ok) throw new Error("Pi camera returned an error");
      } catch (e: any) {
        if (!cancelled) {
          setError(
            `Pi camera unavailable: ${e.message}. ` +
            `Make sure detection_service.py is running on the Pi.`
          );
          setPhase("error");
          return;
        }
      }

      if (cancelled) return;
      setPhase("scanning");
      scanLoop();
    };

    start();

    return () => {
      cancelled = true;
      runningRef.current = false;
    };
  }, [scanLoop]);

  // ── Rescan: stop loop, reset state, restart ─────────────────────────────────
  const handleRescan = useCallback(async () => {
    runningRef.current   = false;
    hitsRef.current      = 0;
    lastClassRef.current = null;
    setConfirmed(null);
    setLiveLabel(null);
    setLiveConf(0);
    setHitCount(0);
    setError(null);
    setPhase("starting");
    setStreamKey(k => k + 1);   // reload the MJPEG stream img element

    await new Promise(r => setTimeout(r, 200));
    setPhase("scanning");
    scanLoop();
  }, [scanLoop]);

  const handleAdd = () => {
    if (!confirmed?.product || phase === "adding") return;
    setPhase("adding");
    onItemDetected(confirmed.product);
  };

  const progress = phase === "scanning" && liveLabel
    ? Math.min(100, (hitCount / CONFIRM_FRAMES) * 100)
    : 0;

  const productImg = confirmed?.product
    ? (confirmed.product.imageUrl || PRODUCT_IMAGES[confirmed.product.detectionClass] || "")
    : "";

  return (
    <div className="flex flex-col gap-4">

      {/* ── Error state ── */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <CameraOff className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
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
                ? <><Loader2 className="w-4 h-4 animate-spin" />Adding…</>
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

      ) : phase !== "error" ? (
        <>
          {/* ── Pi Camera live stream viewport ── */}
          <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>

            {/* MJPEG stream from Pi camera — displayed as a plain <img> */}
            {phase !== "starting" && (
              <img
                key={streamKey}
                src="/api/pi-stream"
                alt="Raspberry Pi camera live feed"
                className="w-full h-full object-cover"
              />
            )}

            {/* Starting overlay */}
            {phase === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <p className="text-white text-sm">Connecting to Pi camera…</p>
              </div>
            )}

            {/* Scanning overlay */}
            {phase === "scanning" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {/* Corner brackets */}
                <div className="relative w-44 h-44">
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-white rounded-tl-md" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-white rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-white rounded-bl-md" />
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
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-white text-xs font-medium">{liveLabel} — {liveConf}%</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 bg-white/50 rounded-full" />
                      <span className="text-white/70 text-xs">Point at product</span>
                    </>
                  )}
                </div>

                {/* Pi camera badge */}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-white/80 text-[10px] font-medium">Pi Camera</span>
                </div>

                {/* Confidence bar */}
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

          {/* Hint text */}
          <p className="text-center text-xs text-gray-400">
            {phase === "scanning"
              ? liveLabel
                ? "Hold still — locking in…"
                : "Hold a product in front of the Pi camera"
              : "Connecting to Raspberry Pi camera…"}
          </p>
        </>
      ) : null}

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
