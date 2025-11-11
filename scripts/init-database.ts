import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function initDatabase() {
  console.log('🔄 Creating database tables...');
  
  try {
    // Create users table
    await sql`
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
    `;
    console.log('✅ Users table created');

    // Create products table
    await sql`
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
    `;
    console.log('✅ Products table created');

    // Create shopping_carts table
    await sql`
      CREATE TABLE IF NOT EXISTS shopping_carts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        status VARCHAR DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Shopping carts table created');

    // Create cart_items table
    await sql`
      CREATE TABLE IF NOT EXISTS cart_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cart_id VARCHAR NOT NULL REFERENCES shopping_carts(id),
        product_id VARCHAR NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        scanned_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Cart items table created');

    // Create orders table
    await sql`
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
    `;
    console.log('✅ Orders table created');

    // Check if products already exist
    const existingProducts = await sql`SELECT COUNT(*) as count FROM products`;
    const productCount = parseInt(existingProducts[0].count);
    
    if (productCount === 0) {
      console.log('🔄 Seeding products...');
      
      // Insert Nike Air Max
      await sql`
        INSERT INTO products (name, brand, description, price, barcode, category, unit)
        VALUES (
          'Nike Air Max 270',
          'Nike',
          'Premium athletic footwear with Air Max cushioning technology',
          12999.00,
          '123456789012',
          'Footwear',
          'pair'
        )
      `;
      console.log('✅ Added Nike Air Max 270 - ₹12,999 (barcode: 123456789012)');

      // Insert Organic Bananas
      await sql`
        INSERT INTO products (name, brand, description, price, barcode, category, weight, unit)
        VALUES (
          'Organic Bananas',
          'Fresh Farms',
          'Fresh organic bananas, rich in potassium',
          349.00,
          '234567890123',
          'Fruits',
          1.000,
          'kg'
        )
      `;
      console.log('✅ Added Organic Bananas - ₹349 (barcode: 234567890123)');

      // Insert Wireless Headphones
      await sql`
        INSERT INTO products (name, brand, description, price, barcode, category, unit)
        VALUES (
          'Wireless Headphones',
          'SoundPro',
          'Bluetooth wireless headphones with noise cancellation',
          8999.00,
          '345678901234',
          'Electronics',
          'piece'
        )
      `;
      console.log('✅ Added Wireless Headphones - ₹8,999 (barcode: 345678901234)');
    } else {
      console.log(`ℹ️  Products already exist (${productCount} products found)`);
    }

    // Display all products
    const products = await sql`SELECT name, barcode, price FROM products ORDER BY name`;
    console.log('\n📦 Current products in database:');
    products.forEach((p: any) => {
      console.log(`  - ${p.name} (${p.barcode}): ₹${parseFloat(p.price).toLocaleString('en-IN')}`);
    });

    console.log('\n✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

initDatabase();
