import { db } from './db';
import { sql } from 'drizzle-orm';

export async function initializeDatabase() {
  try {
    console.log('🔄 Checking database tables...');

    // Create users table
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

    // Create products table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        brand TEXT,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        barcode VARCHAR UNIQUE NOT NULL,
        image_url TEXT,
        category VARCHAR,
        weight DECIMAL(10, 3),
        unit VARCHAR DEFAULT 'each',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create shopping_carts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shopping_carts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        status VARCHAR DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create cart_items table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cart_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cart_id VARCHAR NOT NULL REFERENCES shopping_carts(id),
        product_id VARCHAR NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        scanned_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create orders table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        cart_id VARCHAR REFERENCES shopping_carts(id),
        status VARCHAR DEFAULT 'pending',
        subtotal DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        razorpay_order_id VARCHAR,
        razorpay_payment_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Database tables ready');

    // Check if products exist
    const existingProducts = await db.execute(sql`SELECT COUNT(*) as count FROM products`);
    const productCount = parseInt(existingProducts.rows[0].count as string);

    // CRITICAL: Check if products have WRONG barcodes (old fake barcodes)
    // If they do, delete them so we can re-seed with REAL Indian barcodes
    if (productCount > 0) {
      const wrongBarcodes = await db.execute(sql`
        SELECT COUNT(*) as count FROM products 
        WHERE barcode IN ('123456789012', '234567890123', '345678901234')
      `);
      const wrongCount = parseInt(wrongBarcodes.rows[0].count as string);
      
      if (wrongCount > 0) {
        console.log('🔄 Found products with wrong barcodes - resetting...');
        await db.execute(sql`DELETE FROM products WHERE barcode IN ('123456789012', '234567890123', '345678901234')`);
        console.log('✅ Old products removed');
      }
    }

    // Re-check product count after cleanup
    const finalProducts = await db.execute(sql`SELECT COUNT(*) as count FROM products`);
    const finalCount = parseInt(finalProducts.rows[0].count as string);

    if (finalCount === 0) {
      console.log('🔄 Seeding products with REAL Indian barcodes...');

      // Insert Nike Air Max with REAL Indian barcode
      await db.execute(sql`
        INSERT INTO products (name, brand, description, price, barcode, category, unit)
        VALUES (
          'Nike Air Max 270',
          'Nike',
          'Premium athletic footwear with Air Max cushioning technology',
          1299.00,
          '8901314717429',
          'Footwear',
          'pair'
        )
      `);

      // Insert Organic Bananas with REAL Indian barcode
      await db.execute(sql`
        INSERT INTO products (name, brand, description, price, barcode, category, weight, unit)
        VALUES (
          'Organic Bananas',
          'Fresh Farms',
          'Fresh organic bananas, rich in potassium',
          349.00,
          '8901719129988',
          'Fruits',
          1.000,
          'kg'
        )
      `);

      // Insert Wireless Headphones with REAL Indian barcode
      await db.execute(sql`
        INSERT INTO products (name, brand, description, price, barcode, category, unit)
        VALUES (
          'Wireless Headphones',
          'SoundPro',
          'Bluetooth wireless headphones with noise cancellation',
          8999.00,
          '8901030970122',
          'Electronics',
          'piece'
        )
      `);

      console.log('✅ Products seeded successfully!');
    }

    // Display all products
    const products = await db.execute(sql`SELECT name, barcode, price FROM products ORDER BY name`);
    console.log('\n📦 Products in database:');
    products.rows.forEach((p: any) => {
      console.log(`  ✓ ${p.name} (${p.barcode}): ₹${parseFloat(p.price).toLocaleString('en-IN')}`);
    });
    console.log('');

  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    console.log('⚠️  App will continue in limited mode');
  }
}
