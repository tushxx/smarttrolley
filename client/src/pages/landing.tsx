import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="10" fill="#16a34a" />
      {/* Cart base */}
      <path
        d="M9 11h2.5l3 9h10l3-7H13.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Wheels */}
      <circle cx="16" cy="22.5" r="1.8" fill="white" />
      <circle cx="24" cy="22.5" r="1.8" fill="white" />
      {/* Camera lens on cart handle */}
      <circle cx="26" cy="13" r="3" fill="white" opacity="0.9" />
      <circle cx="26" cy="13" r="1.4" fill="#16a34a" />
      <circle cx="26.6" cy="12.4" r="0.4" fill="white" />
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Place item in trolley",
    body: "The camera on the handle immediately points at the product you just dropped in.",
  },
  {
    n: "02",
    title: "AI detects in seconds",
    body: "YOLO11s runs on-device on a Raspberry Pi 5. No internet required. Result in under 3 s.",
  },
  {
    n: "03",
    title: "Pay and walk out",
    body: "Your running total is on the trolley screen. Tap pay via Razorpay when you're done.",
  },
];

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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }),
    onError: () =>
      toast({
        title: "Error",
        description: "Could not start session. Try again.",
        variant: "destructive",
      }),
  });

  const handleLogin = () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast({ title: "Enter a valid mobile number", variant: "destructive" });
      return;
    }
    loginMutation.mutate(phone);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <a href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-semibold text-gray-900 tracking-tight">
            SmartCart
          </span>
        </a>
      </nav>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-medium px-3.5 py-1.5 rounded-full border border-green-100 mb-8">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block"></span>
          Smart Shopping Trolley — Powered by YOLO11s
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-950 tracking-tight leading-[1.06] max-w-3xl">
          Skip the checkout.
          <span className="block text-green-600">Shop smarter.</span>
        </h1>

        <p className="mt-6 text-lg text-gray-500 max-w-md leading-relaxed">
          An AI camera on your trolley detects every item you place inside. Pay
          from the screen and walk straight out.
        </p>

        {/* ── Phone form ── */}
        <div className="mt-10 w-full max-w-sm">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 select-none pointer-events-none">
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
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-gray-50 hover:bg-white"
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={
                loginMutation.isPending || phone.replace(/\D/g, "").length < 10
              }
              className="px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shadow-sm"
            >
              {loginMutation.isPending ? "Opening…" : "Open cart →"}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-400 text-center">
            No OTP · No password · Instant access
          </p>
        </div>

        {/* ── Divider ── */}
        <div className="mt-20 w-full max-w-4xl border-t border-gray-100"></div>

        {/* ── Steps ── */}
        <div className="mt-16 w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-10 text-left">
          {STEPS.map((s) => (
            <div key={s.n}>
              <span className="text-xs font-semibold text-green-600 tracking-widest">
                {s.n}
              </span>
              <h3 className="mt-3 text-base font-semibold text-gray-900">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 px-8 py-5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span>SmartCart · Final Year Engineering Project</span>
          <span>YOLO11s · Raspberry Pi 5 · Razorpay · AWS IoT</span>
        </div>
      </footer>
    </div>
  );
}
