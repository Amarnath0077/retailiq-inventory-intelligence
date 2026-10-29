import mysql from 'mysql2/promise';
import { INITIAL_T_SHIRTS, INITIAL_DISCOUNTS } from './seedData.ts';

async function seed() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    multipleStatements: true
  });

  console.log('Connected to MySQL. Populating atliq_tshirts and ecommerce_db...');

  // Seed atliq_tshirts
  await conn.query('USE atliq_tshirts;');
  await conn.query('DELETE FROM discounts;');
  await conn.query('DELETE FROM t_shirts;');

  for (const t of INITIAL_T_SHIRTS) {
    await conn.query(
      'INSERT INTO t_shirts (t_shirt_id, brand, color, size, price, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)',
      [t.t_shirt_id, t.brand, t.color, t.size, t.price, t.stock_quantity]
    );
  }

  for (const d of INITIAL_DISCOUNTS) {
    await conn.query(
      'INSERT INTO discounts (t_shirt_id, pct_discount) VALUES (?, ?)',
      [d.t_shirt_id, d.pct_discount]
    );
  }

  console.log(`Seeded atliq_tshirts: ${INITIAL_T_SHIRTS.length} t-shirts, ${INITIAL_DISCOUNTS.length} discounts.`);

  // Seed ecommerce_db
  await conn.query('USE ecommerce_db;');
  await conn.query('DELETE FROM orders;');
  await conn.query('DELETE FROM products;');
  await conn.query('DELETE FROM categories;');

  await conn.query(`
    INSERT INTO categories (category_id, category_name) VALUES
    (1, 'Footwear'),
    (2, 'Electronics'),
    (3, 'Apparel'),
    (4, 'Accessories');
  `);

  await conn.query(`
    INSERT INTO products (product_id, product_name, brand, category_id, price, stock_quantity, sku, rating) VALUES
    (1, 'Nike Air Pegasus 40', 'Nike', 1, 130.00, 45, 'NK-PEG-40', 4.8),
    (2, 'Adidas Ultraboost Light', 'Adidas', 1, 180.00, 32, 'AD-UB-01', 4.9),
    (3, 'Sony WH-1000XM5 Noise Cancelling', 'Sony', 2, 398.00, 18, 'SN-WH5-01', 4.9),
    (4, 'Bose QuietComfort 45', 'Bose', 2, 329.00, 24, 'BS-QC45', 4.7),
    (5, 'Levi 501 Original Fit Jeans', 'Levi', 3, 79.00, 65, 'LV-501-BL', 4.6),
    (6, 'Nike Dri-FIT Legend Fitness Tee', 'Nike', 3, 28.00, 140, 'NK-DF-LG', 4.5),
    (7, 'Van Heusen Regular Fit Dress Shirt', 'Van Heusen', 3, 45.00, 55, 'VH-DRS-01', 4.4),
    (8, 'Apple AirPods Pro (2nd Gen)', 'Apple', 2, 249.00, 15, 'AP-AIR-02', 4.9),
    (9, 'Puma Suede Classic Retro', 'Puma', 1, 75.00, 28, 'PM-SUE-01', 4.3),
    (10, 'Levi Sherpa Trucker Jacket', 'Levi', 3, 128.00, 20, 'LV-SHR-01', 4.8),
    (11, 'Adidas Essentials 3-Stripes Hoodie', 'Adidas', 3, 65.00, 40, 'AD-ESS-01', 4.6),
    (12, 'Sony LinkBuds S Wireless', 'Sony', 2, 198.00, 30, 'SN-LB-01', 4.5);
  `);

  await conn.query(`
    INSERT INTO orders (order_id, product_id, quantity, order_date, status) VALUES
    (101, 1, 2, '2026-03-01', 'delivered'),
    (102, 3, 1, '2026-03-02', 'delivered'),
    (103, 5, 3, '2026-03-03', 'delivered'),
    (104, 6, 5, '2026-03-04', 'delivered'),
    (105, 8, 1, '2026-03-05', 'shipped'),
    (106, 9, 2, '2026-03-06', 'delivered');
  `);

  console.log('Seeded ecommerce_db successfully!');
  await conn.end();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
