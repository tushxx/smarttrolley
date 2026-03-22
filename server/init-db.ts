import { db } from './db';
import { sql } from 'drizzle-orm';

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 2000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === retries) throw err;
      console.log(`⏳ DB retry ${attempt}/${retries} after ${delayMs}ms... (${err.message})`);
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
  throw new Error('unreachable');
}

export async function initializeDatabase() {
  if (!db) {
    console.log('ℹ️  No database credentials — skipping DB init, using in-memory storage.');
    return;
  }

  try {
    console.log('🔄 Setting up database tables...');

    // Users table
    await withRetry(() => db!.execute(sql`
      SELECT 1
    `));  // warm up connection first

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email VARCHAR UNIQUE,
        first_name VARCHAR,
        last_name VARCHAR,
        profile_image_url VARCHAR,
        mobile_number VARCHAR,
        razorpay_customer_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Products table — keyed by YOLO detection class
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        brand TEXT,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        detection_class VARCHAR UNIQUE NOT NULL,
        image_url TEXT,
        category VARCHAR,
        weight DECIMAL(10,3),
        unit VARCHAR DEFAULT 'each',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Shopping carts
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shopping_carts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        status VARCHAR DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Cart items
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cart_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cart_id VARCHAR NOT NULL REFERENCES shopping_carts(id),
        product_id VARCHAR NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        detected_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Orders
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        cart_id VARCHAR REFERENCES shopping_carts(id),
        status VARCHAR DEFAULT 'pending',
        subtotal DECIMAL(10,2) NOT NULL,
        tax DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        razorpay_order_id VARCHAR,
        razorpay_payment_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Drop old barcode column if it exists (migration from old schema)
    await db.execute(sql`
      ALTER TABLE products DROP COLUMN IF EXISTS barcode
    `).catch(() => {});

    console.log('✅ Database tables ready');

    // Seed products matching YOLO trained classes
    const { rows } = await db.execute(sql`SELECT COUNT(*) as count FROM products`);
    const count = parseInt((rows[0] as any).count);

    if (count === 0) {
      console.log('🌱 Seeding products for YOLO detection classes...');

      // Class names match exactly what the YOLO model outputs
      // Model classes: {0:'Cards', 1:'Earbuds', 2:'Facewash', 3:'Perfume', 4:'Shampoo'}
      const yoloProducts = [
        {
          name: 'Perfume',
          brand: 'Luxury',
          description: 'Premium fragrance detected by AI camera',
          price: '1999.00',
          detection_class: 'Perfume',
          category: 'Beauty',
          image_url: 'https://images.unsplash.com/photo-1541643600914-78b084683702?w=300&h=300&fit=crop',
        },
        {
          name: 'Playing Cards',
          brand: 'Classic',
          description: 'Standard deck of playing cards',
          price: '299.00',
          detection_class: 'Cards',
          category: 'Games',
          image_url: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=300&h=300&fit=crop',
        },
        {
          name: 'Face Wash',
          brand: 'Skincare',
          description: 'Daily facial cleanser for all skin types',
          price: '449.00',
          detection_class: 'Facewash',
          category: 'Personal Care',
          image_url: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=300&h=300&fit=crop',
        },
        {
          name: 'Earbuds',
          brand: 'SoundPro',
          description: 'Wireless Bluetooth earbuds',
          price: '8999.00',
          detection_class: 'Earbuds',
          category: 'Electronics',
          image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop',
        },
        {
          name: 'Shampoo',
          brand: 'HairCare',
          description: 'Nourishing shampoo for healthy hair',
          price: '399.00',
          detection_class: 'Shampoo',
          category: 'Personal Care',
          image_url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300&h=300&fit=crop',
        },
      ];

      for (const p of yoloProducts) {
        await db.execute(sql`
          INSERT INTO products (name, brand, description, price, detection_class, category, image_url)
          VALUES (${p.name}, ${p.brand}, ${p.description}, ${p.price}, ${p.detection_class}, ${p.category}, ${p.image_url})
          ON CONFLICT (detection_class) DO NOTHING
        `);
      }

      console.log('✅ Products seeded for YOLO classes: Cards, Earbuds, Facewash, Perfume, Shampoo');
    }

    // Log products
    const { rows: prods } = await db.execute(sql`SELECT name, detection_class, price FROM products ORDER BY name`);
    console.log('\n📦 Products (mapped to YOLO classes):');
    prods.forEach((p: any) => {
      console.log(`  ✓ ${p.name} [class: ${p.detection_class}] ₹${parseFloat(p.price).toLocaleString('en-IN')}`);
    });
    console.log('');

  } catch (error: any) {
    console.error('❌ Database init failed:', error.message);
  }
}
