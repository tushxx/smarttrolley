import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import ItemDetector from "@/components/ItemDetector";
import CartItem from "@/components/CartItem";
import { Camera, LogOut, ShoppingCart, Scan, CreditCard, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import type { CartWithItems } from "@shared/schema";

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="9" fill="#16a34a"/>
      <path d="M9 11h2.5l3 9h10l3-7H13.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="16" cy="22.5" r="1.8" fill="white"/>
      <circle cx="24" cy="22.5" r="1.8" fill="white"/>
      <circle cx="26" cy="13" r="3" fill="white" opacity="0.9"/>
      <circle cx="26" cy="13" r="1.4" fill="#16a34a"/>
      <circle cx="26.6" cy="12.4" r="0.4" fill="white"/>
    </svg>
  );
}

const DETECTABLE = [
  { name: "Perfume",       emoji: "🌸" },
  { name: "Playing Cards", emoji: "🃏" },
  { name: "Face Wash",     emoji: "🧴" },
  { name: "Earbuds",       emoji: "🎧" },
  { name: "Shampoo",       emoji: "🧴" },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [showDetector, setShowDetector] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: cart, isLoading: cartLoading } = useQuery<CartWithItems>({
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
      toast({ title: "Added to cart", className: "bg-white border border-gray-100 shadow-lg text-gray-900" });
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
    if (!cart?.items?.length) {
      toast({ title: "Cart is empty", variant: "destructive" }); return;
    }
    setLocation("/checkout");
  };

  const subtotal = cart?.items?.reduce((s, i) => s + parseFloat(i.product.price) * i.quantity, 0) ?? 0;
  const tax = subtotal * 0.18;
  const total = subtotal + tax;
  const itemCount = cart?.items?.length ?? 0;

  if (cartLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading your cart…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div>
            <span className="text-[15px] font-semibold text-gray-900 tracking-tight leading-none">SmartCart</span>
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">AI-Powered Shopping</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="font-medium text-gray-900">{itemCount}</span>
            <span>items</span>
            {itemCount > 0 && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse ml-1"></span>}
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <span className="text-sm text-gray-500 hidden sm:block">
            +{(user as any)?.phoneNumber}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1.5 rounded-md hover:bg-gray-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-72 bg-white border-r border-gray-100 flex flex-col shrink-0">
          <div className="p-5 flex-1 overflow-y-auto">

            {/* Scan button */}
            <button
              onClick={() => setShowDetector(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors shadow-sm shadow-green-100 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
                  <Camera className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold leading-none">Scan Item</p>
                  <p className="text-[11px] text-green-100 mt-0.5 leading-none">Use AI camera</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-green-200 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Checkout shortcut */}
            <button
              onClick={proceedToCheckout}
              disabled={!itemCount}
              className="w-full mt-2 flex items-center justify-between px-4 py-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium leading-none">Checkout</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-none">
                    {itemCount ? `${itemCount} item${itemCount !== 1 ? "s" : ""}` : "Cart empty"}
                  </p>
                </div>
              </div>
              {itemCount > 0 && (
                <span className="text-xs font-semibold text-gray-900">
                  ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              )}
            </button>

            {/* Divider */}
            <div className="my-5 border-t border-gray-100" />

            {/* What AI can detect */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                AI Can Detect
              </p>
              <div className="space-y-1">
                {DETECTABLE.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-base leading-none">{item.emoji}</span>
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="my-5 border-t border-gray-100" />

            {/* Model info */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Detection Engine
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Model</span>
                <span className="font-medium text-gray-700">YOLO11s</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Hardware</span>
                <span className="font-medium text-gray-700">Raspberry Pi 5</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Threshold</span>
                <span className="font-medium text-gray-700">50% confidence</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Status</span>
                <span className="flex items-center gap-1 font-medium text-green-600">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Online
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Cart area ── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Cart header */}
          <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Your Cart</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {itemCount === 0
                  ? "No items yet — scan something to get started"
                  : `${itemCount} item${itemCount !== 1 ? "s" : ""} detected by AI`}
              </p>
            </div>
            {itemCount > 0 && (
              <button
                onClick={() => setShowDetector(true)}
                className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-green-50"
              >
                <Camera className="h-4 w-4" />
                Scan another
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {!itemCount ? (
              /* Empty state */
              <div className="h-full flex flex-col items-center justify-center text-center max-w-xs mx-auto gap-5">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <Scan className="h-9 w-9 text-gray-300" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Cart is empty</h3>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                    Hold a product in front of the camera. The AI detects it and adds it here automatically.
                  </p>
                </div>
                <button
                  onClick={() => setShowDetector(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-green-100"
                >
                  <Camera className="h-4 w-4" />
                  Start AI Detection
                </button>
              </div>
            ) : (
              <div className="max-w-2xl space-y-2">
                {cart!.items.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onQuantityChange={() => {}}
                    onRemove={() => {}}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Checkout footer bar ── */}
          {itemCount > 0 && (
            <div className="bg-white border-t border-gray-100 px-8 py-4 flex items-center justify-between gap-6">
              <div className="flex items-center gap-8 text-sm">
                <div>
                  <span className="text-gray-400">Subtotal</span>
                  <span className="ml-2 font-medium text-gray-900">
                    ₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">GST (18%)</span>
                  <span className="ml-2 font-medium text-gray-900">
                    ₹{tax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="h-4 w-px bg-gray-200" />
                <div>
                  <span className="text-gray-500 font-medium">Total</span>
                  <span className="ml-2 text-lg font-bold text-gray-900">
                    ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <button
                onClick={proceedToCheckout}
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
              >
                <CreditCard className="h-4 w-4" />
                Pay ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── Scanner modal ── */}
      {showDetector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                  <Camera className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">AI Item Detection</h2>
                  <p className="text-xs text-gray-400">Hold product steady for 3 seconds</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetector(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-lg font-light leading-none px-1"
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

      {/* Floating scan button (mobile) */}
      <button
        onClick={() => setShowDetector(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-xl shadow-green-200 flex items-center justify-center transition-colors z-40 lg:hidden"
      >
        <Camera className="h-6 w-6" />
      </button>
    </div>
  );
}
