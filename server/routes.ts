import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import Razorpay from "razorpay";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCartItemSchema, insertProductSchema } from "@shared/schema";
import { z } from "zod";
import { iotService } from "./iotService";
import { qrService } from "./qrService";

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Product routes
  app.get('/api/products', async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/barcode/:barcode', async (req, res) => {
    try {
      const { barcode } = req.params;
      const product = await storage.getProductByBarcode(barcode);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product by barcode:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post('/api/products', isAuthenticated, async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  // Cart routes
  app.get('/api/cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let cart = await storage.getActiveCart(userId);
      
      if (!cart) {
        const newCart = await storage.createCart(userId);
        cart = await storage.getCartWithItems(newCart.id);
      }
      
      res.json(cart);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.post('/api/cart/items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const itemData = insertCartItemSchema.parse(req.body);
      
      // Get or create active cart
      let cart = await storage.getActiveCart(userId);
      if (!cart) {
        const newCart = await storage.createCart(userId);
        cart = await storage.getCartWithItems(newCart.id);
      }
      
      const cartItem = await storage.addItemToCart(cart!.id, itemData);
      res.status(201).json(cartItem);
    } catch (error) {
      console.error("Error adding item to cart:", error);
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
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete('/api/cart/items/:itemId', isAuthenticated, async (req, res) => {
    try {
      const { itemId } = req.params;
      await storage.removeCartItem(itemId);
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      console.error("Error removing cart item:", error);
      res.status(500).json({ message: "Failed to remove cart item" });
    }
  });

  // Payment routes - Razorpay integration
  app.post("/api/create-razorpay-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cartId } = req.body;
      
      const cart = await storage.getCartWithItems(cartId);
      if (!cart || cart.userId !== userId) {
        return res.status(404).json({ message: "Cart not found" });
      }
      
      // Calculate totals
      const subtotal = cart.items.reduce((sum, item) => {
        return sum + (parseFloat(item.product.price) * item.quantity);
      }, 0);
      
      const taxRate = 0.08; // 8% tax
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      
      // Create order in our database
      const order = await storage.createOrder(userId, cartId, {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
      });
      
      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(total * 100), // Amount in paise
        currency: "INR",
        receipt: order.id,
        notes: {
          orderId: order.id,
          userId: userId
        }
      });
      
      // Update order with Razorpay order ID
      await storage.updateOrderStatus(order.id, "pending", razorpayOrder.id);
      
      res.json({ 
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error: any) {
      console.error("Error creating Razorpay order:", error);
      res.status(500).json({ message: "Error creating payment order: " + error.message });
    }
  });

  // Razorpay payment verification endpoint
  app.post('/api/verify-payment', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId, paymentId, razorpayOrderId, signature } = req.body;
      const userId = req.user.claims.sub;
      
      // Verify the payment signature with Razorpay
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(razorpayOrderId + '|' + paymentId)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('Payment signature mismatch');
        return res.status(400).json({ message: 'Invalid payment signature' });
      }
      
      // Update order status to paid
      await storage.updateOrderStatus(orderId, "paid", razorpayOrderId, paymentId);
      
      // Mark cart as completed
      res.json({ 
        success: true,
        message: "Payment verified successfully" 
      });
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(400).json({ message: 'Payment verification failed' });
    }
  });

  // Order routes
  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orders = await storage.getUserOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Seed some sample products for testing
  app.post('/api/seed-products', async (req, res) => {
    try {
      const sampleProducts = [
        {
          name: "Nike Air Max 270",
          brand: "Nike",
          description: "Comfortable running shoes with air cushioning",
          price: "12999.00",
          barcode: "123456789012",
          imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300",
          category: "Shoes",
        },
        {
          name: "Organic Bananas",
          brand: "Fresh Produce",
          description: "Fresh organic bananas - 1 dozen",
          price: "349.00",
          barcode: "234567890123",
          imageUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300",
          category: "Produce",
          weight: "1.0",
          unit: "dozen",
        },
        {
          name: "Wireless Headphones",
          brand: "Audio Pro",
          description: "Bluetooth wireless headphones with noise cancellation",
          price: "8999.00",
          barcode: "345678901234",
          imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300",
          category: "Electronics",
        },
      ];

      const createdProducts = [];
      for (const product of sampleProducts) {
        try {
          const existing = await storage.getProductByBarcode(product.barcode);
          if (!existing) {
            const created = await storage.createProduct(product);
            createdProducts.push(created);
          }
        } catch (error) {
          console.error(`Error creating product ${product.name}:`, error);
        }
      }

      res.json({ 
        message: `Seeded ${createdProducts.length} products`,
        products: createdProducts,
      });
    } catch (error) {
      console.error("Error seeding products:", error);
      res.status(500).json({ message: "Failed to seed products" });
    }
  });

  // IoT Integration Routes
  
  // Generate QR code for cart session
  app.post('/api/iot/generate-qr', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId, qrCode } = await qrService.generateCartSessionQR(userId);
      
      res.json({ 
        success: true, 
        sessionId, 
        qrCode,
        message: 'QR code generated successfully'
      });
    } catch (error) {
      console.error('Error generating cart QR:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  });

  // Get cart status (mock data for demo)
  app.get('/api/iot/cart-status/:cartId', isAuthenticated, async (req, res) => {
    try {
      const { cartId } = req.params;
      
      // Mock cart status data for demo
      const status = {
        cartId,
        online: Math.random() > 0.3,
        battery: Math.floor(Math.random() * 40) + 60,
        location: ['Aisle 1 - Fruits', 'Aisle 2 - Dairy', 'Aisle 3 - Electronics'][Math.floor(Math.random() * 3)],
        lastSeen: new Date().toISOString(),
        sensorData: {
          weight: `${(Math.random() * 5 + 1).toFixed(1)}kg`,
          temperature: `${Math.floor(Math.random() * 5) + 20}°C`,
          items: Math.floor(Math.random() * 10) + 1
        }
      };
      
      res.json(status);
    } catch (error) {
      console.error('Error getting cart status:', error);
      res.status(500).json({ error: 'Failed to get cart status' });
    }
  });

  // Send command to physical cart via AWS IoT
  app.post('/api/iot/cart-command', isAuthenticated, async (req: any, res) => {
    try {
      const { cartId, command, data } = req.body;
      
      await iotService.sendCartCommand(cartId, command, data);
      
      res.json({ 
        success: true, 
        message: `Command '${command}' sent to cart ${cartId}`
      });
    } catch (error) {
      console.error('Error sending cart command:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to send command to cart' 
      });
    }
  });

  const httpServer = createServer(app);
  
  // Set up Socket.IO for real-time IoT updates
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Connect IoT service with Socket.IO
  iotService.setSocketServer(io);

  io.on('connection', (socket) => {
    console.log('🔌 Client connected to IoT WebSocket');

    socket.on('join_cart', (cartId: string) => {
      socket.join(`cart_${cartId}`);
      console.log(`Client joined cart room: ${cartId}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected from IoT WebSocket');
    });
  });

  console.log('🚀 IoT integration fully configured with AWS connectivity');
  
  return httpServer;
}
