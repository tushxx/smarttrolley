import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatIndianPrice } from "@/lib/formatPrice";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItemWithProduct } from "@shared/schema";

interface CartItemProps {
  item: CartItemWithProduct;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

const PRODUCT_IMAGES: Record<string, string> = {
  Perfume: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=120&h=120&fit=crop",
  Cards: "https://images.unsplash.com/photo-1612404730960-5c71577fca11?w=120&h=120&fit=crop",
  Facewash: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=120&h=120&fit=crop",
  Earbuds: "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=120&h=120&fit=crop",
  Shampoo: "https://images.unsplash.com/photo-1631390015880-e37a6f7bede5?w=120&h=120&fit=crop",
};

export default function CartItem({ item }: CartItemProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (quantity: number) => {
      const res = await apiRequest("PATCH", `/api/cart/items/${item.id}`, { quantity });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cart"] }),
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/cart/items/${item.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({ title: "Item removed" });
    },
    onError: () => toast({ title: "Error", description: "Failed to remove", variant: "destructive" }),
  });

  const handleQty = (delta: number) => {
    const next = item.quantity + delta;
    if (next <= 0) removeMutation.mutate();
    else updateMutation.mutate(next);
  };

  const img = item.product.imageUrl
    || PRODUCT_IMAGES[item.product.detectionClass || ""]
    || "https://images.unsplash.com/photo-1586880244386-8b3e34c8382c?w=120&h=120&fit=crop";

  const lineTotal = parseFloat(item.product.price) * item.quantity;
  const isBusy = updateMutation.isPending || removeMutation.isPending;

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 flex items-center gap-4 px-4 py-3.5 hover:border-gray-200 transition-colors"
      data-testid={`cart-item-${item.id}`}
    >
      {/* Image */}
      <img
        src={img}
        alt={item.product.name}
        className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-50"
      />

      {/* Name / brand */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{item.product.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {item.product.brand || item.product.detectionClass}
        </p>
      </div>

      {/* Qty stepper */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleQty(-1)}
          disabled={isBusy}
          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <Minus className="h-3 w-3 text-gray-500" />
        </button>
        <span className="w-6 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
        <button
          onClick={() => handleQty(1)}
          disabled={isBusy}
          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <Plus className="h-3 w-3 text-gray-500" />
        </button>
      </div>

      {/* Price */}
      <div className="text-right w-20 shrink-0">
        <p className="text-sm font-bold text-gray-900">{formatIndianPrice(lineTotal)}</p>
        {item.quantity > 1 && (
          <p className="text-[10px] text-gray-400">{formatIndianPrice(parseFloat(item.product.price))} each</p>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={() => removeMutation.mutate()}
        disabled={isBusy}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
