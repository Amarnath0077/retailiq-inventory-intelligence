import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { inventoryStore } from './server/db/inventoryStore.ts';
import { queryEngine } from './server/ai/queryEngine.ts';
import { mysqlService } from './server/db/mysqlClient.ts';
import { fileImporterManager } from './server/utils/fileImporter.ts';
import { datasetManager } from './server/db/datasetManager.ts';
import { authRouter } from './server/auth/authRoutes.ts';
import { requireAuth, optionalAuth } from './server/auth/authMiddleware.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to get tenant ID from authenticated user or fallback
function getTenantId(req: express.Request): string {
  return req.user?.id || (req.headers['x-tenant-id'] as string) || 'default';
}

// Authentication Router
app.use('/api/auth', authRouter);

// Ensure local MySQL / MariaDB service is active on boot
function autoStartMySQLService() {
  exec('mkdir -p /run/mysqld && chown -R mysql:mysql /run/mysqld && (/usr/sbin/mysqld --user=root &)', () => {
    setTimeout(() => {
      mysqlService.connect({
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '',
        database: currentSettings.databaseName || 'atliq_tshirts'
      }).then(res => {
        if (res.success) {
          console.log('[RetailIQ System] Live MariaDB/MySQL service connected on 127.0.0.1:3306.');
        }
      }).catch(err => {
        console.log('[RetailIQ System] MySQL connection status:', err.message);
      });
    }, 1500);
  });
}
autoStartMySQLService();

// Application in-memory settings state
let currentSettings = {
  lowStockThreshold: 15,
  queryRoutingMode: 'hybrid' as 'hybrid' | 'gemini_only' | 'pattern_only',
  databaseName: 'atliq_tshirts',
  dbHost: 'localhost:3306',
  pythonBackendUrl: 'http://localhost:8000',
  lastSyncTime: new Date().toISOString()
};

// API: Health & Database connection status
app.get('/api/health', async (req, res) => {
  const isLive = mysqlService.isLive();
  const dbConfig = mysqlService.getConfig();
  const metrics = inventoryStore.getMetrics(currentSettings.lowStockThreshold);
  const activeSource = fileImporterManager.getActiveSourceType();
  const importSummary = fileImporterManager.getSummary();

  res.json({
    connected: true,
    isLiveMySQL: isLive,
    activeSource,
    importSummary,
    database: activeSource !== 'mysql' && importSummary ? importSummary.fileName : (isLive ? dbConfig.database : currentSettings.databaseName),
    host: activeSource !== 'mysql' ? `Direct ${activeSource.toUpperCase()} File` : (isLive ? `${dbConfig.host}:${dbConfig.port}` : currentSettings.dbHost),
    tables: activeSource !== 'mysql' ? ['products'] : ['t_shirts', 'discounts'],
    totalRecords: metrics.totalProducts,
    connectionMode: activeSource === 'csv' ? 'imported-csv' : activeSource === 'pdf' ? 'imported-pdf' : (isLive ? 'live-remote-mysql' : 'built-in-mysql-engine'),
    lastChecked: new Date().toISOString(),
    serverTime: new Date().toISOString()
  });
});

// API: Database connection configuration
app.get('/api/database/config', requireAuth, (req, res) => {
  res.json({
    ...mysqlService.getConfig(),
    isLive: mysqlService.isLive()
  });
});

// API: List available databases on MySQL server
app.get('/api/database/databases', requireAuth, async (req, res) => {
  try {
    const listResult = await mysqlService.listDatabases();
    res.json(listResult);
  } catch (err: any) {
    res.status(500).json({ success: false, databases: ['ecommerce_db', 'atliq_tshirts'], message: err.message });
  }
});

// API: Create a new database (optionally with ecommerce template)
app.post('/api/database/create', requireAuth, async (req, res) => {
  try {
    const { databaseName, template } = req.body;
    if (!databaseName || typeof databaseName !== 'string') {
      res.status(400).json({ success: false, message: 'Database name is required.' });
      return;
    }

    const createResult = await mysqlService.createDatabase(databaseName, template);
    if (createResult.success) {
      currentSettings.databaseName = databaseName.trim();
      currentSettings.lastSyncTime = new Date().toISOString();
    }
    res.json(createResult);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Database creation failed' });
  }
});

