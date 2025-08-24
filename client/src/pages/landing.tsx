import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Phone } from "lucide-react";
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
    
    // For demo purposes, redirect to Google login
    // In production, this would implement SMS OTP verification
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
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-primary rounded-full flex items-center justify-center mb-6">
            <ShoppingCart className="text-white text-2xl h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SmartCart</h1>
          <p className="text-gray-600">Intelligent Shopping Experience</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="shadow-lg">
          <CardContent className="py-8 px-4 sm:px-10">
            <div className="space-y-6">
              {/* Mobile Number Login */}
              <div>
                <Label htmlFor="mobile" className="block text-sm font-medium text-gray-700">
                  Mobile Number
                </Label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    id="mobile"
                    name="mobile"
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="pl-10"
                    data-testid="input-mobile"
                  />
                </div>
              </div>

              <Button
                onClick={handleMobileLogin}
                className="w-full bg-primary hover:bg-blue-700"
                data-testid="button-mobile-login"
              >
                Continue with Mobile
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>

              {/* Google Login */}
              <Button
                onClick={handleGoogleLogin}
                variant="outline"
                className="w-full flex items-center justify-center"
                data-testid="button-google-login"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
