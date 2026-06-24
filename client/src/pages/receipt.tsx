import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ShoppingBag,
  Printer,
  Home,
  Calendar,
  CreditCard,
  Hash,
  Tag,
  Package,
  Store,
  Leaf,
} from "lucide-react";
import type { OrderWithItems } from "@shared/schema";
import { formatIndianPrice } from "@/lib/formatPrice";

function getItemPrice(item: OrderWithItems["items"][number]): number {
  const p = item.product;
  if (p.unit === "grams" && item.measuredWeight && p.weight) {
    const base = parseFloat(p.price);
    const baseW = parseFloat(p.weight.toString());
    const measuredW = parseFloat(item.measuredWeight.toString());
    return (base / baseW) * measuredW;
  }
  return parseFloat(p.price) * item.quantity;
}

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(d: Date | string | null) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function shortId(id: string) {
  return id.slice(-8).toUpperCase();
}

export default function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [, setLocation] = useLocation();

  const { data: order, isLoading, isError } = useQuery<OrderWithItems>({
    queryKey: [`/api/orders/${orderId}`],
    retry: false,
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen modern-gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your receipt...</p>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="min-h-screen modern-gradient-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <Package className="h-16 w-16 text-gray-300 mx-auto" />
          <h2 className="text-xl font-bold text-gray-700">Receipt not found</h2>
          <p className="text-gray-500">This receipt may have expired or is unavailable.</p>
          <Button onClick={() => setLocation("/")} className="primary-gradient rounded-2xl">
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const subtotal = parseFloat(order.subtotal);
  const tax = parseFloat(order.tax);
  const total = parseFloat(order.total);
  const savings = subtotal * 0.05;

  return (
    <div className="min-h-screen modern-gradient-bg py-8 px-4">
      {/* Page Header (hidden on print) */}
      <div className="max-w-2xl mx-auto mb-6 no-print">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </button>
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="flex items-center gap-2 rounded-2xl border-gray-300 hover:border-green-400 hover:text-green-700"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* ────────────────────────────── RECEIPT ────────────────────────────── */}
      <div
        id="receipt-container"
        className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Green Success Banner */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-8 text-white text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-white/20 rounded-full p-3">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Successful!</h1>
          <p className="text-green-100 text-sm mt-1">Thank you for shopping with SmartTrolley</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-5 py-2">
            <span className="text-green-100 text-xs font-medium">Amount Paid</span>
            <span className="text-white text-xl font-bold">{formatIndianPrice(total)}</span>
          </div>
        </div>

        {/* Store Info */}
        <div className="flex items-center justify-center gap-3 py-5 border-b border-dashed border-gray-200 bg-gray-50/60">
          <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-800 text-lg leading-tight">SmartTrolley</p>
            <p className="text-xs text-gray-400">AI-Powered Smart Shopping</p>
          </div>
        </div>

        {/* Receipt Meta */}
        <div className="px-8 py-5 grid grid-cols-2 gap-4 text-sm border-b border-dashed border-gray-200">
          <div className="flex items-start gap-3">
            <Hash className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Receipt #</p>
              <p className="font-mono font-bold text-gray-800 text-base">{shortId(order.id)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Date & Time</p>
              <p className="font-medium text-gray-800">{formatDate(order.createdAt)}</p>
              <p className="text-xs text-gray-500">{formatTime(order.createdAt)}</p>
            </div>
          </div>
          {order.razorpayPaymentId && (
            <div className="col-span-2 flex items-start gap-3">
              <CreditCard className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Razorpay Payment ID</p>
                <p className="font-mono text-gray-700 text-sm break-all">{order.razorpayPaymentId}</p>
              </div>
            </div>
          )}
          <div className="col-span-2 flex items-center gap-3">
            <Tag className="h-4 w-4 text-gray-400 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Status</span>
              <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {order.status === "paid" ? "Paid" : order.status}
              </span>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="px-8 py-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-4 w-4 text-gray-500" />
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Items Purchased</h3>
          </div>

          <div className="space-y-3">
            {order.items.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">No item details available for this order.</p>
            ) : (
              order.items.map((item) => {
                const itemTotal = getItemPrice(item);
                const isWeighted = item.product.unit === "grams";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center shrink-0">
                        {isWeighted ? (
                          <Leaf className="h-5 w-5 text-green-500" />
                        ) : (
                          <Package className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm leading-tight">{item.product.name}</p>
                        <p className="text-xs text-gray-400">{item.product.brand}</p>
                        {isWeighted && item.measuredWeight ? (
                          <p className="text-xs text-green-600 font-medium mt-0.5">
                            {parseFloat(item.measuredWeight.toString()).toFixed(0)}g weighed
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Qty: {item.quantity} × {formatIndianPrice(parseFloat(item.product.price))}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="font-bold text-gray-800 text-sm shrink-0">{formatIndianPrice(itemTotal)}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="mx-8 mb-5 rounded-2xl bg-gray-50 border border-gray-100 px-6 py-4 space-y-2.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span className="font-medium">{formatIndianPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Smart Savings (5%)</span>
            <span className="font-medium">−{formatIndianPrice(savings)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>GST (8%)</span>
            <span className="font-medium">{formatIndianPrice(tax)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Delivery</span>
            <span className="font-medium text-green-600">Free</span>
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="text-base font-bold text-gray-800">Total Paid</span>
            <span className="text-base font-bold text-green-600">{formatIndianPrice(total)}</span>
          </div>
        </div>

        {/* Barcode-style divider */}
        <div className="mx-8 mb-5 flex gap-0.5 h-10 items-end opacity-20">
          {Array.from({ length: 56 }, (_, i) => (
            <div
              key={i}
              className="bg-gray-800 flex-1 rounded-sm"
              style={{ height: `${Math.random() * 70 + 30}%` }}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 text-center text-xs text-gray-400 space-y-1">
          <p className="font-medium text-gray-500">🛒 SmartTrolley — AI Smart Shopping</p>
          <p>Thank you for your purchase! We hope to see you again.</p>
          <p className="font-mono text-gray-300 mt-2 break-all">{order.id}</p>
        </div>
      </div>

      {/* Action Buttons (hidden on print) */}
      <div className="max-w-2xl mx-auto mt-6 flex gap-3 no-print">
        <Button
          onClick={() => window.print()}
          variant="outline"
          className="flex-1 h-12 rounded-2xl border-gray-300 font-semibold hover:border-green-400 hover:text-green-700"
        >
          <Printer className="mr-2 h-4 w-4" />
          Print Receipt
        </Button>
        <Button
          onClick={() => setLocation("/")}
          className="flex-1 h-12 primary-gradient rounded-2xl font-semibold"
        >
          <Home className="mr-2 h-4 w-4" />
          Back to Shopping
        </Button>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          #receipt-container {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
