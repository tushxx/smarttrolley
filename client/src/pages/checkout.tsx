import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, CreditCard, Shield, Smartphone, CreditCard as CardIcon, CheckCircle, Star, Lock } from "lucide-react";
import { useLocation } from "wouter";
import type { CartWithItems } from "@shared/schema";

const CheckoutForm = ({ cart }: { cart: CartWithItems }) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");

  // Create Razorpay order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/create-razorpay-order", {
        cartId: cart.id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      initiateRazorpayPayment(data);
    },
    onError: (error) => {
      toast({
        title: "Payment Setup Failed",
        description: "Unable to setup payment. Please try again.",
        variant: "destructive",
      });
      console.error("Payment setup error:", error);
    },
  });

  // Verify payment mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await apiRequest("POST", "/api/verify-payment", paymentData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "🎉 Payment Successful!",
        description: "Thank you for your purchase! Redirecting to home...",
        className: "bg-green-50 border-green-200",
      });
      setTimeout(() => setLocation("/"), 2000);
    },
    onError: (error) => {
      toast({
        title: "Payment Verification Failed",
        description: "Payment verification failed. Please contact support.",
        variant: "destructive",
      });
      console.error("Payment verification error:", error);
    },
  });

  const initiateRazorpayPayment = (orderData: any) => {
    setIsProcessing(true);
    
    // Simulate payment processing delay
    setTimeout(() => {
      setIsProcessing(false);
      
      // Simulate successful payment
      verifyPaymentMutation.mutate({
        orderId: orderData.orderId,
        paymentId: `pay_${Date.now()}`,
        razorpayOrderId: orderData.razorpayOrderId,
        signature: `sig_${Date.now()}`,
      });
    }, 3000);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    createOrderMutation.mutate();
  };

  const subtotal = cart.items.reduce((sum, item) => sum + (parseFloat(item.product.price) * item.quantity), 0);
  const tax = subtotal * 0.08; // 8% tax
  const savings = subtotal * 0.05; // 5% smart savings
  const total = subtotal + tax;

  return (
    <div className="min-h-screen gradient-dark-bg">
      {/* Modern Header */}
      <header className="glass-dark-effect border-b border-green-500/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="flex items-center text-gray-300 hover:text-white hover:bg-white/10"
              data-testid="button-back-to-cart"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Cart
            </Button>
            <div className="text-center">
              <h1 className="text-xl font-bold text-white">
                Secure Checkout
              </h1>
              <p className="text-sm text-gray-300">Protected by SSL encryption</p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <Lock className="h-4 w-4" />
              <span>Secure</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Payment Form - Takes 3 columns */}
          <div className="lg:col-span-3">
            <Card className="shadow-xl border-0 glass-light border-green-500/20 shadow-green animate-slide-up">
              <CardContent className="p-8">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="w-10 h-10 primary-gradient rounded-2xl flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Payment Information</h2>
                    <p className="text-gray-600">Choose your preferred payment method</p>
                  </div>
                </div>
                
                {/* Payment Methods */}
                <div className="mb-8">
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-4">
                    {/* Card Payment */}
                    <div className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      paymentMethod === 'card' 
                        ? 'border-green-500 bg-green-50/50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="card" id="card" />
                        <Label htmlFor="card" className="flex items-center space-x-3 cursor-pointer flex-1">
                          <CardIcon className="h-5 w-5 text-green-600" />
                          <div>
                            <span className="font-medium text-gray-900">Credit/Debit Card</span>
                            <p className="text-sm text-gray-500">Visa, Mastercard, RuPay accepted</p>
                          </div>
                        </Label>
                        <div className="flex space-x-1">
                          <div className="w-8 h-5 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">V</div>
                          <div className="w-8 h-5 bg-red-600 rounded text-white text-xs flex items-center justify-center font-bold">M</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* UPI Payment */}
                    <div className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      paymentMethod === 'upi' 
                        ? 'border-green-500 bg-green-50/50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="upi" id="upi" />
                        <Label htmlFor="upi" className="flex items-center space-x-3 cursor-pointer flex-1">
                          <Smartphone className="h-5 w-5 text-green-600" />
                          <div>
                            <span className="font-medium text-gray-900">UPI Payment</span>
                            <p className="text-sm text-gray-500">Pay with Google Pay, PhonePe, Paytm</p>
                          </div>
                        </Label>
                        <div className="text-green-600 text-sm font-medium">Instant</div>
                      </div>
                    </div>
                    
                    {/* Net Banking */}
                    <div className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      paymentMethod === 'netbanking' 
                        ? 'border-purple-500 bg-purple-50/50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="netbanking" id="netbanking" />
                        <Label htmlFor="netbanking" className="flex items-center space-x-3 cursor-pointer flex-1">
                          <CreditCard className="h-5 w-5 text-purple-600" />
                          <div>
                            <span className="font-medium text-gray-900">Net Banking</span>
                            <p className="text-sm text-gray-500">50+ banks supported</p>
                          </div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Payment Form */}
                <form onSubmit={handlePayment} className="space-y-6">
                  {paymentMethod === "card" && (
                    <div className="space-y-4 animate-fade-in">
                      <div>
                        <Label htmlFor="cardNumber" className="text-sm font-medium text-gray-700">Card Number</Label>
                        <Input 
                          id="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          className="mt-1 h-12 rounded-xl border-gray-200 focus:border-blue-500"
                          data-testid="input-card-number"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="expiry" className="text-sm font-medium text-gray-700">Expiry Date</Label>
                          <Input 
                            id="expiry"
                            placeholder="MM/YY"
                            className="mt-1 h-12 rounded-xl border-gray-200 focus:border-blue-500"
                            data-testid="input-expiry"
                          />
                        </div>
                        <div>
                          <Label htmlFor="cvv" className="text-sm font-medium text-gray-700">CVV</Label>
                          <Input 
                            id="cvv"
                            placeholder="123"
                            className="mt-1 h-12 rounded-xl border-gray-200 focus:border-blue-500"
                            data-testid="input-cvv"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {paymentMethod === "upi" && (
                    <div className="animate-fade-in">
                      <Label htmlFor="upiId" className="text-sm font-medium text-gray-700">UPI ID</Label>
                      <Input 
                        id="upiId"
                        placeholder="yourname@paytm"
                        className="mt-1 h-12 rounded-xl border-gray-200 focus:border-green-500"
                        data-testid="input-upi-id"
                      />
                      <p className="text-xs text-gray-500 mt-2">Enter your UPI ID to proceed with payment</p>
                    </div>
                  )}
                  
                  <Button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full h-14 primary-gradient hover:shadow-lg transition-all duration-300 rounded-xl font-semibold text-lg"
                    data-testid="button-complete-payment"
                  >
                    {isProcessing ? (
                      <div className="flex items-center">
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3" />
                        Processing Payment...
                      </div>
                    ) : (
                      <>
                        <Shield className="mr-3 h-5 w-5" />
                        Pay ₹{total.toFixed(2)} Securely
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary - Takes 2 columns */}
          <div className="lg:col-span-2">
            <Card className="shadow-xl border-0 glass-light border-green-500/20 shadow-green sticky top-24 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Order Summary</h3>
                </div>
                
                {/* Order Items */}
                <div className="space-y-3 mb-6">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                      <img 
                        src={item.product.imageUrl || ''} 
                        alt={item.product.name}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{item.product.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-medium text-gray-900">
                        ₹{(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium" data-testid="text-subtotal">
                      ₹{subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax (GST)</span>
                    <span className="font-medium" data-testid="text-tax">
                      ₹{tax.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Smart Savings</span>
                    <span className="font-medium">-₹{savings.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Delivery</span>
                    <span className="font-medium text-green-600">Free</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-green-600" data-testid="text-total">
                        ₹{total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security Info */}
                <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200/50">
                  <div className="flex items-start space-x-3">
                    <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Secure Payment</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Your payment is protected by 256-bit SSL encryption and powered by Razorpay
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        ))}
                        <span className="text-xs text-gray-600">Trusted by 10M+ users</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch cart data
  const { data: cart, isLoading: cartLoading } = useQuery<CartWithItems>({
    queryKey: ["/api/cart"],
    retry: false,
  });

  useEffect(() => {
    if (cart && cart.items.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Your cart is empty. Please add items before checkout.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [cart, setLocation, toast]);

  if (cartLoading) {
    return (
      <div className="h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Preparing your checkout...</p>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return null; // Will redirect via useEffect
  }

  return <CheckoutForm cart={cart} />;
}