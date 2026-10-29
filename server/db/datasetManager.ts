import { GoogleGenAI } from '@google/genai';
import { mysqlService } from './mysqlClient.ts';

export type ColumnRole = 
  | 'brand' 
  | 'product' 
  | 'category' 
  | 'store' 
  | 'size' 
  | 'color' 
  | 'stock' 
  | 'price' 
  | 'sales' 
  | 'date' 
  | 'sku' 
  | 'rating' 
  | 'other';

export interface DynamicScopeDimension {
  key: string;             // 'brand', 'category', 'store', 'product', 'size', 'color', etc.
  label: string;           // Display title e.g. "Brand", "Category", "Store"
  columnName: string;      // Actual dataset column name
  uniqueValues: string[];  // Deduplicated, trimmed, sorted valid values
  count: number;
}

export interface ActiveDatasetMeta {
  tenantId: string;
  sourceType: 'mysql' | 'csv' | 'pdf';
  sourceName: string;
  totalRecords: number;
  columns: string[];
  columnRoles: Record<string, ColumnRole>;
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

interface TenantDataState {
  meta: ActiveDatasetMeta;
  records: Record<string, any>[];
  cachedCalculations?: CalculatedMetrics;
}

export class DatasetManager {
  private tenantStore = new Map<string, TenantDataState>();
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (apiKey) {
      try {
        this.aiClient = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
      } catch (e) {
        console.warn('DatasetManager: Failed to initialize GoogleGenAI client');
      }
    }
  }

  public isAIConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  /**
   * Deterministic Column Role Classifier with LLM fallback
   */
  public classifyColumns(columns: string[], sampleRows: Record<string, any>[]): Record<string, ColumnRole> {
    const roles: Record<string, ColumnRole> = {};

    for (const col of columns) {
      const clean = col.toLowerCase().replace(/[^a-z0-9]/g, '_');

      if (/^(brand|brand_name|maker|vendor|manufacturer)$/i.test(clean)) {
        roles[col] = 'brand';
      } else if (/^(product|product_name|item_name|name|title|item_description|description)$/i.test(clean)) {
        roles[col] = 'product';
      } else if (/^(category|category_name|dept|department|group|class|type)$/i.test(clean)) {
        roles[col] = 'category';
      } else if (/^(store|store_name|location|branch|warehouse|outlet|city|region)$/i.test(clean)) {
        roles[col] = 'store';
      } else if (/^(stock|stock_quantity|quantity|qty|units|inventory_count|in_stock|stock_level)$/i.test(clean)) {
        roles[col] = 'stock';
      } else if (/^(price|unit_price|cost|amount|rate|selling_price|mrp|val)$/i.test(clean)) {
        roles[col] = 'price';
      } else if (/^(sales|sold|units_sold|quantity_sold|orders|total_sold)$/i.test(clean)) {
        roles[col] = 'sales';
      } else if (/^(date|order_date|created_at|updated_at|timestamp|sale_date)$/i.test(clean)) {
        roles[col] = 'date';
      } else if (/^(sku|item_code|product_code|barcode|upc)$/i.test(clean)) {
        roles[col] = 'sku';
      } else if (/^(size|size_code|dimensions)$/i.test(clean)) {
        roles[col] = 'size';
      } else if (/^(color|colour)$/i.test(clean)) {
        roles[col] = 'color';
      } else if (/^(rating|review_score|score|stars)$/i.test(clean)) {
        roles[col] = 'rating';
      } else {
        // Inspect sample values if header is ambiguous
        const sampleVals = sampleRows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
        const allNumbers = sampleVals.length > 0 && sampleVals.every(v => !isNaN(Number(v)));

        if (allNumbers) {
          const avg = sampleVals.reduce((acc, v) => acc + Number(v), 0) / sampleVals.length;
          if (/price|cost|val|amt/i.test(clean)) {
            roles[col] = 'price';
          } else if (/qty|count|stock|unit/i.test(clean) || (avg > 0 && avg % 1 === 0 && avg < 50000)) {
            roles[col] = 'stock';
          } else {
            roles[col] = 'other';
          }
        } else {
          roles[col] = 'other';
        }
      }
    }

    return roles;
  }