// API: Connect to remote MySQL database (supports any database name like ecommerce_db)
app.post('/api/database/connect', requireAuth, async (req, res) => {
  try {
    const { host, port, user, password, database, ssl, createIfNotExists } = req.body;
    if (!host || !user || !database) {
      res.status(400).json({ success: false, message: 'Host, user, and database name are required.' });
      return;
    }

    const connectResult = await mysqlService.connect({
      host: host.trim(),
      port: port ? parseInt(port, 10) : 3306,
      user: user.trim(),
      password: password || '',
      database: database.trim(),
      ssl: Boolean(ssl),
      createIfNotExists: Boolean(createIfNotExists)
    });

    if (connectResult.success) {
      currentSettings.databaseName = database.trim();
      currentSettings.dbHost = `${host.trim()}:${port || 3306}`;
      currentSettings.lastSyncTime = new Date().toISOString();
    }

    res.json(connectResult);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Connection failed' });
  }
});

// API: Disconnect from remote MySQL
app.post('/api/database/disconnect', requireAuth, async (req, res) => {
  try {
    await mysqlService.disconnect();
    currentSettings.databaseName = 'atliq_tshirts';
    currentSettings.dbHost = 'localhost:3306';
    res.json({ success: true, message: 'Disconnected from remote MySQL. Reverted to built-in relational engine.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Disconnect failed' });
  }
});

// API: Introspect Database Schema
app.get('/api/database/schema', requireAuth, async (req, res) => {
  try {
    const schema = await mysqlService.inspectSchema();
    res.json(schema);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to inspect schema' });
  }
});

// API: Start / Heal local MySQL / MariaDB service
app.post('/api/database/start-service', requireAuth, async (req, res) => {
  exec('/etc/init.d/mariadb start || service mariadb start', async (err, stdout, stderr) => {
    try {
      // Connect to local database after starting
      const connectResult = await mysqlService.connect({
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '',
        database: currentSettings.databaseName || 'atliq_tshirts'
      });

      fileImporterManager.resetToMySQL();

      res.json({
        success: true,
        message: connectResult.success 
          ? `MySQL service started successfully: ${connectResult.message}` 
          : 'MySQL service process started on 127.0.0.1:3306',
        isLiveMySQL: mysqlService.isLive(),
        schema: connectResult.schema
      });
    } catch (connectErr: any) {
      res.json({
        success: true,
        message: 'MySQL server process started. Verify credentials to complete connection.',
        isLiveMySQL: false
      });
    }
  });
});

// API: Direct CSV File Import
app.post('/api/import/csv', requireAuth, async (req, res) => {
  try {
    const { csvContent, fileName, samplePreset } = req.body;
    const tenantId = getTenantId(req);

    let contentToParse = csvContent;
    let targetFileName = fileName || 'imported_dataset.csv';

    if (samplePreset && fileImporterManager.sampleDatasets[samplePreset as keyof typeof fileImporterManager.sampleDatasets]) {
      contentToParse = fileImporterManager.sampleDatasets[samplePreset as keyof typeof fileImporterManager.sampleDatasets];
      targetFileName = `${samplePreset}_sample.csv`;
    }

    if (!contentToParse || typeof contentToParse !== 'string' || !contentToParse.trim()) {
      res.status(400).json({ success: false, message: 'CSV text content or valid sample preset is required.' });
      return;
    }

    const summary = await fileImporterManager.parseAndImportCSV(contentToParse, targetFileName, tenantId);
    currentSettings.databaseName = `${targetFileName} (CSV)`;
    currentSettings.lastSyncTime = new Date().toISOString();

    res.json({
      success: true,
      message: `Successfully imported ${summary.rowCount} rows from "${targetFileName}". RetailIQ metrics and AI assistant are now querying this CSV dataset.`,
      summary
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'CSV Import Error' });
  }
});

