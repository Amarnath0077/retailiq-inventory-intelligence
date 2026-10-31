import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Code2, 
  CheckCircle2, 
  Copy, 
  Check, 
  RefreshCw, 
  Server, 
  Save, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Play, 
  Table as TableIcon, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  FileSpreadsheet, 
  FileText, 
  UploadCloud, 
  Zap, 
  FileCheck
} from 'lucide-react';
import { AppSettings, DatabaseStatus, TableSchemaInfo, ImportedDatasetSummary } from '../../types/inventory.ts';
import { apiFetch } from '../../utils/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { saveUserDataset, clearUserDataset } from '../../utils/persistentStorage.ts';

interface SettingsViewProps {
  currentSettings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  databaseStatus: DatabaseStatus | null;
  onRefreshDatabase: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentSettings,
  onUpdateSettings,
  onRefreshDatabase
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'database' | 'csv_import' | 'pdf_import' | 'general' | 'python_bridge'>('database');
  const [thresholdInput, setThresholdInput] = useState<number>(currentSettings.lowStockThreshold);
  const [routingMode, setRoutingMode] = useState<string>(currentSettings.queryRoutingMode);
  const [pythonUrl, setPythonUrl] = useState<string>(currentSettings.pythonBackendUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Database Connection State
  const [dbHost, setDbHost] = useState('127.0.0.1');
  const [dbPort, setDbPort] = useState(3306);
  const [dbUser, setDbUser] = useState('root');
  const [dbPassword, setDbPassword] = useState('');
  const [dbName, setDbName] = useState('atliq_tshirts');
  const [dbSsl, setDbSsl] = useState(false);
  const [createIfNotExists, setCreateIfNotExists] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStartingService, setIsStartingService] = useState(false);
  const [connectNotice, setConnectNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Database Discovery & Creation State
  const [discoveredDbs, setDiscoveredDbs] = useState<string[]>(['ecommerce_db', 'atliq_tshirts']);
  const [showCreateDbModal, setShowCreateDbModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newDbTemplate, setNewDbTemplate] = useState<'ecommerce' | 'retail' | 'none'>('ecommerce');
  const [isCreatingDb, setIsCreatingDb] = useState(false);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvImportNotice, setCsvImportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [csvSummary, setCsvSummary] = useState<ImportedDatasetSummary | null>(null);
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [showCsvPaste, setShowCsvPaste] = useState(false);

  // PDF Import State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [pdfImportNotice, setPdfImportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pdfSummary, setPdfSummary] = useState<ImportedDatasetSummary | null>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);

  // Schema state
  const [tablesSchema, setTablesSchema] = useState<TableSchemaInfo[]>([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [isLiveMySQL, setIsLiveMySQL] = useState<boolean>(false);

  // SQL Sandbox State
  const [sandboxSql, setSandboxSql] = useState<string>('SELECT * FROM products LIMIT 5;');
  const [sandboxResult, setSandboxResult] = useState<{ columns: string[]; rows: any[]; executionTimeMs: number } | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  useEffect(() => {
    setThresholdInput(currentSettings.lowStockThreshold);
    setRoutingMode(currentSettings.queryRoutingMode);
    setPythonUrl(currentSettings.pythonBackendUrl);
  }, [currentSettings]);

  // Load active DB config, discovered databases & schema
  const fetchDbInfo = async () => {
    setIsLoadingSchema(true);
    try {
      const [configRes, schemaRes, dbsRes] = await Promise.all([
        apiFetch('/api/database/config'),
        apiFetch('/api/database/schema'),
        apiFetch('/api/database/databases')
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setDbHost(configData.host || '127.0.0.1');
        setDbPort(configData.port || 3306);
        setDbUser(configData.user || 'root');
        setDbName(configData.database || 'atliq_tshirts');
        setDbSsl(Boolean(configData.ssl));
        setIsLiveMySQL(Boolean(configData.isLive));
      }

      if (schemaRes.ok) {
        const schemaData = await schemaRes.json();
        if (schemaData.tables && Array.isArray(schemaData.tables)) {
          setTablesSchema(schemaData.tables);
          if (schemaData.tables.length > 0) {
            setExpandedTable(schemaData.tables[0].tableName);
            const hasProducts = schemaData.tables.some((t: any) => t.tableName === 'products');
            const hasTShirts = schemaData.tables.some((t: any) => t.tableName === 't_shirts');
            if (hasProducts) {
              setSandboxSql('SELECT product_id, name, brand, category, price, stock_quantity FROM products ORDER BY price ASC LIMIT 5;');
            } else if (hasTShirts) {
              setSandboxSql('SELECT t_shirt_id, brand, color, size, price, stock_quantity FROM t_shirts ORDER BY price ASC LIMIT 5;');
            } else {
              setSandboxSql(`SELECT * FROM \`${schemaData.tables[0].tableName}\` LIMIT 5;`);
            }
          }
        }
      }

      if (dbsRes.ok) {
        const dbsData = await dbsRes.json();
        if (dbsData.databases && Array.isArray(dbsData.databases)) {
          setDiscoveredDbs(dbsData.databases);
        }
      }
    } catch (err) {
      console.warn('Failed to load database info:', err);
    } finally {
      setIsLoadingSchema(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'database') {
      fetchDbInfo();
    }
  }, [activeTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateSettings({
        lowStockThreshold: Number(thresholdInput),
        queryRoutingMode: routingMode as any,
        pythonBackendUrl: pythonUrl
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectDatabase = async (e?: React.FormEvent, targetDbName?: string) => {
    if (e) e.preventDefault();
    setIsConnecting(true);
    setConnectNotice(null);

    const activeDb = targetDbName || dbName;

    try {
      const res = await apiFetch('/api/database/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: dbHost,
          port: Number(dbPort),
          user: dbUser,
          password: dbPassword,
          database: activeDb,
          ssl: dbSsl,
          createIfNotExists
        })
      });

      const data = await res.json();
      if (data.success) {
        setDbName(activeDb);
        setConnectNotice({ type: 'success', message: data.message });
        setIsLiveMySQL(true);
        if (data.schema && data.schema.tables) {
          setTablesSchema(data.schema.tables);
          if (data.schema.tables.length > 0) {
            setExpandedTable(data.schema.tables[0].tableName);
          }
        }
        onRefreshDatabase();
      } else {
        setConnectNotice({ type: 'error', message: data.message || 'Connection failed' });
        setIsLiveMySQL(false);
      }
    } catch (err: any) {
      setConnectNotice({ type: 'error', message: err.message || 'Network error connecting to database' });
      setIsLiveMySQL(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbName.trim()) return;

    setIsCreatingDb(true);
    setConnectNotice(null);

    try {
      const res = await apiFetch('/api/database/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseName: newDbName.trim(),
          template: newDbTemplate
        })
      });

      const data = await res.json();
      if (data.success) {
        setDbName(newDbName.trim());
        setConnectNotice({ type: 'success', message: data.message });
        setShowCreateDbModal(false);
        setNewDbName('');
        setIsLiveMySQL(true);
        fetchDbInfo();
        onRefreshDatabase();
      } else {
        setConnectNotice({ type: 'error', message: data.message || 'Database creation failed' });
      }
    } catch (err: any) {
      setConnectNotice({ type: 'error', message: err.message || 'Error creating database' });
    } finally {
      setIsCreatingDb(false);
    }
  };

  const handleDisconnectDatabase = async () => {
    setIsConnecting(true);
    setConnectNotice(null);
    try {
      if (user?.id) {
        await clearUserDataset(user.id);
      }
      const res = await apiFetch('/api/database/disconnect', { method: 'POST' });
      const data = await res.json();
      setConnectNotice({ type: 'success', message: data.message });
      setIsLiveMySQL(false);
      fetchDbInfo();
      onRefreshDatabase();
    } catch (err: any) {
      setConnectNotice({ type: 'error', message: err.message || 'Disconnect failed' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStartMySQLService = async () => {
    setIsStartingService(true);
    setConnectNotice(null);
    try {
      const res = await apiFetch('/api/database/start-service', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setConnectNotice({ type: 'success', message: data.message });
        setIsLiveMySQL(Boolean(data.isLiveMySQL));
        fetchDbInfo();
        onRefreshDatabase();
      } else {
        setConnectNotice({ type: 'error', message: data.message || 'Failed to start service' });
      }
    } catch (err: any) {
      setConnectNotice({ type: 'error', message: err.message || 'Error communicating with server' });
    } finally {
      setIsStartingService(false);
    }
  };

  // CSV Import Handlers
  const handleUploadCsv = (file: File) => {
    setCsvFile(file);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async (contentOverride?: string, nameOverride?: string) => {
    const content = contentOverride || csvText;
    const name = nameOverride || csvFileName || 'imported_dataset.csv';
    if (!content.trim()) return;

    setIsImportingCsv(true);
    setCsvImportNotice(null);
    try {
      const res = await apiFetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: content, fileName: name })
      });
      const data = await res.json();
      if (data.success) {
        if (user?.id && data.records) {
          await saveUserDataset({
            userId: user.id,
            fileType: 'csv',
            fileName: name,
            records: data.records,
            importedAt: new Date().toISOString()
          });
        }
        setCsvImportNotice({ type: 'success', message: data.message });
        setCsvSummary(data.summary);
        fetchDbInfo();
        onRefreshDatabase();
      } else {
        setCsvImportNotice({ type: 'error', message: data.message });
      }
    } catch (err: any) {
      setCsvImportNotice({ type: 'error', message: err.message || 'CSV Import failed' });
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleLoadSampleCsv = async (preset: 'ecommerce' | 'retail_apparel' | 'supplier_invoice') => {
    setIsImportingCsv(true);
    setCsvImportNotice(null);
    try {
      const res = await apiFetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samplePreset: preset })
      });
      const data = await res.json();
      if (data.success) {
        if (user?.id && data.records) {
          await saveUserDataset({
            userId: user.id,
            fileType: 'csv',
            fileName: `${preset}_sample.csv`,
            records: data.records,
            importedAt: new Date().toISOString()
          });
        }
        setCsvImportNotice({ type: 'success', message: data.message });
        setCsvSummary(data.summary);
        fetchDbInfo();
        onRefreshDatabase();
      } else {
        setCsvImportNotice({ type: 'error', message: data.message });
      }
    } catch (err: any) {
      setCsvImportNotice({ type: 'error', message: err.message || 'Failed to load sample CSV' });
    } finally {
      setIsImportingCsv(false);
    }
  };

  // PDF Import Handlers
  const handleUploadPdf = (file: File) => {
    setPdfFile(file);
    setPdfFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string) || '';
      setPdfBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleImportPdf = async () => {
    if (!pdfBase64) return;
    setIsImportingPdf(true);
    setPdfImportNotice(null);
    try {
      const res = await apiFetch('/api/import/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, fileName: pdfFileName || 'document.pdf' })
      });
      const data = await res.json();
      if (data.success) {
        if (user?.id && data.records) {
          await saveUserDataset({
            userId: user.id,
            fileType: 'pdf',
            fileName: pdfFileName || 'document.pdf',
            records: data.records,
            importedAt: new Date().toISOString()
          });
        }
        setPdfImportNotice({ type: 'success', message: data.message });
        setPdfSummary(data.summary);
        fetchDbInfo();
        onRefreshDatabase();
      } else {
        setPdfImportNotice({ type: 'error', message: data.message });
      }
    } catch (err: any) {
      setPdfImportNotice({ type: 'error', message: err.message || 'PDF extraction failed' });
    } finally {
      setIsImportingPdf(false);
    }
  };

  const handleResetToMySQL = async () => {
    try {
      if (user?.id) {
        await clearUserDataset(user.id);
      }
      const res = await apiFetch('/api/import/reset', { method: 'POST' });
      const data = await res.json();
      setConnectNotice({ type: 'success', message: data.message });
      setCsvSummary(null);
      setPdfSummary(null);
      setActiveTab('database');
      fetchDbInfo();
      onRefreshDatabase();
    } catch (err: any) {
      console.error('Failed to reset to MySQL:', err);
    }
  };

  const handleExecuteSandboxSql = async () => {
    if (!sandboxSql.trim()) return;
    setIsExecutingSql(true);
    setSandboxError(null);
    setSandboxResult(null);

    try {
      const res = await apiFetch('/api/database/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sandboxSql })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Query failed to execute');
      }

      setSandboxResult(data);
    } catch (err: any) {
      setSandboxError(err.message || 'Query execution error');
    } finally {
      setIsExecutingSql(false);
    }
  };

