export interface Product {
  t_shirt_id: number;
  brand: 'Nike' | 'Levi' | 'Van Heusen' | 'Adidas' | string;
  color: 'White' | 'Black' | 'Red' | 'Blue' | string;
  size: 'XS' | 'S' | 'M' | 'L' | 'XL' | string;
  price: number;
  stock_quantity: number;
  inventory_value: number; // calculated as price * stock_quantity
  discount_pct?: number;   // from discounts table
  effective_price?: number; // price with discount
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface DiscountRecord {
  t_shirt_id: number;
  pct_discount: number;
}

export interface InventoryMetrics {
  totalProducts: number;
  totalUnits: number;
  totalInventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  averagePrice: number;
  brandDistribution: {
    brand: string;
    units: number;
    value: number;
    productCount: number;
    pctOfTotalUnits: number;
  }[];
  sizeDistribution: {
    size: string;
    units: number;
    value: number;
  }[];
  colorDistribution: {
    color: string;
    units: number;
    value: number;
  }[];
  lowStockItems: Product[];
  lastUpdated: string;
}

export type AlphabeticalSortOption = 'Alphabetical (A-Z)' | 'Alphabetical (Z-A)';

export interface InventoryFilterOptions {
  search?: string;
  brand?: string;
  color?: string;
  size?: string;
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  sort?: string; // Supports 'Alphabetical (A-Z)', 'Alphabetical (Z-A)', or preset keys
  sortBy?: 't_shirt_id' | 'brand' | 'color' | 'size' | 'price' | 'stock_quantity' | 'inventory_value' | string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface InventoryListResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  filterSummary: {
    totalUnits: number;
    totalValue: number;
  };
}

export interface ChatChartData {
  type: 'bar' | 'donut';
  title: string;
  labelKey: string;
  valueKey: string;
  items: Array<{ label: string; value: number; color?: string }>;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  sources?: GroundingSource[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  metric?: {
    label: string;
    value: string | number;
    subtext?: string;
  };
  sqlQuery?: string;
  tableData?: {
    columns: string[];
    rows: Array<Record<string, any>>;
  };
  chartData?: ChatChartData;
  queryType?: 'exact_pattern' | 'gemini_reasoning' | 'python_backend' | 'google_search_grounding';
  groundingMetadata?: GroundingMetadata;
  isError?: boolean;
}

export interface AppSettings {
  lowStockThreshold: number;
  queryRoutingMode: 'hybrid' | 'gemini_only' | 'pattern_only';
  databaseName: string;
  dbHost: string;
  pythonBackendUrl: string;
  lastSyncTime: string;
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

export type DataSourceType = 'mysql' | 'csv' | 'pdf';

export interface ImportedDatasetSummary {
  sourceType: 'mysql' | 'csv' | 'pdf';
  fileName: string;
  rowCount: number;
  columns: string[];
  sampleRows: Record<string, any>[];
  importedAt: string;
  metadata?: {
    totalUnits?: number;
    totalValue?: number;
    detectedCategories?: string[];
    detectedBrands?: string[];
    notes?: string;
  };
}

export interface DatabaseStatus {
  connected: boolean;
  database: string;
  host: string;
  port: number;
  tables: string[] | TableSchemaInfo[];
  totalRecords: number;
  connectionMode: 'built-in-mysql-engine' | 'live-mysql-connection' | 'python-fastapi-bridge' | 'live-remote-mysql' | 'imported-csv' | 'imported-pdf';
  isLiveMySQL: boolean;
  activeSource?: DataSourceType;
  importSummary?: ImportedDatasetSummary | null;
  lastChecked: string;
  serverTime: string;
  connectionError?: string;
}

export interface DynamicScopeDimension {
  key: string;             // 'brand', 'category', 'store', 'product', 'size', 'color', etc.
  label: string;           // e.g. "Brand", "Category", "Store Location", "Product"
  columnName: string;      // original column name from dataset
  uniqueValues: string[];  // deduplicated, trimmed, sorted valid values
  count: number;
}

export interface ActiveDatasetMeta {
  tenantId: string;
  sourceType: 'mysql' | 'csv' | 'pdf';
  sourceName: string;
  totalRecords: number;
  columns: string[];
  columnRoles: Record<string, string>;
  dimensions: DynamicScopeDimension[];
  hasBrand: boolean;
  hasProduct: boolean;
  hasCategory: boolean;
  hasStore: boolean;
  hasStock: boolean;
  hasPrice: boolean;
  hasSales: boolean;
  missingFieldsNotes: string[];
  lastUpdated: string;
  isLive: boolean;
}

export interface CalculatedMetrics {
  totalRecords: number;
  totalStock: number | null;
  totalValue: number | null;
  averagePrice: number | null;
  lowStockCount: number | null;
  outOfStockCount: number | null;
  missingFieldAlerts: string[];
  brandDistribution: Array<{ brand: string; units: number; value: number; count: number; pctOfTotalUnits: number }>;
  categoryDistribution: Array<{ category: string; units: number; value: number; count: number; pctOfTotalUnits: number }>;
  storeDistribution: Array<{ store: string; units: number; value: number; count: number; pctOfTotalUnits: number }>;
  productDistribution: Array<{ product: string; units: number; value: number; count: number }>;
  sizeDistribution: Array<{ size: string; units: number; value: number }>;
  colorDistribution: Array<{ color: string; units: number; value: number }>;
  lowStockItems: Array<Record<string, any>>;
  activeFiltersApplied: Record<string, string>;
  lastUpdated: string;
}

export interface AIStatus {
  configured: boolean;
  model: string;
  provider: string;
}
