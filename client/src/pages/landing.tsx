import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Phone, Sparkles, QrCode, Zap, Shield, Star, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [mobileNumber, setMobileNumber] = useState("");
  const { toast } = useToast();

  const handleMobileLogin = () => {
    if (!mobileNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please enter your mobile number to continue.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Mobile Login",
      description: "Mobile login will be implemented with SMS verification. Using Google login for now.",
    });
    window.location.href = "/api/login";
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/login";
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
            <span>4.9 • 12k+ users</span>
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
                <span className="text-sm font-medium text-green-700">Now Live in Beta</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Smart Shopping
                <span className="block bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">
                  Made Simple
                </span>
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed">
                Experience the future of grocery shopping with AI-powered barcode scanning, 
                real-time inventory updates, and seamless payment processing.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Smart Scanning</p>
                  <p className="text-sm text-gray-500">AI-powered recognition</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Instant Updates</p>
                  <p className="text-sm text-gray-500">Real-time inventory</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Secure Payments</p>
                  <p className="text-sm text-gray-500">Razorpay integration</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Smart Suggestions</p>
                  <p className="text-sm text-gray-500">Personalized picks</p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <Button
              onClick={handleGoogleLogin}
              className="h-14 px-8 primary-gradient text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
              data-testid="button-get-started"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Right Content - Login Card */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md modern-card">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <div className="w-12 h-12 primary-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
                  <p className="text-gray-600 mt-1">Sign in to your smart cart</p>
                </div>

                <div className="space-y-6">
                  {/* Mobile Number Login */}
                  <div>
                    <Label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-3">
                      Mobile Number
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-gray-400" />
                      </div>
                      <Input
                        id="mobile"
                        name="mobile"
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="pl-11 h-12 border-gray-200 focus:border-green-500 focus:ring-green-500 rounded-xl"
                        data-testid="input-mobile"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleMobileLogin}
                    className="w-full h-12 primary-gradient font-semibold rounded-xl"
                    data-testid="button-mobile-login"
                  >
                    Continue with Mobile
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500 font-medium">Or continue with</span>
                    </div>
                  </div>

                  {/* Google Login */}
                  <Button
                    onClick={handleGoogleLogin}
                    variant="outline"
                    className="w-full h-12 border-2 border-gray-200 hover:border-gray-300 rounded-xl font-semibold transition-all duration-200 hover:bg-gray-50"
                    data-testid="button-google-login"
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </div>

                {/* Trust indicators */}
                <div className="mt-8 text-center">
                  <div className="flex justify-center items-center space-x-4 text-gray-400 text-xs">
                    <div className="flex items-center space-x-1">
                      <Shield className="h-3 w-3" />
                      <span>SSL Secured</span>
                    </div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <span>GDPR Compliant</span>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <span>SOC 2 Certified</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 pt-12 border-t border-gray-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">12k+</div>
            <div className="text-sm text-gray-600 mt-1">Active Users</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">98.9%</div>
            <div className="text-sm text-gray-600 mt-1">Accuracy Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">2.5s</div>
            <div className="text-sm text-gray-600 mt-1">Avg Scan Time</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">4.9★</div>
            <div className="text-sm text-gray-600 mt-1">User Rating</div>
          </div>
        </div>
      </div>
    </div>
  );
}