// API: Direct PDF Document Import
app.post('/api/import/pdf', requireAuth, async (req, res) => {
  try {
    const { pdfBase64, fileName } = req.body;
    const tenantId = getTenantId(req);

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      res.status(400).json({ success: false, message: 'PDF base64 content is required.' });
      return;
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const targetFileName = fileName || 'uploaded_document.pdf';

    const summary = await fileImporterManager.parseAndImportPDF(cleanBase64, targetFileName, tenantId);
    currentSettings.databaseName = `${targetFileName} (PDF)`;
    currentSettings.lastSyncTime = new Date().toISOString();

    res.json({
      success: true,
      message: `Successfully parsed and extracted ${summary.rowCount} inventory rows from PDF "${targetFileName}".`,
      summary
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'PDF Import Error' });
  }
});

// API: Get active data source status (MySQL, CSV, or PDF)
app.get('/api/import/status', requireAuth, (req, res) => {
  res.json({
    activeSource: fileImporterManager.getActiveSourceType(),
    summary: fileImporterManager.getSummary()
  });
});

// API: Reset data source back to MySQL Database
app.post('/api/import/reset', requireAuth, async (req, res) => {
  fileImporterManager.resetToMySQL();
  currentSettings.databaseName = 'atliq_tshirts';
  
  // Re-sync from MySQL database
  try {
    const connResult = await mysqlService.connect({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'atliq_tshirts'
    });
    res.json({
      success: true,
      message: 'Active data source reverted to MySQL Database engine.',
      schema: connResult.schema
    });
  } catch (err: any) {
    res.json({
      success: true,
      message: 'Active data source reverted to MySQL Database engine.'
    });
  }
});

// API: Dynamic Dataset Meta (Dynamic Scope Dimensions, detected roles, missing fields)
app.get('/api/dataset/meta', requireAuth, (req, res) => {
  const tenantId = getTenantId(req);
  let meta = datasetManager.getDatasetMeta(tenantId);
  if (!meta) {
    const isLive = mysqlService.isLive();
    const dbConfig = mysqlService.getConfig();
    const activeDb = isLive ? dbConfig.database : (currentSettings.databaseName || 'atliq_tshirts');
    meta = {
      tenantId,
      sourceType: 'mysql',
      sourceName: activeDb,
      totalRecords: 67,
      columns: ['t_shirt_id', 'brand', 'color', 'size', 'price', 'stock_quantity'],
      columnRoles: {
        t_shirt_id: 'sku',
        brand: 'brand',
        color: 'color',
        size: 'size',
        price: 'price',
        stock_quantity: 'stock'
      },
      dimensions: [
        { key: 'brand', label: 'Brand', columnName: 'brand', uniqueValues: ['Adidas', 'Levi', 'Nike', 'Van Heusen'], count: 4 },
        { key: 'size', label: 'Size', columnName: 'size', uniqueValues: ['L', 'M', 'S', 'XL', 'XS'], count: 5 },
        { key: 'color', label: 'Color', columnName: 'color', uniqueValues: ['Black', 'Blue', 'Red', 'White'], count: 4 }
      ],
      hasBrand: true,
      hasProduct: true,
      hasCategory: false,
      hasStore: false,
      hasStock: true,
      hasPrice: true,
      hasSales: false,
      missingFieldsNotes: ['No store or category columns detected in atliq_tshirts.'],
      lastUpdated: new Date().toISOString(),
      isLive
    };
  }
  res.json(meta);
});

// API: Dataset Metrics with Dynamic Filters
app.get('/api/dataset/metrics', requireAuth, (req, res) => {
  const tenantId = getTenantId(req);
  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === 'string') {
      filters[k] = v;
    }
  }
  const metrics = datasetManager.calculateMetrics(tenantId, filters, currentSettings.lowStockThreshold);
  res.json(metrics);
});

