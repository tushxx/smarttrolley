import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Phone, Camera, Zap, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Landing() {
  const [phone, setPhone] = useState("");
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
        title: "Error",
        description: err.message || "Could not start session. Try again.",
        variant: "destructive",
      });
    },
  });

  const handleStart = () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast({
        title: "Invalid number",
        description: "Please enter at least 10 digits.",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(phone);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleStart();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 flex items-center gap-3">
        <div className="h-10 w-10 bg-green-600 rounded-2xl flex items-center justify-center shadow-md">
          <ShoppingCart className="text-white h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-none">SmartCart</h1>
          <p className="text-xs text-gray-500">AI-Powered Shopping</p>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-6">

          {/* Hero text */}
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 bg-green-600 rounded-3xl flex items-center justify-center shadow-xl">
                <Camera className="text-white h-10 w-10" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Start Shopping</h2>
            <p className="text-gray-500 text-base">
              Point your camera at any product — our AI identifies it instantly and adds it to your cart.
            </p>
          </div>

          {/* Phone login card */}
          <Card className="shadow-lg border-0 bg-white">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-600" />
                  Mobile Number
                </label>
                <Input
                  type="tel"
                  placeholder="Enter your mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-12 text-base border-gray-200 focus:border-green-500 focus:ring-green-500 rounded-xl"
                  disabled={loginMutation.isPending}
                  autoFocus
                />
              </div>

              <Button
                onClick={handleStart}
                disabled={loginMutation.isPending || phone.replace(/\D/g, "").length < 10}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-base shadow-md"
              >
                {loginMutation.isPending ? "Starting session…" : "Start Shopping →"}
              </Button>

              <p className="text-center text-xs text-gray-400">
                No OTP • No password • Just tap and shop
              </p>
            </CardContent>
          </Card>

          {/* Feature pills */}
          <div className="flex justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-white rounded-full px-3 py-1.5 shadow-sm border">
              <Camera className="h-3.5 w-3.5 text-green-600" />
              AI Detection
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-white rounded-full px-3 py-1.5 shadow-sm border">
              <Zap className="h-3.5 w-3.5 text-yellow-500" />
              Instant Results
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-white rounded-full px-3 py-1.5 shadow-sm border">
              <Shield className="h-3.5 w-3.5 text-blue-500" />
              Razorpay Secure
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
