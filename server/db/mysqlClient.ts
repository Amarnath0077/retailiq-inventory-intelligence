import mysql from 'mysql2/promise';
import { inventoryStore } from './inventoryStore.ts';
import { datasetManager } from './datasetManager.ts';
import { fileImporterManager } from '../utils/fileImporter.ts';

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
  createIfNotExists?: boolean;
}

export interface ColumnDefinition {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignTable?: string;
  foreignColumn?: string;
}

export interface TableSchemaInfo {
  tableName: string;
  rowCount: number;
  columns: ColumnDefinition[];
  sampleRows: Record<string, any>[];
}

export interface SchemaInspectionResult {
  connected: boolean;
  database: string;
  host: string;
  port: number;
  isLiveMySQL: boolean;
  tables: TableSchemaInfo[];
  lastChecked: string;
  connectionError?: string;
}

class MySQLService {
  private pool: mysql.Pool | null = null;
  private config: DatabaseConnectionConfig;
  private isConnected: boolean = false;
  private lastError: string | null = null;
  private cachedSchema: SchemaInspectionResult | null = null;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'atliq_tshirts',
      ssl: process.env.DB_SSL === 'true'
    };

    // Attempt initial connection to MySQL (supports local instance on 127.0.0.1:3306 or remote env)
    this.connect({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'atliq_tshirts',
      ssl: process.env.DB_SSL === 'true'
    }).then(res => {
      if (res.success) {
        console.log(`[RetailIQ MySQL] Successfully connected to live database "${this.config.database}" at ${this.config.host}:${this.config.port}`);
      } else {
        console.log(`[RetailIQ MySQL] Standby mode (${res.message})`);
      }
    }).catch(err => {
      console.log(`[RetailIQ MySQL] Initial connect skipped: ${err.message}`);
    });
  }

  public getConfig(): DatabaseConnectionConfig {
    return {
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password ? '••••••••' : '',
      database: this.config.database,
      ssl: this.config.ssl
    };
  }

  public async connect(newConfig: DatabaseConnectionConfig): Promise<{ success: boolean; message: string; schema?: SchemaInspectionResult }> {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (e) {
        // Ignore disconnect error
      }
      this.pool = null;
    }

    // Retain existing password only if the masked placeholder was sent or password was omitted
    const actualPassword = (newConfig.password !== undefined && newConfig.password !== '••••••••')
      ? newConfig.password
      : (this.config.password || '');

    this.config = {
      ...newConfig,
      password: actualPassword
    };

    // If createIfNotExists was specified, create the database if not already present
    if (newConfig.createIfNotExists) {
      try {
        const adminConn = await mysql.createConnection({
          host: this.config.host,
          port: this.config.port,
          user: this.config.user,
          password: this.config.password,
          ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
          connectTimeout: 5000
        });
        await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\`;`);
        await adminConn.end();
      } catch (adminErr: any) {
        console.warn('[MySQL] Auto-create database notice:', adminErr.message);
      }
    }

    try {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
        waitForConnections: true,
        connectionLimit: 5,
        connectTimeout: 6000,
        queueLimit: 0
      });

      // Test ping
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      this.isConnected = true;
      this.lastError = null;

      // Introspect live schema immediately
      const schema = await this.inspectSchema();
      this.cachedSchema = schema;

      // Multi-table synchronization for inventory views
      try {
        const hasTShirts = schema.tables.some(t => t.tableName.toLowerCase() === 't_shirts');
        const hasProducts = schema.tables.some(t => t.tableName.toLowerCase() === 'products');

        if (hasTShirts && this.pool) {
          const [tShirts]: any = await this.pool.query('SELECT * FROM t_shirts LIMIT 500');
          let discounts: any[] = [];
          try {
            const [disc]: any = await this.pool.query('SELECT * FROM discounts LIMIT 100');
            discounts = disc;
          } catch (e) {
            // Discounts table might not exist
          }
          inventoryStore.syncFromDatabase(tShirts, discounts);
          await datasetManager.setDataset('default', 'mysql', `${this.config.database}.t_shirts`, tShirts, true);
        } else if (hasProducts && this.pool) {
          const [products]: any = await this.pool.query('SELECT * FROM products LIMIT 500');
          let discounts: any[] = [];
          try {
            const [disc]: any = await this.pool.query('SELECT * FROM discounts LIMIT 100');
            discounts = disc;
          } catch (e) {
            // Discounts table might not exist
          }
          inventoryStore.syncFromDatabase(products, discounts);
          await datasetManager.setDataset('default', 'mysql', `${this.config.database}.products`, products, true);
        } else if (schema.tables.length > 0 && this.pool) {
          const firstTable = schema.tables[0].tableName;
          const [rows]: any = await this.pool.query(`SELECT * FROM \`${firstTable}\` LIMIT 500`);
          inventoryStore.syncFromDatabase(rows);
          await datasetManager.setDataset('default', 'mysql', `${this.config.database}.${firstTable}`, rows, true);
        }
      } catch (syncErr: any) {
        console.warn('[MySQL] Store sync notice:', syncErr.message);
      }

      return {
        success: true,
        message: `Successfully connected to MySQL database "${this.config.database}" at ${this.config.host}:${this.config.port} (${schema.tables.length} tables found)`,
        schema
      };
    } catch (err: any) {
      this.isConnected = false;
      this.pool = null;

      let friendlyMessage = err.message || 'Connection failed';
      if (err.code === 'ECONNREFUSED') {
        friendlyMessage = `Connection refused at ${this.config.host}:${this.config.port}. Ensure MySQL/MariaDB server is running and accepting TCP connections on port ${this.config.port}.`;
      } else if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_DBACCESS_DENIED_USER_ERROR') {
        friendlyMessage = `Access denied for user "${this.config.user}". Please verify database username and password.`;
      } else if (err.code === 'ER_BAD_DB_ERROR') {
        friendlyMessage = `Database "${this.config.database}" does not exist on MySQL server at ${this.config.host}:${this.config.port}. Enable "Create database if not exists" or select an existing database.`;
      } else if (err.code === 'ENOTFOUND') {
        friendlyMessage = `Host "${this.config.host}" could not be resolved. Please verify host IP or domain name.`;
      } else if (err.code === 'ETIMEDOUT') {
        friendlyMessage = `Connection timed out while trying to reach ${this.config.host}:${this.config.port}. Check firewall or network security groups.`;
      } else if (err.message && err.message.toLowerCase().includes('ssl')) {
        friendlyMessage = `SSL handshake failed with MySQL server. Try toggling the SSL option off or verify certificates.`;
      }

      this.lastError = friendlyMessage;
      return {
        success: false,
        message: friendlyMessage
      };
    }
  }

  /**
   * List all databases discovered on the host
   */
  public async listDatabases(overrideConfig?: Partial<DatabaseConnectionConfig>): Promise<{ success: boolean; databases: string[]; current: string; message?: string }> {
    try {
      const conn = await mysql.createConnection({
        host: overrideConfig?.host || this.config.host,
        port: overrideConfig?.port || this.config.port,
        user: overrideConfig?.user || this.config.user,
        password: (overrideConfig?.password !== undefined && overrideConfig?.password !== '••••••••')
          ? overrideConfig.password
          : (this.config.password || ''),
        ssl: overrideConfig?.ssl ?? this.config.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 5000
      });

      const [rows]: any = await conn.query('SHOW DATABASES;');
      await conn.end();

      const allDbs: string[] = rows.map((r: any) => Object.values(r)[0] as string);
      const systemDbs = new Set(['information_schema', 'performance_schema', 'mysql', 'sys']);
      const userDbs = allDbs.filter(db => !systemDbs.has(db.toLowerCase()));
      const otherDbs = allDbs.filter(db => systemDbs.has(db.toLowerCase()));

      return {
        success: true,
        databases: [...userDbs, ...otherDbs],
        current: this.config.database
      };
    } catch (err: any) {
      return {
        success: false,
        databases: ['ecommerce_db', 'atliq_tshirts'],
        current: this.config.database,
        message: err.message || 'Failed to list databases from host'
      };
    }
  }

  /**
   * Create a new database on the MySQL host and optionally seed an e-commerce template
   */
  public async createDatabase(dbName: string, template?: 'ecommerce' | 'retail' | 'none'): Promise<{ success: boolean; message: string; schema?: SchemaInspectionResult }> {
    const cleanDbName = dbName.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanDbName) {
      return { success: false, message: 'Invalid database name. Use letters, numbers, and underscores.' };
    }

    try {
      const conn = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 5000,
        multipleStatements: true
      });

      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${cleanDbName}\`;`);

      if (template === 'ecommerce') {
        await conn.query(`
          USE \`${cleanDbName}\`;
          CREATE TABLE IF NOT EXISTS categories (
            category_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) NOT NULL,
            description TEXT
          );
          CREATE TABLE IF NOT EXISTS products (
            product_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            brand VARCHAR(100) NOT NULL,
            category VARCHAR(100) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            stock_quantity INT NOT NULL,
            rating DECIMAL(3,2) DEFAULT 4.50,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS customers (
            customer_id INT AUTO_INCREMENT PRIMARY KEY,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            city VARCHAR(100),
            state VARCHAR(50),
            country VARCHAR(50) DEFAULT 'USA'
          );
          CREATE TABLE IF NOT EXISTS orders (
            order_id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT,
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(50) DEFAULT 'delivered',
            total_amount DECIMAL(10,2) NOT NULL,
            payment_method VARCHAR(50) DEFAULT 'Credit Card'
          );
          CREATE TABLE IF NOT EXISTS order_items (
            order_item_id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT,
            product_id INT,
            quantity INT NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            subtotal DECIMAL(10,2) NOT NULL
          );
          CREATE TABLE IF NOT EXISTS discounts (
            discount_id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(50) NOT NULL,
            pct_discount DECIMAL(5,2) NOT NULL,
            category VARCHAR(100)
          );
          INSERT INTO products (name, brand, category, price, stock_quantity, rating) VALUES
          ('Noise Cancelling Headphones 700', 'Bose', 'Electronics', 279.00, 18, 4.8),
          ('Ultra Wireless Earbuds Pro', 'Sony', 'Electronics', 149.99, 42, 4.7),
          ('Mechanical Gaming Keyboard RGB', 'Logitech', 'Electronics', 89.50, 8, 4.6),
          ('Ergonomic Wireless Mouse', 'Logitech', 'Electronics', 49.99, 35, 4.5),
          ('Ultra HD 4K Monitor 27-inch', 'Dell', 'Electronics', 329.00, 12, 4.7),
          ('Classic Cotton Crewneck Tee', 'Levi', 'Apparel & Fashion', 24.50, 95, 4.4),
          ('Performance Dri-FIT Running Tee', 'Nike', 'Apparel & Fashion', 34.00, 80, 4.8),
          ('Air Zoom Pegasus Running Shoes', 'Nike', 'Footwear', 130.00, 22, 4.7)
          ON DUPLICATE KEY UPDATE price=price;
        `);
      }

      await conn.end();

      // Automatically connect to this newly created database
      const connectRes = await this.connect({
        ...this.config,
        database: cleanDbName
      });

      return {
        success: true,
        message: `Database "${cleanDbName}" created successfully and connected!`,
        schema: connectRes.schema
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || `Failed to create database "${cleanDbName}"`
      };
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.isConnected = false;
    this.cachedSchema = null;
  }

  public isLive(): boolean {
    if (fileImporterManager.getActiveSourceType() !== 'mysql') {
      return false;
    }
    return this.isConnected && this.pool !== null;
  }

  /**
   * Introspect schema from live MySQL database, imported CSV/PDF dataset, or built-in atliq_tshirts relational schema
   */
  public async inspectSchema(): Promise<SchemaInspectionResult> {
    const activeSource = fileImporterManager.getActiveSourceType();
    const importedSummary = fileImporterManager.getSummary();

    // If an imported CSV or PDF dataset is currently active, return its schema
    if (activeSource !== 'mysql' && importedSummary) {
      return {
        connected: true,
        database: `${importedSummary.fileName} (${activeSource.toUpperCase()})`,
        host: `Local ${activeSource.toUpperCase()} File`,
        port: 0,
        isLiveMySQL: false,
        tables: [
          {
            tableName: 'products',
            rowCount: importedSummary.rowCount,
            columns: importedSummary.columns.map(c => ({
              name: c,
              dataType: /price|cost|amount|quantity|count|stock|id|units|rating/i.test(c) ? 'NUMERIC' : 'VARCHAR(255)',
              isNullable: true,
              isPrimaryKey: /^(id|t_shirt_id|product_id|sku)$/i.test(c),
              isForeignKey: false
            })),
            sampleRows: importedSummary.sampleRows
          }
        ],
        lastChecked: importedSummary.importedAt
      };
    }

    if (this.isLive() && this.pool) {
      try {
        const [tablesRows]: any = await this.pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = ?
          ORDER BY table_name;
        `, [this.config.database]);

        const tableNames: string[] = tablesRows.map((r: any) => r.table_name || r.TABLE_NAME);
        const tables: TableSchemaInfo[] = [];

        for (const tableName of tableNames) {
          // Columns
          const [colRows]: any = await this.pool.query(`
            SELECT column_name, data_type, is_nullable, column_key
            FROM information_schema.columns
            WHERE table_schema = ? AND table_name = ?
            ORDER BY ordinal_position;
          `, [this.config.database, tableName]);

          // Sample rows
          let sampleRows: any[] = [];
          let rowCount = 0;
          try {
            const [samples]: any = await this.pool.query(`SELECT * FROM \`${tableName}\` LIMIT 3;`);
            sampleRows = samples;
            const [countRes]: any = await this.pool.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\`;`);
            rowCount = countRes[0]?.cnt || 0;
          } catch (e) {
            // Ignore sample query error
          }

          tables.push({
            tableName,
            rowCount,
            columns: colRows.map((c: any) => ({
              name: c.column_name || c.COLUMN_NAME,
              dataType: (c.data_type || c.DATA_TYPE).toUpperCase(),
              isNullable: (c.is_nullable || c.IS_NULLABLE) === 'YES',
              isPrimaryKey: (c.column_key || c.COLUMN_KEY) === 'PRI',
              isForeignKey: (c.column_key || c.COLUMN_KEY) === 'MUL'
            })),
            sampleRows
          });
        }

        const result: SchemaInspectionResult = {
          connected: true,
          database: this.config.database,
          host: this.config.host,
          port: this.config.port,
          isLiveMySQL: true,
          tables,
          lastChecked: new Date().toISOString()
        };
        this.cachedSchema = result;
        return result;
      } catch (err: any) {
        console.warn('Live schema inspection failed, falling back:', err.message);
      }
    }

    // Default / built-in AtliQ T-Shirts schema
    const products = inventoryStore.getJoinedProducts();
    const rawTShirts = products.slice(0, 3).map(p => ({
      t_shirt_id: p.t_shirt_id,
      brand: p.brand,
      color: p.color,
      size: p.size,
      price: p.price,
      stock_quantity: p.stock_quantity
    }));

    const sampleDiscounts = [
      { t_shirt_id: 1, pct_discount: 10 },
      { t_shirt_id: 3, pct_discount: 15 },
      { t_shirt_id: 7, pct_discount: 20 }
    ];

    return {
      connected: this.isConnected,
      database: this.config.database,
      host: this.config.host,
      port: this.config.port,
      isLiveMySQL: false,
      tables: [
        {
          tableName: 't_shirts',
          rowCount: products.length,
          columns: [
            { name: 't_shirt_id', dataType: 'INT', isNullable: false, isPrimaryKey: true, isForeignKey: false },
            { name: 'brand', dataType: 'VARCHAR(50)', isNullable: false, isPrimaryKey: false, isForeignKey: false },
            { name: 'color', dataType: 'VARCHAR(50)', isNullable: false, isPrimaryKey: false, isForeignKey: false },
            { name: 'size', dataType: 'VARCHAR(10)', isNullable: false, isPrimaryKey: false, isForeignKey: false },
            { name: 'price', dataType: 'INT', isNullable: false, isPrimaryKey: false, isForeignKey: false },
            { name: 'stock_quantity', dataType: 'INT', isNullable: false, isPrimaryKey: false, isForeignKey: false }
          ],
          sampleRows: rawTShirts
        },
        {
          tableName: 'discounts',
          rowCount: 15,
          columns: [
            { name: 't_shirt_id', dataType: 'INT', isNullable: false, isPrimaryKey: true, isForeignKey: true, foreignTable: 't_shirts', foreignColumn: 't_shirt_id' },
            { name: 'pct_discount', dataType: 'DECIMAL(5,2)', isNullable: false, isPrimaryKey: false, isForeignKey: false }
          ],
          sampleRows: sampleDiscounts
        }
      ],
      lastChecked: new Date().toISOString(),
      connectionError: this.lastError || undefined
    };
  }

  /**
   * Safe read-only SQL query validator and executor
   */
  public async executeSafeQuery(sql: string): Promise<{ columns: string[]; rows: any[]; executionTimeMs: number }> {
    const startTime = performance.now();
    const cleanSql = sql.trim().replace(/;+$/, '');
    const lower = cleanSql.toLowerCase();

    // 1. Strict Read-Only Validation
    const prohibitedKeywords = [
      'insert', 'update', 'delete', 'drop', 'truncate', 'alter', 'create',
      'replace', 'rename', 'grant', 'revoke', 'lock', 'unlock', 'exec',
      'execute', 'call', 'flush', 'kill', 'shutdown', 'set global'
    ];

    for (const kw of prohibitedKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lower)) {
        throw new Error(`Security Violation: Keyword "${kw.toUpperCase()}" is not permitted. Only read-only queries are allowed.`);
      }
    }

    if (!lower.startsWith('select') && !lower.startsWith('show') && !lower.startsWith('describe') && !lower.startsWith('explain')) {
      throw new Error('Security Violation: Only SELECT, SHOW, DESCRIBE, and EXPLAIN statements are permitted.');
    }

    // 2. Execute on Live MySQL Pool if connected
    if (this.isLive() && this.pool) {
      try {
        const [rows, fields]: any = await this.pool.query(cleanSql);
        const executionTimeMs = Math.round(performance.now() - startTime);

        let columns: string[] = [];
        if (fields && Array.isArray(fields)) {
          columns = fields.map((f: any) => f.name);
        } else if (rows && rows.length > 0 && typeof rows[0] === 'object') {
          columns = Object.keys(rows[0]);
        }

        return {
          columns,
          rows: Array.isArray(rows) ? rows : [rows],
          executionTimeMs
        };
      } catch (mysqlErr: any) {
        throw new Error(`MySQL Execution Error: ${mysqlErr.message}`);
      }
    }

    // 3. Fallback to Relational SQL Simulator Engine
    try {
      const simulated = inventoryStore.executeSimulatedSQL(cleanSql);
      const executionTimeMs = Math.round(performance.now() - startTime);
      return {
        columns: simulated.columns,
        rows: simulated.rows,
        executionTimeMs
      };
    } catch (simErr: any) {
      throw new Error(`SQL Simulator Error: ${simErr.message}`);
    }
  }

  private async initPool() {
    await this.connect(this.config);
  }
}

export const mysqlService = new MySQLService();
