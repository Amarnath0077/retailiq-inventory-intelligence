import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { userInventoryStore } from './server/db/userInventoryStore.ts';
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

// Helper to extract isolated tenant ID from authenticated user or request header
function getTenantId(req: express.Request): string {
  return req.user?.id || (req.headers['x-tenant-id'] as string) || 'default';
}

// Authentication Router
app.use('/api/auth', authRouter);

// Application in-memory settings state
let currentSettings = {
  lowStockThreshold: 15,
  queryRoutingMode: 'hybrid' as 'hybrid' | 'gemini_only' | 'pattern_only',
  databaseName: '',
  dbHost: 'localhost:3306',
  pythonBackendUrl: 'http://localhost:8000',
  lastSyncTime: new Date().toISOString()
};

// API: Health & User Data Source Status
app.get('/api/health', optionalAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  const hasData = userInventoryStore.hasData(tenantId);
  const userData = userInventoryStore.getUserData(tenantId);
  const isLive = mysqlService.isLive();
  const dbConfig = mysqlService.getConfig();

  if (!hasData) {
    res.json({
      connected: isLive,
      hasData: false,
      isLiveMySQL: isLive,
      activeSource: isLive ? 'mysql' : 'none',
      importSummary: null,
      database: isLive ? dbConfig.database : 'No data source connected',
      host: isLive ? `${dbConfig.host}:${dbConfig.port}` : 'None',
      tables: isLive ? ['products'] : [],
      totalRecords: 0,
      connectionMode: isLive ? 'live-mysql' : 'none',
      lastChecked: new Date().toISOString(),
      serverTime: new Date().toISOString()
    });
    return;
  }

  const metrics = userInventoryStore.getMetrics(tenantId, currentSettings.lowStockThreshold);

  res.json({
    connected: true,
    hasData: true,
    isLiveMySQL: userData.dataSource.type === 'database' && userData.dataSource.isLive,
    activeSource: userData.dataSource.type,
    importSummary: userData.dataSource.name ? {
      fileName: userData.dataSource.name,
      rowCount: userData.records.length,
      importedAt: userData.dataSource.connectedAt || userData.lastUpdated
    } : null,
    database: userData.dataSource.name || 'Connected Dataset',
    host: userData.dataSource.host || (userData.dataSource.type === 'database' ? 'MySQL Database' : `Imported ${userData.dataSource.type.toUpperCase()}`),
    tables: userData.dataSource.tables || ['products'],
    totalRecords: metrics.totalProducts,
    connectionMode: userData.dataSource.type,
    lastChecked: userData.lastUpdated || new Date().toISOString(),
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
    res.status(500).json({ success: false, databases: [], message: err.message });
  }
});

// API: Create a new database
app.post('/api/database/create', requireAuth, async (req, res) => {
  try {
    const { databaseName, template } = req.body;
    if (!databaseName || typeof databaseName !== 'string') {
      res.status(400).json({ success: false, message: 'Database name is required.' });
      return;
    }

    const tenantId = getTenantId(req);
    const createResult = await mysqlService.createDatabase(databaseName, template);
    if (createResult.success) {
      currentSettings.databaseName = databaseName.trim();
      currentSettings.lastSyncTime = new Date().toISOString();
      // Connect and sync with user's inventory
      await mysqlService.connect({
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '',
        database: databaseName.trim()
      }, tenantId);
    }
    res.json(createResult);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Database creation failed' });
  }
});

