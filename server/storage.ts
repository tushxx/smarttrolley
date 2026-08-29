import {
  users,
  products,
  shoppingCarts,
  cartItems,
  orders,
  type User,
  type UpsertUser,
  type Product,
  type InsertProduct,
  type ShoppingCart,
  type CartItem,
  type InsertCartItem,
  type Order,
  type InsertOrder,
  type CartItemWithProduct,
  type CartWithItems,
  type OrderWithItems,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRazorpayInfo(userId: string, razorpayCustomerId: string): Promise<User>;
  getProductByDetectionClass(detectionClass: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  getAllProducts(): Promise<Product[]>;
  getActiveCart(userId: string): Promise<CartWithItems | undefined>;
  createCart(userId: string): Promise<ShoppingCart>;
  addItemToCart(cartId: string, item: InsertCartItem): Promise<CartItem>;
  updateCartItemQuantity(cartItemId: string, quantity: number): Promise<CartItem>;
  updateCartItem(
    cartItemId: string,
    updates: { quantity?: number; measuredWeight?: string | null },
  ): Promise<CartItem>;
  removeCartItem(cartItemId: string): Promise<void>;
  getCartWithItems(cartId: string): Promise<CartWithItems | undefined>;
  createOrder(userId: string, cartId: string, orderData: InsertOrder): Promise<Order>;
  updateOrderStatus(orderId: string, status: string, razorpayOrderId?: string, razorpayPaymentId?: string): Promise<Order>;
  getUserOrders(userId: string): Promise<Order[]>;
  getOrderWithItems(orderId: string, userId: string): Promise<OrderWithItems | undefined>;
}


function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}


export const PRODUCT_WEIGHT_TOLERANCE_G = 100;

