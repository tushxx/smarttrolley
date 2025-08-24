import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, CreditCard, Shield, Smartphone, CreditCard as CardIcon } from "lucide-react";
import { useLocation } from "wouter";
import type { CartWithItems } from "@shared/schema";

declare global {
  interface Window {
    Razorpay: any;
  }
}

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
        title: "Payment Successful",
        description: "Thank you for your purchase!",
      });
      setLocation("/");
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
    // For demo purposes, we'll simulate a successful payment
    // In production, you would load Razorpay script and create payment
    
    const options = {
      key: orderData.key,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "SmartCart",
      description: "Smart Shopping Cart Purchase",
      order_id: orderData.razorpayOrderId,
      handler: function (response: any) {
        // Payment successful
        verifyPaymentMutation.mutate({
          orderId: orderData.orderId,
          paymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
      },
      prefill: {
        name: "",
        email: "",
        contact: ""
      },
      theme: {
        color: "#3B82F6"
      }
    };

    // For demo, we'll simulate the payment process
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
    }, 2000);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    createOrderMutation.mutate();
  };

  const subtotal = cart.items.reduce((sum, item) => sum + (parseFloat(item.product.price) * item.quantity), 0);
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Checkout Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="flex items-center text-gray-600 hover:text-gray-900"
              data-testid="button-back-to-cart"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Cart
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">Checkout</h1>
            <div className="w-6"></div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Payment Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Payment Information</h2>
                
                {/* Payment Methods */}
                <div className="mb-6">
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="card" id="card" />
                      <Label htmlFor="card" className="flex items-center space-x-2 cursor-pointer">
                        <CardIcon className="h-4 w-4 text-gray-600" />
                        <span className="text-gray-900">Credit/Debit Card</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="upi" id="upi" />
                      <Label htmlFor="upi" className="flex items-center space-x-2 cursor-pointer">
                        <Smartphone className="h-4 w-4 text-gray-600" />
                        <span className="text-gray-900">UPI Payment</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="netbanking" id="netbanking" />
                      <Label htmlFor="netbanking" className="flex items-center space-x-2 cursor-pointer">
                        <CreditCard className="h-4 w-4 text-gray-600" />
                        <span className="text-gray-900">Net Banking</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Payment Form */}
                <form onSubmit={handlePayment} className="space-y-6">
                  {paymentMethod === "card" && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input 
                          id="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          className="mt-1"
                          data-testid="input-card-number"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="expiry">Expiry</Label>
                          <Input 
                            id="expiry"
                            placeholder="MM/YY"
                            className="mt-1"
                            data-testid="input-expiry"
                          />
                        </div>
                        <div>
                          <Label htmlFor="cvv">CVV</Label>
                          <Input 
                            id="cvv"
                            placeholder="123"
                            className="mt-1"
                            data-testid="input-cvv"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {paymentMethod === "upi" && (
                    <div>
                      <Label htmlFor="upiId">UPI ID</Label>
                      <Input 
                        id="upiId"
                        placeholder="yourname@upi"
                        className="mt-1"
                        data-testid="input-upi-id"
                      />
                    </div>
                  )}
                  
                  <Button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full bg-success text-white hover:bg-green-600"
                    data-testid="button-complete-payment"
                  >
                    {isProcessing ? (
                      <div className="flex items-center">
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Processing Payment...
                      </div>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Pay ₹{total.toFixed(2)}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
                
                {/* Order Items */}
                <div className="space-y-3 mb-6">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.product.name} × {item.quantity}
                      </span>
                      <span className="font-medium">
                        ₹{(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium" data-testid="text-subtotal">
                      ₹{subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium" data-testid="text-tax">
                      ₹{tax.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Delivery</span>
                    <span className="font-medium text-success">Free</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total</span>
                      <span className="text-primary" data-testid="text-total">
                        ₹{total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security Info */}
                <div className="mt-6 p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-success" />
                    <span className="text-sm text-gray-700">Secure payment powered by Razorpay</span>
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
      // Redirect to home if cart is empty
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
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return null; // Will redirect via useEffect
  }

  return <CheckoutForm cart={cart} />;
}