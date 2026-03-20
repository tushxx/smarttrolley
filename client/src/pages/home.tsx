import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import ItemDetector from "@/components/ItemDetector";
import CartItem from "@/components/CartItem";
import CartSummary from "@/components/CartSummary";
import {
  ShoppingCart, User, LogOut, Plus, Bell,
  Search, TrendingUp, Package, CreditCard, Camera, Scan,
} from "lucide-react";
import { useLocation } from "wouter";
import type { CartWithItems, Product } from "@shared/schema";

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
      const response = await apiRequest("POST", "/api/cart/items", {
        productId,
        quantity: 1,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Item Added!",
        description: "Product successfully added to your cart",
        className: "bg-green-50 border-green-200",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue shopping",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      if (error.message?.includes("already in cart")) {
        toast({
          title: "Already in Cart",
          description: "This item is already in your cart.",
          className: "bg-yellow-50 border-yellow-200",
        });
        return;
      }
      toast({
        title: "Something went wrong",
        description: error.message || "Failed to add item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleItemDetected = (product: Product | undefined) => {
    setShowDetector(false);
    if (!product) return;
    addToCartMutation.mutate(product.id);
  };

  const handleLogout = () => { window.location.href = "/api/logout"; };

  const proceedToCheckout = () => {
    if (!cart?.items || cart.items.length === 0) {
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
      <div className="min-h-screen modern-gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your smart cart...</p>
        </div>
      </div>
    );
  }

  const cartTotal = cart?.items?.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0
  ) || 0;

  return (
    <div className="min-h-screen modern-gradient-bg">
      {/* Header */}
      <header className="modern-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 primary-gradient rounded-2xl flex items-center justify-center">
                <ShoppingCart className="text-white h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SmartCart</h1>
                <p className="text-xs text-gray-500">AI-Powered Shopping</p>
              </div>
            </div>

            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="flex items-center space-x-3 bg-gray-50 rounded-full px-4 py-2 border border-gray-200">
                  <ShoppingCart className="h-4 w-4 text-gray-600" />
                  <div className="text-sm">
                    <span className="font-semibold text-gray-900">{cart?.items?.length || 0}</span>
                    <span className="text-gray-500 ml-1">items</span>
                  </div>
                  {cart?.items && cart.items.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4 text-gray-600" />
                <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </Button>
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">
                    {(user as any)?.firstName || (user as any)?.email?.split("@")[0] || "User"}
                  </p>
                  <p className="text-xs text-gray-500">Welcome back!</p>
                </div>
                <Button onClick={handleLogout} variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Item Detector Modal */}
      {showDetector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg modern-card">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-green-600" />
                  <h2 className="text-xl font-semibold">AI Item Detection</h2>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Point your camera at a product — the AI will recognize it automatically.
              </p>
              <ItemDetector
                onItemDetected={handleItemDetected}
                onClose={() => setShowDetector(false)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Good day, {(user as any)?.firstName || "there"}! 👋
          </h2>
          <p className="text-gray-600">
            Point your camera at any product to add it to your cart automatically.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="modern-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{cartTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-gray-600">Cart Total</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="modern-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{cart?.items?.length || 0}</p>
                <p className="text-sm text-gray-600">Items Detected</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="modern-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">YOLO</p>
                <p className="text-sm text-gray-600">AI Model</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card
            className="modern-card p-6 cursor-pointer hover:shadow-lg transition-all duration-200"
            onClick={() => setShowDetector(true)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900">Detect Item</p>
                <p className="text-sm text-gray-600">Use AI camera</p>
              </div>
              <div className="w-12 h-12 primary-gradient rounded-2xl flex items-center justify-center">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Quick Actions */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="modern-card">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button
                    onClick={() => setShowDetector(true)}
                    className="w-full justify-start h-12 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200"
                    variant="outline"
                  >
                    <Camera className="mr-3 h-4 w-4" />
                    Scan Item with AI Camera
                  </Button>

                  <Button
                    onClick={proceedToCheckout}
                    disabled={!cart?.items || cart.items.length === 0}
                    className="w-full justify-start h-12 primary-gradient text-white"
                  >
                    <CreditCard className="mr-3 h-4 w-4" />
                    Checkout ({cart?.items?.length || 0} items)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Supported Products */}
            <Card className="modern-card">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  AI Can Detect
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Perfume", icon: "🌸" },
                    { label: "Playing Cards", icon: "🃏" },
                    { label: "Face Wash", icon: "🧴" },
                    { label: "Earbuds", icon: "🎧" },
                    { label: "Shampoo", icon: "💆" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Cart */}
          <div className="lg:col-span-2">
            <Card className="modern-card">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 primary-gradient rounded-lg flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Your Cart</h3>
                      <p className="text-sm text-gray-500">
                        {cart?.items?.length || 0} items detected
                      </p>
                    </div>
                  </div>
                  {cart?.items && cart.items.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDetector(true)}
                      className="border-green-200 text-green-700 hover:bg-green-50"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add More
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  {!cart?.items || cart.items.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Scan className="h-8 w-8 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Cart is empty</h4>
                      <p className="text-gray-500 mb-6">
                        Point your camera at a product to add it automatically using AI detection
                      </p>
                      <Button
                        onClick={() => setShowDetector(true)}
                        className="primary-gradient"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Start AI Detection
                      </Button>
                    </div>
                  ) : (
                    cart.items.map((item, index) => (
                      <div key={item.id} className="animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                        <CartItem
                          item={item}
                          onQuantityChange={() => {}}
                          onRemove={() => {}}
                        />
                      </div>
                    ))
                  )}
                </div>

                {cart && cart.items && cart.items.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <CartSummary cart={cart} onCheckout={proceedToCheckout} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Floating Camera Button */}
      <Button
        onClick={() => setShowDetector(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full primary-gradient shadow-2xl hover:shadow-xl transition-all duration-300 z-40"
      >
        <Camera className="h-6 w-6 text-white" />
      </Button>
    </div>
  );
}
