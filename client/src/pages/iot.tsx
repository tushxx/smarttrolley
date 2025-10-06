import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import IoTDashboard from "@/components/IoTDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, WifiOff } from "lucide-react";

export default function IoTPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen modern-gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading IoT dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen modern-gradient-bg">
      {/* Header */}
      <header className="modern-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 primary-gradient rounded-2xl flex items-center justify-center">
                <Zap className="text-white h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">IoT Dashboard</h1>
                <p className="text-xs text-gray-500">Smart Cart Integration</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                <WifiOff className="h-3 w-3 mr-1" />
                Basic Mode
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* AWS Setup Notice */}
        <Card className="modern-card mb-8 border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Zap className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  AWS IoT Integration Ready
                </h3>
                <p className="text-gray-600 mb-4">
                  Your SmartCart is set up for AWS IoT integration! Currently running in basic mode with mock data. 
                  To enable real-time IoT features like physical cart connectivity, sensor data, and fraud detection, 
                  you'll need to configure AWS credentials.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">🚀 Ready Features:</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li>• QR code generation for cart sessions</li>
                      <li>• WebSocket integration for real-time updates</li>
                      <li>• Cart command interface</li>
                      <li>• Mock sensor data simulation</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">🔧 Needs AWS Setup:</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li>• AWS_ACCESS_KEY_ID</li>
                      <li>• AWS_SECRET_ACCESS_KEY</li>
                      <li>• AWS_REGION</li>
                      <li>• AWS_IOT_ENDPOINT</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* IoT Dashboard */}
        <IoTDashboard />
      </main>
    </div>
  );
}