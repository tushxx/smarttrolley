import { Button } from "@/components/ui/button";
import { formatIndianPrice } from "@/lib/formatPrice";
import { CreditCard } from "lucide-react";
import type { CartWithItems } from "@shared/schema";

interface CartSummaryProps {
  cart: CartWithItems;
  onCheckout: () => void;
}

export default function CartSummary({ cart, onCheckout }: CartSummaryProps) {
  const subtotal = cart.items.reduce((sum, item) => {
    return sum + (parseFloat(item.product.price) * item.quantity);
  }, 0);
  
  const taxRate = 0.08; // 8% tax
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return (
    <div className="p-6 bg-gray-50 border-t border-gray-200">
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium" data-testid="text-summary-subtotal">
            {formatIndianPrice(subtotal)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax (GST 18%)</span>
          <span className="font-medium" data-testid="text-summary-tax">
            {formatIndianPrice(tax)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Delivery</span>
          <span className="font-medium text-success">Free</span>
        </div>
        <div className="border-t pt-3">
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span className="text-primary" data-testid="text-summary-total">
              {formatIndianPrice(total)}
            </span>
          </div>
        </div>
      </div>
      
      <Button
        onClick={onCheckout}
        className="w-full mt-6 bg-primary text-white hover:bg-blue-700"
        data-testid="button-proceed-checkout"
      >
        <CreditCard className="mr-2 h-4 w-4" />
        Proceed to Checkout
      </Button>
    </div>
  );
}
