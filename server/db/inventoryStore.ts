import { INITIAL_T_SHIRTS, INITIAL_DISCOUNTS, RawTShirt, RawDiscount } from './seedData.ts';
import type { Product, InventoryMetrics, InventoryFilterOptions, InventoryListResponse } from '../../src/types/inventory.ts';
import { applyInventorySorting } from '../utils/inventorySorting.ts';

class InventoryStore {
  private tShirts: RawTShirt[];
  private discounts: RawDiscount[];
  private lowStockThreshold: number = 15;
  private lastUpdated: Date;

  constructor() {
    this.tShirts = [...INITIAL_T_SHIRTS];
    this.discounts = [...INITIAL_DISCOUNTS];
    this.lastUpdated = new Date();
  }

  public getThreshold(): number {
    return this.lowStockThreshold;
  }

  public setThreshold(val: number): void {
    if (val >= 1 && val <= 100) {
      this.lowStockThreshold = val;
    }
  }

  public syncFromDatabase(records: any[], discounts: any[] = []): void {
    if (Array.isArray(records) && records.length > 0) {
      this.tShirts = records.map((t, idx) => {
        const id = Number(t.t_shirt_id ?? t.product_id ?? t.id ?? t.item_id ?? (idx + 1));
        const brandName = String(t.brand ?? t.name ?? t.product_name ?? t.title ?? 'Product');
        const colorOrCat = String(t.color ?? t.category ?? t.department ?? (t.name ? t.name.slice(0, 16) : 'Standard'));
        const sizeOrType = String(t.size ?? (t.category ? t.category.slice(0, 12) : (t.rating ? `★ ${t.rating}` : 'Standard')));
        const unitPrice = Math.max(0, Number(t.price ?? t.unit_price ?? t.cost ?? t.amount ?? 25));
        const stockQty = Math.max(0, Number(t.stock_quantity ?? t.quantity ?? t.stock ?? t.inventory_count ?? 0));

        return {
          t_shirt_id: id,
          brand: brandName as any,
          color: colorOrCat as any,
          size: sizeOrType as any,
          price: unitPrice,
          stock_quantity: stockQty
        };
      });
    }
    if (Array.isArray(discounts)) {
      this.discounts = discounts.map(d => ({
        t_shirt_id: Number(d.t_shirt_id ?? d.product_id ?? d.discount_id ?? 1),
        pct_discount: Number(d.pct_discount ?? d.percentage ?? d.discount_pct ?? 0)
      }));
    }
    this.lastUpdated = new Date();
  }

  public getJoinedProducts(threshold = this.lowStockThreshold): Product[] {
    const discountMap = new Map<number, number>();
    for (const d of this.discounts) {
      discountMap.set(d.t_shirt_id, d.pct_discount);
    }

    return this.tShirts.map((item) => {
      const discount = discountMap.get(item.t_shirt_id);
      const inventory_value = item.price * item.stock_quantity;
      const effective_price = discount 
        ? Math.round((item.price * (1 - discount / 100)) * 100) / 100 
        : item.price;
      
      let stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (item.stock_quantity === 0) {
        stock_status = 'out_of_stock';
      } else if (item.stock_quantity <= threshold) {
        stock_status = 'low_stock';
      }

      return {
        ...item,
        inventory_value,
        discount_pct: discount,
        effective_price,
        stock_status
      };
    });
  }

