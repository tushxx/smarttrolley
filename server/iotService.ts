import { iot, mqtt, io } from 'aws-iot-device-sdk-v2';
import { TextDecoder } from 'util';
import { storage } from './storage';
import type { Server } from 'socket.io';

export class IoTCartService {
  private connection: mqtt.MqttClientConnection | null = null;
  private socketServer: Server | null = null;

  constructor() {
    this.initializeConnection();
  }

  setSocketServer(socketServer: Server) {
    this.socketServer = socketServer;
  }

  private async initializeConnection() {
    try {
      if (!process.env.AWS_IOT_ENDPOINT || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
        console.warn('⚠️  AWS IoT credentials not fully configured. IoT features in basic mode.');
        console.log('Missing:', {
          endpoint: !process.env.AWS_IOT_ENDPOINT,
          accessKey: !process.env.AWS_ACCESS_KEY_ID,
          secretKey: !process.env.AWS_SECRET_ACCESS_KEY,
          region: !process.env.AWS_REGION
        });
        return;
      }

      const clientBootstrap = new io.ClientBootstrap();
      
      // Use WebSocket connection with AWS credentials
      const config = iot.AwsIotMqttConnectionConfigBuilder.new_builder_for_websocket()
        .with_clean_session(false)
        .with_client_id(`smartcart-web-${Date.now()}`)
        .with_endpoint(process.env.AWS_IOT_ENDPOINT)
        .with_credentials(
          process.env.AWS_REGION,
          process.env.AWS_ACCESS_KEY_ID,
          process.env.AWS_SECRET_ACCESS_KEY
        )
        .build();

      const client = new mqtt.MqttClient(clientBootstrap);
      this.connection = client.new_connection(config);

      // Connect to AWS IoT Core
      await this.connection.connect();
      console.log('✅ Connected to AWS IoT Core successfully!');
      console.log(`📡 Endpoint: ${process.env.AWS_IOT_ENDPOINT}`);
      console.log(`🌍 Region: ${process.env.AWS_REGION}`);

      // Subscribe to cart events
      await this.subscribeToCartEvents();
      
    } catch (error) {
      console.error('❌ Failed to connect to AWS IoT:', error);
      console.error('Using basic mode without IoT integration');
    }
  }

  private async subscribeToCartEvents() {
    if (!this.connection) return;

    // Subscribe to all cart events
    const topics = [
      'cart/+/item_add',
      'cart/+/item_remove', 
      'cart/+/checkout',
      'cart/+/fraud_alert',
      'cart/+/session_start',
      'cart/+/session_end'
    ];

    for (const topic of topics) {
      await this.connection.subscribe(topic, mqtt.QoS.AtLeastOnce, (topic, payload) => {
        this.handleCartMessage(topic, payload);
      });
      console.log(`📡 Subscribed to ${topic}`);
    }
  }