// API: Dataset Items (Filtered & Paginated)
app.get('/api/dataset/items', requireAuth, (req, res) => {
  const tenantId = getTenantId(req);
  const rawRecords = datasetManager.getRawRecords(tenantId);
  const meta = datasetManager.getDatasetMeta(tenantId);
  
  let filtered = [...rawRecords];
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== 'page' && k !== 'limit' && k !== 'search' && typeof v === 'string' && v && v !== 'all') {
      const dim = meta?.dimensions.find(d => d.key === k);
      const col = dim ? dim.columnName : k;
      filtered = filtered.filter(row => String(row[col] ?? '').toLowerCase().trim() === v.toLowerCase().trim());
    }
  }
  if (req.query.search && typeof req.query.search === 'string') {
    const q = req.query.search.toLowerCase().trim();
    filtered = filtered.filter(row => Object.values(row).some(val => String(val ?? '').toLowerCase().includes(q)));
  }

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 12);
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  res.json({
    items: paginated,
    columns: meta?.columns || (paginated.length > 0 ? Object.keys(paginated[0]) : []),
    total,
    page,
    totalPages,
    limit
  });
});

// API: Dataset Refresh
app.post('/api/dataset/refresh', requireAuth, async (req, res) => {
  try {
    const isLive = mysqlService.isLive();
    if (isLive) {
      const schema = await mysqlService.inspectSchema();
      currentSettings.lastSyncTime = new Date().toISOString();
      res.json({ success: true, message: 'Refreshed live MySQL database records.', schema, lastSyncTime: currentSettings.lastSyncTime });
    } else {
      currentSettings.lastSyncTime = new Date().toISOString();
      res.json({ success: true, message: 'Snapshot re-evaluated.', lastSyncTime: currentSettings.lastSyncTime });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Refresh failed' });
  }
});

// API: AI Configuration Status
app.get('/api/ai/status', (req, res) => {
  res.json({
    configured: datasetManager.isAIConfigured(),
    model: 'gemini-3.8-flash',
    provider: '@google/genai'
  });
});

// API: Dataset-aware Contextual Suggestions
app.get('/api/ai/suggestions', (req, res) => {
  const tenantId = (req.headers['x-tenant-id'] as string) || 'default';
  const suggestions = datasetManager.generateSuggestions(tenantId);
  res.json(suggestions);
});

// API: Get available sample CSV datasets
app.get('/api/import/samples', (req, res) => {
  res.json(fileImporterManager.sampleDatasets);
});

// API: Safe read-only SQL Execution Sandbox
app.post('/api/database/execute-sql', requireAuth, async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string' || !sql.trim()) {
      res.status(400).json({ error: 'SQL query string is required' });
      return;
    }

    const result = await mysqlService.executeSafeQuery(sql);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Query execution error' });
  }
});

// API: Inventory list with filtering, sorting, pagination
app.get('/api/inventory', requireAuth, (req, res) => {
  try {
    const {
      search,
      brand,
      color,
      size,
      stockStatus,
      sort,
      sortBy,
      sortOrder,
      page,
      limit
    } = req.query;

    const result = inventoryStore.getFilteredProducts({
      search: search as string | undefined,
      brand: brand as string | undefined,
      color: color as string | undefined,
      size: size as string | undefined,
      stockStatus: stockStatus as any,
      sort: sort as string | undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 12
    }, currentSettings.lowStockThreshold);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching inventory' });
  }
});

// API: Metrics for Dashboard and Analytics
app.get('/api/metrics', requireAuth, (req, res) => {
  try {
    const metrics = inventoryStore.getMetrics(currentSettings.lowStockThreshold);
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error calculating metrics' });
  }
});

// API: Export filtered CSV
app.get('/api/export', requireAuth, (req, res) => {
  try {
    const { search, brand, color, size, stockStatus, sort, sortBy, sortOrder } = req.query;
    const csv = inventoryStore.getCSVData({
      search: search as string | undefined,
      brand: brand as string | undefined,
      color: color as string | undefined,
      size: size as string | undefined,
      stockStatus: stockStatus as any,
      sort: sort as string | undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any
    }, currentSettings.lowStockThreshold);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="retaliq_inventory.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(500).send('Error generating export');
  }
});

