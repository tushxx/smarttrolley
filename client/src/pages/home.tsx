import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import ItemDetector from "@/components/ItemDetector";
import CartItem from "@/components/CartItem";
import { Camera, LogOut, ShoppingCart, Scan, CreditCard, ChevronRight, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import type { CartWithItems } from "@shared/schema";
import {
  expectedCartWeightG,
  lastPendingGramItem,
  cartSubtotal,
  WEIGHT_ERROR_THRESHOLD_G,
  WEIGHT_ASSIGN_MIN_G,
  hasUnweighedGramProduct,
} from "@/lib/cartPricing";

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
  { name: "Appy Fizz",      emoji: "🥤" },
  { name: "Frooti",         emoji: "🧃" },
  { name: "Moisturizer",    emoji: "🧴" },
  { name: "Soap",           emoji: "🧼" },
  { name: "Water Bottle",   emoji: "💧" },
];

type WeightApiResponse = {
  weight_g: number;
  raw?: number | null;
  sensor_ok?: boolean;
  error?: string;
};

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

  const { data: weightData } = useQuery<WeightApiResponse>({
    queryKey: ["/api/weight"],
    refetchInterval: 1000, // poll every 1 second
    retry: false,
  });

  const addToCartMutation = useMutation({
    mutationFn: async (payload: { productId: string; measuredWeight?: string; quantity?: number }) => {
      const res = await apiRequest("POST", "/api/cart/items", { quantity: 1, ...payload });
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

  const syncWeightMutation = useMutation({
    mutationFn: async ({ itemId, measuredWeight }: { itemId: string; measuredWeight: string }) => {
      const res = await apiRequest("PATCH", `/api/cart/items/${itemId}`, { measuredWeight });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cart"] }),
    onError: (error: Error) => {
      toast({ title: "Scale sync failed", description: error.message, variant: "destructive" });
    },
  });

  const cartRef = useRef(cart);
  cartRef.current = cart;
  const weightDataRef = useRef(weightData);
  weightDataRef.current = weightData;

  useEffect(() => {
    if (syncWeightMutation.isPending) return;
    const w = weightData?.weight_g;
    if (w === undefined) return;

    const c = cartRef.current;
    if (!c?.items?.length) return;

    const expected = expectedCartWeightG(c);
    const delta = w - expected;
    const pending = lastPendingGramItem(c);
    if (!pending || delta < WEIGHT_ASSIGN_MIN_G) return;

    const t = setTimeout(() => {
      const c2 = cartRef.current;
      const wd = weightDataRef.current;
      const w2 = wd?.weight_g;
      if (w2 === undefined || !c2?.items?.length) return;
      const exp2 = expectedCartWeightG(c2);
      const d2 = w2 - exp2;
      const pend2 = lastPendingGramItem(c2);
      if (!pend2 || pend2.id !== pending.id) return;
      if (d2 < WEIGHT_ASSIGN_MIN_G || Math.abs(d2 - delta) > 8) return;
      const grams = Math.max(0, Math.round(d2));
      if (grams >= WEIGHT_ASSIGN_MIN_G) {
        syncWeightMutation.mutate({ itemId: pend2.id, measuredWeight: String(grams) });
      }
    }, 750);

    return () => clearTimeout(t);
  }, [weightData?.weight_g, cart?.items, syncWeightMutation, syncWeightMutation.isPending]);

  const expectedWeight = expectedCartWeightG(cart);
  const actualWeight = weightData?.weight_g ?? 0;
  const weightDelta = actualWeight - expectedWeight;
  const hasPendingGramAwaitingScale = lastPendingGramItem(cart) !== undefined;

  const hasUnscannedWeightOnScale =
    weightDelta > WEIGHT_ERROR_THRESHOLD_G &&
    !(hasPendingGramAwaitingScale && weightDelta >= WEIGHT_ASSIGN_MIN_G);

  const hasRemovedWithoutScan =
    !!cart?.items?.length && weightDelta < -WEIGHT_ERROR_THRESHOLD_G;

  const hasAnomaly = hasUnscannedWeightOnScale || hasRemovedWithoutScan;

  const handleItemDetected = (product: { id: string; unit: string }) => {
    setShowDetector(false);
    addToCartMutation.mutate({ productId: product.id, quantity: 1 });
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
    if (hasUnweighedGramProduct(cart)) {
      toast({
        title: "Weight required",
        description: "Place the scanned loose item on the scale so its weight can be recorded.",
        variant: "destructive",
      });
      return;
    }
    if (hasAnomaly) {
      toast({ title: "Weight Anomaly", description: "Please resolve the weight error before checkout.", variant: "destructive" }); return;
    }
    setLocation("/checkout");
  };

  const tareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/weight/tare", {});
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Tare failed");
      }
      return data;
    },
    onSuccess: (data: { ok?: boolean; message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/weight"] });
      toast({
        title: "Scale tared",
        description: data.message || "You can add items to the basket.",
        className: "bg-white border border-gray-100 shadow-lg text-gray-900",
      });
    },
    onError: (e: Error) => toast({ title: "Tare failed", description: e.message, variant: "destructive" }),
  });

  const subtotal = cart?.items?.length ? cartSubtotal(cart.items) : 0;
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

      {/* ── Anomaly Alert Banner ── */}
      {hasAnomaly && (
        <div className="bg-red-50 border-b border-red-100 px-6 py-3 flex items-center justify-center gap-3 shadow-inner z-40">
          <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
          <p className="text-sm font-semibold text-red-700 text-center max-w-2xl">
            {hasUnscannedWeightOnScale
              ? `Weight increased by about ${Math.round(weightDelta)} g but no matching scan was completed. Remove the item or scan it with the camera before continuing.`
              : `Basket is lighter than your cart by about ${Math.round(-weightDelta)} g. Remove the item from the cart screen or put it back in the basket.`}
          </p>
        </div>
      )}

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
              disabled={!itemCount || hasAnomaly}
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
              {itemCount > 0 && !hasAnomaly && (
                <span className="text-xs font-semibold text-gray-900">
                  ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              )}
              {hasAnomaly && (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </button>

            {/* Live scale + tare */}
            <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Scale (live)</span>
                {!weightData?.sensor_ok && (
                  <span className="text-amber-600">Sensor offline / sim</span>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  {Math.round(actualWeight)} g
                </span>
                <span className="text-[11px] text-gray-400">
                  expected {Math.round(expectedWeight)} g
                </span>
              </div>
              <button
                type="button"
                onClick={() => tareMutation.mutate()}
                disabled={tareMutation.isPending}
                className="mt-2 w-full text-[11px] font-medium text-green-700 hover:text-green-800 py-1.5 rounded-lg border border-green-200 bg-white hover:bg-green-50/50 disabled:opacity-50"
              >
                Tare scale (empty basket first)
              </button>
            </div>

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
                disabled={hasAnomaly}
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
              >
                <CreditCard className="h-4 w-4" />
                {hasAnomaly ? "Resolve Error" : `Pay ₹${total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
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
