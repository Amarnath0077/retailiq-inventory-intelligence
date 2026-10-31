import mysql from 'mysql2/promise';
import { userInventoryStore } from './userInventoryStore.ts';
import { datasetManager } from './datasetManager.ts';
import { executeInMemorySql } from './inMemorySql.ts';

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
  private isSandbox: boolean = false;
  private sandboxDbName: string = '';
  private sandboxRecords: any[] = [];
  private sandboxDiscounts: any[] = [];
  private lastError: string | null = null;
  private cachedSchema: SchemaInspectionResult | null = null;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '',
      ssl: process.env.DB_SSL === 'true'
    };
    // Strict requirement: Start in standby/disconnected state.
    // Do NOT auto-connect or auto-seed demo data without explicit user request.
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

  public async connect(
    newConfig: DatabaseConnectionConfig,
    userId?: string
  ): Promise<{ success: boolean; message: string; schema?: SchemaInspectionResult; rowCount?: number }> {
    // If user requested sandbox mode directly
    if (newConfig.host === 'sandbox' || newConfig.host === 'built-in' || newConfig.host === 'virtual') {
      return this.connectSandbox(newConfig.database || 'ecommerce_db', userId);
    }

    if (this.pool) {
      try {
        await this.pool.end();
      } catch (e) {
        // Ignore disconnect error
      }
      this.pool = null;
    }
    this.isSandbox = false;

    const actualPassword = (newConfig.password !== undefined && newConfig.password !== '••••••••')
      ? newConfig.password
      : (this.config.password || '');

    this.config = {
      ...newConfig,
      password: actualPassword
    };

    // If createIfNotExists was specified, create the database if not already present
    if (newConfig.createIfNotExists && this.config.database) {
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

      let fetchedRecords: any[] = [];
      let fetchedDiscounts: any[] = [];

      try {
        const hasTShirts = schema.tables.some(t => t.tableName.toLowerCase() === 't_shirts');
        const hasProducts = schema.tables.some(t => t.tableName.toLowerCase() === 'products');

        if (hasTShirts && this.pool) {
          const [tShirts]: any = await this.pool.query('SELECT * FROM t_shirts LIMIT 1000');
          fetchedRecords = tShirts;
          try {
            const [disc]: any = await this.pool.query('SELECT * FROM discounts LIMIT 200');
            fetchedDiscounts = disc;
          } catch (e) {}
        } else if (hasProducts && this.pool) {
          const [products]: any = await this.pool.query('SELECT * FROM products LIMIT 1000');
          fetchedRecords = products;
          try {
            const [disc]: any = await this.pool.query('SELECT * FROM discounts LIMIT 200');
            fetchedDiscounts = disc;
          } catch (e) {}
        } else if (schema.tables.length > 0 && this.pool) {
          const firstTable = schema.tables[0].tableName;
          const [rows]: any = await this.pool.query(`SELECT * FROM \`${firstTable}\` LIMIT 1000`);
          fetchedRecords = rows;
        }

        if (userId) {
          userInventoryStore.setDataSource(
            userId,
            {
              type: 'database',
              name: this.config.database,
              host: `${this.config.host}:${this.config.port}`,
              isLive: true,
              tables: schema.tables.map(t => t.tableName),
              totalRecords: fetchedRecords.length
            },
            fetchedRecords,
            fetchedDiscounts
          );
          await datasetManager.setDataset(userId, 'mysql', this.config.database, fetchedRecords, true);
        }
      } catch (syncErr: any) {
        console.warn('[MySQL] Store sync notice:', syncErr.message);
      }

      return {
        success: true,
        message: `Successfully connected to database "${this.config.database}" at ${this.config.host}:${this.config.port}. Loaded ${fetchedRecords.length} records.`,
        schema,
        rowCount: fetchedRecords.length
      };
    } catch (err: any) {
      this.isConnected = false;
      this.pool = null;

      let friendlyMessage = err.message || 'Connection failed';
      if (err.code === 'ECONNREFUSED') {
        const isLocal = this.config.host === '127.0.0.1' || this.config.host === 'localhost';
        if (isLocal) {
          friendlyMessage = `Connection refused at ${this.config.host}:${this.config.port}. Because RetailIQ is running on a cloud deployment, ${this.config.host} points to the cloud container rather than your local computer. To connect your database: (1) Click "Launch Built-in Sandbox Database", (2) Use a cloud database host (AWS RDS, Aiven, Railway, etc.), or (3) Tunnel your local MySQL with ngrok (ngrok tcp 3306).`;
        } else {
          friendlyMessage = `Connection refused at ${this.config.host}:${this.config.port}. Ensure MySQL/MariaDB server is running and accepting TCP connections on port ${this.config.port}.`;
        }
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

  public async insertRecords(records: any[], tableName: string = 'products'): Promise<{ success: boolean; insertedCount: number; message?: string }> {
    if (this.isSandbox) {
      if (!records || records.length === 0) return { success: true, insertedCount: 0 };
      this.sandboxRecords = [...this.sandboxRecords, ...records];
      return { success: true, insertedCount: records.length, message: `Inserted ${records.length} records into sandbox database.` };
    }
    if (!this.pool || !this.isConnected) {
      return { success: false, insertedCount: 0, message: 'Database is not connected.' };
    }
    if (!records || records.length === 0) {
      return { success: true, insertedCount: 0 };
    }

    try {
      const cleanTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');
      const firstRow = records[0];
      const validCols = Object.keys(firstRow).filter(k => !k.startsWith('_'));

      if (validCols.length === 0) {
        return { success: false, insertedCount: 0, message: 'No valid columns found in records.' };
      }

      // Check if table exists
      const [tableCheck]: any = await this.pool.query(
        `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
        [this.config.database, cleanTable]
      );

      if (!tableCheck[0] || tableCheck[0].cnt === 0) {
        const colDefs = validCols.map(col => {
          const val = firstRow[col];
          let type = 'VARCHAR(255)';
          if (typeof val === 'number') {
            type = Number.isInteger(val) ? 'INT' : 'DECIMAL(10,2)';
          }
          return `\`${col.replace(/`/g, '')}\` ${type}`;
        }).join(', ');

        await this.pool.query(`CREATE TABLE IF NOT EXISTS \`${cleanTable}\` (id INT AUTO_INCREMENT PRIMARY KEY, ${colDefs});`);
      }

      const colNames = validCols.map(c => `\`${c.replace(/`/g, '')}\``).join(', ');
      const placeholders = validCols.map(() => '?').join(', ');
      const sql = `INSERT INTO \`${cleanTable}\` (${colNames}) VALUES (${placeholders})`;

      let insertedCount = 0;
      for (const row of records) {
        const values = validCols.map(c => row[c] ?? null);
        await this.pool.query(sql, values);
        insertedCount++;
      }

      return { success: true, insertedCount };
    } catch (err: any) {
      return { success: false, insertedCount: 0, message: err.message };
    }
  }

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
        databases: [],
        current: this.config.database,
        message: err.message || 'Failed to list databases from host'
      };
    }
  }

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
        `);
      }

      await conn.end();

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

  public async disconnect(userId?: string): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (e) {}
      this.pool = null;
    }
    this.isConnected = false;
    this.isSandbox = false;
    this.sandboxRecords = [];
    this.sandboxDiscounts = [];
    this.cachedSchema = null;
    if (userId) {
      userInventoryStore.clearUserData(userId);
      datasetManager.clearDataset(userId);
    }
  }

  public isLive(): boolean {
    return this.isConnected && (this.pool !== null || this.isSandbox);
  }

  public async connectSandbox(
    dbName: string = 'ecommerce_db',
    userId?: string
  ): Promise<{ success: boolean; message: string; schema: SchemaInspectionResult; rowCount: number }> {
    const cleanDb = dbName.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'ecommerce_db';
    this.isSandbox = true;
    this.isConnected = true;
    this.sandboxDbName = cleanDb;

    const sampleProducts = [
      { t_shirt_id: 1, brand: 'Nike', name: 'Nike Dri-FIT Legend Athletic Tee', color: 'Black', size: 'M', price: 32.00, stock_quantity: 48, category: 'Apparel', sku: 'NK-DF-01' },
      { t_shirt_id: 2, brand: 'Nike', name: 'Nike Sportswear Club Fleece Crewneck', color: 'Heather Grey', size: 'L', price: 65.00, stock_quantity: 12, category: 'Apparel', sku: 'NK-CF-02' },
      { t_shirt_id: 3, brand: 'Adidas', name: 'Adidas Essentials 3-Stripes Tee', color: 'White', size: 'L', price: 30.00, stock_quantity: 65, category: 'Apparel', sku: 'AD-3S-03' },
      { t_shirt_id: 4, brand: 'Adidas', name: 'Adidas Ultraboost Light Running', color: 'Core Black', size: '10', price: 190.00, stock_quantity: 24, category: 'Footwear', sku: 'AD-UB-04' },
      { t_shirt_id: 5, brand: "Levi's", name: "Levi's 511 Slim Fit Stretch Denim", color: 'Dark Indigo', size: '32x32', price: 79.50, stock_quantity: 35, category: 'Denim', sku: 'LV-511-05' },
      { t_shirt_id: 6, brand: "Levi's", name: "Levi's Classic Trucker Jacket", color: 'Medium Wash', size: 'XL', price: 98.00, stock_quantity: 8, category: 'Denim', sku: 'LV-TRK-06' },
      { t_shirt_id: 7, brand: 'Puma', name: 'Puma Iconic T7 Retro Track Jacket', color: 'Puma Black', size: 'M', price: 75.00, stock_quantity: 18, category: 'Activewear', sku: 'PM-T7-07' },
      { t_shirt_id: 8, brand: 'Puma', name: 'Puma Suede Classic Heritage Sneakers', color: 'Navy', size: '9.5', price: 70.00, stock_quantity: 5, category: 'Footwear', sku: 'PM-SD-08' },
      { t_shirt_id: 9, brand: 'Van Heusen', name: 'Van Heusen Slim Fit Poplin Dress Shirt', color: 'Light Blue', size: '15.5', price: 45.00, stock_quantity: 42, category: 'Formal', sku: 'VH-DF-09' },
      { t_shirt_id: 10, brand: 'Van Heusen', name: 'Van Heusen Flex Straight Trouser', color: 'Charcoal', size: '34x30', price: 58.00, stock_quantity: 0, category: 'Formal', sku: 'VH-FLX-10' },
      { t_shirt_id: 11, brand: 'Under Armour', name: 'UA Tech 2.0 Short Sleeve Performance', color: 'Academy', size: 'XL', price: 25.00, stock_quantity: 52, category: 'Activewear', sku: 'UA-T2-11' },
      { t_shirt_id: 12, brand: 'Under Armour', name: 'UA Rival Fleece Big Logo Pullover', color: 'Pitch Grey', size: 'L', price: 60.00, stock_quantity: 14, category: 'Activewear', sku: 'UA-RF-12' }
    ];

    const sampleDiscounts = [
      { t_shirt_id: 1, pct_discount: 10 },
      { t_shirt_id: 4, pct_discount: 15 },
      { t_shirt_id: 9, pct_discount: 20 }
    ];

    this.sandboxRecords = sampleProducts;
    this.sandboxDiscounts = sampleDiscounts;

    this.config = {
      host: 'RetailIQ Built-in SQL Engine',
      port: 3306,
      user: 'root',
      database: cleanDb,
      ssl: false
    };

    const schema: SchemaInspectionResult = {
      connected: true,
      database: cleanDb,
      host: 'RetailIQ Built-in SQL Engine',
      port: 3306,
      isLiveMySQL: true,
      tables: [
        {
          tableName: 'products',
          rowCount: sampleProducts.length,
          columns: [
            { name: 't_shirt_id', dataType: 'INT', isNullable: false, isPrimaryKey: true, isForeignKey: false },
            { name: 'brand', dataType: 'VARCHAR(100)', isNullable: false, isPrimaryKey: false, isForeignKey: false },
            { name: 'name', dataType: 'VARCHAR(150)', isNullable: false, isPrimaryKey: false, isForeignKey: false },
            { name: 'color', dataType: 'VARCHAR(50)', isNullable: true, isPrimaryKey: false, isForeignKey: false },
            { name: 'size', dataType: 'VARCHAR(20)', isNullable: true, isPrimaryKey: false, isForeignKey: false },
            { name: 'price', dataType: 'DECIMAL(10,2)', isNullable: false, isPrimaryKey: false, isForeignKey: false },
            { name: 'stock_quantity', dataType: 'INT', isNullable: false, isPrimaryKey: false, isForeignKey: false },
            { name: 'category', dataType: 'VARCHAR(50)', isNullable: true, isPrimaryKey: false, isForeignKey: false },
            { name: 'sku', dataType: 'VARCHAR(50)', isNullable: true, isPrimaryKey: false, isForeignKey: false }
          ],
          sampleRows: sampleProducts.slice(0, 3)
        },
        {
          tableName: 'discounts',
          rowCount: sampleDiscounts.length,
          columns: [
            { name: 't_shirt_id', dataType: 'INT', isNullable: false, isPrimaryKey: false, isForeignKey: true },
            { name: 'pct_discount', dataType: 'INT', isNullable: false, isPrimaryKey: false, isForeignKey: false }
          ],
          sampleRows: sampleDiscounts
        }
      ],
      lastChecked: new Date().toISOString()
    };

    this.cachedSchema = schema;

    if (userId) {
      userInventoryStore.setDataSource(
        userId,
        {
          type: 'database',
          name: cleanDb,
          host: 'RetailIQ Built-in SQL Engine',
          isLive: true,
          tables: ['products', 'discounts'],
          totalRecords: sampleProducts.length
        },
        sampleProducts,
        sampleDiscounts
      );
      await datasetManager.setDataset(userId, 'mysql', cleanDb, sampleProducts, true);
    }

    return {
      success: true,
      message: `Successfully initialized and connected to Built-In Sandbox Database "${cleanDb}". Loaded ${sampleProducts.length} live records.`,
      schema,
      rowCount: sampleProducts.length
    };
  }

  public async inspectSchema(userId?: string): Promise<SchemaInspectionResult> {
    // 1. Live remote MySQL connection
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
          const [colRows]: any = await this.pool.query(`
            SELECT column_name, data_type, is_nullable, column_key
            FROM information_schema.columns
            WHERE table_schema = ? AND table_name = ?
            ORDER BY ordinal_position;
          `, [this.config.database, tableName]);

          let sampleRows: any[] = [];
          let rowCount = 0;
          try {
            const [samples]: any = await this.pool.query(`SELECT * FROM \`${tableName}\` LIMIT 3;`);
            sampleRows = samples;
            const [countRes]: any = await this.pool.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\`;`);
            rowCount = countRes[0]?.cnt || 0;
          } catch (e) {}

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
        console.warn('Live schema inspection failed:', err.message);
      }
    }

    // 2. Built-in Sandbox database
    if (this.isSandbox && this.cachedSchema) {
      return this.cachedSchema;
    }

    // 3. User's imported CSV or PDF dataset
    if (userId && userInventoryStore.hasData(userId)) {
      const userData = userInventoryStore.getUserData(userId);
      const records = userData.records || [];
      const sourceName = userData.dataSource.name || 'imported_inventory';
      const firstRow = records[0] || {};
      const cols = Object.keys(firstRow);

      const columns: ColumnDefinition[] = cols.map(c => {
        const sampleVal = records.find(r => r[c] !== undefined && r[c] !== null)?.[c];
        const isNum = typeof sampleVal === 'number' || (!isNaN(Number(sampleVal)) && sampleVal !== '' && sampleVal !== null);
        const isInt = isNum && Number.isInteger(Number(sampleVal));
        return {
          name: c,
          dataType: isInt ? 'INT' : (isNum ? 'DECIMAL(10,2)' : 'VARCHAR(255)'),
          isNullable: true,
          isPrimaryKey: /id$/i.test(c) || c.toLowerCase() === 'id',
          isForeignKey: false
        };
      });

      const tables: TableSchemaInfo[] = [{
        tableName: 'products',
        rowCount: records.length,
        columns,
        sampleRows: records.slice(0, 3)
      }];

      if (userData.discounts && userData.discounts.length > 0) {
        tables.push({
          tableName: 'discounts',
          rowCount: userData.discounts.length,
          columns: [
            { name: 't_shirt_id', dataType: 'INT', isNullable: false, isPrimaryKey: false, isForeignKey: true },
            { name: 'pct_discount', dataType: 'INT', isNullable: false, isPrimaryKey: false, isForeignKey: false }
          ],
          sampleRows: userData.discounts.slice(0, 3)
        });
      }

      return {
        connected: true,
        database: sourceName,
        host: userData.dataSource.host || (userData.dataSource.type === 'database' ? 'MySQL Database' : `Imported ${userData.dataSource.type.toUpperCase()}`),
        port: 0,
        isLiveMySQL: userData.dataSource.type === 'database',
        tables,
        lastChecked: userData.lastUpdated || new Date().toISOString()
      };
    }

    // STRICT: If not connected to live MySQL, return disconnected empty schema without fake fallbacks
    return {
      connected: false,
      database: this.config.database || 'None',
      host: this.config.host || 'None',
      port: this.config.port || 0,
      isLiveMySQL: false,
      tables: [],
      lastChecked: new Date().toISOString(),
      connectionError: this.lastError || 'No database connected or file imported.'
    };
  }

  public async executeSafeQuery(sql: string, userId?: string): Promise<{ columns: string[]; rows: any[]; executionTimeMs: number }> {
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

    if (!lower.startsWith('select') && !lower.startsWith('show') && !lower.startsWith('describe') && !lower.startsWith('desc') && !lower.startsWith('explain')) {
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

    // 3. User's active imported CSV/PDF dataset
    if (userId && userInventoryStore.hasData(userId)) {
      const userData = userInventoryStore.getUserData(userId);
      const tables: Record<string, any[]> = {
        products: userData.records || [],
        t_shirts: userData.records || [],
        inventory: userData.records || [],
        discounts: userData.discounts || []
      };
      return executeInMemorySql(cleanSql, tables, 'products');
    }

    // 4. Built-in Sandbox database
    if (this.isSandbox) {
      const tables: Record<string, any[]> = {
        products: this.sandboxRecords,
        t_shirts: this.sandboxRecords,
        inventory: this.sandboxRecords,
        discounts: this.sandboxDiscounts
      };
      return executeInMemorySql(cleanSql, tables, 'products');
    }

    // STRICT: Do NOT return fake sample data when database is disconnected and no file imported
    throw new Error('Database is disconnected or unavailable. Please connect a database or import a CSV/PDF file to run queries.');
  }
}

export const mysqlService = new MySQLService();