// API: Conversational AI query endpoint (supports NL-to-SQL and Google Search Grounding)
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { query, searchGrounding } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'Valid query text is required.' });
      return;
    }

    const response = await queryEngine.processQuery(
      query,
      currentSettings.lowStockThreshold,
      currentSettings.queryRoutingMode,
      Boolean(searchGrounding)
    );

    res.json(response);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Failed to process inventory query',
      queryType: 'exact_pattern'
    });
  }
});

// API: Dedicated Google Search Grounding with gemini-3.8-flash
app.post('/api/search-grounding', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'Query is required for Google Search Grounding.' });
      return;
    }

    const response = await queryEngine.executeSearchGrounding(
      query,
      await mysqlService.inspectSchema(),
      currentSettings.lowStockThreshold
    );

    res.json(response);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Google Search Grounding failed',
      queryType: 'google_search_grounding'
    });
  }
});

// API: Suggested benchmark questions
app.get('/api/suggested-queries', (req, res) => {
  res.json([
    {
      title: "Specific SKU Availability",
      query: "How many Nike XS white T-shirts are available?",
      category: "Stock Lookup"
    },
    {
      title: "Color & Brand Aggregation",
      query: "How many white Levi's T-shirts do we have?",
      category: "Aggregation"
    },
    {
      title: "Gross Inventory Valuation",
      query: "What is the total inventory value?",
      category: "Financials"
    },
    {
      title: "Discounted Net Revenue",
      query: "What is the revenue from selling Levi's T-shirts?",
      category: "Financials"
    },
    {
      title: "Brand Distribution",
      query: "Show stock quantities by brand.",
      category: "Analytics"
    },
    {
      title: "Low Stock Alert",
      query: "Which products have low stock?",
      category: "Inventory Health"
    }
  ]);
});

// API: Settings get and update
app.get('/api/settings', requireAuth, (req, res) => {
  res.json(currentSettings);
});

app.post('/api/settings', requireAuth, (req, res) => {
  const { lowStockThreshold, queryRoutingMode, pythonBackendUrl } = req.body;
  if (typeof lowStockThreshold === 'number' && lowStockThreshold >= 1 && lowStockThreshold <= 100) {
    currentSettings.lowStockThreshold = lowStockThreshold;
    inventoryStore.setThreshold(lowStockThreshold);
  }
  if (queryRoutingMode && ['hybrid', 'gemini_only', 'pattern_only'].includes(queryRoutingMode)) {
    currentSettings.queryRoutingMode = queryRoutingMode;
  }
  if (typeof pythonBackendUrl === 'string') {
    currentSettings.pythonBackendUrl = pythonBackendUrl;
  }
  currentSettings.lastSyncTime = new Date().toISOString();
  res.json({ success: true, settings: currentSettings });
});

// API: Python bridge contract and setup code for user's existing Python/MySQL project
app.get('/api/python-bridge/template', (req, res) => {
  res.json({
    fastApiCode: `"""
RetailIQ Python FastAPI Bridge for atliq_tshirts MySQL Database.
Connects existing database/inventory_queries.py and database/inventory.py to RetailIQ.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymysql
import os

app = FastAPI(title="RetailIQ Python Bridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connects to your existing MySQL database
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "root"),
    "database": "atliq_tshirts",
    "port": 3306,
    "cursorclass": pymysql.cursors.DictCursor
}

class QueryRequest(BaseModel):
    query: str
    threshold: int = 15

@app.get("/api/health")
def health():
    return {"status": "connected", "database": "atliq_tshirts"}

@app.post("/api/query")
def execute_query(req: QueryRequest):
    # Call your existing inventory_queries module or predefined SQL executor
    return {
        "answer": f"Processed query for: {req.query}",
        "queryType": "python_backend"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`
  });
});

// Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RetailIQ Server] Ready on http://0.0.0.0:${PORT}`);
  });
}

startServer();
