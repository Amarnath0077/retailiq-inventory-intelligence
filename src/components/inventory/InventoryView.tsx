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
  Filter
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
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStore, setSelectedStore] = useState('all');
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

  const brandDim = datasetMeta?.dimensions.find(d => d.key === 'brand');
  const categoryDim = datasetMeta?.dimensions.find(d => d.key === 'category');
  const storeDim = datasetMeta?.dimensions.find(d => d.key === 'store');
  const colorDim = datasetMeta?.dimensions.find(d => d.key === 'color');
  const sizeDim = datasetMeta?.dimensions.find(d => d.key === 'size');

  const brands = brandDim?.uniqueValues || [];
  const categories = categoryDim?.uniqueValues || [];
  const stores = storeDim?.uniqueValues || [];
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
      setError(err.message || 'An error occurred while fetching inventory');
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedBrand, selectedColor, selectedSize, selectedStatus, sortParameter, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleSortDropdownChange = (value: string) => {
    setSortParameter(value);
    if (value === 'Alphabetical (A-Z)') {
      setSortBy('brand');
      setSortOrder('asc');
    } else if (value === 'Alphabetical (Z-A)') {
      setSortBy('brand');
      setSortOrder('desc');
    } else if (value === 'price_asc') {
      setSortBy('price');
      setSortOrder('asc');
    } else if (value === 'price_desc') {
      setSortBy('price');
      setSortOrder('desc');
    } else if (value === 'stock_desc') {
      setSortBy('stock_quantity');
      setSortOrder('desc');
    } else if (value === 'stock_asc') {
      setSortBy('stock_quantity');
      setSortOrder('asc');
    } else if (value === 'value_desc') {
      setSortBy('inventory_value');
      setSortOrder('desc');
    } else {
      setSortBy('t_shirt_id');
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleColumnSort = (column: string) => {
    if (column === 'brand') {
      if (sortParameter === 'Alphabetical (A-Z)') {
        handleSortDropdownChange('Alphabetical (Z-A)');
      } else {
        handleSortDropdownChange('Alphabetical (A-Z)');
      }
      return;
    }

    if (column === 'price') {
      handleSortDropdownChange(sortParameter === 'price_asc' ? 'price_desc' : 'price_asc');
      return;
    }

    if (column === 'stock_quantity') {
      handleSortDropdownChange(sortParameter === 'stock_desc' ? 'stock_asc' : 'stock_desc');
      return;
    }

    if (column === 'inventory_value') {
      handleSortDropdownChange(sortParameter === 'value_desc' ? 't_shirt_id_asc' : 'value_desc');
      return;
    }

    if (sortBy === column) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
    } else {
      setSortBy(column);
      setSortOrder('asc');
      setSortParameter(`${column}_asc`);
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedBrand('all');
    setSelectedColor('all');
    setSelectedSize('all');
    setSelectedStatus('all');
    handleSortDropdownChange('Alphabetical (A-Z)');
    setPage(1);
  };

  const hasActiveFilters = search.trim() !== '' || 
    selectedBrand !== 'all' || 
    selectedColor !== 'all' || 
    selectedSize !== 'all' || 
    selectedStatus !== 'all' ||
    sortParameter !== 'Alphabetical (A-Z)';

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

  const renderSortIcon = (column: string) => {
    if (column === 'brand') {
      if (sortParameter === 'Alphabetical (A-Z)') {
        return <ChevronUp className="w-3.5 h-3.5 text-[#245C45]" />;
      }
      if (sortParameter === 'Alphabetical (Z-A)') {
        return <ChevronDown className="w-3.5 h-3.5 text-[#245C45]" />;
      }
    }

    if (sortBy !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-[#9BA19B] opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' 
      ? <ChevronUp className="w-3.5 h-3.5 text-[#245C45]" />
      : <ChevronDown className="w-3.5 h-3.5 text-[#245C45]" />;
  };

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-7xl mx-auto text-[#252B28]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E5DC] pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#252B28]">
            Merchandise Catalog
          </h1>
          <p className="mt-1 text-xs text-[#6F756F]">
            Detailed product ledger, unit availability, and valuation per SKU.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchInventory}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#252B28] bg-white border border-[#E4E5DC] hover:bg-[#F7F6F0] rounded-md transition-colors cursor-pointer"
            title="Refresh inventory dataset"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#245C45]' : 'text-[#6F756F]'}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#245C45] hover:bg-[#1C4A37] rounded-md transition-colors cursor-pointer active:scale-[0.99]"
            title="Export filtered catalog as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Toolbar / Filters (Ledger Control Bar) */}
      <div className="bg-white rounded-md border border-[#E4E5DC] p-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA19B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by product name, brand, color, SKU..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#F7F6F0] border border-[#E4E5DC] rounded-md text-[#252B28] placeholder-[#9BA19B] focus:outline-hidden focus:border-[#245C45] focus:ring-1 focus:ring-[#245C45] transition-colors"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9BA19B] hover:text-[#252B28] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {brands.length > 0 && (
              <select
                value={selectedBrand}
                onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
                className="px-2.5 py-1.5 text-xs bg-[#F7F6F0] border border-[#E4E5DC] rounded-md text-[#252B28] font-medium focus:outline-hidden focus:border-[#245C45] focus:ring-1 focus:ring-[#245C45] cursor-pointer"
              >
                <option value="all">All Brands ({brands.length})</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}

            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                className="px-2.5 py-1.5 text-xs bg-[#F7F6F0] border border-[#E4E5DC] rounded-md text-[#252B28] font-medium focus:outline-hidden focus:border-[#245C45] focus:ring-1 focus:ring-[#245C45] cursor-pointer"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {colors.length > 0 && (
              <select
                value={selectedColor}
                onChange={(e) => { setSelectedColor(e.target.value); setPage(1); }}
                className="px-2.5 py-1.5 text-xs bg-[#F7F6F0] border border-[#E4E5DC] rounded-md text-[#252B28] font-medium focus:outline-hidden focus:border-[#245C45] focus:ring-1 focus:ring-[#245C45] cursor-pointer"
              >
                <option value="all">All Colors</option>
                {colors.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {sizes.length > 0 && (
              <select
                value={selectedSize}
                onChange={(e) => { setSelectedSize(e.target.value); setPage(1); }}
                className="px-2.5 py-1.5 text-xs bg-[#F7F6F0] border border-[#E4E5DC] rounded-md text-[#252B28] font-medium focus:outline-hidden focus:border-[#245C45] focus:ring-1 focus:ring-[#245C45] cursor-pointer"
              >
                <option value="all">All Sizes</option>
                {sizes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value as any); setPage(1); }}
              className="px-2.5 py-1.5 text-xs bg-[#F7F6F0] border border-[#E4E5DC] rounded-md text-[#252B28] font-medium focus:outline-hidden focus:border-[#245C45] focus:ring-1 focus:ring-[#245C45] cursor-pointer"
            >
              <option value="all">All Stock Statuses</option>
              <option value="in_stock">In Stock (&gt; {lowStockThreshold})</option>
              <option value="low_stock">Low Stock (≤ {lowStockThreshold})</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>

            <select
              value={sortParameter}
              onChange={(e) => handleSortDropdownChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#F7F6F0] border border-[#CCD9CD] text-[#245C45] font-semibold rounded-md focus:outline-hidden focus:border-[#245C45] cursor-pointer"
              title="Select catalog sorting order"
            >
              <option value="Alphabetical (A-Z)">Sort: Alphabetical (A-Z)</option>
              <option value="Alphabetical (Z-A)">Sort: Alphabetical (Z-A)</option>
              <option value="t_shirt_id_asc">Sort: Product ID (Default)</option>
              <option value="price_asc">Sort: Price (Low to High)</option>
              <option value="price_desc">Sort: Price (High to Low)</option>
              <option value="stock_desc">Sort: Stock Quantity (High to Low)</option>
              <option value="stock_asc">Sort: Stock Quantity (Low to High)</option>
              <option value="value_desc">Sort: Inventory Value (High to Low)</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#B9473F] hover:bg-[#F9ECEB] rounded-md transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary Bar */}
        {productsData && (
          <div className="pt-2 border-t border-[#E4E5DC] flex flex-wrap items-center justify-between text-xs text-[#6F756F] gap-2 font-mono tabular-nums">
            <div className="flex items-center gap-2">
              <span className="font-sans text-[#555C56]">Matched:</span>
              <strong className="text-[#252B28]">{productsData.total} SKUs</strong>
              <span className="text-[#C5C8C0]" aria-hidden="true">·</span>
              <span>Total Units: <strong className="text-[#252B28]">{productsData.filterSummary.totalUnits.toLocaleString()}</strong></span>
              <span className="text-[#C5C8C0]" aria-hidden="true">·</span>
              <span>Catalog Valuation: <strong className="text-[#245C45]">${productsData.filterSummary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            </div>
            <div className="text-[11px] font-sans text-[#7A807A]">
              Page {productsData.page} of {productsData.totalPages}
            </div>
          </div>
        )}
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-md border border-[#E4E5DC] overflow-hidden">
        {isLoading && !productsData ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-9 bg-[#F7F6F0] rounded-xs animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <p className="text-xs text-[#B9473F] font-semibold">{error}</p>
            <button
              onClick={fetchInventory}
              className="mt-2 px-3 py-1 text-xs bg-[#F7F6F0] hover:bg-[#EAEBE2] rounded-md border border-[#E4E5DC] cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !productsData || productsData.total === 0 ? (
          <div className="p-12 text-center">
            <div className="w-10 h-10 rounded bg-[#F7F6F0] text-[#7A807A] flex items-center justify-center mx-auto mb-2.5">
              <PackageSearch className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#252B28] mb-0.5">No inventory data available</h3>
            <p className="text-xs text-[#6F756F] mb-3 max-w-sm mx-auto">
              No inventory data available. Connect your database or import a CSV/PDF file to get started.
            </p>
          </div>
        ) : productsData.products.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-10 h-10 rounded bg-[#F7F6F0] text-[#7A807A] flex items-center justify-center mx-auto mb-2.5">
              <PackageSearch className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#252B28] mb-0.5">No products match current criteria</h3>
            <p className="text-xs text-[#6F756F] mb-3 max-w-sm mx-auto">
              Adjust your search keywords or clear filters to view available inventory.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-[#245C45] text-white text-xs font-semibold rounded-md hover:bg-[#1C4A37] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F7F6F0] text-[#555C56] font-semibold border-b border-[#E4E5DC] select-none">
                  <tr>
                    <th 
                      onClick={() => handleColumnSort('t_shirt_id')}
                      className="py-2.5 px-4 cursor-pointer hover:bg-[#EAEBE2] transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>SKU ID</span>
                        {renderSortIcon('t_shirt_id')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('brand')}
                      className="py-2.5 px-4 cursor-pointer hover:bg-[#EAEBE2] transition-colors group"
                      title="Click to toggle Alphabetical sort"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Brand</span>
                        {renderSortIcon('brand')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('color')}
                      className="py-2.5 px-4 cursor-pointer hover:bg-[#EAEBE2] transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Color</span>
                        {renderSortIcon('color')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('size')}
                      className="py-2.5 px-4 cursor-pointer hover:bg-[#EAEBE2] transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Size</span>
                        {renderSortIcon('size')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('price')}
                      className="py-2.5 px-4 text-right cursor-pointer hover:bg-[#EAEBE2] transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Unit Price</span>
                        {renderSortIcon('price')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('stock_quantity')}
                      className="py-2.5 px-4 text-right cursor-pointer hover:bg-[#EAEBE2] transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Stock Qty</span>
                        {renderSortIcon('stock_quantity')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleColumnSort('inventory_value')}
                      className="py-2.5 px-4 text-right cursor-pointer hover:bg-[#EAEBE2] transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Valuation</span>
                        {renderSortIcon('inventory_value')}
                      </div>
                    </th>
                    <th className="py-2.5 px-4 text-right">
                      <span>Status</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEBE2] font-mono tabular-nums">
                  {productsData.products.map((item) => (
                    <tr 
                      key={item.t_shirt_id} 
                      className="hover:bg-[#F9FAF6] transition-colors font-sans"
                    >
                      <td className="py-2.5 px-4 font-mono text-[#6F756F] font-medium">
                        #{item.t_shirt_id}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#252B28]">
                        {item.brand}
                      </td>
                      <td className="py-2.5 px-4 text-[#555C56]">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-xs border border-[#CCD0C5]"
                            style={{
                              backgroundColor: 
                                item.color.toLowerCase() === 'white' ? '#FFFFFF' :
                                item.color.toLowerCase() === 'black' ? '#252B28' :
                                item.color.toLowerCase() === 'red' ? '#B9473F' :
                                item.color.toLowerCase() === 'blue' ? '#3B6B8A' : '#A2A9A0'
                            }}
                          />
                          <span>{item.color}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#252B28]">
                        {item.size}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[#555C56]">
                        ${item.price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#252B28]">
                        {item.stock_quantity}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#245C45]">
                        ${item.inventory_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <StockBadge status={item.stock_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 border-t border-[#E4E5DC] bg-[#F7F6F0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6F756F]">
              <div>
                Showing <span className="font-semibold text-[#252B28] font-mono tabular-nums">{(page - 1) * limit + 1}</span> to{' '}
                <span className="font-semibold text-[#252B28] font-mono tabular-nums">{Math.min(page * limit, productsData.total)}</span> of{' '}
                <span className="font-semibold text-[#252B28] font-mono tabular-nums">{productsData.total}</span> SKUs
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1 rounded-md border border-[#E4E5DC] bg-white hover:bg-[#EAEBE2] text-[#252B28] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <div className="px-2.5 py-1 font-mono font-medium text-[#252B28]">
                  {page} / {productsData.totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(productsData.totalPages, p + 1))}
                  disabled={page >= productsData.totalPages}
                  className="px-2.5 py-1 rounded-md border border-[#E4E5DC] bg-white hover:bg-[#EAEBE2] text-[#252B28] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
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