// API: Connect to remote MySQL database
app.post('/api/database/connect', requireAuth, async (req, res) => {
  try {
    const { host, port, user, password, database, ssl, createIfNotExists } = req.body;
    if (!host || !user || !database) {
      res.status(400).json({ success: false, message: 'Host, user, and database name are required.' });
      return;
    }

    const tenantId = getTenantId(req);
    const connectResult = await mysqlService.connect({
      host: host.trim(),
      port: port ? parseInt(port, 10) : 3306,
      user: user.trim(),
      password: password || '',
      database: database.trim(),
      ssl: Boolean(ssl),
      createIfNotExists: Boolean(createIfNotExists)
    }, tenantId);

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
    const tenantId = getTenantId(req);
    await mysqlService.disconnect(tenantId);
    currentSettings.databaseName = '';
    res.json({ success: true, message: 'Database disconnected. Inventory data cleared.' });
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

// ==========================================
// CSV & PDF IMPORT WITH PREVIEW & CONFIRM
// ==========================================

// Step 1: Preview file import (validates and returns preview without saving)
app.post('/api/import/preview', requireAuth, async (req, res) => {
  try {
    const { fileType, content, fileName } = req.body;
    if (!fileType || !['csv', 'pdf'].includes(fileType)) {
      res.status(400).json({ valid: false, error: 'Invalid file type. Only "csv" and "pdf" are supported.' });
      return;
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ valid: false, error: 'File content is required.' });
      return;
    }

    const preview = await fileImporterManager.validateAndPreview(
      fileType,
      content,
      fileName || (fileType === 'csv' ? 'data.csv' : 'document.pdf')
    );

    res.json(preview);
  } catch (err: any) {
    res.status(400).json({ valid: false, error: err.message || 'Failed to generate preview' });
  }
});

// Step 2: Confirm file import (persists validated records to user store and optionally connected DB)
app.post('/api/import/confirm', requireAuth, async (req, res) => {
  try {
    const { fileType, fileName, records, saveToDatabase } = req.body;
    const tenantId = getTenantId(req);

    if (!records || !Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, message: 'No valid records provided for confirmation.' });
      return;
    }

    const result = await fileImporterManager.confirmImport(
      tenantId,
      fileType || 'csv',
      fileName || 'imported_inventory',
      records,
      Boolean(saveToDatabase)
    );

    currentSettings.lastSyncTime = new Date().toISOString();

    res.json({
      success: true,
      message: `Successfully imported ${result.summary.rowCount} records into your personal inventory workspace.${result.savedToDatabase ? ' Also persisted to connected database.' : ''}`,
      summary: result.summary,
      savedToDatabase: result.savedToDatabase,
      dbMessage: result.dbMessage
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to confirm import' });
  }
});

// Legacy direct CSV import route (calls preview + confirm automatically)
app.post('/api/import/csv', requireAuth, async (req, res) => {
  try {
    const { csvContent, fileName, samplePreset, saveToDatabase } = req.body;
    const tenantId = getTenantId(req);

    let contentToParse = csvContent;
    let targetFileName = fileName || 'imported_dataset.csv';

    if (samplePreset && fileImporterManager.sampleDatasets[samplePreset as keyof typeof fileImporterManager.sampleDatasets]) {
      contentToParse = fileImporterManager.sampleDatasets[samplePreset as keyof typeof fileImporterManager.sampleDatasets];
      targetFileName = `${samplePreset}_sample.csv`;
    }

    if (!contentToParse || typeof contentToParse !== 'string' || !contentToParse.trim()) {
      res.status(400).json({ success: false, message: 'CSV text content is required.' });
      return;
    }

    const preview = await fileImporterManager.validateAndPreview('csv', contentToParse, targetFileName);
    if (!preview.valid) {
      res.status(400).json({ success: false, message: preview.error || 'Invalid CSV file.' });
      return;
    }

    const result = await fileImporterManager.confirmImport(
      tenantId,
      'csv',
      targetFileName,
      preview.records,
      Boolean(saveToDatabase)
    );

    res.json({
      success: true,
      message: `Successfully imported ${result.summary.rowCount} rows from "${targetFileName}".`,
      summary: result.summary,
      savedToDatabase: result.savedToDatabase
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'CSV Import Error' });
  }
});

// Legacy direct PDF import route (calls preview + confirm automatically)
app.post('/api/import/pdf', requireAuth, async (req, res) => {
  try {
    const { pdfBase64, fileName, saveToDatabase } = req.body;
    const tenantId = getTenantId(req);

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      res.status(400).json({ success: false, message: 'PDF content is required.' });
      return;
    }

    const targetFileName = fileName || 'uploaded_document.pdf';
    const preview = await fileImporterManager.validateAndPreview('pdf', pdfBase64, targetFileName);
    if (!preview.valid) {
      res.status(400).json({ success: false, message: preview.error || 'Could not extract inventory records from PDF.' });
      return;
    }

    const result = await fileImporterManager.confirmImport(
      tenantId,
      'pdf',
      targetFileName,
      preview.records,
      Boolean(saveToDatabase)
    );

    res.json({
      success: true,
      message: `Successfully parsed and extracted ${result.summary.rowCount} inventory rows from PDF "${targetFileName}".`,
      summary: result.summary,
      savedToDatabase: result.savedToDatabase
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'PDF Import Error' });
  }
});

// API: Get active data source status for user
app.get('/api/import/status', requireAuth, (req, res) => {
  const tenantId = getTenantId(req);
  const userData = userInventoryStore.getUserData(tenantId);
  res.json({
    activeSource: userData.dataSource.type,
    summary: userData.dataSource.name ? {
      fileName: userData.dataSource.name,
      rowCount: userData.records.length,
      importedAt: userData.dataSource.connectedAt || userData.lastUpdated
    } : null
  });
});

// API: Reset data source
app.post('/api/import/reset', requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  userInventoryStore.clearUserData(tenantId);
  datasetManager.clearDataset(tenantId);
  res.json({
    success: true,
    message: 'Active inventory data source cleared. Dashboard reset to clean state.'
  });
});

