import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Product, InventoryMetrics, InventoryFilterOptions, InventoryListResponse } from '../../src/types/inventory.ts';
import { applyInventorySorting } from '../utils/inventorySorting.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? '/tmp/retailiq_data' : path.resolve(__dirname, '../data');
const TENANTS_DIR = path.resolve(DATA_DIR, 'user_inventories');

export interface UserDataSource {
  type: 'none' | 'database' | 'csv' | 'pdf';
  name?: string;
  host?: string;
  isLive?: boolean;
  connectedAt?: string;
  tables?: string[];
  totalRecords?: number;
}

export interface UserInventoryData {
  userId: string;
  dataSource: UserDataSource;
  records: Record<string, any>[];
  discounts: any[];
  lowStockThreshold: number;
  lastUpdated: string;
}

class UserInventoryStore {
  private userStores = new Map<string, UserInventoryData>();

  constructor() {
    this.ensureDirs();
  }

  private getDirs(): string[] {
    const localDir = path.resolve(__dirname, '../data/user_inventories');
    const tmpDir = '/tmp/retailiq_data/user_inventories';
    return [localDir, tmpDir];
  }

  private ensureDirs() {
    for (const dir of this.getDirs()) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      } catch {
        // Continue gracefully
      }
    }
  }

  private getTenantFilePaths(userId: string): string[] {
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return this.getDirs().map(dir => path.resolve(dir, `${safeId}.json`));
  }

  private persistUser(userId: string) {
    const data = this.userStores.get(userId);
    if (!data) return;

    this.ensureDirs();
    const paths = this.getTenantFilePaths(userId);
    let savedAny = false;

    for (const p of paths) {
      try {
        fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
        savedAny = true;
      } catch {
        // Try next candidate directory
      }
    }

    if (!savedAny) {
      // Data remains safely in RAM
    }
  }

  private loadUserFromDisk(userId: string): UserInventoryData | null {
    const paths = this.getTenantFilePaths(userId);
    for (const p of paths) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf-8');
          const parsed: UserInventoryData = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Try next candidate
      }
    }
    return null;
  }

  public getUserData(userId: string): UserInventoryData {
    if (!this.userStores.has(userId)) {
      const diskData = this.loadUserFromDisk(userId);
      if (diskData) {
        this.userStores.set(userId, diskData);
      } else {
        // STRICT REQUIREMENT: Initial state for any user is completely empty!
        // No sample data, no mock records, no demo t-shirts!
        const emptyState: UserInventoryData = {
          userId,
          dataSource: {
            type: 'none',
            name: undefined,
            isLive: false,
            totalRecords: 0
          },
          records: [],
          discounts: [],
          lowStockThreshold: 15,
          lastUpdated: ''
        };
        this.userStores.set(userId, emptyState);
      }
    }
    return this.userStores.get(userId)!;
  }

  public hasData(userId: string): boolean {
    const data = this.getUserData(userId);
    return data.dataSource.type !== 'none' && data.records.length > 0;
  }

  public setDataSource(
    userId: string,
    source: UserDataSource,
    records: Record<string, any>[] = [],
    discounts: any[] = []
  ): void {
    const userState = this.getUserData(userId);
    userState.dataSource = {
      ...source,
      totalRecords: records.length,
      connectedAt: new Date().toISOString()
    };
    userState.records = records;
    userState.discounts = discounts;
    userState.lastUpdated = new Date().toISOString();
    this.persistUser(userId);
  }

  public clearUserData(userId: string): void {
    const userState = this.getUserData(userId);
    userState.dataSource = {
      type: 'none',
      name: undefined,
      isLive: false,
      totalRecords: 0
    };
    userState.records = [];
    userState.discounts = [];
    userState.lastUpdated = '';
    this.persistUser(userId);
    try {
      const paths = this.getTenantFilePaths(userId);
      for (const p of paths) {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      }
    } catch {}
  }

  public setThreshold(userId: string, threshold: number): void {
    if (threshold >= 1 && threshold <= 100) {
      const userState = this.getUserData(userId);
      userState.lowStockThreshold = threshold;
      this.persistUser(userId);
    }
  }

  public getJoinedProducts(userId: string, thresholdOverride?: number): Product[] {
    const userState = this.getUserData(userId);
    if (!userState.records || userState.records.length === 0) {
      return [];
    }

    const threshold = thresholdOverride ?? userState.lowStockThreshold;
    const discountMap = new Map<number, number>();
    for (const d of userState.discounts) {
      discountMap.set(Number(d.t_shirt_id ?? d.id), Number(d.pct_discount ?? 0));
    }

    return userState.records.map((item, idx) => {
      const id = Number(item.t_shirt_id ?? item.id ?? item.product_id ?? item.item_id ?? (idx + 1));
      const brand = String(item.brand ?? item.vendor ?? item.supplier ?? 'Unbranded');
      const color = String(item.color ?? item.category ?? 'Standard');
      const size = String(item.size ?? item.sku ?? 'Standard');
      const price = Math.max(0, Number(item.price ?? item.unit_price ?? item.cost ?? 0));
      const stock_quantity = Math.max(0, Number(item.stock_quantity ?? item.quantity ?? item.stock ?? item.units ?? 0));

      const discount = discountMap.get(id);
      const inventory_value = Math.round(price * stock_quantity * 100) / 100;
      const effective_price = discount 
        ? Math.round((price * (1 - discount / 100)) * 100) / 100 
        : price;
      
      let stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (stock_quantity === 0) {
        stock_status = 'out_of_stock';
      } else if (stock_quantity <= threshold) {
        stock_status = 'low_stock';
      }

      return {
        t_shirt_id: id,
        brand: brand as any,
        color: color as any,
        size: size as any,
        price,
        stock_quantity,
        inventory_value,
        discount_pct: discount,
        effective_price,
        stock_status
      };
    });
  }

  public getMetrics(userId: string, thresholdOverride?: number): InventoryMetrics {
    const userState = this.getUserData(userId);
    const products = this.getJoinedProducts(userId, thresholdOverride);
    const totalProducts = products.length;

    // Strict requirement: zero records return 0 for everything
    if (totalProducts === 0) {
      return {
        totalProducts: 0,
        totalUnits: 0,
        totalInventoryValue: 0,
        averagePrice: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        brandDistribution: [],
        sizeDistribution: [],
        colorDistribution: [],
        lowStockItems: [],
        lastUpdated: ''
      };
    }

    const totalUnits = products.reduce((acc, p) => acc + p.stock_quantity, 0);
    const totalInventoryValue = Math.round(products.reduce((acc, p) => acc + p.inventory_value, 0) * 100) / 100;
    const lowStockItems = products.filter(p => p.stock_status === 'low_stock');
    const outOfStockItems = products.filter(p => p.stock_status === 'out_of_stock');
    const averagePrice = Math.round((products.reduce((acc, p) => acc + p.price, 0) / totalProducts) * 100) / 100;

    // Brand distribution
    const brandMap = new Map<string, { units: number; value: number; count: number }>();
    for (const p of products) {
      const current = brandMap.get(p.brand) || { units: 0, value: 0, count: 0 };
      brandMap.set(p.brand, {
        units: current.units + p.stock_quantity,
        value: current.value + p.inventory_value,
        count: current.count + 1
      });
    }

    const brandDistribution = Array.from(brandMap.entries()).map(([brand, data]) => ({
      brand,
      units: data.units,
      value: Math.round(data.value * 100) / 100,
      count: data.count,
      productCount: data.count,
      pctOfTotalUnits: totalUnits > 0 ? Math.round((data.units / totalUnits) * 1000) / 10 : 0
    })).sort((a, b) => b.units - a.units);

    // Color/category distribution
    const colorMap = new Map<string, { units: number; value: number }>();
    for (const p of products) {
      const current = colorMap.get(p.color) || { units: 0, value: 0 };
      colorMap.set(p.color, {
        units: current.units + p.stock_quantity,
        value: current.value + p.inventory_value
      });
    }

    const colorDistribution = Array.from(colorMap.entries()).map(([color, data]) => ({
      color,
      units: data.units,
      value: Math.round(data.value * 100) / 100
    })).sort((a, b) => b.units - a.units);

    return {
      totalProducts,
      totalUnits,
      totalInventoryValue,
      averagePrice,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      brandDistribution,
      sizeDistribution: [],
      colorDistribution,
      lowStockItems,
      lastUpdated: userState.lastUpdated || new Date().toISOString()
    };
  }

  public getFilteredProducts(
    userId: string,
    options: InventoryFilterOptions,
    thresholdOverride?: number
  ): InventoryListResponse {
    let products = this.getJoinedProducts(userId, thresholdOverride);

    if (products.length === 0) {
      return {
        products: [],
        total: 0,
        page: options.page || 1,
        totalPages: 0,
        limit: options.limit || 12,
        filterSummary: {
          totalUnits: 0,
          totalValue: 0
        },
        brands: [],
        colors: [],
        sizes: []
      } as any;
    }

    // Dynamic distinct filters from user's actual data
    const brands = Array.from(new Set(products.map(p => p.brand))).filter(Boolean).sort();
    const colors = Array.from(new Set(products.map(p => p.color))).filter(Boolean).sort();
    const sizes = Array.from(new Set(products.map(p => p.size))).filter(Boolean).sort();

    // Search filter
    if (options.search && options.search.trim()) {
      const q = options.search.toLowerCase().trim();
      products = products.filter(p => 
        p.brand.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q) ||
        p.size.toLowerCase().includes(q) ||
        String(p.t_shirt_id).includes(q) ||
        String(p.price).includes(q)
      );
    }

    // Brand filter
    if (options.brand && options.brand !== 'all') {
      products = products.filter(p => p.brand.toLowerCase() === options.brand!.toLowerCase());
    }

    // Color filter
    if (options.color && options.color !== 'all') {
      products = products.filter(p => p.color.toLowerCase() === options.color!.toLowerCase());
    }

    // Size filter
    if (options.size && options.size !== 'all') {
      products = products.filter(p => p.size.toLowerCase() === options.size!.toLowerCase());
    }

    // Stock status filter
    if (options.stockStatus && options.stockStatus !== 'all') {
      products = products.filter(p => p.stock_status === options.stockStatus);
    }

    // Sorting
    products = applyInventorySorting(products, options.sort, options.sortBy, options.sortOrder);

    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 12);
    const total = products.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedProducts = products.slice((page - 1) * limit, page * limit);

    const totalUnits = products.reduce((acc, p) => acc + p.stock_quantity, 0);
    const totalValue = Math.round(products.reduce((acc, p) => acc + p.inventory_value, 0) * 100) / 100;

    return {
      products: paginatedProducts,
      total,
      page,
      totalPages: Math.max(1, totalPages),
      limit,
      filterSummary: {
        totalUnits,
        totalValue
      },
      brands,
      colors,
      sizes
    } as any;
  }

  public getCSVData(userId: string, options: InventoryFilterOptions, thresholdOverride?: number): string {
    const listRes = this.getFilteredProducts(userId, { ...options, page: 1, limit: 100000 }, thresholdOverride);
    const rows = [
      ['ID', 'Brand / Item', 'Color / Category', 'Size / Spec', 'Base Price', 'Discount %', 'Effective Price', 'Stock Quantity', 'Stock Status', 'Inventory Value']
    ];

    for (const p of listRes.products) {
      rows.push([
        String(p.t_shirt_id),
        `"${p.brand}"`,
        `"${p.color}"`,
        `"${p.size}"`,
        p.price.toFixed(2),
        p.discount_pct !== undefined ? `${p.discount_pct}%` : '0%',
        (p.effective_price ?? p.price).toFixed(2),
        String(p.stock_quantity),
        p.stock_status,
        p.inventory_value.toFixed(2)
      ]);
    }

    return rows.map(r => r.join(',')).join('\n');
  }
}

export const userInventoryStore = new UserInventoryStore();
