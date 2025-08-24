import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Phone, Sparkles, QrCode, Zap, Shield } from "lucide-react";
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
    <div className="min-h-screen gradient-dark-bg">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 via-emerald-400/10 to-green-600/10"></div>
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-br from-green-400/30 to-emerald-600/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-gradient-to-br from-emerald-400/30 to-green-800/30 rounded-full blur-3xl"></div>
        
        <div className="relative flex flex-col justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 animate-fade-in">
            <div className="mx-auto h-24 w-24 primary-gradient rounded-3xl flex items-center justify-center mb-8 shadow-xl animate-bounce-gentle">
              <ShoppingCart className="text-white h-12 w-12" />
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-white via-green-300 to-white bg-clip-text text-transparent mb-4">
              SmartCart
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Experience the future of shopping with intelligent barcode scanning, seamless payments, and instant cart management
            </p>
            
            {/* Features showcase */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
              <div className="glass-dark-effect rounded-2xl p-6 animate-slide-up">
                <QrCode className="h-8 w-8 text-green-400 mx-auto mb-3" />
                <h3 className="font-semibold text-white mb-2">Smart Scanning</h3>
                <p className="text-sm text-gray-300">Instant barcode recognition with AI-powered product detection</p>
              </div>
              <div className="glass-dark-effect rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <Zap className="h-8 w-8 text-green-400 mx-auto mb-3" />
                <h3 className="font-semibold text-white mb-2">Lightning Fast</h3>
                <p className="text-sm text-gray-300">Add items to cart in seconds with real-time inventory sync</p>
              </div>
              <div className="glass-dark-effect rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                <Shield className="h-8 w-8 text-green-400 mx-auto mb-3" />
                <h3 className="font-semibold text-white mb-2">Secure Payments</h3>
                <p className="text-sm text-gray-300">Integrated Razorpay for UPI, cards, and net banking</p>
              </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="max-w-md mx-auto w-full animate-slide-up" style={{ animationDelay: '0.6s' }}>
            <Card className="shadow-2xl border-0 glass-light">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <Sparkles className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <h2 className="text-2xl font-bold text-gray-900">Get Started</h2>
                  <p className="text-gray-600 mt-1">Join the smart shopping revolution</p>
                </div>

                <div className="space-y-6">
                  {/* Mobile Number Login */}
                  <div>
                    <Label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full h-12 primary-gradient hover:shadow-lg transition-all duration-300 rounded-xl font-semibold"
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
                    className="w-full h-12 border-2 border-gray-200 hover:border-gray-300 rounded-xl font-semibold transition-all duration-300 hover:shadow-md"
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
                  <p className="text-xs text-gray-500 mb-3">Trusted by thousands of users</p>
                  <div className="flex justify-center items-center space-x-4 text-gray-400">
                    <Shield className="h-4 w-4" />
                    <span className="text-xs">256-bit SSL</span>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <span className="text-xs">GDPR Compliant</span>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <span className="text-xs">SOC 2 Certified</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}