  private handleCartMessage(topic: string, payload: ArrayBuffer) {
    try {
      const decoder = new TextDecoder('utf-8');
      const message = JSON.parse(decoder.decode(payload));
      const cartId = this.extractCartIdFromTopic(topic);
      
      console.log(`📨 IoT Message from cart ${cartId}:`, message);

      // Route message based on topic
      if (topic.includes('/item_add')) {
        this.handleItemAdd(cartId, message);
      } else if (topic.includes('/item_remove')) {
        this.handleItemRemove(cartId, message);
      } else if (topic.includes('/checkout')) {
        this.handleCheckout(cartId, message);
      } else if (topic.includes('/fraud_alert')) {
        this.handleFraudAlert(cartId, message);
      } else if (topic.includes('/session_start')) {
        this.handleSessionStart(cartId, message);
      } else if (topic.includes('/session_end')) {
        this.handleSessionEnd(cartId, message);
      }

      // Broadcast to connected web clients
      this.broadcastToWebClients(cartId, {
        type: this.getEventType(topic),
        data: message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error processing IoT message:', error);
    }
  }

  private extractCartIdFromTopic(topic: string): string {
    const parts = topic.split('/');
    return parts[1] || 'unknown';
  }

  private getEventType(topic: string): string {
    if (topic.includes('/item_add')) return 'item_added';
    if (topic.includes('/item_remove')) return 'item_removed';
    if (topic.includes('/checkout')) return 'checkout_initiated';
    if (topic.includes('/fraud_alert')) return 'fraud_detected';
    if (topic.includes('/session_start')) return 'session_started';
    if (topic.includes('/session_end')) return 'session_ended';
    return 'unknown';
  }

  private async handleItemAdd(cartId: string, message: any) {
    try {
      const { barcode, weight, vision_confidence, session_id } = message;
      
      // Find user session by session_id
      const session = await storage.getCartSession(session_id);
      if (!session) {
        console.warn(`Session ${session_id} not found`);
        return;
      }

      // Get product by barcode
      const product = await storage.getProductByBarcode(barcode);
      if (!product) {
        console.warn(`Product with barcode ${barcode} not found`);
        return;
      }

      // Add item to user's cart
      await storage.addItemToCart(session.cartId, { productId: product.id, quantity: 1 });
      
      console.log(`✅ Added ${product.name} to cart via IoT`);
      
    } catch (error) {
      console.error('❌ Error handling item add:', error);
    }
  }

  private async handleItemRemove(cartId: string, message: any) {
    try {
      const { barcode, session_id } = message;
      
      const session = await storage.getCartSession(session_id);
      if (!session) return;

      const product = await storage.getProductByBarcode(barcode);
      if (!product) return;

      // Find and remove the cart item
      const cart = await storage.getCartWithItems(session.cartId);
      const cartItem = cart?.items.find(item => item.productId === product.id);
      if (cartItem) {
        await storage.removeCartItem(cartItem.id);
      }
      
      console.log(`🗑️ Removed ${product.name} from cart via IoT`);
      
    } catch (error) {
      console.error('❌ Error handling item remove:', error);
    }
  }

  private async handleCheckout(cartId: string, message: any) {
    try {
      const { session_id, total_amount } = message;
      
      // Trigger checkout process
      console.log(`💳 Checkout initiated for session ${session_id}, amount: ₹${total_amount}`);
      
    } catch (error) {
      console.error('❌ Error handling checkout:', error);
    }
  }

  private async handleFraudAlert(cartId: string, message: any) {
    try {
      const { fraud_type, confidence, session_id } = message;
      
      console.warn(`🚨 FRAUD ALERT - Cart ${cartId}: ${fraud_type} (confidence: ${confidence}%)`);
      
      // Log fraud attempt
      await storage.logFraudAttempt(session_id, fraud_type, confidence);
      
    } catch (error) {
      console.error('❌ Error handling fraud alert:', error);
    }
  }

  private async handleSessionStart(cartId: string, message: any) {
    try {
      const { session_id, user_id } = message;
      
      // Link physical cart to user session
      await storage.createCartSession(session_id, cartId, user_id);
      
      console.log(`🚀 Cart session started: ${session_id} for user ${user_id}`);
      
    } catch (error) {
      console.error('❌ Error handling session start:', error);
    }
  }

  private async handleSessionEnd(cartId: string, message: any) {
    try {
      const { session_id } = message;
      
      // End cart session
      await storage.endCartSession(session_id);
      
      console.log(`🏁 Cart session ended: ${session_id}`);
      
    } catch (error) {
      console.error('❌ Error handling session end:', error);
    }
  }

  private broadcastToWebClients(cartId: string, event: any) {
    if (this.socketServer) {
      // Send to specific cart room
      this.socketServer.to(`cart_${cartId}`).emit('cart_event', event);
      
      // Send to all connected clients
      this.socketServer.emit('iot_update', {
        cartId,
        ...event
      });
    }
  }

  // Public methods for sending commands to physical carts
  async sendCartCommand(cartId: string, command: string, data: any = {}) {
    if (!this.connection) {
      throw new Error('IoT connection not established');
    }

    const topic = `cart/${cartId}/command`;
    const message = JSON.stringify({
      command,
      data,
      timestamp: new Date().toISOString()
    });

    await this.connection.publish(topic, message, mqtt.QoS.AtLeastOnce);
    console.log(`📤 Sent command to cart ${cartId}:`, command);
  }

  async lockCart(cartId: string) {
    await this.sendCartCommand(cartId, 'lock_cart');
  }

  async unlockCart(cartId: string) {
    await this.sendCartCommand(cartId, 'unlock_cart');
  }

  async displayMessage(cartId: string, message: string) {
    await this.sendCartCommand(cartId, 'display_message', { message });
  }

  async triggerAlert(cartId: string, alertType: string = 'warning') {
    await this.sendCartCommand(cartId, 'trigger_alert', { type: alertType });
  }
}

export const iotService = new IoTCartService();