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

// Interface for storage operations
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRazorpayInfo(userId: string, razorpayCustomerId: string): Promise<User>;

  // Product operations
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  getAllProducts(): Promise<Product[]>;

  // Cart operations
  getActiveCart(userId: string): Promise<CartWithItems | undefined>;
  createCart(userId: string): Promise<ShoppingCart>;
  addItemToCart(cartId: string, item: InsertCartItem): Promise<CartItem>;
  updateCartItemQuantity(cartItemId: string, quantity: number): Promise<CartItem>;
  removeCartItem(cartItemId: string): Promise<void>;
  getCartWithItems(cartId: string): Promise<CartWithItems | undefined>;

  // Order operations
  createOrder(userId: string, cartId: string, orderData: InsertOrder): Promise<Order>;
  updateOrderStatus(orderId: string, status: string, razorpayOrderId?: string, razorpayPaymentId?: string): Promise<Order>;
  getUserOrders(userId: string): Promise<Order[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserRazorpayInfo(userId: string, razorpayCustomerId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        razorpayCustomerId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Product operations
  async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.barcode, barcode));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  // Cart operations
  async getActiveCart(userId: string): Promise<CartWithItems | undefined> {
    const [cart] = await db
      .select()
      .from(shoppingCarts)
      .where(and(eq(shoppingCarts.userId, userId), eq(shoppingCarts.status, "active")))
      .orderBy(desc(shoppingCarts.createdAt));

    if (!cart) return undefined;

    return this.getCartWithItems(cart.id);
  }

  async createCart(userId: string): Promise<ShoppingCart> {
    const [cart] = await db
      .insert(shoppingCarts)
      .values({ userId, status: "active" })
      .returning();
    return cart;
  }

  async addItemToCart(cartId: string, item: InsertCartItem): Promise<CartItem> {
    // Check if item already exists in cart
    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, item.productId)));

    if (existingItem) {
      // Update quantity
      const [updatedItem] = await db
        .update(cartItems)
        .set({ quantity: existingItem.quantity + (item.quantity || 1) })
        .where(eq(cartItems.id, existingItem.id))
        .returning();
      return updatedItem;
    } else {
      // Add new item
      const [newItem] = await db
        .insert(cartItems)
        .values({ ...item, cartId })
        .returning();
      return newItem;
    }
  }

  async updateCartItemQuantity(cartItemId: string, quantity: number): Promise<CartItem> {
    const [updatedItem] = await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, cartItemId))
      .returning();
    return updatedItem;
  }

  async removeCartItem(cartItemId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
  }

  async getCartWithItems(cartId: string): Promise<CartWithItems | undefined> {
    const [cart] = await db.select().from(shoppingCarts).where(eq(shoppingCarts.id, cartId));
    if (!cart) return undefined;

    const items = await db
      .select({
        id: cartItems.id,
        cartId: cartItems.cartId,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        scannedAt: cartItems.scannedAt,
        product: products,
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, cartId));

    return {
      ...cart,
      items: items as CartItemWithProduct[],
    };
  }

  // Order operations
  async createOrder(userId: string, cartId: string, orderData: InsertOrder): Promise<Order> {
    const [order] = await db
      .insert(orders)
      .values({
        ...orderData,
        userId,
        cartId,
      })
      .returning();
    return order;
  }

  async updateOrderStatus(orderId: string, status: string, razorpayOrderId?: string, razorpayPaymentId?: string): Promise<Order> {
    const updateData: any = { status, updatedAt: new Date() };
    if (razorpayOrderId) updateData.razorpayOrderId = razorpayOrderId;
    if (razorpayPaymentId) updateData.razorpayPaymentId = razorpayPaymentId;

    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning();
    return order;
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }
}

export const storage = new DatabaseStorage();
