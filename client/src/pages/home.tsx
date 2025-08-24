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
import { ShoppingCart, User, QrCode, LogOut, Plus, Sparkles, TrendingUp } from "lucide-react";
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
        title: "✨ Item Added!",
        description: "Product successfully added to your cart",
        className: "bg-green-50 border-green-200",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue shopping",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Oops! Something went wrong",
        description: "Failed to add item to cart. Please try again.",
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
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your smart cart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Modern Header */}
      <header className="sticky top-0 z-50 glass-effect border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="h-10 w-10 primary-gradient rounded-2xl flex items-center justify-center shadow-lg">
                <ShoppingCart className="text-white h-5 w-5" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  SmartCart
                </h1>
                <p className="text-xs text-gray-500">Smart Shopping</p>
              </div>
            </div>
            
            {/* Header Stats */}
            <div className="flex items-center space-x-6">
              {/* Cart Summary Badge */}
              <div className="flex items-center space-x-3 bg-white/70 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                <div className="text-sm">
                  <span className="font-semibold text-gray-900" data-testid="text-cart-count">
                    {cart?.items?.length || 0}
                  </span>
                  <span className="text-gray-500 ml-1">items</span>
                </div>
                {cart?.items && cart.items.length > 0 && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </div>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">
                    {(user as any)?.firstName || user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">Welcome back!</p>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Scanner Modal */}
        {showScanner && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg animate-slide-up">
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Barcode Scanner</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowScanner(false)}
                    className="text-gray-500"
                  >
                    ✕
                  </Button>
                </div>
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
              </CardContent>
            </Card>
          </div>
        )}

        {/* Welcome Section */}
        <div className="mb-8 text-center animate-fade-in">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Your Smart Cart
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Scan barcodes to add items instantly, manage your cart effortlessly, and checkout securely with Razorpay
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Scan to Add */}
          <Card className="card-hover animate-slide-up cursor-pointer" onClick={() => setShowScanner(true)}>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 primary-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QrCode className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Scan Barcode</h3>
              <p className="text-sm text-gray-600">
                Use your camera to scan product barcodes
              </p>
              <Button className="mt-4 primary-gradient" size="sm">
                Start Scanning
              </Button>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Cart Value</h3>
              <p className="text-sm text-gray-600 mb-2">Current total amount</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{cart?.items.reduce((sum, item) => sum + (parseFloat(item.product.price) * item.quantity), 0).toFixed(2) || '0.00'}
              </p>
            </CardContent>
          </Card>

          {/* Quick Checkout */}
          <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Quick Checkout</h3>
              <p className="text-sm text-gray-600 mb-2">
                {cart?.items.length || 0} items ready
              </p>
              <Button
                onClick={proceedToCheckout}
                disabled={!cart?.items.length}
                className="primary-gradient"
                size="sm"
              >
                Checkout Now
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Cart Section */}
        <Card className="animate-fade-in shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 primary-gradient rounded-lg flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Your Cart</h3>
                  <p className="text-sm text-gray-500">
                    {cart?.items.length || 0} items • Updated just now
                  </p>
                </div>
              </div>
              
              {cart?.items.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScanner(true)}
                  className="hover:bg-blue-50 border-blue-200"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add More
                </Button>
              )}
            </div>

            {/* Cart Items */}
            <div className="space-y-4">
              {!cart?.items || cart.items.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="h-8 w-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Your cart is empty
                  </h4>
                  <p className="text-gray-500 mb-6">
                    Scan your first barcode to get started with smart shopping
                  </p>
                  <Button
                    onClick={() => setShowScanner(true)}
                    className="primary-gradient"
                    data-testid="button-start-scanning"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Start Scanning
                  </Button>
                </div>
              ) : (
                cart?.items?.map((item, index) => (
                  <div key={item.id} className="animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                    <CartItem 
                      item={item} 
                      onQuantityChange={(itemId, newQuantity) => {
                        // This will be handled by CartItem's internal mutations
                      }}
                      onRemove={(itemId) => {
                        // This will be handled by CartItem's internal mutations
                      }}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Cart Summary */}
            {cart && cart.items.length > 0 && (
              <div className="animate-slide-up" style={{ animationDelay: '0.6s' }}>
                <CartSummary cart={cart} onCheckout={proceedToCheckout} />
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Floating Action Button for Scanner */}
      <Button
        onClick={() => setShowScanner(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full primary-gradient shadow-2xl hover:shadow-xl transition-all duration-300 animate-bounce-gentle z-40"
        data-testid="button-floating-scanner"
      >
        <QrCode className="h-6 w-6 text-white" />
      </Button>
    </div>
  );
}