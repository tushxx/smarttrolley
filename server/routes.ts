import type { Express } from "express";
import { createServer, type Server } from "http";
import Razorpay from "razorpay";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertCartItemSchema } from "@shared/schema";
import { z } from "zod";

// Razorpay is initialized lazily — only when a payment is attempted.
// This prevents a crash at startup when keys are not configured locally.
function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.");
  }
  return new Razorpay({ key_id, key_secret });
}

const DETECTION_SERVICE_URL = "http://127.0.0.1:8001";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // ── Phone Auth ───────────────────────────────────────────────────────────────
  // Enter phone number → session created, shopping starts
  app.post('/api/auth/phone', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber || typeof phoneNumber !== "string") {
        return res.status(400).json({ message: "Phone number is required" });
      }

      const cleaned = phoneNumber.replace(/\D/g, "");
      if (cleaned.length < 10) {
        return res.status(400).json({ message: "Enter a valid phone number" });
      }

      const userId = `phone:${cleaned}`;
      let user = await storage.getUser(userId);
      if (!user) {
        user = await storage.upsertUser({ id: userId, mobileNumber: cleaned });
      }

      req.session.user = { id: userId, phoneNumber: cleaned };
      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get('/api/auth/user', (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.session.user);
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // ── Products ────────────────────────────────────────────────────────────────
  app.get('/api/products', async (_req, res) => {
    try {
      const prods = await storage.getAllProducts();
      res.json(prods);
    } catch {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/class/:className', async (req, res) => {
    try {
      const product = await storage.getProductByDetectionClass(req.params.className);
      if (!product) {
        return res.status(404).json({ message: `No product mapped to "${req.params.className}"` });
      }
      res.json(product);
    } catch {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // ── YOLO Detection ──────────────────────────────────────────────────────────
  app.post('/api/detect', isAuthenticated, async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ message: "No image provided" });

      let detectionResult;
      try {
        const resp = await fetch(`${DETECTION_SERVICE_URL}/detect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image }),
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) return res.json({ detected: false, message: "Detection service error" });
        detectionResult = await resp.json();
      } catch {
        return res.json({ detected: false, message: "Detection service unavailable" });
      }

      if (!detectionResult.detected || !detectionResult.class) {
        return res.json({ detected: false });
      }

      const product = await storage.getProductByDetectionClass(detectionResult.class);
      if (!product) {
        return res.json({
          detected: true,
          class: detectionResult.class,
          confidence: detectionResult.confidence,
          productFound: false,
          message: `Detected "${detectionResult.class}" but no product mapped`,
        });
      }

      res.json({
        detected: true,
        class: detectionResult.class,
        confidence: detectionResult.confidence,
        productFound: true,
        product,
        allDetections: detectionResult.all_detections || [],
      });
    } catch (error) {
      res.status(500).json({ message: "Detection failed" });
    }
  });

  // ── Cart ────────────────────────────────────────────────────────────────────
  app.get('/api/cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.sessionUser.id;
      let cart = await storage.getActiveCart(userId);
      if (!cart) {
        const newCart = await storage.createCart(userId);
        cart = await storage.getCartWithItems(newCart.id);
      }
      res.json(cart);
    } catch {
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.post('/api/cart/items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.sessionUser.id;
      const itemData = insertCartItemSchema.parse(req.body);

      let cart = await storage.getActiveCart(userId);
      if (!cart) {
        const newCart = await storage.createCart(userId);
        cart = await storage.getCartWithItems(newCart.id);
      }

      const existing = cart?.items?.find(i => i.productId === itemData.productId);
      if (existing) {
        return res.status(400).json({ message: "Item already in cart", code: "ALREADY_IN_CART" });
      }

      const cartItem = await storage.addItemToCart(cart!.id, { ...itemData, quantity: 1 });
      res.status(201).json(cartItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid item data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add item to cart" });
    }
  });

  app.patch('/api/cart/items/:itemId', isAuthenticated, async (req, res) => {
    try {
      const { itemId } = req.params;
      const { quantity } = req.body;
      if (quantity <= 0) {
        await storage.removeCartItem(itemId);
        return res.json({ message: "Item removed" });
      }
      const updated = await storage.updateCartItemQuantity(itemId, quantity);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete('/api/cart/items/:itemId', isAuthenticated, async (req, res) => {
    try {
      await storage.removeCartItem(req.params.itemId);
      res.json({ message: "Item removed" });
    } catch {
      res.status(500).json({ message: "Failed to remove cart item" });
    }
  });

  // ── IoT Hardware Endpoint ────────────────────────────────────────────────────
  // Called by the Raspberry Pi PIR + camera script (no browser session needed).
  // The Pi authenticates with a shared secret and its configured phone number.
  app.post('/api/iot/detect', async (req, res) => {
    try {
      const { iot_secret, phone_number, detection_class, confidence } = req.body;

      // Verify the shared secret (set IOT_SECRET in environment)
      const expectedSecret = process.env.IOT_SECRET || "smarttrolley_iot_2024";
      if (iot_secret !== expectedSecret) {
        return res.status(401).json({ message: "Invalid IoT secret" });
      }

      if (!phone_number || !detection_class) {
        return res.status(400).json({ message: "phone_number and detection_class are required" });
      }

      // Find the user by phone number (same pattern as phone auth)
      const cleaned = String(phone_number).replace(/\D/g, "");
      const userId = `phone:${cleaned}`;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: `No active session for phone ${cleaned}. Log in on the iPad first.` });
      }

      // Look up product by detection class
      const product = await storage.getProductByDetectionClass(detection_class);
      if (!product) {
        return res.status(404).json({ message: `No product mapped to class "${detection_class}"` });
      }

      // Get or create cart
      let cart = await storage.getActiveCart(userId);
      if (!cart) {
        const newCart = await storage.createCart(userId);
        cart = await storage.getCartWithItems(newCart.id);
      }

      // Check if already in cart
      const existing = cart?.items?.find(i => i.productId === product.id);
      if (existing) {
        return res.status(200).json({
          success: true,
          alreadyInCart: true,
          message: `${product.name} already in cart`,
          product,
        });
      }

      // Add to cart
      await storage.addItemToCart(cart!.id, { productId: product.id, quantity: 1 });

      console.log(`[IoT] PIR detection: ${detection_class} (${Math.round((confidence || 0) * 100)}%) → added "${product.name}" to cart of ${cleaned}`);

      res.json({
        success: true,
        alreadyInCart: false,
        message: `Added ${product.name} to cart`,
        product,
      });
    } catch (error: any) {
      console.error("[IoT] Error:", error.message);
      res.status(500).json({ message: "IoT detection failed: " + error.message });
    }
  });

  // ── Payments ────────────────────────────────────────────────────────────────
  app.post("/api/create-razorpay-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.sessionUser.id;
      const { cartId } = req.body;
      const cart = await storage.getCartWithItems(cartId);
      if (!cart || cart.userId !== userId) {
        return res.status(404).json({ message: "Cart not found" });
      }

      const subtotal = cart.items.reduce(
        (sum, item) => sum + parseFloat(item.product.price) * item.quantity, 0
      );
      const tax = subtotal * 0.08;
      const total = subtotal + tax;

      const order = await storage.createOrder(userId, cartId, {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
      });

      const razorpayOrder = await getRazorpay().orders.create({
        amount: Math.round(total * 100),
        currency: "INR",
        receipt: order.id,
        notes: { orderId: order.id, userId },
      });

      await storage.updateOrderStatus(order.id, "pending", razorpayOrder.id);

      res.json({
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error creating order: " + error.message });
    }
  });

  app.post('/api/verify-payment', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId, paymentId, razorpayOrderId, signature } = req.body;
      const crypto = require('crypto');
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(razorpayOrderId + '|' + paymentId)
        .digest('hex');

      if (signature !== expected) {
        return res.status(400).json({ message: 'Invalid payment signature' });
      }

      await storage.updateOrderStatus(orderId, "paid", razorpayOrderId, paymentId);
      res.json({ success: true });
    } catch {
      res.status(400).json({ message: 'Payment verification failed' });
    }
  });

  // ── Orders ──────────────────────────────────────────────────────────────────
  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const orders = await storage.getUserOrders(req.sessionUser.id);
      res.json(orders);
    } catch {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