  public getMetrics(threshold = this.lowStockThreshold): InventoryMetrics {
    const products = this.getJoinedProducts(threshold);
    const totalProducts = products.length;
    const totalUnits = products.reduce((acc, p) => acc + p.stock_quantity, 0);
    const totalInventoryValue = products.reduce((acc, p) => acc + p.inventory_value, 0);
    const lowStockItems = products.filter(p => p.stock_quantity <= threshold && p.stock_quantity > 0);
    const outOfStockItems = products.filter(p => p.stock_quantity === 0);
    const averagePrice = totalProducts > 0 
      ? Math.round((products.reduce((acc, p) => acc + p.price, 0) / totalProducts) * 100) / 100 
      : 0;

    // Brand aggregation
    const brandMap = new Map<string, { units: number; value: number; count: number }>();
    for (const p of products) {
      const current = brandMap.get(p.brand) || { units: 0, value: 0, count: 0 };
      current.units += p.stock_quantity;
      current.value += p.inventory_value;
      current.count += 1;
      brandMap.set(p.brand, current);
    }

    const brandDistribution = Array.from(brandMap.entries())
      .map(([brand, data]) => ({
        brand,
        units: data.units,
        value: data.value,
        productCount: data.count,
        pctOfTotalUnits: totalUnits > 0 ? Math.round((data.units / totalUnits) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.units - a.units);

    // Size aggregation
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL'];
    const sizeMap = new Map<string, { units: number; value: number }>();
    for (const p of products) {
      const current = sizeMap.get(p.size) || { units: 0, value: 0 };
      current.units += p.stock_quantity;
      current.value += p.inventory_value;
      sizeMap.set(p.size, current);
    }

    const sizeDistribution = sizeOrder.map(size => {
      const data = sizeMap.get(size) || { units: 0, value: 0 };
      return { size, units: data.units, value: data.value };
    });

    // Color aggregation
    const colorMap = new Map<string, { units: number; value: number }>();
    for (const p of products) {
      const current = colorMap.get(p.color) || { units: 0, value: 0 };
      current.units += p.stock_quantity;
      current.value += p.inventory_value;
      colorMap.set(p.color, current);
    }

    const colorDistribution = Array.from(colorMap.entries())
      .map(([color, data]) => ({ color, units: data.units, value: data.value }))
      .sort((a, b) => b.units - a.units);

    return {
      totalProducts,
      totalUnits,
      totalInventoryValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      averagePrice,
      brandDistribution,
      sizeDistribution,
      colorDistribution,
      lowStockItems: lowStockItems.sort((a, b) => a.stock_quantity - b.stock_quantity),
      lastUpdated: this.lastUpdated.toISOString()
    };
  }

  public getFilteredProducts(filters: InventoryFilterOptions, threshold = this.lowStockThreshold): InventoryListResponse {
    let items = this.getJoinedProducts(threshold);

    // Filter by Brand
    if (filters.brand && filters.brand !== 'all') {
      const b = filters.brand.toLowerCase();
      items = items.filter(p => p.brand.toLowerCase() === b);
    }

    // Filter by Color
    if (filters.color && filters.color !== 'all') {
      const c = filters.color.toLowerCase();
      items = items.filter(p => p.color.toLowerCase() === c);
    }

    // Filter by Size
    if (filters.size && filters.size !== 'all') {
      const s = filters.size.toUpperCase();
      items = items.filter(p => p.size.toUpperCase() === s);
    }

    // Filter by Stock Status
    if (filters.stockStatus && filters.stockStatus !== 'all') {
      items = items.filter(p => p.stock_status === filters.stockStatus);
    }

    // Search query across ID, Brand, Color, Size
    if (filters.search && filters.search.trim()) {
      const query = filters.search.toLowerCase().trim();
      items = items.filter(p => 
        p.brand.toLowerCase().includes(query) ||
        p.color.toLowerCase().includes(query) ||
        p.size.toLowerCase().includes(query) ||
        p.t_shirt_id.toString().includes(query)
      );
    }

    // Summary of filtered dataset
    const filterSummary = {
      totalUnits: items.reduce((sum, p) => sum + p.stock_quantity, 0),
      totalValue: items.reduce((sum, p) => sum + p.inventory_value, 0)
    };

    // Apply backend sorting utility (supports 'Alphabetical (A-Z)' and 'Alphabetical (Z-A)')
    items = applyInventorySorting(items, filters.sort, filters.sortBy, filters.sortOrder);

    const total = items.length;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, filters.limit || 10);
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedProducts = items.slice(startIndex, startIndex + limit);

    return {
      products: paginatedProducts,
      total,
      page,
      totalPages,
      limit,
      filterSummary
    };
  }

  public getCSVData(filters: InventoryFilterOptions, threshold = this.lowStockThreshold): string {
    const list = this.getFilteredProducts({ ...filters, page: 1, limit: 10000 }, threshold).products;
    const headers = ['Product ID', 'Brand', 'Color', 'Size', 'Price ($)', 'Stock Quantity', 'Discount (%)', 'Inventory Value ($)', 'Stock Status'];
    const rows = list.map(p => [
      p.t_shirt_id,
      `"${p.brand}"`,
      `"${p.color}"`,
      `"${p.size}"`,
      p.price.toFixed(2),
      p.stock_quantity,
      p.discount_pct || 0,
      p.inventory_value.toFixed(2),
      p.stock_status
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // Pure MySQL Query simulator for safe read-only SQL queries
  public executeSimulatedSQL(sql: string): { columns: string[]; rows: any[]; affectedRows?: number } {
    const normalized = sql.trim().replace(/;+$/, '');
    const lower = normalized.toLowerCase();

    // Enforce safe read-only query policy
    if (!lower.startsWith('select') && !lower.startsWith('show') && !lower.startsWith('describe')) {
      throw new Error('Security Error: Only read-only SELECT queries are permitted on atliq_tshirts.');
    }

    const products = this.getJoinedProducts();
    const discounts = this.discounts;

    // Pattern 1: Net revenue with discounts applied / Projected Yield
    if (lower.includes('projected_discounted_yield') || lower.includes('net_amount') || (lower.includes('discount') && lower.includes('yield'))) {
      const brandMap = new Map<string, { gross: number; net: number }>();
      for (const p of products) {
        const cur = brandMap.get(p.brand) || { gross: 0, net: 0 };
        cur.gross += p.inventory_value;
        const discountRate = (p.discount_pct || 0) / 100;
        cur.net += (p.price * (1 - discountRate)) * p.stock_quantity;
        brandMap.set(p.brand, cur);
      }
      const rows = Array.from(brandMap.entries()).map(([brand, data]) => ({
        brand,
        gross_inventory_value: Math.round(data.gross),
        projected_discounted_yield: Math.round(data.net * 100) / 100
      })).sort((a, b) => b.projected_discounted_yield - a.projected_discounted_yield);

      return {
        columns: ['brand', 'gross_inventory_value', 'projected_discounted_yield'],
        rows
      };
    }

    // Pattern 2: Brand-level inventory value / Group by brand
    if (lower.includes('group by brand') || (lower.includes('brand') && lower.includes('group by'))) {
      const brandMap = new Map<string, { count: number; units: number; value: number }>();
      for (const p of products) {
        const cur = brandMap.get(p.brand) || { count: 0, units: 0, value: 0 };
        cur.count++;
        cur.units += p.stock_quantity;
        cur.value += p.inventory_value;
        brandMap.set(p.brand, cur);
      }
      const rows = Array.from(brandMap.entries()).map(([brand, data]) => ({
        brand,
        sku_count: data.count,
        total_units: data.units,
        total_inventory_value: Math.round(data.value * 100) / 100
      })).sort((a, b) => b.total_inventory_value - a.total_inventory_value);

      return {
        columns: ['brand', 'sku_count', 'total_units', 'total_inventory_value'],
        rows
      };
    }

    // Pattern B: Aggregate total inventory value
    if (lower.includes('sum(price * stock_quantity)') || lower.includes('sum(price*stock_quantity)') || lower.includes('sum(inventory_value)')) {
      if (lower.includes('where') && lower.includes('brand')) {
        const brandMatch = sql.match(/brand\s*=\s*['"]([^'"]+)['"]/i);
        const brand = brandMatch ? brandMatch[1] : '';
        const filtered = products.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
        const totalVal = filtered.reduce((sum, p) => sum + p.inventory_value, 0);
        return {
          columns: ['brand', 'total_inventory_value'],
          rows: [{ brand, total_inventory_value: totalVal }]
        };
      }
      const totalVal = products.reduce((sum, p) => sum + p.inventory_value, 0);
      return {
        columns: ['total_inventory_value'],
        rows: [{ total_inventory_value: totalVal }]
      };
    }

    // Pattern C: Average price
    if (lower.includes('avg(price)')) {
      const avg = products.reduce((sum, p) => sum + p.price, 0) / (products.length || 1);
      const min = Math.min(...products.map(p => p.price));
      const max = Math.max(...products.map(p => p.price));
      return {
        columns: ['average_price', 'min_price', 'max_price'],
        rows: [{
          average_price: Math.round(avg * 100) / 100,
          min_price: min,
          max_price: max
        }]
      };
    }


    // Pattern E: Filtering and sorting items (Cheapest, Low Stock, Alphabetical, Size/Color)
    let filtered = [...products];

    // Filter by Brand
    const brandMatch = sql.match(/brand\s*=\s*['"]([^'"]+)['"]/i);
    if (brandMatch) {
      filtered = filtered.filter(p => p.brand.toLowerCase() === brandMatch[1].toLowerCase());
    }

    // Filter by Color
    const colorMatch = sql.match(/color\s*=\s*['"]([^'"]+)['"]/i);
    if (colorMatch) {
      filtered = filtered.filter(p => p.color.toLowerCase() === colorMatch[1].toLowerCase());
    }

    // Filter by Size
    const sizeMatch = sql.match(/size\s*=\s*['"]([^'"]+)['"]/i);
    if (sizeMatch) {
      filtered = filtered.filter(p => p.size.toUpperCase() === sizeMatch[1].toUpperCase());
    }

    // Filter by stock_quantity <= or <
    const stockLeMatch = sql.match(/stock_quantity\s*(<=|<)\s*(\d+)/i);
    if (stockLeMatch) {
      const maxStock = parseInt(stockLeMatch[2], 10);
      filtered = filtered.filter(p => stockLeMatch[1] === '<=' ? p.stock_quantity <= maxStock : p.stock_quantity < maxStock);
    }

    // Filter by price <= or < or >= or >
    const priceLeMatch = sql.match(/price\s*(<=|<)\s*(\d+)/i);
    if (priceLeMatch) {
      const maxPrice = parseInt(priceLeMatch[2], 10);
      filtered = filtered.filter(p => priceLeMatch[1] === '<=' ? p.price <= maxPrice : p.price < maxPrice);
    }
    const priceGeMatch = sql.match(/price\s*(>=|>)\s*(\d+)/i);
    if (priceGeMatch) {
      const minPrice = parseInt(priceGeMatch[2], 10);
      filtered = filtered.filter(p => priceGeMatch[1] === '>=' ? p.price >= minPrice : p.price > minPrice);
    }

    // Handle ORDER BY
    if (lower.includes('order by price asc')) {
      filtered.sort((a, b) => a.price - b.price || b.stock_quantity - a.stock_quantity);
    } else if (lower.includes('order by price desc')) {
      filtered.sort((a, b) => b.price - a.price || b.stock_quantity - a.stock_quantity);
    } else if (lower.includes('order by stock_quantity asc')) {
      filtered.sort((a, b) => a.stock_quantity - b.stock_quantity);
    } else if (lower.includes('order by stock_quantity desc')) {
      filtered.sort((a, b) => b.stock_quantity - a.stock_quantity);
    } else if (lower.includes('order by brand desc')) {
      filtered.sort((a, b) => b.brand.localeCompare(a.brand) || a.color.localeCompare(b.color) || a.size.localeCompare(b.size));
    } else if (lower.includes('order by brand') || lower.includes('order by brand asc')) {
      filtered.sort((a, b) => a.brand.localeCompare(b.brand) || a.color.localeCompare(b.color) || a.size.localeCompare(b.size));
    }

    // Handle LIMIT
    const limitMatch = sql.match(/limit\s+(\d+)/i);
    if (limitMatch) {
      filtered = filtered.slice(0, parseInt(limitMatch[1], 10));
    } else if (!lower.includes('limit')) {
      filtered = filtered.slice(0, 50);
    }

    // Format output columns based on query projection
    const hasDiscountCol = lower.includes('discount') || lower.includes('pct_discount');
    const cols = ['t_shirt_id', 'brand', 'color', 'size', 'price', 'stock_quantity', 'inventory_value'];
    if (hasDiscountCol) cols.push('pct_discount');

    const rows = filtered.map(p => {
      const r: Record<string, any> = {
        t_shirt_id: p.t_shirt_id,
        brand: p.brand,
        color: p.color,
        size: p.size,
        price: p.price,
        stock_quantity: p.stock_quantity,
        inventory_value: p.inventory_value
      };
      if (hasDiscountCol) r.pct_discount = p.discount_pct || 0;
      return r;
    });

    return {
      columns: cols,
      rows
    };
  }
}

export const inventoryStore = new InventoryStore();
