import mysql from 'mysql2/promise';
import { INITIAL_T_SHIRTS, INITIAL_DISCOUNTS } from './seedData.ts';

export async function seedMySQLDatabase(customConfig?: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}) {
  const host = customConfig?.host || process.env.DB_HOST || '127.0.0.1';
  const port = customConfig?.port || (process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306);
  const user = customConfig?.user || process.env.DB_USER || 'root';
  const password = customConfig?.password !== undefined ? customConfig.password : (process.env.DB_PASSWORD || '');
  const database = customConfig?.database || process.env.DB_NAME || 'atliq_tshirts';

  console.log(`Connecting to MySQL at ${host}:${port} as ${user}...`);

  // Connect to MySQL server first (without database) to ensure database exists
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    connectTimeout: 5000
  });

  try {
    console.log(`Creating database \`${database}\` if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${database}\`;`);

    // Create tables
    console.log('Creating tables `t_shirts` and `discounts`...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS t_shirts (
        t_shirt_id INT AUTO_INCREMENT PRIMARY KEY,
        brand ENUM('Nike', 'Levi', 'Van Heusen', 'Adidas') NOT NULL,
        color ENUM('White', 'Black', 'Red', 'Blue') NOT NULL,
        size ENUM('XS', 'S', 'M', 'L', 'XL') NOT NULL,
        price INT NOT NULL,
        stock_quantity INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS discounts (
        discount_id INT AUTO_INCREMENT PRIMARY KEY,
        t_shirt_id INT NOT NULL,
        pct_discount DECIMAL(5, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_t_shirt FOREIGN KEY (t_shirt_id) REFERENCES t_shirts (t_shirt_id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Check existing count
    const [tshirtCountRows]: any = await connection.query('SELECT COUNT(*) as count FROM t_shirts;');
    const tshirtCount = tshirtCountRows[0]?.count || 0;

    if (tshirtCount === 0) {
      console.log(`Seeding ${INITIAL_T_SHIRTS.length} t_shirts records...`);
      for (const t of INITIAL_T_SHIRTS) {
        await connection.query(
          'INSERT INTO t_shirts (t_shirt_id, brand, color, size, price, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)',
          [t.t_shirt_id, t.brand, t.color, t.size, t.price, t.stock_quantity]
        );
      }
    } else {
      console.log(`Database already has ${tshirtCount} t_shirts records.`);
    }

    const [discountCountRows]: any = await connection.query('SELECT COUNT(*) as count FROM discounts;');
    const discountCount = discountCountRows[0]?.count || 0;

    if (discountCount === 0) {
      console.log(`Seeding ${INITIAL_DISCOUNTS.length} discount records...`);
      for (const d of INITIAL_DISCOUNTS) {
        await connection.query(
          'INSERT INTO discounts (t_shirt_id, pct_discount) VALUES (?, ?)',
          [d.t_shirt_id, d.pct_discount]
        );
      }
    } else {
      console.log(`Database already has ${discountCount} discounts records.`);
    }

    console.log(`MySQL database \`${database}\` successfully prepared and seeded!`);
    return { success: true, count: INITIAL_T_SHIRTS.length };
  } finally {
    await connection.end();
  }
}

// Run if called directly
if (process.argv[1]?.includes('seedMySQL.ts')) {
  seedMySQLDatabase()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
