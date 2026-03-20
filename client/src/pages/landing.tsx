import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Phone, Sparkles, QrCode, Zap, Shield, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Landing() {
  const [mobileNumber, setMobileNumber] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await apiRequest("POST", "/api/auth/phone", { phoneNumber });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (err: any) => {
      toast({
        title: "Login failed",
        description: err.message || "Could not start session. Try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogin = () => {
    const cleaned = mobileNumber.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(mobileNumber);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  const scrollToLogin = () => {
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen modern-gradient-bg">
      {/* Header */}
      <header className="p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 primary-gradient rounded-2xl flex items-center justify-center">
              <ShoppingCart className="text-white h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">SmartCart</h1>
              <p className="text-xs text-gray-500">Smart Shopping Experience</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span>AI-Powered · Final Year Project</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center space-x-2 bg-green-50 border border-green-200 rounded-full px-4 py-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-700">Live Demo · YOLO11s Detection</span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Scan. Add.
                <span className="block bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">
                  Checkout.
                </span>
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed">
                Point your camera at a product — our AI detects it in under 3 seconds
                and adds it straight to your cart. No barcodes. No manual entry.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Vision Detection</p>
                  <p className="text-sm text-gray-500">YOLO11s model</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Instant Add</p>
                  <p className="text-sm text-gray-500">2-frame confirm</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Secure Payments</p>
                  <p className="text-sm text-gray-500">Razorpay · INR</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">No Queues</p>
                  <p className="text-sm text-gray-500">Self-checkout</p>
                </div>
              </div>
            </div>

            <Button
              onClick={scrollToLogin}
              className="h-14 px-8 primary-gradient text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Get Started — It's Free
            </Button>
          </div>

          {/* Right Content — Login Card */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md modern-card">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <div className="w-12 h-12 primary-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Phone className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Welcome to SmartCart</h2>
                  <p className="text-gray-500 mt-1 text-sm">Enter your mobile number to begin</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <Label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-2">
                      Mobile Number
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-gray-400" />
                      </div>
                      <Input
                        ref={inputRef}
                        id="mobile"
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="+91 98765 43210"
                        className="pl-11 h-12 border-gray-200 focus:border-green-500 focus:ring-green-500 rounded-xl"
                        disabled={loginMutation.isPending}
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleLogin}
                    disabled={loginMutation.isPending || mobileNumber.replace(/\D/g, "").length < 10}
                    className="w-full h-12 primary-gradient font-semibold rounded-xl text-base"
                  >
                    {loginMutation.isPending ? "Starting session…" : "Start Shopping →"}
                  </Button>

                  <p className="text-center text-xs text-gray-400 pt-1">
                    No OTP · No password · No account needed
                  </p>
                </div>

                {/* Trust indicators */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="flex justify-center items-center space-x-4 text-gray-400 text-xs">
                    <div className="flex items-center space-x-1">
                      <Shield className="h-3 w-3" />
                      <span>Session secured</span>
                    </div>
                    <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                    <span>5 product classes</span>
                    <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                    <span>Razorpay payments</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 pt-12 border-t border-gray-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">5</div>
            <div className="text-sm text-gray-600 mt-1">Product Classes</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">&gt;90%</div>
            <div className="text-sm text-gray-600 mt-1">Detection Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">3s</div>
            <div className="text-sm text-gray-600 mt-1">Avg Detect Time</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">0₹</div>
            <div className="text-sm text-gray-600 mt-1">Setup Cost</div>
          </div>
        </div>
      </div>
    </div>
  );
}
