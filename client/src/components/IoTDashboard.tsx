import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  QrCode, 
  Zap, 
  Battery, 
  MapPin, 
  Package, 
  Thermometer,
  Wifi,
  WifiOff,
  ShoppingCart,
  Activity,
  AlertTriangle
} from "lucide-react";
import io from 'socket.io-client';

interface CartStatus {
  cartId: string;
  online: boolean;
  battery: number;
  location: string;
  lastSeen: string;
  sensorData: {
    weight: string;
    temperature: string;
    items: number;
  };
}

interface IoTEvent {
  type: string;
  data: any;
  timestamp: string;
}

export default function IoTDashboard() {
  const [qrCode, setQrCode] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [cartStatus, setCartStatus] = useState<CartStatus | null>(null);
  const [iotEvents, setIotEvents] = useState<IoTEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize WebSocket connection
    const socket = io();
    
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('🔌 Connected to IoT server');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('❌ Disconnected from IoT server');
    });

    // Listen for IoT events
    socket.on('iot_update', (event: IoTEvent) => {
      setIotEvents(prev => [event, ...prev.slice(0, 9)]); // Keep last 10 events
      
      // Show toast for important events
      if (event.type === 'item_added') {
        toast({
          title: "📦 Item Added",
          description: `Product scanned and added to cart`,
          className: "bg-green-50 border-green-200",
        });
      } else if (event.type === 'fraud_detected') {
        toast({
          title: "🚨 Fraud Alert",
          description: "Suspicious activity detected on cart",
          variant: "destructive",
        });
      }
    });

    socket.on('cart_event', (event: any) => {
      console.log('🛒 Cart event received:', event);
    });

    return () => {
      socket.disconnect();
    };
  }, [toast]);

  const generateQRCode = async () => {
    try {
      const response = await apiRequest("POST", "/api/iot/generate-qr");
      const data = await response.json();
      
      if (data.success) {
        setQrCode(data.qrCode);
        setSessionId(data.sessionId);
        toast({
          title: "✨ QR Code Generated",
          description: data.message,
          className: "bg-green-50 border-green-200",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      });
    }
  };

  const sendCartCommand = async (command: string, data: any = {}) => {
    try {
      const response = await apiRequest("POST", "/api/iot/cart-command", {
        cartId: 'cart_001',
        command,
        data
      });
      
      const result = await response.json();
      if (result.success) {
        toast({
          title: "📡 Command Sent",
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send command to cart",
        variant: "destructive",
      });
    }
  };

  const getCartStatus = async () => {
    try {
      const response = await apiRequest("GET", "/api/iot/cart-status/cart_001");
      const status = await response.json();
      setCartStatus(status);
    } catch (error) {
      console.error("Failed to get cart status:", error);
    }
  };

  useEffect(() => {
    // Poll cart status every 10 seconds
    const interval = setInterval(getCartStatus, 10000);
    getCartStatus(); // Initial load
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Connection Status */}
      <Card className="modern-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isConnected ? (
                <div className="flex items-center space-x-2">
                  <Wifi className="h-5 w-5 text-green-600" />
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <WifiOff className="h-5 w-5 text-red-600" />
                  <Badge variant="destructive">Disconnected</Badge>
                </div>
              )}
              <span className="text-sm text-gray-600">IoT Server Status</span>
            </div>
            <Activity className={`h-5 w-5 ${isConnected ? 'text-green-600' : 'text-gray-400'}`} />
          </div>
        </CardContent>
      </Card>

      {/* QR Code Generation */}
      <Card className="modern-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Cart Session QR</h3>
              <p className="text-sm text-gray-600">Generate QR code to connect with physical cart</p>
            </div>
            <Button onClick={generateQRCode} className="primary-gradient">
              <QrCode className="mr-2 h-4 w-4" />
              Generate QR
            </Button>
          </div>
          
          {qrCode && (
            <div className="text-center">
              <div className="inline-block p-4 bg-white rounded-2xl border-2 border-dashed border-gray-300">
                <img src={qrCode} alt="Cart Session QR Code" className="w-48 h-48 mx-auto" />
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Session ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{sessionId}</code>
              </p>
              <p className="text-xs text-gray-500 mt-1">QR code expires in 5 minutes</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cart Status */}
      {cartStatus && (
        <Card className="modern-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Cart Status</h3>
              <Badge className={cartStatus.online ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {cartStatus.online ? "Online" : "Offline"}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <Battery className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">{cartStatus.battery}%</p>
                <p className="text-xs text-gray-500">Battery</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <MapPin className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">Aisle 3</p>
                <p className="text-xs text-gray-500">Location</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <Package className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">{cartStatus.sensorData.items}</p>
                <p className="text-xs text-gray-500">Items</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <Thermometer className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">{cartStatus.sensorData.temperature}</p>
                <p className="text-xs text-gray-500">Temperature</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cart Controls */}
      <Card className="modern-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cart Controls</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button 
              variant="outline" 
              onClick={() => sendCartCommand('lock_cart')}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              🔒 Lock Cart
            </Button>
            <Button 
              variant="outline" 
              onClick={() => sendCartCommand('unlock_cart')}
              className="border-green-200 text-green-700 hover:bg-green-50"
            >
              🔓 Unlock Cart
            </Button>
            <Button 
              variant="outline" 
              onClick={() => sendCartCommand('trigger_alert', { type: 'warning' })}
              className="border-yellow-200 text-yellow-700 hover:bg-yellow-50"
            >
              ⚠️ Alert
            </Button>
            <Button 
              variant="outline" 
              onClick={() => sendCartCommand('display_message', { message: 'Hello from web!' })}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              💬 Send Message
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Events */}
      <Card className="modern-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Real-time Events</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {iotEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No IoT events yet</p>
                <p className="text-xs mt-1">Events will appear here when your cart is active</p>
              </div>
            ) : (
              iotEvents.map((event, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {event.type === 'item_added' && <Package className="h-4 w-4 text-blue-600" />}
                    {event.type === 'fraud_detected' && <AlertTriangle className="h-4 w-4 text-red-600" />}
                    {event.type === 'session_started' && <Zap className="h-4 w-4 text-green-600" />}
                    {!['item_added', 'fraud_detected', 'session_started'].includes(event.type) && 
                      <Activity className="h-4 w-4 text-gray-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {event.type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}