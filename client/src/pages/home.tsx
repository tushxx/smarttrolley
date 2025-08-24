import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import BarcodeScanner from "@/components/BarcodeScanner";
import CartItem from "@/components/CartItem";
import CartSummary from "@/components/CartSummary";
import { ShoppingCart, User, QrCode } from "lucide-react";
import { useLocation } from "wouter";
import type { CartWithItems } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showScanner, setShowScanner] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch cart data
  const { data: cart, isLoading: cartLoading } = useQuery<CartWithItems>({
    queryKey: ["/api/cart"],
    retry: false,
  });

  // Add item to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("POST", "/api/cart/items", {
        productId,
        quantity: 1,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Item Added",
        description: "Product successfully added to your cart!",
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
        description: "Failed to add item to cart",
        variant: "destructive",
      });
    },
  });

  // Handle barcode scan
  const handleBarcodeScanned = async (barcode: string) => {
    try {
      const response = await apiRequest("GET", `/api/products/barcode/${barcode}`);
      const product = await response.json();
      
      if (product) {
        addToCartMutation.mutate(product.id);
        setShowScanner(false);
      }
    } catch (error) {
      toast({
        title: "Product Not Found",
        description: "This barcode is not in our database. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const proceedToCheckout = () => {
    if (!cart?.items.length) {
      toast({
        title: "Empty Cart",
        description: "Please add items to your cart before checkout.",
        variant: "destructive",
      });
      return;
    }
    setLocation("/checkout");
  };

  if (cartLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                <ShoppingCart className="text-white h-4 w-4" />
              </div>
              <h1 className="ml-3 text-xl font-semibold text-gray-900">SmartCart</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Cart Summary */}
              <div className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium" data-testid="text-cart-count">
                  {cart?.items.length || 0} items
                </span>
                <span className="text-sm font-bold text-primary" data-testid="text-cart-total">
                  ${cart?.items.reduce((total, item) => total + (parseFloat(item.product.price) * item.quantity), 0).toFixed(2) || "0.00"}
                </span>
              </div>
              
              {/* User Menu */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                data-testid="button-logout"
              >
                <User className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Barcode Scanner Section */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="mx-auto w-24 h-24 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center mb-4">
                <QrCode className="text-white h-8 w-8" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Scan Product Barcode</h2>
              <p className="text-gray-600 mb-6">Point your camera at the product barcode to add it to your cart</p>
              
              {showScanner ? (
                <div className="mb-4">
                  <BarcodeScanner
                    onScan={handleBarcodeScanned}
                    onError={(error) => {
                      toast({
                        title: "Scanner Error",
                        description: error.message,
                        variant: "destructive",
                      });
                    }}
                  />
                  <Button
                    onClick={() => setShowScanner(false)}
                    variant="outline"
                    className="mt-4"
                    data-testid="button-stop-scanner"
                  >
                    Stop Scanning
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowScanner(true)}
                  className="bg-accent text-white hover:bg-green-600"
                  data-testid="button-start-scanner"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Start Scanning
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shopping Cart */}
        <Card>
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Your Cart</h3>
              <span className="text-sm text-gray-500" data-testid="text-cart-items">
                {cart?.items.length || 0} items
              </span>
            </div>
          </div>

          {/* Cart Items */}
          <div className="divide-y divide-gray-200">
            {cart?.items.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>Your cart is empty</p>
                <p className="text-sm">Scan a product to get started!</p>
              </div>
            ) : (
              cart?.items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onQuantityChange={(quantity) => {
                    // Handle quantity update
                    queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
                  }}
                  onRemove={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
                  }}
                />
              ))
            )}
          </div>

          {/* Cart Summary */}
          {cart && cart.items.length > 0 && (
            <CartSummary cart={cart} onCheckout={proceedToCheckout} />
          )}
        </Card>
      </main>

      {/* Floating Action Button for Scanner */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setShowScanner(!showScanner)}
          className="w-16 h-16 bg-accent text-white rounded-full shadow-lg hover:bg-green-600"
          data-testid="button-fab-scanner"
        >
          <QrCode className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
