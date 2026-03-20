import type { Express } from "express";
import { createServer, type Server } from "http";
import Razorpay from "razorpay";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCartItemSchema } from "@shared/schema";
import { z } from "zod";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

const DETECTION_SERVICE_URL = "http://127.0.0.1:8001";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  // ── Auth ────────────────────────────────────────────────────────────────────
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const claims = req.user.claims;
      let user;
      try {
        user = await storage.getUser(claims.sub);
      } catch {
        user = {
          id: claims.sub,
          email: claims.email,
          firstName: claims.first_name,
          lastName: claims.last_name,
          profileImageUrl: claims.profile_image_url,
          razorpayCustomerId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
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

  // Look up a product by its YOLO detection class name
  app.get('/api/products/class/:className', async (req, res) => {
    try {
      const { className } = req.params;
      const product = await storage.getProductByDetectionClass(className);
      if (!product) {
        return res.status(404).json({ message: `No product mapped to detection class "${className}"` });
      }
      res.json(product);
    } catch {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // ── YOLO Detection ──────────────────────────────────────────────────────────
  // Receives a base64-encoded JPEG frame from the browser, forwards to the
  // Python YOLO service, and returns the detected class + product info.
  app.post('/api/detect', isAuthenticated, async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ message: "No image provided" });
      }

      // Call Python detection service
      let detectionResult;
      try {
        const resp = await fetch(`${DETECTION_SERVICE_URL}/detect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image }),
          signal: AbortSignal.timeout(5000),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return res.status(502).json({ message: "Detection service error", detail: err });
        }
        detectionResult = await resp.json();
      } catch (fetchErr: any) {
        // Detection service unavailable - return empty detection
        return res.json({ detected: false, message: "Detection service unavailable" });
      }

      if (!detectionResult.detected || !detectionResult.class) {
        return res.json({ detected: false });
      }

      // Map detected class to a product in the database
      const product = await storage.getProductByDetectionClass(detectionResult.class);
      if (!product) {
        return res.json({
          detected: true,
          class: detectionResult.class,
          confidence: detectionResult.confidence,
          productFound: false,
          message: `Detected "${detectionResult.class}" but no product is mapped to it`,
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
      console.error("Detection error:", error);
      res.status(500).json({ message: "Detection failed" });
    }
  });

  // ── Cart ────────────────────────────────────────────────────────────────────
  app.get('/api/cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const itemData = insertCartItemSchema.parse(req.body);

      let cart = await storage.getActiveCart(userId);
      if (!cart) {
        const newCart = await storage.createCart(userId);
        cart = await storage.getCartWithItems(newCart.id);
      }

      // One item per product — enforce uniqueness
      const cartWithItems = await storage.getCartWithItems(cart!.id);
      const alreadyInCart = cartWithItems?.items?.some(
        (item) => item.productId === itemData.productId
      );
      if (alreadyInCart) {
        return res.status(400).json({
          message: "This item is already in your cart.",
          code: "ALREADY_IN_CART",
        });
      }

      const cartItem = await storage.addItemToCart(cart!.id, itemData);
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
        return res.json({ message: "Item removed from cart" });
      }
      const updatedItem = await storage.updateCartItemQuantity(itemId, quantity);
      res.json(updatedItem);
    } catch {
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete('/api/cart/items/:itemId', isAuthenticated, async (req, res) => {
    try {
      const { itemId } = req.params;
      await storage.removeCartItem(itemId);
      res.json({ message: "Item removed from cart" });
    } catch {
      res.status(500).json({ message: "Failed to remove cart item" });
    }
  });

  // ── Payments ────────────────────────────────────────────────────────────────
  app.post("/api/create-razorpay-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cartId } = req.body;
      const cart = await storage.getCartWithItems(cartId);
      if (!cart || cart.userId !== userId) {
        return res.status(404).json({ message: "Cart not found" });
      }

      const subtotal = cart.items.reduce(
        (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
        0
      );
      const tax = subtotal * 0.08;
      const total = subtotal + tax;

      const order = await storage.createOrder(userId, cartId, {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
      });

      const razorpayOrder = await razorpay.orders.create({
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
      res.status(500).json({ message: "Error creating payment order: " + error.message });
    }
  });

  app.post('/api/verify-payment', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId, paymentId, razorpayOrderId, signature } = req.body;
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(razorpayOrderId + '|' + paymentId)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(400).json({ message: 'Invalid payment signature' });
      }

      await storage.updateOrderStatus(orderId, "paid", razorpayOrderId, paymentId);
      res.json({ success: true, message: "Payment verified successfully" });
    } catch {
      res.status(400).json({ message: 'Payment verification failed' });
    }
  });

  // ── Orders ──────────────────────────────────────────────────────────────────
  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orders = await storage.getUserOrders(userId);
      res.json(orders);
    } catch {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
