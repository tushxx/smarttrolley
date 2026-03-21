import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/* ─── Logo SVG ─── */
function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="11" fill="#15803d"/>
      <path d="M10 13h3l4 11h11l3.5-8.5H15" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="17.5" cy="26.5" r="2.2" fill="white"/>
      <circle cx="27.5" cy="26.5" r="2.2" fill="white"/>
      <circle cx="29" cy="14.5" r="3.5" fill="white" opacity="0.92"/>
      <circle cx="29" cy="14.5" r="1.6" fill="#15803d"/>
      <circle cx="29.7" cy="13.8" r="0.45" fill="white"/>
    </svg>
  );
}

/* ─── Feature row item ─── */
function Feature({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="py-8 border-b border-white/6 flex gap-8 items-start">
      <span className="text-xs font-semibold text-white/25 tabular-nums mt-0.5 w-6 shrink-0">{num}</span>
      <div>
        <h3 className="text-[15px] font-semibold text-white/90 leading-snug">{title}</h3>
        <p className="mt-1.5 text-[14px] text-white/40 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const [phone, setPhone] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await apiRequest("POST", "/api/auth/phone", { phoneNumber });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }),
    onError: () => toast({ title: "Error", description: "Could not start session.", variant: "destructive" }),
  });

  const handleLogin = () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast({ title: "Enter a valid mobile number", variant: "destructive" }); return;
    }
    loginMutation.mutate(phone);
  };

  return (
    <div className="min-h-screen" style={{ background: "#060a06" }}>

      {/* ─── Aurora glow ─── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(21,128,61,0.28) 0%, transparent 65%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse 40% 30% at 80% 10%, rgba(74,222,128,0.07) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10">
        {/* ─── Nav ─── */}
        <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <span
              className="text-[17px] font-semibold text-white tracking-tight"
              style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontVariationSettings: "'wght' 650" }}
            >
              SmartCart
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-white/25 border border-white/8 rounded-full px-3 py-1">
              Final Year Project · 2025
            </span>
          </div>
        </nav>

        {/* ─── Hero ─── */}
        <section className="max-w-5xl mx-auto px-8 pt-16 pb-24 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-10 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-[12px] font-medium text-white/60 tracking-wide">
              Powered by YOLO11s · Raspberry Pi 5
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-white leading-[1.04] tracking-tight"
            style={{
              fontSize: "clamp(52px, 8vw, 88px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            The shopping trolley
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #4ade80 0%, #22c55e 40%, #86efac 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              that checks itself out.
            </span>
          </h1>

          {/* Sub */}
          <p
            className="mt-7 mx-auto text-white/45 leading-relaxed"
            style={{
              fontSize: "clamp(16px, 2vw, 19px)",
              maxWidth: "520px",
              fontWeight: 400,
            }}
          >
            An AI camera on the trolley handle detects every item you drop in.
            Your total updates live. Pay and walk out — no cashier, no queue.
          </p>

          {/* Phone form */}
          <div className="mt-10 flex items-center justify-center gap-2 max-w-sm mx-auto">
            <div
              className="relative flex-1"
              style={{ background: "rgba(255,255,255,0.06)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/30 select-none pointer-events-none">
                +91
              </span>
              <input
                ref={inputRef}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Mobile number"
                disabled={loginMutation.isPending}
                autoFocus
                className="w-full pl-12 pr-4 py-3.5 bg-transparent text-white placeholder-white/20 text-sm focus:outline-none rounded-[14px]"
                style={{ caretColor: "#22c55e" }}
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={loginMutation.isPending || phone.replace(/\D/g, "").length < 10}
              className="px-5 py-3.5 text-sm font-semibold text-white rounded-[14px] transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
              style={{
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                boxShadow: "0 0 0 1px rgba(22,163,74,0.4), 0 4px 20px rgba(22,163,74,0.25)",
              }}
            >
              {loginMutation.isPending ? "Opening…" : "Open cart →"}
            </button>
          </div>
          <p className="mt-4 text-[12px] text-white/20">No OTP · No password · Just start shopping</p>
        </section>

        {/* ─── Divider line ─── */}
        <div className="max-w-5xl mx-auto px-8">
          <div className="border-t border-white/6" />
        </div>

        {/* ─── How it works ─── */}
        <section className="max-w-5xl mx-auto px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16">
            <div>
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-2">How it works</p>
              <h2
                className="text-white/90 font-semibold leading-snug"
                style={{ fontSize: "clamp(22px, 3vw, 30px)", letterSpacing: "-0.02em" }}
              >
                Built for the future of retail.
              </h2>
            </div>
            <div className="mt-6 md:mt-0">
              <Feature
                num="01"
                title="Drop it in the trolley"
                body="The camera mounted on the handle instantly begins scanning. No barcodes. No manual entry."
              />
              <Feature
                num="02"
                title="AI detects in under 3 seconds"
                body="YOLO11s runs on a Raspberry Pi 5. Completely on-device — no cloud, no latency."
              />
              <Feature
                num="03"
                title="Pay from the trolley screen"
                body="Your live total is always visible. Tap to pay via Razorpay and walk straight out."
              />
              <Feature
                num="04"
                title="Weight sensor double-checks"
                body="A load cell verifies what's in the trolley matches what was detected. Zero theft."
              />
            </div>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="max-w-5xl mx-auto px-8 py-8 border-t border-white/6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span className="text-xs text-white/30 font-medium">SmartCart</span>
          </div>
          <span className="text-[11px] text-white/20">
            YOLO11s · Raspberry Pi 5 · Razorpay · AWS IoT · React
          </span>
        </footer>
      </div>
    </div>
  );
}
