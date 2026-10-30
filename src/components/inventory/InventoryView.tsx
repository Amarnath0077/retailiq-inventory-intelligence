import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Download, 
  RotateCw, 
  X, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  PackageSearch,
  Filter,
  SlidersHorizontal,
  Boxes,
  DollarSign,
  Tag,
  Layers,
  Sparkles
} from 'lucide-react';
import { Product, InventoryListResponse, ActiveDatasetMeta } from '../../types/inventory.ts';
import { apiFetch } from '../../utils/api.ts';
import { StockBadge } from '../ui/Badge.tsx';

interface InventoryViewProps {
  lowStockThreshold: number;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ lowStockThreshold }) => {
  const [productsData, setProductsData] = useState<InventoryListResponse | null>(null);
  const [datasetMeta, setDatasetMeta] = useState<ActiveDatasetMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedColor, setSelectedColor] = useState('all');
  const [selectedSize, setSelectedSize] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [sortParameter, setSortParameter] = useState<string>('Alphabetical (A-Z)');
  const [sortBy, setSortBy] = useState<string>('brand');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const limit = 14;

  useEffect(() => {
    apiFetch('/api/dataset/meta')
      .then(res => res.json())
      .then(meta => setDatasetMeta(meta))
      .catch(() => {});
  }, []);

  const brandDim = datasetMeta?.dimensions?.find(d => d.key === 'brand');
  const categoryDim = datasetMeta?.dimensions?.find(d => d.key === 'category');
  const colorDim = datasetMeta?.dimensions?.find(d => d.key === 'color');
  const sizeDim = datasetMeta?.dimensions?.find(d => d.key === 'size');

  const brands = brandDim?.uniqueValues || [];
  const colors = colorDim?.uniqueValues || [];
  const sizes = sizeDim?.uniqueValues || [];

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (selectedBrand !== 'all') params.append('brand', selectedBrand);
      if (selectedColor !== 'all') params.append('color', selectedColor);
      if (selectedSize !== 'all') params.append('size', selectedSize);
      if (selectedStatus !== 'all') params.append('stockStatus', selectedStatus);
      
      params.append('sort', sortParameter);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await apiFetch(`/api/inventory?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load inventory dataset');
      const data: InventoryListResponse = await res.json();
      setProductsData(data);
    } catch (err: any) {
      setError(err.message || 'Error communicating with catalog server');
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedBrand, selectedColor, selectedSize, selectedStatus, sortParameter, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedBrand('all');
    setSelectedColor('all');
    setSelectedSize('all');
    setSelectedStatus('all');
    setSortParameter('Alphabetical (A-Z)');
    setSortBy('brand');
    setSortOrder('asc');
    setPage(1);
  };

  const handleColumnSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' 
      ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
      : <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />;
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.append('search', search.trim());
    if (selectedBrand !== 'all') params.append('brand', selectedBrand);
    if (selectedColor !== 'all') params.append('color', selectedColor);
    if (selectedSize !== 'all') params.append('size', selectedSize);
    if (selectedStatus !== 'all') params.append('stockStatus', selectedStatus);
    params.append('sort', sortParameter);
    params.append('sortBy', sortBy);
    params.append('sortOrder', sortOrder);

    window.location.href = `/api/export?${params.toString()}`;
  };

  const activeFilterCount = (selectedBrand !== 'all' ? 1 : 0) +
    (selectedColor !== 'all' ? 1 : 0) +
    (selectedSize !== 'all' ? 1 : 0) +
    (selectedStatus !== 'all' ? 1 : 0) +
    (search.trim() ? 1 : 0);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Merchandise Catalog
          </h1>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            Real-time stock levels, pricing matrices, and inventory allocation ledger.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={!productsData || productsData.total === 0}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-2xs hover:shadow-xs disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchInventory}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-2xs disabled:opacity-40 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 text-indigo-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 space-y-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          {/* Keyword Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by SKU, product, brand..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Brand Filter */}
          <div>
            <select
              value={selectedBrand}
              onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors cursor-pointer"
            >
              <option value="all">All Brands ({brands.length})</option>
              {brands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Color Filter */}
          <div>
            <select
              value={selectedColor}
              onChange={(e) => { setSelectedColor(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors cursor-pointer"
            >
              <option value="all">All Colors ({colors.length})</option>
              {colors.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Size Filter */}
          <div>
            <select
              value={selectedSize}
              onChange={(e) => { setSelectedSize(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors cursor-pointer"
            >
              <option value="all">All Sizes ({sizes.length})</option>
              {sizes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Stock Condition Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value as any); setPage(1); }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors cursor-pointer"
            >
              <option value="all">All Stock Statuses</option>
              <option value="in_stock">Healthy Stock</option>
              <option value="low_stock">Low Stock (≤ {lowStockThreshold})</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
          </div>
        </div>

        {/* Filter Summary Bar */}
        {productsData && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3 font-mono tabular-nums">
            <div className="flex items-center gap-3">
              <span className="font-sans text-slate-500 font-medium">Matched:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                {productsData.total} SKUs
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span>Total Units: <strong className="text-blue-700 font-bold">{productsData.filterSummary?.totalUnits?.toLocaleString() || 0}</strong></span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span>Catalog Valuation: <strong className="text-emerald-700 font-bold">${productsData.filterSummary?.totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</strong></span>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset {activeFilterCount} Filters</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Catalog Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading && !productsData ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-xs text-rose-600 font-bold mb-3">{error}</p>
            <button
              onClick={fetchInventory}
              className="px-4 py-2 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !productsData || productsData.total === 0 ? (
          <div className="p-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <PackageSearch className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">No inventory data available</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No inventory data available. Connect your database or import a CSV/PDF file to get started.
            </p>
          </div>
        ) : productsData.products.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <PackageSearch className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">No products match current criteria</h3>
            <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
              Adjust your search keywords or clear filters to view available inventory.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20 cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th 
                      onClick={() => handleColumnSort('t_shirt_id')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>SKU ID</span>
                        {renderSortIcon('t_shirt_id')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('brand')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Brand / Vendor</span>
                        {renderSortIcon('brand')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('color')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Color / Category</span>
                        {renderSortIcon('color')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('size')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Size / Spec</span>
                        {renderSortIcon('size')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('price')}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Unit Price</span>
                        {renderSortIcon('price')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('stock_quantity')}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Available Units</span>
                        {renderSortIcon('stock_quantity')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('inventory_value')}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Valuation</span>
                        {renderSortIcon('inventory_value')}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <span>Condition</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {productsData.products.map((item) => (
                    <tr 
                      key={item.t_shirt_id} 
                      className="hover:bg-slate-50/80 transition-colors font-sans"
                    >
                      <td className="py-3 px-4 font-mono text-slate-500 font-bold">
                        #{item.t_shirt_id}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 text-xs font-semibold">
                          {item.brand}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {item.color}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono font-medium">
                        {item.size}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                        ${item.price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                        {item.stock_quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        ${item.inventory_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <StockBadge status={
                          item.stock_quantity === 0 
                            ? 'out_of_stock' 
                            : item.stock_quantity <= 5 
                            ? 'critical' 
                            : item.stock_status
                        } />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div>
                Showing <strong className="text-slate-800 font-mono">{(page - 1) * limit + 1}</strong> to{' '}
                <strong className="text-slate-800 font-mono">{Math.min(page * limit, productsData.total)}</strong> of{' '}
                <strong className="text-slate-800 font-mono">{productsData.total}</strong> SKUs
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <div className="px-3 py-1 font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  {page} / {productsData.totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(productsData.totalPages, p + 1))}
                  disabled={page >= productsData.totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
