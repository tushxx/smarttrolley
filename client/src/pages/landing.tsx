import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Cpu, CreditCard, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

function SmartCartLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cart body */}
      <path d="M8 14h4l4 14h16l4-10H14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      {/* Wheels */}
      <circle cx="18" cy="31" r="2.5" fill="white"/>
      <circle cx="30" cy="31" r="2.5" fill="white"/>
      {/* Screen/display on cart handle */}
      <rect x="28" y="6" width="14" height="10" rx="2" fill="white" opacity="0.9"/>
      {/* Screen content — camera icon */}
      <circle cx="35" cy="11" r="2.5" fill="#16a34a"/>
      <circle cx="35" cy="11" r="1.2" fill="white"/>
      {/* Wifi signal dots */}
      <circle cx="41" cy="7.5" r="0.8" fill="#4ade80"/>
      {/* Handle */}
      <line x1="34" y1="16" x2="32" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

const FEATURES = [
  {
    icon: Camera,
    title: "AI Camera Detection",
    desc: "YOLO11s model detects products in real-time. Just hold the item in front of the camera.",
    color: "text-green-400",
    bg: "bg-green-400/10 border-green-400/20",
  },
  {
    icon: Cpu,
    title: "Edge Computing",
    desc: "Runs entirely on a Raspberry Pi 5. No cloud dependency. Instant, offline inference.",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
  },
  {
    icon: CreditCard,
    title: "Instant Checkout",
    desc: "Pay directly from the trolley screen via Razorpay. Skip every queue at the store.",
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
  },
  {
    icon: Wifi,
    title: "IoT Connected",
    desc: "Weight sensors cross-verify detected items. AWS IoT backend syncs your cart in real time.",
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/20",
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not start session. Try again.", variant: "destructive" });
    },
  });

  const handleLogin = () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast({ title: "Invalid number", description: "Enter a 10-digit mobile number.", variant: "destructive" });
      return;
    }
    loginMutation.mutate(phone);
  };

  return (
    <div className="min-h-screen bg-[#050e05] text-white">

      {/* ── Nav ── */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-900/40">
              <SmartCartLogo size={28} />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight">SmartCart</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block"></span>
                <span className="text-xs text-green-400 font-medium">System Online</span>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
            <span>YOLO11s · Raspberry Pi 5 · Razorpay</span>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-green-950/60 border border-green-500/20 rounded-full px-4 py-1.5 text-sm text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Final Year Engineering Project — 2025
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
                Shop Without
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
                  Waiting in Line.
                </span>
              </h1>
              <p className="text-lg text-white/55 leading-relaxed max-w-lg">
                A smart shopping trolley with an AI camera mounted on the handle. 
                It detects products as you place them in, tracks your total live, 
                and lets you pay and walk out — no cashier needed.
              </p>
            </div>

            {/* Tech stack pills */}
            <div className="flex flex-wrap gap-2">
              {["YOLO11s", "Raspberry Pi 5", "Razorpay", "AWS IoT", "React"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-xs font-medium text-white/60 border border-white/10 rounded-full bg-white/5"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Stats row */}
            <div className="flex gap-8 pt-2 border-t border-white/8">
              <div>
                <div className="text-2xl font-bold text-white">5</div>
                <div className="text-xs text-white/40 mt-0.5">Product classes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">&lt;3s</div>
                <div className="text-xs text-white/40 mt-0.5">Detection time</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">₹0</div>
                <div className="text-xs text-white/40 mt-0.5">Checkout queue</div>
              </div>
            </div>
          </div>

          {/* Right — Login card */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-sm">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md">
                
                {/* Card header */}
                <div className="mb-7">
                  <h2 className="text-xl font-bold text-white">Start a session</h2>
                  <p className="text-sm text-white/40 mt-1">
                    Enter your mobile number to open your cart
                  </p>
                </div>

                {/* Phone input */}
                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-white/30 text-sm">+91</span>
                      <div className="w-px h-4 bg-white/10 mx-3"></div>
                    </div>
                    <input
                      ref={inputRef}
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      placeholder="98765 43210"
                      disabled={loginMutation.isPending}
                      autoFocus
                      className="w-full bg-white/8 border border-white/12 rounded-xl pl-20 pr-4 py-3.5 text-white placeholder-white/20 text-base focus:outline-none focus:border-green-500/60 focus:bg-white/10 transition-all"
                    />
                  </div>

                  <button
                    onClick={handleLogin}
                    disabled={loginMutation.isPending || phone.replace(/\D/g, "").length < 10}
                    className="w-full py-3.5 rounded-xl font-semibold text-base bg-green-500 hover:bg-green-400 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-green-900/30"
                  >
                    {loginMutation.isPending ? "Opening cart…" : "Open My Cart →"}
                  </button>
                </div>

                <p className="text-center text-xs text-white/25 mt-5">
                  No OTP · No password · Session expires when you log out
                </p>

                {/* Divider */}
                <div className="border-t border-white/8 mt-6 pt-6">
                  <div className="flex items-center justify-between text-xs text-white/25">
                    <span>Session secured</span>
                    <span>·</span>
                    <span>In-store use only</span>
                    <span>·</span>
                    <span>Razorpay payments</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Feature cards ── */}
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white">How it works</h2>
          <p className="text-white/40 text-sm mt-2">The full stack behind the trolley</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className={`rounded-2xl border p-6 ${bg} backdrop-blur-sm`}>
              <div className={`mb-3 ${color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-white text-sm mb-2">{title}</h3>
              <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/25">
          <span>SmartCart · Final Year Engineering Project</span>
          <span>Built with YOLO11s · React · Raspberry Pi 5</span>
        </div>
      </footer>
    </div>
  );
}
