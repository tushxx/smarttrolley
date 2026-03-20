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
  removeCartItem(cartItemId: string): Promise<void>;
  getCartWithItems(cartId: string): Promise<CartWithItems | undefined>;
  createOrder(userId: string, cartId: string, orderData: InsertOrder): Promise<Order>;
  updateOrderStatus(orderId: string, status: string, razorpayOrderId?: string, razorpayPaymentId?: string): Promise<Order>;
  getUserOrders(userId: string): Promise<Order[]>;
}

// ── In-memory fallback storage ────────────────────────────────────────────────
// Used when the database is unavailable. Seeded with the 5 YOLO-trained products.
function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Class names MUST match what the YOLO model outputs (case-sensitive from model.names)
// Model classes: {0: 'Cards', 1: 'Earbuds', 2: 'Facewash', 3: 'Perfume', 4: 'Shampoo'}
const DEMO_PRODUCTS: Product[] = [
  { id: "p1", name: "Perfume",       brand: "Luxury",   description: "Premium fragrance",                    price: "1999.00", detectionClass: "Perfume",  imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683702?w=300&h=300&fit=crop", category: "Beauty",        weight: null, unit: "each", createdAt: new Date() },
  { id: "p2", name: "Playing Cards", brand: "Classic",  description: "Standard playing card deck",           price: "299.00",  detectionClass: "Cards",    imageUrl: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=300&h=300&fit=crop", category: "Games",         weight: null, unit: "each", createdAt: new Date() },
  { id: "p3", name: "Face Wash",     brand: "Skincare", description: "Daily facial cleanser",                price: "449.00",  detectionClass: "Facewash", imageUrl: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=300&h=300&fit=crop", category: "Personal Care", weight: null, unit: "each", createdAt: new Date() },
  { id: "p4", name: "Earbuds",       brand: "SoundPro", description: "Wireless Bluetooth earbuds",           price: "8999.00", detectionClass: "Earbuds",  imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop", category: "Electronics",   weight: null, unit: "each", createdAt: new Date() },
  { id: "p5", name: "Shampoo",       brand: "HairCare", description: "Nourishing shampoo",                   price: "399.00",  detectionClass: "Shampoo",  imageUrl: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300&h=300&fit=crop", category: "Personal Care", weight: null, unit: "each", createdAt: new Date() },
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
    for (const cart of this.carts.values()) {
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
    for (const [key, ci] of this.items.entries()) {
      if (ci.cartId === cartId && ci.productId === item.productId) {
        const updated = { ...ci, quantity: ci.quantity + (item.quantity || 1) };
        this.items.set(key, updated);
        return updated;
      }
    }
    const product = DEMO_PRODUCTS.find(p => p.id === item.productId)!;
    const newItem = { id: uuid(), cartId, productId: item.productId, quantity: item.quantity || 1, detectedAt: new Date(), product } as CartItem & { product: Product };
    this.items.set(newItem.id, newItem);
    return newItem;
  }
  async updateCartItemQuantity(cartItemId: string, quantity: number) {
    const ci = this.items.get(cartItemId)!;
    const updated = { ...ci, quantity };
    this.items.set(cartItemId, updated);
    return updated;
  }
  async removeCartItem(cartItemId: string) { this.items.delete(cartItemId); }
  async getCartWithItems(cartId: string): Promise<CartWithItems | undefined> {
    const cart = this.carts.get(cartId);
    if (!cart) return undefined;
    const cartItemsList = [...this.items.values()].filter(i => i.cartId === cartId);
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
    return [...this.orderMap.values()].filter(o => o.userId === userId);
  }
}

// ── Database storage ──────────────────────────────────────────────────────────
export class DatabaseStorage implements IStorage {
  async getUser(id: string)                { const [u] = await db.select().from(users).where(eq(users.id, id)); return u; }
  async upsertUser(userData: UpsertUser) {
    const [u] = await db.insert(users).values(userData).onConflictDoUpdate({ target: users.id, set: { ...userData, updatedAt: new Date() } }).returning();
    return u;
  }
  async updateUserRazorpayInfo(userId: string, razorpayCustomerId: string) {
    const [u] = await db.update(users).set({ razorpayCustomerId, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return u;
  }
  async getProductByDetectionClass(detectionClass: string) {
    const { ilike } = await import("drizzle-orm");
    const [p] = await db.select().from(products).where(ilike(products.detectionClass, detectionClass));
    return p;
  }
  async createProduct(product: InsertProduct) {
    const [p] = await db.insert(products).values(product).returning();
    return p;
  }
  async getAllProducts() { return db.select().from(products); }
  async getActiveCart(userId: string) {
    const [cart] = await db.select().from(shoppingCarts).where(and(eq(shoppingCarts.userId, userId), eq(shoppingCarts.status, "active"))).orderBy(desc(shoppingCarts.createdAt));
    if (!cart) return undefined;
    return this.getCartWithItems(cart.id);
  }
  async createCart(userId: string) {
    const [cart] = await db.insert(shoppingCarts).values({ userId, status: "active" }).returning();
    return cart;
  }
  async addItemToCart(cartId: string, item: InsertCartItem) {
    const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, item.productId)));
    if (existing) {
      const [u] = await db.update(cartItems).set({ quantity: existing.quantity + (item.quantity || 1) }).where(eq(cartItems.id, existing.id)).returning();
      return u;
    }
    const [n] = await db.insert(cartItems).values({ ...item, cartId }).returning();
    return n;
  }
  async updateCartItemQuantity(cartItemId: string, quantity: number) {
    const [u] = await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, cartItemId)).returning();
    return u;
  }
  async removeCartItem(cartItemId: string) { await db.delete(cartItems).where(eq(cartItems.id, cartItemId)); }
  async getCartWithItems(cartId: string): Promise<CartWithItems | undefined> {
    const [cart] = await db.select().from(shoppingCarts).where(eq(shoppingCarts.id, cartId));
    if (!cart) return undefined;
    const items = await db.select({ id: cartItems.id, cartId: cartItems.cartId, productId: cartItems.productId, quantity: cartItems.quantity, detectedAt: cartItems.detectedAt, product: products })
      .from(cartItems).leftJoin(products, eq(cartItems.productId, products.id)).where(eq(cartItems.cartId, cartId));
    return { ...cart, items: items as CartItemWithProduct[] };
  }
  async createOrder(userId: string, cartId: string, orderData: InsertOrder) {
    const [o] = await db.insert(orders).values({ ...orderData, userId, cartId }).returning();
    return o;
  }
  async updateOrderStatus(orderId: string, status: string, razorpayOrderId?: string, razorpayPaymentId?: string) {
    const data: any = { status, updatedAt: new Date() };
    if (razorpayOrderId) data.razorpayOrderId = razorpayOrderId;
    if (razorpayPaymentId) data.razorpayPaymentId = razorpayPaymentId;
    const [o] = await db.update(orders).set(data).where(eq(orders.id, orderId)).returning();
    return o;
  }
  async getUserOrders(userId: string) {
    return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  }
}

// ── Auto-detect which storage to use ─────────────────────────────────────────
let _storage: IStorage;

async function createStorage(): Promise<IStorage> {
  try {
    const dbStorage = new DatabaseStorage();
    // Quick connectivity test
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
