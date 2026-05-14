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
      // Model classes: {0:'APPY FIZZ', 1:'FROOTI', 2:'MOISTURIZER', 3:'SOAP', 4:'WATER BOTTLE'}
      const yoloProducts = [
        {
          name: 'Appy Fizz',
          brand: 'Parle Agro',
          description: 'Sparkling apple juice drink 250ml',
          price: '40.00',
          detection_class: 'APPY FIZZ',
          category: 'Beverages',
          image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&h=300&fit=crop',
          weight: '275.000',
          unit: 'grams',
        },
        {
          name: 'Frooti',
          brand: 'Parle Agro',
          description: 'Mango fruit drink 200ml Tetra Pak',
          price: '20.00',
          detection_class: 'FROOTI',
          category: 'Beverages',
          image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=300&h=300&fit=crop',
          weight: '210.000',
          unit: 'grams',
        },
        {
          name: 'Moisturizer',
          brand: 'Nivea',
          description: 'Daily moisturizing cream for all skin types',
          price: '299.00',
          detection_class: 'MOISTURIZER',
          category: 'Personal Care',
          image_url: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=300&h=300&fit=crop',
          weight: '150.000',
          unit: 'grams',
        },
        {
          name: 'Soap',
          brand: 'Dove',
          description: 'Moisturizing beauty bar soap 100g',
          price: '55.00',
          detection_class: 'SOAP',
          category: 'Personal Care',
          image_url: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=300&h=300&fit=crop',
          weight: '115.000',
          unit: 'grams',
        },
        {
          name: 'Water Bottle',
          brand: 'Bisleri',
          description: 'Packaged drinking water 500ml',
          price: '20.00',
          detection_class: 'WATER BOTTLE',
          category: 'Beverages',
          image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300&h=300&fit=crop',
          weight: '530.000',
          unit: 'grams',
        },
      ];

      for (const p of yoloProducts) {
        await db.execute(sql`
          INSERT INTO products (name, brand, description, price, detection_class, category, image_url, weight, unit)
          VALUES (${p.name}, ${p.brand}, ${p.description}, ${p.price}, ${p.detection_class}, ${p.category}, ${p.image_url}, ${p.weight}, ${p.unit})
          ON CONFLICT (detection_class) DO NOTHING
        `);
      }

      console.log('✅ Products seeded for YOLO classes: APPY FIZZ, FROOTI, MOISTURIZER, SOAP, WATER BOTTLE');
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