  /**
   * Use Gemini 3.8 Flash to classify unfamiliar schema columns
   */
  public async classifyWithLLM(columns: string[], sampleRows: Record<string, any>[]): Promise<Record<string, ColumnRole>> {
    const baseRoles = this.classifyColumns(columns, sampleRows);
    if (!this.aiClient) return baseRoles;

    const unclassified = columns.filter(c => baseRoles[c] === 'other');
    if (unclassified.length === 0) return baseRoles;

    try {
      const prompt = `Analyze these dataset column headers and sample values for a retail inventory system.
Columns to classify: ${JSON.stringify(unclassified)}
Sample rows: ${JSON.stringify(sampleRows.slice(0, 3))}

Allowed roles: "brand", "product", "category", "store", "size", "color", "stock", "price", "sales", "date", "sku", "rating", "other".

Return ONLY a valid JSON object mapping each column to one of the allowed roles, with NO markdown formatting:
Example: {"col_a": "brand", "col_b": "stock"}`;

      const response = await Promise.race([
        this.aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt
        }),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('LLM classify timeout (4s)')), 4000))
      ]);

      const text = response.text ? response.text.trim().replace(/^```json/i, '').replace(/```$/i, '').trim() : '';
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [col, role] of Object.entries(parsed)) {
          if (columns.includes(col) && typeof role === 'string') {
            baseRoles[col] = role as ColumnRole;
          }
        }
      }
    } catch (e: any) {
      const msg = e?.message || '';
      const isQuota = e?.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
      if (!isQuota) {
        console.warn('DatasetManager: LLM schema classification notice (using heuristic):', msg.slice(0, 100));
      }
    }

    return baseRoles;
  }

  /**
   * Set active dataset for a tenant
   */
  public async setDataset(
    tenantId: string,
    sourceType: 'mysql' | 'csv' | 'pdf',
    sourceName: string,
    records: Record<string, any>[],
    isLive: boolean = false
  ): Promise<ActiveDatasetMeta> {
    const columns = records.length > 0 ? Object.keys(records[0]) : [];
    const sampleRows = records.slice(0, 5);

    // Classify column roles
    const columnRoles = await this.classifyWithLLM(columns, sampleRows);

    // Extract dynamic scope dimensions
    const dimensions: DynamicScopeDimension[] = [];
    const missingFieldsNotes: string[] = [];

    // Check availability of key retail roles
    const brandCols = columns.filter(c => columnRoles[c] === 'brand');
    const productCols = columns.filter(c => columnRoles[c] === 'product');
    const categoryCols = columns.filter(c => columnRoles[c] === 'category');
    const storeCols = columns.filter(c => columnRoles[c] === 'store');
    const sizeCols = columns.filter(c => columnRoles[c] === 'size');
    const colorCols = columns.filter(c => columnRoles[c] === 'color');
    const stockCols = columns.filter(c => columnRoles[c] === 'stock');
    const priceCols = columns.filter(c => columnRoles[c] === 'price');
    const salesCols = columns.filter(c => columnRoles[c] === 'sales');

    // Build unique values for each present categorical dimension
    const buildDimension = (key: string, label: string, colName: string): DynamicScopeDimension => {
      const valSet = new Set<string>();
      for (const row of records) {
        const raw = row[colName];
        if (raw !== null && raw !== undefined) {
          const str = String(raw).trim();
          if (str.length > 0 && str.toLowerCase() !== 'null' && str.toLowerCase() !== 'undefined' && str.toLowerCase() !== 'nan') {
            valSet.add(str);
          }
        }
      }
      const uniqueValues = Array.from(valSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      return {
        key,
        label,
        columnName: colName,
        uniqueValues,
        count: uniqueValues.length
      };
    };

    if (brandCols.length > 0) {
      dimensions.push(buildDimension('brand', 'Brand', brandCols[0]));
    }
    if (categoryCols.length > 0) {
      dimensions.push(buildDimension('category', 'Category', categoryCols[0]));
    }
    if (storeCols.length > 0) {
      dimensions.push(buildDimension('store', 'Store Location', storeCols[0]));
    }
    if (productCols.length > 0) {
      dimensions.push(buildDimension('product', 'Product', productCols[0]));
    }
    if (sizeCols.length > 0) {
      dimensions.push(buildDimension('size', 'Size', sizeCols[0]));
    }
    if (colorCols.length > 0) {
      dimensions.push(buildDimension('color', 'Color', colorCols[0]));
    }

    // Explicit Missing Field Alerts
    if (brandCols.length === 0) {
      missingFieldsNotes.push('No Brand column detected in dataset. Brand filters and brand breakdowns are excluded.');
    }
    if (stockCols.length === 0) {
      missingFieldsNotes.push('No Stock Quantity column detected. Stock totals and replenishment alerts are unavailable.');
    }
    if (priceCols.length === 0) {
      missingFieldsNotes.push('No Unit Price column detected. Inventory valuation and pricing analytics are unavailable.');
    }
    if (storeCols.length === 0) {
      missingFieldsNotes.push('No Store/Location column detected. Store-level comparison is not active.');
    }

    const meta: ActiveDatasetMeta = {
      tenantId,
      sourceType,
      sourceName,
      totalRecords: records.length,
      columns,
      columnRoles,
      dimensions,
      hasBrand: brandCols.length > 0,
      hasProduct: productCols.length > 0,
      hasCategory: categoryCols.length > 0,
      hasStore: storeCols.length > 0,
      hasStock: stockCols.length > 0,
      hasPrice: priceCols.length > 0,
      hasSales: salesCols.length > 0,
      missingFieldsNotes,
      lastUpdated: new Date().toISOString(),
      isLive
    };

    this.tenantStore.set(tenantId, {
      meta,
      records
    });

    return meta;
  }

  public getDatasetMeta(tenantId = 'default'): ActiveDatasetMeta | null {
    const data = this.tenantStore.get(tenantId);
    return data ? data.meta : null;
  }

  public getRawRecords(tenantId = 'default'): Record<string, any>[] {
    const data = this.tenantStore.get(tenantId);
    return data ? data.records : [];
  }

  /**
   * Deterministic metrics calculation based on active filters
   */
  public calculateMetrics(
    tenantId = 'default',
    filters: Record<string, string> = {},
    lowStockThreshold: number = 15
  ): CalculatedMetrics {
    const state = this.tenantStore.get(tenantId);
    if (!state || state.records.length === 0) {
      return {
        totalRecords: 0,
        totalStock: null,
        totalValue: null,
        averagePrice: null,
        lowStockCount: null,
        outOfStockCount: null,
        missingFieldAlerts: ['No active dataset loaded.'],
        brandDistribution: [],
        categoryDistribution: [],
        storeDistribution: [],
        productDistribution: [],
        sizeDistribution: [],
        colorDistribution: [],
        lowStockItems: [],
        activeFiltersApplied: filters,
        lastUpdated: new Date().toISOString()
      };
    }

    const { meta, records } = state;
    const { columnRoles, dimensions } = meta;

    // Filter records deterministically
    let filtered = [...records];
    const activeFiltersApplied: Record<string, string> = {};

    for (const dim of dimensions) {
      const selectedValue = filters[dim.key];
      if (selectedValue && selectedValue !== 'all' && selectedValue !== '') {
        activeFiltersApplied[dim.key] = selectedValue;
        const normSelected = selectedValue.toLowerCase().trim();
        filtered = filtered.filter(row => {
          const raw = row[dim.columnName];
          return raw !== null && raw !== undefined && String(raw).toLowerCase().trim() === normSelected;
        });
      }
    }

    // Search filter
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      activeFiltersApplied.search = q;
      filtered = filtered.filter(row => {
        return Object.values(row).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(q));
      });
    }

    // Find column names for roles
    const stockCol = Object.keys(columnRoles).find(c => columnRoles[c] === 'stock');
    const priceCol = Object.keys(columnRoles).find(c => columnRoles[c] === 'price');
    const brandCol = Object.keys(columnRoles).find(c => columnRoles[c] === 'brand');
    const catCol = Object.keys(columnRoles).find(c => columnRoles[c] === 'category');
    const storeCol = Object.keys(columnRoles).find(c => columnRoles[c] === 'store');
    const prodCol = Object.keys(columnRoles).find(c => columnRoles[c] === 'product');
    const sizeCol = Object.keys(columnRoles).find(c => columnRoles[c] === 'size');
    const colorCol = Object.keys(columnRoles).find(c => columnRoles[c] === 'color');

    // Aggregate deterministic KPIs
    let totalStock: number | null = null;
    let totalValue: number | null = null;
    let averagePrice: number | null = null;
    let lowStockCount: number | null = null;
    let outOfStockCount: number | null = null;
    const lowStockItems: Array<Record<string, any>> = [];

    if (stockCol) {
      let sumStock = 0;
      let lowCount = 0;
      let outCount = 0;

      for (const row of filtered) {
        const raw = Number(row[stockCol]);
        const s = isNaN(raw) ? 0 : Math.max(0, raw);
        sumStock += s;
        if (s === 0) {
          outCount++;
        } else if (s <= lowStockThreshold) {
          lowCount++;
          lowStockItems.push({
            ...row,
            _stock: s,
            _price: priceCol ? Number(row[priceCol]) || 0 : undefined,
            _name: prodCol ? String(row[prodCol]) : (brandCol ? `${row[brandCol]} SKU` : `Item #${row.id || ''}`)
          });
        }
      }

      totalStock = sumStock;
      lowStockCount = lowCount;
      outOfStockCount = outCount;
    }

    if (priceCol) {
      let sumPrice = 0;
      let countPrice = 0;
      for (const row of filtered) {
        const raw = Number(row[priceCol]);
        if (!isNaN(raw) && raw >= 0) {
          sumPrice += raw;
          countPrice++;
        }
      }
      averagePrice = countPrice > 0 ? Math.round((sumPrice / countPrice) * 100) / 100 : null;
    }

    if (stockCol && priceCol) {
      let sumValue = 0;
      for (const row of filtered) {
        const s = Math.max(0, Number(row[stockCol]) || 0);
        const p = Math.max(0, Number(row[priceCol]) || 0);
        sumValue += s * p;
      }
      totalValue = Math.round(sumValue * 100) / 100;
    }

    // Helper for dimension aggregation
    const aggregateDimension = (colName?: string) => {
      if (!colName) return [];
      const map = new Map<string, { units: number; value: number; count: number }>();
      for (const row of filtered) {
        const key = row[colName] ? String(row[colName]).trim() : 'Unknown';
        const s = stockCol ? Math.max(0, Number(row[stockCol]) || 0) : 1;
        const p = priceCol ? Math.max(0, Number(row[priceCol]) || 0) : 0;
        const v = s * p;

        const curr = map.get(key) || { units: 0, value: 0, count: 0 };
        curr.units += s;
        curr.value += v;
        curr.count += 1;
        map.set(key, curr);
      }

      const totalU = totalStock !== null ? totalStock : filtered.length;
      return Array.from(map.entries()).map(([k, d]) => ({
        label: k,
        units: d.units,
        value: Math.round(d.value * 100) / 100,
        count: d.count,
        pctOfTotalUnits: totalU > 0 ? Math.round((d.units / totalU) * 1000) / 10 : 0
      })).sort((a, b) => b.units - a.units);
    };

    const brandAgg = aggregateDimension(brandCol).map(b => ({
      brand: b.label,
      units: b.units,
      value: b.value,
      count: b.count,
      pctOfTotalUnits: b.pctOfTotalUnits
    }));

    const categoryAgg = aggregateDimension(catCol).map(c => ({
      category: c.label,
      units: c.units,
      value: c.value,
      count: c.count,
      pctOfTotalUnits: c.pctOfTotalUnits
    }));

    const storeAgg = aggregateDimension(storeCol).map(s => ({
      store: s.label,
      units: s.units,
      value: s.value,
      count: s.count,
      pctOfTotalUnits: s.pctOfTotalUnits
    }));

    const productAgg = aggregateDimension(prodCol).slice(0, 15).map(p => ({
      product: p.label,
      units: p.units,
      value: p.value,
      count: p.count
    }));

    const sizeAgg = aggregateDimension(sizeCol).map(s => ({
      size: s.label,
      units: s.units,
      value: s.value
    }));

    const colorAgg = aggregateDimension(colorCol).map(c => ({
      color: c.label,
      units: c.units,
      value: c.value
    }));

    return {
      totalRecords: filtered.length,
      totalStock,
      totalValue,
      averagePrice,
      lowStockCount,
      outOfStockCount,
      missingFieldAlerts: meta.missingFieldsNotes,
      brandDistribution: brandAgg,
      categoryDistribution: categoryAgg,
      storeDistribution: storeAgg,
      productDistribution: productAgg,
      sizeDistribution: sizeAgg,
      colorDistribution: colorAgg,
      lowStockItems: lowStockItems.sort((a, b) => a._stock - b._stock).slice(0, 20),
      activeFiltersApplied,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Dataset-aware contextual AI recommendations
   * Never fabricates brands or fields if they don't exist in the active dataset
   */
  public generateSuggestions(tenantId = 'default'): Array<{ title: string; query: string; tag: string }> {
    const state = this.tenantStore.get(tenantId);
    if (!state || state.records.length === 0) {
      return [
        { title: 'Upload Dataset', query: 'How do I upload a CSV or connect MySQL?', tag: 'Getting Started' },
        { title: 'Explore Demo Database', query: 'Connect to ecommerce_db or atliq_tshirts', tag: 'Setup' }
      ];
    }

    const { meta } = state;
    const { hasBrand, hasProduct, hasCategory, hasStore, hasStock, hasPrice, dimensions } = meta;
    const suggestions: Array<{ title: string; query: string; tag: string }> = [];

    // Case 1: ONLY product name is available (Acceptance Test 1)
    if (hasProduct && !hasBrand && !hasCategory && !hasStore) {
      const prodDim = dimensions.find(d => d.key === 'product');
      const sampleProd = prodDim?.uniqueValues[0] || 'first product';
      suggestions.push(
        { title: 'List All Products', query: 'Show all products in the catalog', tag: 'Catalog' },
        { title: 'Find Specific Product', query: `Find product details for "${sampleProd}"`, tag: 'Product Lookup' },
        { title: 'Count Total Items', query: 'How many total products are in this dataset?', tag: 'Catalog Count' },
        { title: 'Alphabetical Catalog', query: 'Show all products in alphabetical order', tag: 'Sorting' }
      );
      if (hasStock) {
        suggestions.push(
          { title: 'Lowest Stock Products', query: 'Which products have the lowest stock?', tag: 'Inventory Level' },
          { title: 'Products Below 20 Units', query: 'Show products with stock below 20', tag: 'Restocking' }
        );
      }
      return suggestions;
    }

    // Case 2: Brand column exists
    if (hasBrand) {
      const brandDim = dimensions.find(d => d.key === 'brand');
      const firstBrand = brandDim?.uniqueValues[0] || 'Nike';
      const secondBrand = brandDim?.uniqueValues[1] || 'Adidas';

      if (hasStock) {
        suggestions.push(
          { title: 'Lowest Stock Brand', query: 'Which brand has the lowest stock?', tag: 'Brand Analysis' },
          { title: `Stock for ${firstBrand}`, query: `How many ${firstBrand} items do we have in stock?`, tag: 'Brand Stock' }
        );
      }

      if (hasPrice && hasStock) {
        suggestions.push(
          { title: 'Inventory Value by Brand', query: 'Calculate inventory value by brand', tag: 'Valuation' },
          { title: `${firstBrand} vs ${secondBrand} Value`, query: `Compare inventory value between ${firstBrand} and ${secondBrand}`, tag: 'Comparison' }
        );
      }
    }

    // Case 3: Category column exists
    if (hasCategory) {
      const catDim = dimensions.find(d => d.key === 'category');
      const firstCat = catDim?.uniqueValues[0] || 'Apparel';
      suggestions.push(
        { title: `Stock by Category`, query: 'Show inventory distribution by category', tag: 'Category Breakdown' },
        { title: `${firstCat} Catalog`, query: `Show all items in the ${firstCat} category`, tag: 'Category Filter' }
      );
    }

    // Case 4: Store location column exists
    if (hasStore) {
      suggestions.push(
        { title: 'Store with Highest Inventory', query: 'Which store has the highest inventory value?', tag: 'Store Comparison' },
        { title: 'Stock Breakdown by Store', query: 'Show total stock quantity per store location', tag: 'Store Allocation' }
      );
    }

    // General stock & replenishment queries if stock exists
    if (hasStock) {
      suggestions.push(
        { title: 'Low Stock Alert (≤ 15 Units)', query: 'Show products with stock below 15', tag: 'Stock Alert' },
        { title: 'Out of Stock Items', query: 'Show all out of stock products', tag: 'Zero Inventory' }
      );
    }

    // Pricing & valuation if price exists
    if (hasPrice) {
      suggestions.push(
        { title: '5 Most Expensive Items', query: 'Find the 5 most expensive products', tag: 'Premium Pricing' },
        { title: '5 Cheapest Items', query: 'Find the 5 cheapest products', tag: 'Value Items' }
      );
    }

    return suggestions.slice(0, 8);
  }
}

export const datasetManager = new DatasetManager();
