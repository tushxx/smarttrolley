import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatIndianPrice } from "@/lib/formatPrice";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItemWithProduct } from "@shared/schema";

interface CartItemProps {
  item: CartItemWithProduct;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export default function CartItem({ item, onQuantityChange, onRemove }: CartItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async (newQuantity: number) => {
      setIsUpdating(true);
      const response = await apiRequest("PATCH", `/api/cart/items/${item.id}`, {
        quantity: newQuantity,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      onQuantityChange(item.quantity);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update item quantity",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUpdating(false);
    },
  });

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/cart/items/${item.id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      onRemove();
      toast({
        title: "Item Removed",
        description: "Item has been removed from your cart",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive",
      });
    },
  });

  const handleQuantityChange = (change: number) => {
    const newQuantity = item.quantity + change;
    if (newQuantity <= 0) {
      removeItemMutation.mutate();
    } else {
      updateQuantityMutation.mutate(newQuantity);
    }
  };

  const handleRemove = () => {
    removeItemMutation.mutate();
  };

  return (
    <div className="p-6 flex items-center space-x-4" data-testid={`cart-item-${item.id}`}>
      {/* Product Image */}
      <img
        src={item.product.imageUrl || "https://images.unsplash.com/photo-1586880244386-8b3e34c8382c?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150"}
        alt={item.product.name}
        className="w-16 h-16 rounded-lg object-cover"
        data-testid={`img-product-${item.id}`}
      />
      
      {/* Product Details */}
      <div className="flex-1">
        <h4 className="font-medium text-gray-900" data-testid={`text-product-name-${item.id}`}>
          {item.product.name}
        </h4>
        <p className="text-sm text-gray-500" data-testid={`text-product-brand-${item.id}`}>
          {item.product.brand}
        </p>
        {item.product.weight && (
          <p className="text-sm text-gray-500">
            {item.product.weight} {item.product.unit}
          </p>
        )}
      </div>
      
      {/* Quantity Controls */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => handleQuantityChange(-1)}
            disabled={isUpdating || updateQuantityMutation.isPending}
            size="sm"
            variant="outline"
            className="w-8 h-8 rounded-full p-0"
            data-testid={`button-decrease-${item.id}`}
          >
            <Minus className="h-3 w-3" />
          </Button>
          
          <span 
            className="w-8 text-center font-medium"
            data-testid={`text-quantity-${item.id}`}
          >
            {item.quantity}
          </span>
          
          <Button
            onClick={() => handleQuantityChange(1)}
            disabled={isUpdating || updateQuantityMutation.isPending}
            size="sm"
            variant="outline"
            className="w-8 h-8 rounded-full p-0"
            data-testid={`button-increase-${item.id}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        
        {/* Price */}
        <div className="text-right">
          <p className="font-semibold text-gray-900" data-testid={`text-price-${item.id}`}>
            {formatIndianPrice(parseFloat(item.product.price) * item.quantity)}
          </p>
          {item.quantity > 1 && (
            <p className="text-xs text-gray-500">
              {formatIndianPrice(item.product.price)} each
            </p>
          )}
        </div>
        
        {/* Remove Button */}
        <Button
          onClick={handleRemove}
          disabled={removeItemMutation.isPending}
          size="sm"
          variant="ghost"
          className="text-danger hover:text-red-600 p-1"
          data-testid={`button-remove-${item.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