// API: Dynamic Dataset Meta
app.get('/api/dataset/meta', requireAuth, (req, res) => {
  const tenantId = getTenantId(req);
  const hasData = userInventoryStore.hasData(tenantId);

  // STRICT REQUIREMENT: If user has not connected a database or imported data, return empty meta
  if (!hasData) {
    res.json({
      tenantId,
      hasDataSource: false,
      sourceType: 'none',
      sourceName: 'No data source connected',
      totalRecords: 0,
      columns: [],
      dimensions: [],
      hasBrand: false,
      hasProduct: false,
      hasCategory: false,
      hasStore: false,
      hasStock: false,
      hasPrice: false,
      hasSales: false,
      missingFieldsNotes: ['No inventory data available. Connect your database or import a CSV/PDF file to get started.'],
      lastUpdated: '',
      isLive: false
    });
    return;
  }

  const meta = datasetManager.getDatasetMeta(tenantId);
  if (meta) {
    res.json(meta);
  } else {
    // Generate meta on the fly from userInventoryStore records
    const userData = userInventoryStore.getUserData(tenantId);
    datasetManager.setDataset(tenantId, (userData.dataSource.type as any) || 'csv', userData.dataSource.name || 'User Dataset', userData.records, userData.dataSource.isLive || false).then(createdMeta => {
      res.json(createdMeta);
    });
  }
});

// API: Dataset Metrics with Dynamic Filters
app.get('/api/dataset/metrics', requireAuth, (req, res) => {
  const tenantId = getTenantId(req);
  const hasData = userInventoryStore.hasData(tenantId);

  if (!hasData) {
    res.json({
      totalRecords: 0,
      totalStock: 0,
      totalValue: 0,
      averagePrice: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      missingFieldAlerts: ['No inventory data available. Connect your database or import a CSV/PDF file to get started.'],
      brandDistribution: [],
      categoryDistribution: [],
      storeDistribution: [],
      productDistribution: [],
      sizeDistribution: [],
      colorDistribution: [],
      lowStockItems: [],
      activeFiltersApplied: {},
      lastUpdated: ''
    });
    return;
  }

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
  const hasData = userInventoryStore.hasData(tenantId);

  if (!hasData) {
    res.json({
      items: [],
      columns: [],
      total: 0,
      page: 1,
      totalPages: 0,
      limit: 12
    });
    return;
  }

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

// API: Inventory list with filtering, sorting, pagination
app.get('/api/inventory', requireAuth, (req, res) => {
  try {
    const tenantId = getTenantId(req);
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

    const result = userInventoryStore.getFilteredProducts(tenantId, {
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
    const tenantId = getTenantId(req);
    const metrics = userInventoryStore.getMetrics(tenantId, currentSettings.lowStockThreshold);
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error calculating metrics' });
  }
});

// API: Export filtered CSV
app.get('/api/export', requireAuth, (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { search, brand, color, size, stockStatus, sort, sortBy, sortOrder } = req.query;
    const csv = userInventoryStore.getCSVData(tenantId, {
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

// API: AI suggestions (returns empty if user has no data)
app.get('/api/ai/suggestions', requireAuth, (req, res) => {
  const tenantId = getTenantId(req);
  if (!userInventoryStore.hasData(tenantId)) {
    res.json([]);
    return;
  }
  const suggestions = datasetManager.generateSuggestions(tenantId);
  res.json(suggestions);
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

// API: Conversational AI query endpoint
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!userInventoryStore.hasData(tenantId)) {
      res.json({
        answer: 'No inventory data available. Connect your database or import a CSV/PDF file to get started.',
        sqlQuery: '',
        queryType: 'no_data',
        columns: [],
        rows: []
      });
      return;
    }

    const { query, searchGrounding } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'Valid query text is required.' });
      return;
    }

    const response = await queryEngine.processQuery(
      query,
      currentSettings.lowStockThreshold,
      currentSettings.queryRoutingMode,
      Boolean(searchGrounding),
      tenantId
    );

    res.json(response);
  } catch (err: any) {
    console.error('[API Chat Error]:', err?.message);
    res.status(500).json({
      error: err.message || 'Failed to process inventory query',
      queryType: 'error'
    });
  }
});

// API: Dedicated Google Search Grounding with gemini-3.8-flash
app.post('/api/search-grounding', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'Query is required for Google Search Grounding.' });
      return;
    }

    const response = await queryEngine.executeSearchGrounding(
      query,
      undefined,
      currentSettings.lowStockThreshold,
      tenantId
    );

    res.json(response);
  } catch (err: any) {
    console.error('[API Grounding Error]:', err?.message);
    res.status(500).json({
      error: err.message || 'Google Search Grounding failed',
      queryType: 'google_search_grounding'
    });
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

// API: Settings get and update
app.get('/api/settings', requireAuth, (req, res) => {
  res.json(currentSettings);
});

app.post('/api/settings', requireAuth, (req, res) => {
  const { lowStockThreshold, queryRoutingMode, pythonBackendUrl } = req.body;
  const tenantId = getTenantId(req);
  if (typeof lowStockThreshold === 'number' && lowStockThreshold >= 1 && lowStockThreshold <= 100) {
    currentSettings.lowStockThreshold = lowStockThreshold;
    userInventoryStore.setThreshold(tenantId, lowStockThreshold);
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

if (!process.env.VERCEL) {
  startServer();
}

export default app;