const DEMO_PRODUCTS: Product[] = [
  { id: "p1", name: "maaza",      brand: "Parle Agro",  description: "Sparkling apple juice drink 250ml",          price: "40.00",  detectionClass: "APPY FIZZ",     imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&h=300&fit=crop", category: "Beverages",     weight: "240.000", unit: "each", createdAt: new Date() },
  { id: "p2", name: "Frooti",         brand: "Parle Agro",  description: "Mango fruit drink 200ml Tetra Pak",          price: "20.00",  detectionClass: "FROOTI",        imageUrl: "https://images.unsplash.com/photo-1546173159-315724a31696?w=300&h=300&fit=crop", category: "Beverages",     weight: "304.000", unit: "each", createdAt: new Date() },
  { id: "p3", name: "Moisturizer",    brand: "Nivea",       description: "Daily moisturizing cream for all skin types", price: "299.00", detectionClass: "MOISTURIZER",   imageUrl: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=300&h=300&fit=crop", category: "Personal Care", weight: "295.000", unit: "each", createdAt: new Date() },
  { id: "p4", name: "Soap",           brand: "Dove",        description: "Moisturizing beauty bar soap 100g",           price: "55.00",  detectionClass: "SOAP",          imageUrl: "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=300&h=300&fit=crop", category: "Personal Care", weight: null,      unit: "each", createdAt: new Date() },
  { id: "p5", name: "Water Bottle",   brand: "Bisleri",     description: "Packaged drinking water 500ml",               price: "20.00",  detectionClass: "WATER BOTTLE",  imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300&h=300&fit=crop", category: "Beverages",     weight: null,      unit: "each", createdAt: new Date() },
  {
    id: "p6",
    name: "Loose Vegetable",
    brand: "Fresh",
    description: "Price per 100 g — scan then place produce on the scale",
    price: "100.00",
    detectionClass: "LOOSE PRODUCE",
    imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300&h=300&fit=crop",
    category: "Produce",
    weight: "100.000",
    unit: "grams",
    createdAt: new Date(),
  },
];

class MemStorage implements IStorage {
  private users   = new Map<string, User>();
  private carts   = new Map<string, ShoppingCart>();
  private items   = new Map<string, CartItem & { product: Product }>();
  private orderMap = new Map<string, Order>();

  async getUser(id: string)                { return this.users.get(id); }
  async upsertUser(u: UpsertUser) {
    const existing = u.id ? this.users.get(u.id as string) : undefined;
    const user = { ...existing, ...u, id: (u.id as string) || uuid(), createdAt: existing?.createdAt || new Date(), updatedAt: new Date() } as User;
    this.users.set(user.id, user);
    return user;
  }
  async updateUserRazorpayInfo(userId: string, razorpayCustomerId: string) {
    const u = this.users.get(userId)!;
    const updated = { ...u, razorpayCustomerId, updatedAt: new Date() };
    this.users.set(userId, updated);
    return updated;
  }
  async getProductByDetectionClass(cls: string) {
    return DEMO_PRODUCTS.find(p => p.detectionClass?.toLowerCase() === cls.toLowerCase());
  }
  async createProduct(p: InsertProduct) {
    const prod = { ...p, id: uuid(), createdAt: new Date() } as Product;
    DEMO_PRODUCTS.push(prod);
    return prod;
  }
  async getAllProducts() { return [...DEMO_PRODUCTS]; }

  async getActiveCart(userId: string): Promise<CartWithItems | undefined> {
    for (const cart of Array.from(this.carts.values())) {
      if (cart.userId === userId && cart.status === "active") {
        return this.getCartWithItems(cart.id);
      }
    }
    return undefined;
  }
  async createCart(userId: string) {
    const cart: ShoppingCart = { id: uuid(), userId, status: "active", createdAt: new Date(), updatedAt: new Date() };
    this.carts.set(cart.id, cart);
    return cart;
  }
  async addItemToCart(cartId: string, item: InsertCartItem): Promise<CartItem> {
    // find existing
    for (const [key, ci] of Array.from(this.items.entries())) {
      if (ci.cartId === cartId && ci.productId === item.productId) {
        const updated = {
          ...ci,
          quantity: ci.quantity + (item.quantity || 1),
          measuredWeight:
            item.measuredWeight !== undefined && item.measuredWeight !== null
              ? item.measuredWeight
              : ci.measuredWeight,
        };
        this.items.set(key, updated);
        return updated;
      }
    }
    const product = DEMO_PRODUCTS.find(p => p.id === item.productId)!;
    const newItem = {
      id: uuid(),
      cartId,
      productId: item.productId,
      quantity: item.quantity || 1,
      measuredWeight: item.measuredWeight ?? null,
      detectedAt: new Date(),
      product,
    } as CartItem & { product: Product };
    this.items.set(newItem.id, newItem);
    return newItem;
  }
  async updateCartItemQuantity(cartItemId: string, quantity: number) {
    return this.updateCartItem(cartItemId, { quantity });
  }
  async updateCartItem(
    cartItemId: string,
    updates: { quantity?: number; measuredWeight?: string | null },
  ): Promise<CartItem> {
    const ci = this.items.get(cartItemId);
    if (!ci) throw new Error("Cart item not found");
    const next = { ...ci } as CartItem & { product: Product };
    if (updates.quantity !== undefined) next.quantity = updates.quantity;
    if (updates.measuredWeight !== undefined) next.measuredWeight = updates.measuredWeight as any;
    this.items.set(cartItemId, next);
    return next;
  }
  async removeCartItem(cartItemId: string) { this.items.delete(cartItemId); }
  async getCartWithItems(cartId: string): Promise<CartWithItems | undefined> {
    const cart = this.carts.get(cartId);
    if (!cart) return undefined;
    const cartItemsList = Array.from(this.items.values()).filter(i => i.cartId === cartId);
    return { ...cart, items: cartItemsList as CartItemWithProduct[] };
  }
  async createOrder(userId: string, cartId: string, orderData: InsertOrder): Promise<Order> {
    const order: Order = { id: uuid(), userId, cartId, status: "pending", ...orderData, razorpayOrderId: null, razorpayPaymentId: null, createdAt: new Date(), updatedAt: new Date() };
    this.orderMap.set(order.id, order);
    return order;
  }
  async updateOrderStatus(orderId: string, status: string, razorpayOrderId?: string, razorpayPaymentId?: string): Promise<Order> {
    const o = this.orderMap.get(orderId)!;
    const updated = { ...o, status, razorpayOrderId: razorpayOrderId || o.razorpayOrderId, razorpayPaymentId: razorpayPaymentId || o.razorpayPaymentId, updatedAt: new Date() };
    this.orderMap.set(orderId, updated);
    return updated;
  }
  async getUserOrders(userId: string) {
    return Array.from(this.orderMap.values()).filter(o => o.userId === userId);
  }
  async getOrderWithItems(orderId: string, userId: string): Promise<OrderWithItems | undefined> {
    const order = this.orderMap.get(orderId);
    if (!order || order.userId !== userId) return undefined;
    // For MemStorage: if the cart is still around, get its items; otherwise return empty items
    const cartItems = order.cartId ? await this.getCartWithItems(order.cartId) : undefined;
    return { ...order, items: cartItems?.items || [] };
  }
}

// ── Database storage ──────────────────────────────────────────────────────────
export class DatabaseStorage implements IStorage {
  // db is guaranteed non-null here — createStorage() only instantiates this class when db !== null
  async getUser(id: string)                { const [u] = await db!.select().from(users).where(eq(users.id, id)); return u; }
  async upsertUser(userData: UpsertUser) {
    const [u] = await db!.insert(users).values(userData).onConflictDoUpdate({ target: users.id, set: { ...userData, updatedAt: new Date() } }).returning();
    return u;
  }
  async updateUserRazorpayInfo(userId: string, razorpayCustomerId: string) {
    const [u] = await db!.update(users).set({ razorpayCustomerId, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return u;
  }
  async getProductByDetectionClass(detectionClass: string) {
    const { ilike } = await import("drizzle-orm");
    const [p] = await db!.select().from(products).where(ilike(products.detectionClass, detectionClass));
    return p;
  }
  async createProduct(product: InsertProduct) {
    const [p] = await db!.insert(products).values(product).returning();
    return p;
  }
  async getAllProducts() { return db!.select().from(products); }
  async getActiveCart(userId: string) {
    const [cart] = await db!.select().from(shoppingCarts).where(and(eq(shoppingCarts.userId, userId), eq(shoppingCarts.status, "active"))).orderBy(desc(shoppingCarts.createdAt));
    if (!cart) return undefined;
    return this.getCartWithItems(cart.id);
  }
  async createCart(userId: string) {
    const [cart] = await db!.insert(shoppingCarts).values({ userId, status: "active" }).returning();
    return cart;
  }
  async addItemToCart(cartId: string, item: InsertCartItem) {
    const [existing] = await db!.select().from(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, item.productId)));
    if (existing) {
      const [u] = await db!
        .update(cartItems)
        .set({
          quantity: existing.quantity + (item.quantity || 1),
          ...(item.measuredWeight !== undefined && item.measuredWeight !== null
            ? { measuredWeight: item.measuredWeight }
            : {}),
        })
        .where(eq(cartItems.id, existing.id))
        .returning();
      return u;
    }
    const [n] = await db!.insert(cartItems).values({ ...item, cartId }).returning();
    return n;
  }
  async updateCartItemQuantity(cartItemId: string, quantity: number) {
    return this.updateCartItem(cartItemId, { quantity });
  }
  async updateCartItem(
    cartItemId: string,
    updates: { quantity?: number; measuredWeight?: string | null },
  ): Promise<CartItem> {
    const data: Record<string, unknown> = {};
    if (updates.quantity !== undefined) data.quantity = updates.quantity;
    if (updates.measuredWeight !== undefined) data.measuredWeight = updates.measuredWeight;
    const [u] = await db!.update(cartItems).set(data).where(eq(cartItems.id, cartItemId)).returning();
    return u;
  }
  async removeCartItem(cartItemId: string) { await db!.delete(cartItems).where(eq(cartItems.id, cartItemId)); }
  async getCartWithItems(cartId: string): Promise<CartWithItems | undefined> {
    const [cart] = await db!.select().from(shoppingCarts).where(eq(shoppingCarts.id, cartId));
    if (!cart) return undefined;
    const items = await db!
      .select({
        id: cartItems.id,
        cartId: cartItems.cartId,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        measuredWeight: cartItems.measuredWeight,
        detectedAt: cartItems.detectedAt,
        product: products,
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, cartId));
    return { ...cart, items: items as CartItemWithProduct[] };
  }
  async createOrder(userId: string, cartId: string, orderData: InsertOrder) {
    const [o] = await db!.insert(orders).values({ ...orderData, userId, cartId }).returning();
    return o;
  }
  async updateOrderStatus(orderId: string, status: string, razorpayOrderId?: string, razorpayPaymentId?: string) {
    const data: any = { status, updatedAt: new Date() };
    if (razorpayOrderId) data.razorpayOrderId = razorpayOrderId;
    if (razorpayPaymentId) data.razorpayPaymentId = razorpayPaymentId;
    const [o] = await db!.update(orders).set(data).where(eq(orders.id, orderId)).returning();
    return o;
  }
  async getUserOrders(userId: string) {
    return db!.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  }
  async getOrderWithItems(orderId: string, userId: string): Promise<OrderWithItems | undefined> {
    const [order] = await db!.select().from(orders).where(
      and(eq(orders.id, orderId), eq(orders.userId, userId))
    );
    if (!order || !order.cartId) return order ? { ...order, items: [] } : undefined;
    const itemRows = await db!
      .select({
        id: cartItems.id,
        cartId: cartItems.cartId,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        measuredWeight: cartItems.measuredWeight,
        detectedAt: cartItems.detectedAt,
        product: products,
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, order.cartId));
    return { ...order, items: itemRows as CartItemWithProduct[] };
  }
}

// ── Auto-detect which storage to use ─────────────────────────────────────────
let _storage: IStorage;

async function createStorage(): Promise<IStorage> {
  // If no database credentials are configured, skip DB entirely
  if (!db) {
    console.warn("⚠️  No database credentials found — using in-memory storage.");
    console.warn("   Cart data will reset on server restart.");
    console.warn("   Products are pre-seeded for YOLO detection testing.");
    return new MemStorage();
  }

  try {
    const dbStorage = new DatabaseStorage();
    await dbStorage.getAllProducts();
    console.log("✅ Using PostgreSQL database storage");
    return dbStorage;
  } catch (err: any) {
    console.warn("⚠️  Database unavailable, using in-memory storage:", err.message);
    console.warn("   Cart data will reset on server restart.");
    console.warn("   Products are pre-seeded for YOLO detection testing.");
    return new MemStorage();
  }
}

// Lazy init — createStorage() is awaited in server/index.ts
const storagePromise = createStorage();
export const storage = new Proxy({} as IStorage, {
  get(_target, prop) {
    return async (...args: any[]) => {
      if (!_storage) _storage = await storagePromise;
      return (_storage as any)[prop](...args);
    };
  },
});