  const pythonBridgeCode = `# =====================================================================
# RetailIQ Python FastAPI Bridge for MySQL Store
# Save as: bridge_api.py in your project root
# Run with: uvicorn bridge_api:app --reload --port 8000
# =====================================================================

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

class QueryPayload(BaseModel):
    query: str
    threshold: int = 15

@app.get("/api/health")
def health_check():
    """Returns database connection status."""
    return {
        "connected": True,
        "database": "ecommerce_db",
        "tables": ["products", "orders", "discounts"],
        "status": "active"
    }

@app.post("/api/query")
def run_query(payload: QueryPayload):
    """
    Executes natural language or structured query safely.
    """
    query_text = payload.query.strip()
    return {
        "answer": f"Processed query: {query_text}",
        "queryType": "python_backend",
        "sqlQuery": "SELECT SUM(stock_quantity) FROM products;"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("bridge_api:app", host="0.0.0.0", port=8000, reload=True)
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pythonBridgeCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto text-slate-800">
      {/* Header with Active Data Source Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Data Sources & Configuration
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Connect relational MySQL stores, import CSV merchandise catalogs, parse PDF supplier documents, or configure stock thresholds.
          </p>
        </div>

        {/* Active Source Status Badge */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-1">
            Active Store:
          </span>
          {csvSummary ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>CSV: {csvSummary.fileName} ({csvSummary.rowCount} items)</span>
              </span>
              <button
                type="button"
                onClick={handleResetToMySQL}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer"
              >
                Reset to MySQL
              </button>
            </div>
          ) : pdfSummary ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                <span>PDF: {pdfSummary.fileName} ({pdfSummary.rowCount} items)</span>
              </span>
              <button
                type="button"
                onClick={handleResetToMySQL}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer"
              >
                Reset to MySQL
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>MySQL: {dbName} {isLiveMySQL ? '(Live)' : '(Relational Engine)'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 md:gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('database')}
          className={`pb-3 px-3 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'database'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Remote MySQL & Schema Explorer</span>
          {isLiveMySQL && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('csv_import')}
          className={`pb-3 px-3 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'csv_import'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Direct CSV Import</span>
          {csvSummary && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block ml-1" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('pdf_import')}
          className={`pb-3 px-3 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'pdf_import'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-purple-600" />
          <span>Direct PDF Import</span>
          {pdfSummary && (
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block ml-1" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('general')}
          className={`pb-3 px-3 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'general'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          General Configuration
        </button>

        <button
          onClick={() => setActiveTab('python_bridge')}
          className={`pb-3 px-3 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'python_bridge'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>Python Bridge API</span>
        </button>
      </div>

      {/* Tab 1: General Configuration */}
      {activeTab === 'general' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
            <h2 className="text-sm font-bold text-slate-900">Inventory Business Rules</h2>

            {/* Low-Stock Threshold Rule */}
            <div className="space-y-2">
              <label htmlFor="lowStockThreshold" className="block text-xs font-semibold text-slate-800">
                Low-Stock Threshold (Units)
              </label>
              <div className="flex items-center gap-3 max-w-sm">
                <input
                  id="lowStockThreshold"
                  type="number"
                  min={1}
                  max={100}
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(parseInt(e.target.value, 10) || 1)}
                  className="w-24 px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-500">
                  Products with ≤ {thresholdInput} units trigger alert status.
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Recalculates dashboard alerts, inventory table filters, and assistant low-stock risk queries.
              </p>
            </div>

            <div className="h-px bg-slate-200" />

            {/* Query Routing Mode */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-800">
                Assistant Query Routing Strategy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  routingMode === 'hybrid'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="routingMode"
                    value="hybrid"
                    checked={routingMode === 'hybrid'}
                    onChange={() => setRoutingMode('hybrid')}
                    className="sr-only"
                  />
                  <div className="text-xs font-bold text-slate-900 mb-1">Hybrid Auto-Detect (Recommended)</div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    Grounds queries in introspected schema and generates real-time read-only SQL via Gemini 3.8 Flash; falls back to deterministic router.
                  </div>
                </label>

                <label className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  routingMode === 'pattern_only'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="routingMode"
                    value="pattern_only"
                    checked={routingMode === 'pattern_only'}
                    onChange={() => setRoutingMode('pattern_only')}
                    className="sr-only"
                  />
                  <div className="text-xs font-bold text-slate-900 mb-1">Deterministic Patterns Only</div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    Strict adherence to deterministic schema pattern queries with zero external API dependency.
                  </div>
                </label>

                <label className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  routingMode === 'gemini_only'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="routingMode"
                    value="gemini_only"
                    checked={routingMode === 'gemini_only'}
                    onChange={() => setRoutingMode('gemini_only')}
                    className="sr-only"
                  />
                  <div className="text-xs font-bold text-slate-900 mb-1">Gemini Direct NL-to-SQL</div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    Translates natural language questions directly into read-only SQL queries via Google GenAI on the server.
                  </div>
                </label>
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            {/* Python Backend Target URL */}
            <div className="space-y-2">
              <label htmlFor="pythonUrl" className="block text-xs font-semibold text-slate-800">
                Local Python Backend Bridge Endpoint
              </label>
              <input
                id="pythonUrl"
                type="text"
                value={pythonUrl}
                onChange={(e) => setPythonUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full max-w-md px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                When running your Python FastAPI bridge locally, RetailIQ routes queries to this endpoint.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
            </button>
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Settings persisted successfully!</span>
              </span>
            )}
          </div>
        </form>
      )}

      {/* Tab 2: Remote MySQL Database & Schema Explorer */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Connection Status Banner */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {isLiveMySQL ? 'Connected to Remote MySQL Store' : 'Active Relational Store'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium ${
                    isLiveMySQL ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {isLiveMySQL ? 'LIVE SYNC' : 'STANDALONE'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Database: <span className="font-semibold text-slate-800">{dbName}</span> · Host: <span className="font-semibold text-slate-800">{dbHost}:{dbPort}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isLiveMySQL && (
                <button
                  type="button"
                  onClick={handleDisconnectDatabase}
                  disabled={isConnecting}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                >
                  Disconnect Store
                </button>
              )}
              <button
                type="button"
                onClick={fetchDbInfo}
                disabled={isLoadingSchema}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoadingSchema ? 'animate-spin' : ''}`} />
                <span>Refresh Schema</span>
              </button>
            </div>
          </div>

          {/* Connect Notice Message */}
          {connectNotice && (
            <div className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              connectNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-2.5">
                {connectNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium leading-relaxed">{connectNotice.message}</span>
              </div>

              {connectNotice.type === 'error' && (
                <button
                  type="button"
                  disabled={isStartingService}
                  onClick={handleStartMySQLService}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <Zap className={`w-3.5 h-3.5 ${isStartingService ? 'animate-spin' : ''}`} />
                  <span>{isStartingService ? 'Starting MySQL...' : 'Start Local MySQL Server'}</span>
                </button>
              )}
            </div>
          )}

          {/* Remote MySQL Credentials & Database Selector Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span>Connect to MySQL Database</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connect to <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono border border-slate-200">ecommerce_db</code>, <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono border border-slate-200">atliq_tshirts</code>, or any custom store.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateDbModal(!showCreateDbModal)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{showCreateDbModal ? 'Hide Creator' : '+ Seed Database'}</span>
                </button>
              </div>
            </div>

            {/* Quick-Switch Database Pills */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  <span>Discovered Stores on Server</span>
                </span>
                <span className="text-[11px] text-slate-400">Click to switch store</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {discoveredDbs.map((db) => {
                  const isActive = db === dbName && isLiveMySQL;
                  return (
                    <button
                      key={db}
                      type="button"
                      disabled={isConnecting}
                      onClick={() => {
                        setDbName(db);
                        handleConnectDatabase(undefined, db);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-700 font-semibold shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <Database className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-indigo-600'}`} />
                      <span className="font-mono">{db}</span>
                      {isActive && (
                        <span className="px-1.5 py-0.2 bg-white/20 rounded text-[9px] uppercase font-bold tracking-wider">
                          Active
                        </span>
                      )}
                      {db === 'ecommerce_db' && !isActive && (
                        <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-medium">
                          E-Commerce
                        </span>
                      )}
                      {db === 'atliq_tshirts' && !isActive && (
                        <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium">
                          Apparel
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inline Database Creator Card */}
            {showCreateDbModal && (
              <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">Create New Database & Initialize Tables</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateDbModal(false)}
                    className="text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <form onSubmit={handleCreateDatabase} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">Database Name</label>
                      <input
                        type="text"
                        required
                        value={newDbName}
                        onChange={(e) => setNewDbName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="e.g. ecommerce_db, analytics_db"
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">Schema Template</label>
                      <select
                        value={newDbTemplate}
                        onChange={(e) => setNewDbTemplate(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="ecommerce">E-Commerce (Products, Orders, Customers, Categories, Discounts)</option>
                        <option value="retail">Retail Apparel (T-Shirts, Discounts)</option>
                        <option value="none">Empty Database (Create schema from scratch)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isCreatingDb || !newDbName.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>{isCreatingDb ? 'Creating Database...' : 'Create & Connect to Store'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            <form onSubmit={handleConnectDatabase} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Host / Endpoint</label>
                  <input
                    type="text"
                    required
                    value={dbHost}
                    onChange={(e) => setDbHost(e.target.value)}
                    placeholder="127.0.0.1 or mysql.example.com"
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Port</label>
                  <input
                    type="number"
                    required
                    value={dbPort}
                    onChange={(e) => setDbPort(parseInt(e.target.value, 10) || 3306)}
                    placeholder="3306"
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Database User</label>
                  <input
                    type="text"
                    required
                    value={dbUser}
                    onChange={(e) => setDbUser(e.target.value)}
                    placeholder="root"
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Database Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={dbPassword}
                      onChange={(e) => setDbPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3 pr-8 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">Database Name</label>
                    <span className="text-[10px] text-slate-400">e.g. ecommerce_db</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={dbName}
                    onChange={(e) => setDbName(e.target.value)}
                    placeholder="ecommerce_db or atliq_tshirts"
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium select-none">
                    <input
                      type="checkbox"
                      checked={dbSsl}
                      onChange={(e) => setDbSsl(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Enable SSL / TLS Encryption</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium select-none">
                    <input
                      type="checkbox"
                      checked={createIfNotExists}
                      onChange={(e) => setCreateIfNotExists(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Automatically create database if it doesn't exist on server</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isConnecting}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shrink-0 shadow-xs"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{isConnecting ? 'Connecting...' : `Connect to "${dbName}"`}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Live Introspected Schema Inspector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-indigo-600" />
                  <span>Introspected Database Schema</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tables, column data types, constraints, and sample records discovered from the connected database.
                </p>
              </div>
              <span className="text-xs font-mono font-medium px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                {tablesSchema.length} Tables Discovered
              </span>
            </div>

            {isLoadingSchema ? (
              <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                <span>Introspecting tables from database schema...</span>
              </div>
            ) : tablesSchema.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl text-xs text-slate-500 text-center border border-slate-200">
                No tables found in this database. Connect a store database with retail tables to inspect schema.
              </div>
            ) : (
              <div className="space-y-3">
                {tablesSchema.map((table) => {
                  const isExp = expandedTable === table.tableName;
                  return (
                    <div key={table.tableName} className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      {/* Table Header Bar */}
                      <div 
                        onClick={() => setExpandedTable(isExp ? null : table.tableName)}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/70 transition-colors cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <TableIcon className="w-4 h-4 text-slate-500" />
                          <span className="font-mono text-xs font-bold text-slate-900">{table.tableName}</span>
                          <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            {table.rowCount} rows
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            {table.columns.length} columns
                          </span>
                        </div>
                        <div className="text-slate-400">
                          {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {/* Expanded Table Details */}
                      {isExp && (
                        <div className="p-5 space-y-4 bg-white border-t border-slate-200">
                          {/* Columns Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-mono border-collapse">
                              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-sans">
                                <tr>
                                  <th className="py-2 px-3">Column Name</th>
                                  <th className="py-2 px-3">Data Type</th>
                                  <th className="py-2 px-3">Keys / Constraints</th>
                                  <th className="py-2 px-3">Nullable</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {table.columns.map((col) => (
                                  <tr key={col.name} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-2 px-3 font-semibold text-slate-900">{col.name}</td>
                                    <td className="py-2 px-3 text-slate-600 font-semibold">{col.dataType}</td>
                                    <td className="py-2 px-3">
                                      {col.isPrimaryKey ? (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                          PRIMARY KEY
                                        </span>
                                      ) : col.isForeignKey ? (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                          FOREIGN KEY
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 font-sans">-</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-slate-500 font-sans">
                                      {col.isNullable ? 'YES' : 'NO'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Sample Rows Preview */}
                          {table.sampleRows && table.sampleRows.length > 0 && (
                            <div className="space-y-2 pt-2">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Sample Data Preview
                              </div>
                              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="w-full text-left text-[11px] font-mono tabular-nums border-collapse">
                                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 font-sans">
                                    <tr>
                                      {Object.keys(table.sampleRows[0]).map((k) => (
                                        <th key={k} className="py-2 px-3 whitespace-nowrap">{k}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {table.sampleRows.map((row, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        {Object.keys(table.sampleRows[0]).map((k) => (
                                          <td key={k} className="py-1.5 px-3 whitespace-nowrap text-slate-800">
                                            {row[k] !== undefined && row[k] !== null ? String(row[k]) : '-'}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Safe SQL Sandbox */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Play className="w-4 h-4 text-indigo-600" />
                  <span>Read-Only SQL Playground</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Test and execute read-only SQL queries directly against your connected store with safety validation.
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Read-Only Guard</span>
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSandboxSql('SELECT product_id, name, brand, category, price, stock_quantity FROM products ORDER BY price ASC LIMIT 5;')}
                  className="px-2.5 py-1 text-[11px] font-mono bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
                >
                  Cheapest Products
                </button>
                <button
                  type="button"
                  onClick={() => setSandboxSql('SELECT product_id, name, brand, stock_quantity, price FROM products WHERE stock_quantity <= 15 ORDER BY stock_quantity ASC;')}
                  className="px-2.5 py-1 text-[11px] font-mono bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
                >
                  Stock ≤ 15
                </button>
                <button
                  type="button"
                  onClick={() => setSandboxSql('SELECT category, COUNT(*) AS sku_count, SUM(stock_quantity) AS total_units, SUM(price * stock_quantity) AS total_valuation FROM products GROUP BY category ORDER BY total_valuation DESC;')}
                  className="px-2.5 py-1 text-[11px] font-mono bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 text-slate-700 cursor-pointer"
                >
                  Valuation by Category
                </button>
              </div>

              <textarea
                rows={3}
                value={sandboxSql}
                onChange={(e) => setSandboxSql(e.target.value)}
                placeholder="SELECT ... FROM ...;"
                className="w-full p-3 text-xs font-mono bg-slate-900 text-slate-100 border border-slate-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Destructive operations (INSERT, UPDATE, DELETE, DROP, ALTER) are automatically blocked.
              </span>
              <button
                type="button"
                onClick={handleExecuteSandboxSql}
                disabled={isExecutingSql || !sandboxSql.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isExecutingSql ? 'Executing...' : 'Run Query'}</span>
              </button>
            </div>

            {/* Query Error Notice */}
            {sandboxError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-mono text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{sandboxError}</span>
              </div>
            )}

            {/* Sandbox Results Table */}
            {sandboxResult && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-900">
                    Query Results ({sandboxResult.rows.length} rows)
                  </span>
                  <span className="font-mono text-[11px] bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                    Latency: {sandboxResult.executionTimeMs} ms
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72">
                  <table className="w-full text-left text-xs font-mono tabular-nums border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 font-sans">
                      <tr>
                        {sandboxResult.columns.map((col) => (
                          <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {sandboxResult.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                          {sandboxResult.columns.map((col) => (
                            <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-800">
                              {row[col] !== undefined && row[col] !== null ? String(row[col]) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Direct CSV File Import & Data Studio */}
      {activeTab === 'csv_import' && (
        <div className="space-y-6">
          {/* Main Upload Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Direct CSV Merchandise Import</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload any retail inventory, e-commerce catalog, or sales CSV to query immediately with the assistant and inspect in data tables.
                </p>
              </div>

              {csvSummary && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active: {csvSummary.fileName}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetToMySQL}
                    className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Reset to MySQL
                  </button>
                </div>
              )}
            </div>

            {/* Quick-Load Sample CSV Presets */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Sample Retail Datasets</span>
                </span>
                <span className="text-[11px] text-slate-400">Click preset to import instantly</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  disabled={isImportingCsv}
                  onClick={() => handleLoadSampleCsv('ecommerce')}
                  className="p-3.5 text-left bg-white rounded-xl border border-slate-200 hover:border-indigo-500 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                    <span>E-Commerce Catalog</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">12 SKUs</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                    Multi-category store: audio, apparel, tech with prices & stock
                  </p>
                </button>

                <button
                  type="button"
                  disabled={isImportingCsv}
                  onClick={() => handleLoadSampleCsv('retail_apparel')}
                  className="p-3.5 text-left bg-white rounded-xl border border-slate-200 hover:border-indigo-500 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                    <span>Apparel Store Catalog</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">20 SKUs</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                    Multi-brand t-shirts, sizes XS-XL, colorways & counts
                  </p>
                </button>

                <button
                  type="button"
                  disabled={isImportingCsv}
                  onClick={() => handleLoadSampleCsv('supplier_invoice')}
                  className="p-3.5 text-left bg-white rounded-xl border border-slate-200 hover:border-indigo-500 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                    <span>Supplier Orders & Cost</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">5 Lines</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                    Wholesale order lines, vendors, unit costs & quantities
                  </p>
                </button>
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setCsvDragOver(true);
              }}
              onDragLeave={() => setCsvDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setCsvDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleUploadCsv(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                csvDragOver
                  ? 'border-indigo-600 bg-indigo-50/50'
                  : 'border-slate-300 hover:border-indigo-500 bg-slate-50/60'
              }`}
            >
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-2xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <label htmlFor="csv-file-input" className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-indigo-600 transition-colors">
                    Click to select CSV file from your computer
                  </label>
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadCsv(e.target.files[0]);
                      }
                    }}
                    className="sr-only"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    or drag and drop your spreadsheet file here (.csv format)
                  </p>
                </div>

                {csvFile && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 inline-flex items-center gap-3 text-left shadow-2xs">
                    <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 truncate max-w-xs">{csvFile.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {(csvFile.size / 1024).toFixed(1)} KB • {csvText.split('\n').filter(Boolean).length} rows detected
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Direct Paste Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCsvPaste(!showCsvPaste)}
                className="text-xs text-indigo-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>{showCsvPaste ? '- Hide raw CSV text box' : '+ Or paste raw CSV text directly'}</span>
              </button>

              {showCsvPaste && (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={5}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="product_id,brand,name,price,stock_quantity&#10;1,Nike,Nike Dri-FIT Tee,28,50&#10;2,Adidas,Ultraboost Shoes,180,25"
                    className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400">
                    Include column headers in the first row. Commas, tabs, and quotes are automatically parsed.
                  </span>
                </div>
              )}
            </div>

            {/* Import Notice */}
            {csvImportNotice && (
              <div className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
                csvImportNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {csvImportNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium">{csvImportNotice.message}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                Imported data powers Assistant inquiries, analytics charts, and merchandise tables immediately.
              </span>

              <button
                type="button"
                disabled={isImportingCsv || !csvText.trim()}
                onClick={() => handleImportCsv()}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isImportingCsv ? 'Parsing & Importing CSV...' : 'Import CSV into Ledger'}</span>
              </button>
            </div>
          </div>

          {/* Dataset Summary & Table Preview (if CSV imported) */}
          {csvSummary && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-indigo-600" />
                    <span>CSV Dataset Preview: {csvSummary.fileName}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {csvSummary.rowCount} records loaded with {csvSummary.columns.length} columns.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active Store
                </span>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Catalog SKUs</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{csvSummary.rowCount}</div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Total Units</div>
                  <div className="text-xl font-bold font-mono text-blue-600 mt-0.5">
                    {csvSummary.metadata?.totalUnits?.toLocaleString() || '-'}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Inventory Valuation</div>
                  <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">
                    ${csvSummary.metadata?.totalValue?.toLocaleString() || '-'}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Detected Columns</div>
                  <div className="text-xl font-bold font-mono text-indigo-600 mt-0.5">{csvSummary.columns.length}</div>
                </div>
              </div>

              {/* Sample Rows Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      {csvSummary.columns.map((col) => (
                        <th key={col} className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {csvSummary.sampleRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                        {csvSummary.columns.map((col) => (
                          <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-800 font-mono text-[11px]">
                            {row[col] !== undefined && row[col] !== null ? String(row[col]) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Direct PDF Document Import & Table Extractor */}
      {activeTab === 'pdf_import' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  <span>Direct PDF Document Import & Extraction</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Upload supplier invoices, inventory audit reports, or product catalog PDFs. RetailIQ extracts structured tabular data using Gemini 3.8 Flash intelligence and loads it into your queryable catalog.
                </p>
              </div>

              {pdfSummary && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    Active Document: {pdfSummary.fileName}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetToMySQL}
                    className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Reset to MySQL
                  </button>
                </div>
              )}
            </div>

            {/* Drag & Drop PDF Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setPdfDragOver(true);
              }}
              onDragLeave={() => setPdfDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setPdfDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleUploadPdf(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                pdfDragOver
                  ? 'border-purple-600 bg-purple-50/30'
                  : 'border-slate-300 hover:border-purple-500 bg-slate-50/60'
              }`}
            >
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100 shadow-2xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <label htmlFor="pdf-file-input" className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-purple-600 transition-colors">
                    Click to browse your PDF document
                  </label>
                  <input
                    id="pdf-file-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadPdf(e.target.files[0]);
                      }
                    }}
                    className="sr-only"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    or drag and drop your invoice/catalog PDF here (.pdf format)
                  </p>
                </div>

                {pdfFile && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 inline-flex items-center gap-3 text-left shadow-2xs">
                    <FileCheck className="w-5 h-5 text-purple-600 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 truncate max-w-xs">{pdfFile.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                        {(pdfFile.size / 1024).toFixed(1)} KB • PDF Document Ready
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PDF Notice */}
            {pdfImportNotice && (
              <div className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
                pdfImportNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {pdfImportNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium">{pdfImportNotice.message}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                PDF tables and line items are extracted into queryable inventory records using Gemini 3.8 Flash.
              </span>

              <button
                type="button"
                disabled={isImportingPdf || !pdfBase64}
                onClick={handleImportPdf}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isImportingPdf ? 'Extracting PDF Data via Gemini...' : 'Extract & Import PDF into Ledger'}</span>
              </button>
            </div>
          </div>

          {/* Dataset Summary & Table Preview (if PDF imported) */}
          {pdfSummary && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-purple-600" />
                    <span>Extracted PDF Inventory Items: {pdfSummary.fileName}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {pdfSummary.rowCount} records extracted from document.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  Active in Engine
                </span>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Extracted SKUs</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">{pdfSummary.rowCount}</div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Units</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-blue-600 mt-0.5">
                    {pdfSummary.metadata?.totalUnits?.toLocaleString() || '-'}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Extracted Valuation</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 mt-0.5">
                    ${pdfSummary.metadata?.totalValue?.toLocaleString() || '-'}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Extracted Columns</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-purple-600 mt-0.5">{pdfSummary.columns.length}</div>
                </div>
              </div>

              {/* Sample Rows Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      {pdfSummary.columns.map((col) => (
                        <th key={col} className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pdfSummary.sampleRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                        {pdfSummary.columns.map((col) => (
                          <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-800 font-mono tabular-nums text-[11px]">
                            {row[col] !== undefined && row[col] !== null ? String(row[col]) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Python / MySQL Bridge Code */}
      {activeTab === 'python_bridge' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Python &amp; MySQL Backend Bridge</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Drop-in FastAPI bridge that connects your existing Python modules to RetailIQ.
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shrink-0 cursor-pointer shadow-xs"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied Code!' : 'Copy Bridge Code'}</span>
              </button>
            </div>

            <div className="bg-slate-900 text-slate-200 rounded-xl p-5 text-xs font-mono border border-slate-800 overflow-x-auto max-h-[480px]">
              <pre>{pythonBridgeCode}</pre>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <h4 className="font-semibold text-slate-900">Quick Integration Steps:</h4>
              <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 leading-relaxed">
                <li>Install FastAPI and Uvicorn: <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-800">pip install fastapi uvicorn pymysql</code></li>
                <li>Place <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-800">bridge_api.py</code> inside your project directory.</li>
                <li>Launch the FastAPI bridge: <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-800">python -m uvicorn bridge_api:app --reload --port 8000</code>.</li>
                <li>In RetailIQ Settings &gt; General Configuration, set the Local Python Backend Endpoint to <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-800">http://localhost:8000</code>.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
