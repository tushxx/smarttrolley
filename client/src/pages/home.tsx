import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import ItemDetector from "@/components/ItemDetector";
import CartItem from "@/components/CartItem";
import { Camera, LogOut, Scan, CreditCard, Plus } from "lucide-react";
import { useLocation } from "wouter";
import type { CartWithItems } from "@shared/schema";

/* ─── Logo ─── */
function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 40 40" fill="none">
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

const DETECTABLE = [
  { name: "Perfume",       emoji: "🌸", class: "Perfume" },
  { name: "Playing Cards", emoji: "🃏", class: "Cards" },
  { name: "Face Wash",     emoji: "🧴", class: "Facewash" },
  { name: "Earbuds",       emoji: "🎧", class: "Earbuds" },
  { name: "Shampoo",       emoji: "🧴", class: "Shampoo" },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [showDetector, setShowDetector] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: cart, isLoading } = useQuery<CartWithItems>({
    queryKey: ["/api/cart"],
    retry: false,
  });

  const addToCartMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await apiRequest("POST", "/api/cart/items", { productId, quantity: 1 });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({ title: "Added to cart" });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) { window.location.href = "/"; return; }
      if (error.message?.includes("already in cart")) {
        toast({ title: "Already in cart", variant: "destructive" }); return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleItemDetected = (product: { id: string }) => {
    setShowDetector(false);
    addToCartMutation.mutate(product.id);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    window.location.href = "/";
  };

  const proceedToCheckout = () => {
    if (!cart?.items?.length) { toast({ title: "Cart is empty", variant: "destructive" }); return; }
    setLocation("/checkout");
  };

  const subtotal = cart?.items?.reduce((s, i) => s + parseFloat(i.product.price) * i.quantity, 0) ?? 0;
  const tax = subtotal * 0.18;
  const total = subtotal + tax;
  const itemCount = cart?.items?.length ?? 0;

  const fmt = (n: number) =>
    "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400 tracking-wide">Loading</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9f9] flex flex-col" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ─── Topbar ─── */}
      <header
        className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-6"
        style={{ height: 52, borderBottom: "1px solid rgba(0,0,0,0.06)" }}
      >
        {/* Left */}
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold text-gray-900" style={{ letterSpacing: "-0.01em" }}>
            SmartCart
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-5">
          {itemCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-gray-900">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-gray-400">· {fmt(total)}</span>
            </div>
          )}
          <div
            className="h-4 w-px"
            style={{ background: "rgba(0,0,0,0.08)" }}
          />
          <span className="text-xs text-gray-400 hidden sm:block">
            +{(user as any)?.phoneNumber}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </header>

      {/* ─── Body ─── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 52px)" }}>

        {/* ─── Left sidebar ─── */}
        <aside
          className="w-64 flex flex-col shrink-0 bg-white overflow-y-auto"
          style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div className="p-5 flex flex-col gap-2">

            {/* Primary: Scan */}
            <button
              onClick={() => setShowDetector(true)}
              className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                boxShadow: "0 2px 12px rgba(22,163,74,0.3)",
              }}
            >
              <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
                <Camera className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-semibold leading-tight">Scan Item</p>
                <p className="text-[11px] text-green-100/80 leading-tight mt-0.5">AI camera detection</p>
              </div>
            </button>

            {/* Secondary: Checkout */}
            <button
              onClick={proceedToCheckout}
              disabled={!itemCount}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:bg-gray-50"
              style={{ borderColor: "rgba(0,0,0,0.09)", background: "white" }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(0,0,0,0.04)" }}
              >
                <CreditCard className="h-3.5 w-3.5 text-gray-500" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-800 leading-tight">Checkout</p>
                <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                  {itemCount ? `${itemCount} item${itemCount !== 1 ? "s" : ""} · ${fmt(total)}` : "Cart is empty"}
                </p>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="mx-5" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }} />

          {/* Detectable products */}
          <div className="p-5">
            <p
              className="text-[10px] font-semibold text-gray-400 uppercase mb-3"
              style={{ letterSpacing: "0.1em" }}
            >
              Detectable Products
            </p>
            <div className="space-y-0.5">
              {DETECTABLE.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-default"
                >
                  <span className="text-base leading-none">{item.emoji}</span>
                  <span className="text-[13px] text-gray-600">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }} />

          {/* Engine status */}
          <div className="p-5">
            <p
              className="text-[10px] font-semibold text-gray-400 uppercase mb-3"
              style={{ letterSpacing: "0.1em" }}
            >
              Detection Engine
            </p>
            <div className="space-y-2.5">
              {[
                ["Model", "YOLO11s"],
                ["Device", "Raspberry Pi 5"],
                ["Threshold", "50% confidence"],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-400">{label}</span>
                  <span className="text-[12px] font-medium text-gray-700">{val}</span>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-400">Status</span>
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-green-600">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Live
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── Main cart panel ─── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#f9f9f9]">

          {/* Cart header */}
          <div
            className="bg-white px-8 py-5 flex items-start justify-between shrink-0"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div>
              <h1
                className="text-gray-900 font-semibold leading-none"
                style={{ fontSize: 22, letterSpacing: "-0.02em" }}
              >
                Your Cart
              </h1>
              <p className="text-[13px] text-gray-400 mt-1.5">
                {itemCount === 0
                  ? "Scan a product to begin"
                  : `${itemCount} item${itemCount !== 1 ? "s" : ""} · automatically detected`}
              </p>
            </div>

            {itemCount > 0 && (
              <button
                onClick={() => setShowDetector(true)}
                className="flex items-center gap-2 text-[13px] font-semibold text-green-700 hover:text-green-800 px-3.5 py-2 rounded-xl hover:bg-green-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Scan another
              </button>
            )}
          </div>

          {/* Items / empty */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {itemCount === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-5 max-w-xs mx-auto">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.04)" }}
                >
                  <Scan className="h-7 w-7 text-gray-300" />
                </div>
                <div>
                  <p
                    className="font-semibold text-gray-900 leading-snug"
                    style={{ fontSize: 16, letterSpacing: "-0.01em" }}
                  >
                    No items yet
                  </p>
                  <p className="text-[13px] text-gray-400 mt-1.5 leading-relaxed">
                    Point the camera at any product. The AI will detect and add it automatically.
                  </p>
                </div>
                <button
                  onClick={() => setShowDetector(true)}
                  className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white rounded-xl transition-all"
                  style={{
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    boxShadow: "0 2px 12px rgba(22,163,74,0.3)",
                  }}
                >
                  <Camera className="h-3.5 w-3.5" />
                  Start Scanning
                </button>
              </div>
            ) : (
              <div className="max-w-2xl space-y-2">
                {cart!.items.map((item) => (
                  <CartItem key={item.id} item={item} onQuantityChange={() => {}} onRemove={() => {}} />
                ))}
              </div>
            )}
          </div>

          {/* ─── Checkout footer ─── */}
          {itemCount > 0 && (
            <div
              className="bg-white px-8 py-5 flex items-center justify-between gap-6 shrink-0"
              style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-widest">Subtotal</p>
                  <p className="text-[15px] font-semibold text-gray-900 mt-0.5">{fmt(subtotal)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-widest">GST 18%</p>
                  <p className="text-[15px] font-semibold text-gray-900 mt-0.5">{fmt(tax)}</p>
                </div>
                <div
                  className="h-8 w-px"
                  style={{ background: "rgba(0,0,0,0.07)" }}
                />
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-widest">Total</p>
                  <p
                    className="font-bold text-gray-900 mt-0.5"
                    style={{ fontSize: 22, letterSpacing: "-0.02em" }}
                  >
                    {fmt(total)}
                  </p>
                </div>
              </div>

              <button
                onClick={proceedToCheckout}
                className="flex items-center gap-2.5 text-[14px] font-semibold text-white rounded-xl px-6 py-3 transition-all"
                style={{
                  background: "linear-gradient(135deg, #111, #1a1a1a)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                  letterSpacing: "-0.01em",
                }}
              >
                <CreditCard className="h-4 w-4" />
                Pay {fmt(total)}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ─── Scanner modal ─── */}
      {showDetector && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="bg-white w-full max-w-lg overflow-hidden"
            style={{
              borderRadius: 20,
              boxShadow: "0 30px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05)",
            }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(22,163,74,0.1)" }}
                >
                  <Camera className="h-4 w-4 text-green-700" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-gray-900">AI Detection</p>
                  <p className="text-[11px] text-gray-400">Hold product steady · 3 seconds</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetector(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <ItemDetector
                onItemDetected={handleItemDetected}
                onClose={() => setShowDetector(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating scan (mobile) */}
      <button
        onClick={() => setShowDetector(true)}
        className="fixed bottom-6 right-6 w-14 h-14 text-white rounded-full flex items-center justify-center transition-all z-40 lg:hidden"
        style={{
          background: "linear-gradient(135deg, #16a34a, #15803d)",
          boxShadow: "0 4px 20px rgba(22,163,74,0.4)",
        }}
      >
        <Camera className="h-6 w-6" />
      </button>
    </div>
  );
}
