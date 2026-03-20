/**
 * AWS IoT Service — connects the physical Raspberry Pi smart cart to the web app.
 * The Pi sends MQTT messages (item detected by YOLO camera, weight sensor readings, etc.)
 * and this service processes them and updates the user's cart in real time.
 */

import { iot, mqtt, io } from 'aws-iot-device-sdk-v2';
import { TextDecoder } from 'util';
import { storage } from './storage';
import type { Server } from 'socket.io';

// In-memory session store (cart sessionId → { cartId, userId })
const activeSessions = new Map<string, { cartId: string; userId: string }>();

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
      const { AWS_IOT_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = process.env;
      if (!AWS_IOT_ENDPOINT || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
        console.warn('⚠️  AWS IoT credentials not fully configured. IoT features in basic mode.');
        return;
      }

      const clientBootstrap = new io.ClientBootstrap();
      const config = iot.AwsIotMqttConnectionConfigBuilder.new_builder_for_websocket()
        .with_clean_session(false)
        .with_client_id(`smartcart-web-${Date.now()}`)
        .with_endpoint(AWS_IOT_ENDPOINT)
        .with_credentials(AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
        .build();

      const client = new mqtt.MqttClient(clientBootstrap);
      this.connection = client.new_connection(config);
      await this.connection.connect();

      console.log('✅ Connected to AWS IoT Core');
      await this.subscribeToCartEvents();
    } catch (error) {
      console.error('❌ Failed to connect to AWS IoT:', error);
      console.error('Using basic mode without IoT integration');
    }
  }

  private async subscribeToCartEvents() {
    if (!this.connection) return;

    const topics = [
      'cart/+/item_detected',   // Pi YOLO camera detected an item
      'cart/+/item_remove',     // item physically removed from cart
      'cart/+/weight_update',   // weight sensor reading
      'cart/+/checkout',
      'cart/+/fraud_alert',
      'cart/+/session_start',
      'cart/+/session_end',
    ];

    for (const topic of topics) {
      await this.connection!.subscribe(topic, mqtt.QoS.AtLeastOnce, (t, payload) => {
        this.handleCartMessage(t, payload);
      });
      console.log(`📡 Subscribed to ${topic}`);
    }
  }

  private handleCartMessage(topic: string, payload: ArrayBuffer) {
    try {
      const decoder = new TextDecoder('utf-8');
      const message = JSON.parse(decoder.decode(payload));
      const cartId = topic.split('/')[1] || 'unknown';

      console.log(`📨 IoT Message [${topic}]:`, message);

      if (topic.includes('/item_detected'))  this.handleItemDetected(cartId, message);
      else if (topic.includes('/item_remove'))    this.handleItemRemove(cartId, message);
      else if (topic.includes('/weight_update'))  this.handleWeightUpdate(cartId, message);
      else if (topic.includes('/checkout'))       this.handleCheckout(cartId, message);
      else if (topic.includes('/fraud_alert'))    this.handleFraudAlert(cartId, message);
      else if (topic.includes('/session_start'))  this.handleSessionStart(cartId, message);
      else if (topic.includes('/session_end'))    this.handleSessionEnd(cartId, message);

      this.broadcastToWebClients(cartId, {
        type: this.getEventType(topic),
        data: message,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Error processing IoT message:', error);
    }
  }

  private getEventType(topic: string): string {
    if (topic.includes('/item_detected'))  return 'item_detected';
    if (topic.includes('/item_remove'))    return 'item_removed';
    if (topic.includes('/weight_update'))  return 'weight_updated';
    if (topic.includes('/checkout'))       return 'checkout_initiated';
    if (topic.includes('/fraud_alert'))    return 'fraud_detected';
    if (topic.includes('/session_start'))  return 'session_started';
    if (topic.includes('/session_end'))    return 'session_ended';
    return 'unknown';
  }

  // Pi camera detected an item via YOLO — look up by detection class
  private async handleItemDetected(cartId: string, message: any) {
    try {
      const { detection_class, confidence, session_id } = message;

      const session = activeSessions.get(session_id);
      if (!session) {
        console.warn(`Session ${session_id} not found`);
        return;
      }

      const product = await storage.getProductByDetectionClass(detection_class);
      if (!product) {
        console.warn(`No product mapped to detection class "${detection_class}"`);
        return;
      }

      await storage.addItemToCart(session.cartId, { productId: product.id, quantity: 1 });
      console.log(`✅ Added "${product.name}" (class: ${detection_class}, conf: ${confidence}) via IoT`);
    } catch (error) {
      console.error('❌ Error handling item detection:', error);
    }
  }

  private async handleItemRemove(cartId: string, message: any) {
    try {
      const { detection_class, session_id } = message;
      const session = activeSessions.get(session_id);
      if (!session) return;

      const product = await storage.getProductByDetectionClass(detection_class);
      if (!product) return;

      const cart = await storage.getCartWithItems(session.cartId);
      const cartItem = cart?.items.find((i) => i.productId === product.id);
      if (cartItem) {
        await storage.removeCartItem(cartItem.id);
        console.log(`🗑️ Removed "${product.name}" from cart via IoT`);
      }
    } catch (error) {
      console.error('❌ Error handling item remove:', error);
    }
  }

  private handleWeightUpdate(_cartId: string, message: any) {
    const { weight_kg, session_id } = message;
    console.log(`⚖️ Weight update — session ${session_id}: ${weight_kg} kg`);
    // Future: cross-check detected item weights for fraud detection
  }

  private handleCheckout(_cartId: string, message: any) {
    const { session_id, total_amount } = message;
    console.log(`💳 Checkout initiated — session ${session_id}, ₹${total_amount}`);
  }

  private handleFraudAlert(cartId: string, message: any) {
    const { fraud_type, confidence, session_id } = message;
    console.warn(`🚨 FRAUD ALERT — cart ${cartId} session ${session_id}: ${fraud_type} (${confidence}% conf)`);
  }

  private handleSessionStart(cartId: string, message: any) {
    const { session_id, user_id } = message;
    activeSessions.set(session_id, { cartId, userId: user_id });
    console.log(`🚀 Cart session started: ${session_id} → cartId ${cartId}, user ${user_id}`);
  }

  private handleSessionEnd(_cartId: string, message: any) {
    const { session_id } = message;
    activeSessions.delete(session_id);
    console.log(`🏁 Cart session ended: ${session_id}`);
  }

  private broadcastToWebClients(cartId: string, event: any) {
    if (!this.socketServer) return;
    this.socketServer.to(`cart_${cartId}`).emit('cart_event', event);
    this.socketServer.emit('iot_update', { cartId, ...event });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  async sendCartCommand(cartId: string, command: string, data: any = {}) {
    if (!this.connection) {
      throw new Error('IoT connection not established. Physical cart not connected.');
    }
    const topic = `cart/${cartId}/command`;
    const msg = JSON.stringify({ command, data, timestamp: new Date().toISOString() });
    await this.connection.publish(topic, msg, mqtt.QoS.AtLeastOnce);
    console.log(`📤 Command sent to cart ${cartId}: ${command}`);
  }

  async lockCart(cartId: string)   { await this.sendCartCommand(cartId, 'lock_cart'); }
  async unlockCart(cartId: string) { await this.sendCartCommand(cartId, 'unlock_cart'); }
  async displayMessage(cartId: string, message: string) {
    await this.sendCartCommand(cartId, 'display_message', { message });
  }
  async triggerAlert(cartId: string, alertType = 'warning') {
    await this.sendCartCommand(cartId, 'trigger_alert', { type: alertType });
  }
}

export const iotService = new IoTCartService();
