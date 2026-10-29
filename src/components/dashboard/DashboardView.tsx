import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, 
  Boxes, 
  DollarSign, 
  AlertTriangle, 
  ArrowRight, 
  RotateCw, 
  SlidersHorizontal,
  Filter,
  Sparkles,
  Info,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Database,
  Search,
  X,
  TrendingDown,
  Layers
} from 'lucide-react';
import { InventoryMetrics, ActiveDatasetMeta, CalculatedMetrics } from '../../types/inventory.ts';
import { apiFetch } from '../../utils/api.ts';
import { MetricCard } from '../ui/MetricCard.tsx';
import { StockBadge } from '../ui/Badge.tsx';

interface DashboardViewProps {
  metrics: InventoryMetrics | null;
  isLoading: boolean;
  onRefresh: () => void;
  onNavigateToInventory: () => void;
  onNavigateToSettings: () => void;
  lowStockThreshold: number;
  onSelectSuggestion?: (query: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics: fallbackMetrics,
  isLoading: isParentLoading,
  onRefresh,
  onNavigateToInventory,
  onNavigateToSettings,
  lowStockThreshold,
  onSelectSuggestion
}) => {
  const [datasetMeta, setDatasetMeta] = useState<ActiveDatasetMeta | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [dynamicMetrics, setDynamicMetrics] = useState<CalculatedMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; query: string; tag: string }>>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');

  // 1. Fetch Active Dataset Metadata & AI Suggestions
  const loadDatasetContext = useCallback(async () => {
    try {
      const [metaRes, suggRes] = await Promise.all([
        apiFetch('/api/dataset/meta'),
        apiFetch('/api/ai/suggestions')
      ]);

      if (metaRes.ok) {
        const meta: ActiveDatasetMeta = await metaRes.json();
        setDatasetMeta(meta);
        // Clear filters that don't belong to the new dataset dimensions
        setActiveFilters(prev => {
          const validKeys = new Set(meta.dimensions.map(d => d.key));
          const cleaned: Record<string, string> = {};
          for (const [k, v] of Object.entries(prev)) {
            if (validKeys.has(k)) cleaned[k] = v;
          }
          return cleaned;
        });
      }

      if (suggRes.ok) {
        const sugg = await suggRes.json();
        setSuggestions(Array.isArray(sugg) ? sugg : []);
      }
    } catch (err) {
      console.warn('Could not load dynamic dataset metadata:', err);
    }
  }, []);

  // 2. Fetch Calculated Metrics based on dynamic scope filters
  const fetchFilteredMetrics = useCallback(async (filters: Record<string, string>) => {
    setIsDataLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v && v !== 'all') {
          params.append(k, v);
        }
      }
      if (filterSearch.trim()) {
        params.append('search', filterSearch.trim());
      }

      const res = await apiFetch(`/api/dataset/metrics?${params.toString()}`);
      if (res.ok) {
        const calc: CalculatedMetrics = await res.json();
        setDynamicMetrics(calc);
      }
    } catch (err) {
      console.warn('Metrics calculation error:', err);
    } finally {
      setIsDataLoading(false);
    }
  }, [filterSearch]);

  useEffect(() => {
    loadDatasetContext();
  }, [loadDatasetContext]);

  useEffect(() => {
    fetchFilteredMetrics(activeFilters);
  }, [activeFilters, fetchFilteredMetrics]);

  const handleFilterChange = (dimensionKey: string, value: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      if (value === 'all' || !value) {
        delete next[dimensionKey];
      } else {
        next[dimensionKey] = value;
      }
      return next;
    });
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
    setFilterSearch('');
  };

  const activeFilterCount = Object.keys(activeFilters).length + (filterSearch.trim() ? 1 : 0);

  // Retail Ledger Color Palette for distributions (Forest Green, Sage, Burnt Orange, Slate, Ochre)
  const chartColors = ['#245C45', '#7E9F8B', '#C66A42', '#3D4A43', '#D48D3B', '#5A7568', '#A25936', '#87948B'];

  // Current metrics display source
  const totalProducts = dynamicMetrics ? dynamicMetrics.totalRecords : (fallbackMetrics?.totalProducts || 0);
  const totalUnits = dynamicMetrics ? dynamicMetrics.totalStock : (fallbackMetrics?.totalUnits || 0);
  const totalValue = dynamicMetrics ? dynamicMetrics.totalValue : (fallbackMetrics?.totalInventoryValue || 0);
  const lowStockCount = dynamicMetrics ? dynamicMetrics.lowStockCount : (fallbackMetrics?.lowStockCount || 0);
  const averagePrice = dynamicMetrics ? dynamicMetrics.averagePrice : (fallbackMetrics?.averagePrice || 0);
  const lowStockItems = dynamicMetrics ? dynamicMetrics.lowStockItems : (fallbackMetrics?.lowStockItems || []);

  const hasStock = datasetMeta ? datasetMeta.hasStock : true;
  const hasPrice = datasetMeta ? datasetMeta.hasPrice : true;
  const hasBrand = datasetMeta ? datasetMeta.hasBrand : true;
  const hasCategory = datasetMeta ? datasetMeta.hasCategory : false;

  // Active primary distribution for chart 1 & 2
  const primaryDistribution = (hasBrand && dynamicMetrics && dynamicMetrics.brandDistribution.length > 0)
    ? dynamicMetrics.brandDistribution.map(b => ({ label: b.brand, units: b.units, value: b.value, pct: b.pctOfTotalUnits, count: b.count }))
    : (hasCategory && dynamicMetrics && dynamicMetrics.categoryDistribution.length > 0)
    ? dynamicMetrics.categoryDistribution.map(c => ({ label: c.category, units: c.units, value: c.value, pct: c.pctOfTotalUnits, count: c.count }))
    : (dynamicMetrics?.productDistribution && dynamicMetrics.productDistribution.length > 0)
    ? dynamicMetrics.productDistribution.map(p => ({ label: p.product, units: p.units, value: p.value, pct: 0, count: p.count }))
    : fallbackMetrics?.brandDistribution.map(b => ({ label: b.brand, units: b.units, value: b.value, pct: b.pctOfTotalUnits, count: b.productCount })) || [];

  const maxUnits = Math.max(...primaryDistribution.map(d => d.units), 1);

  // Calculate SVG donut slices
  let cumulativeAngle = 0;
  const totalSliceUnits = primaryDistribution.reduce((acc, d) => acc + d.units, 0) || 1;
  const donutSlices = primaryDistribution.slice(0, 5).map((item, idx) => {
    const angle = (item.units / totalSliceUnits) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return {
      label: item.label,
      units: item.units,
      pct: Math.round((item.units / totalSliceUnits) * 100),
      startAngle,
      angle,
      color: chartColors[idx % chartColors.length]
    };
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto text-[#252B28]">
      {/* Top Header & Refresh Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E5DC] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#252B28]">
              Inventory Overview
            </h1>
            {datasetMeta?.isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#E8EFEA] text-[#245C45] border border-[#CCDACC]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#245C45]" />
                Live MySQL Sync
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#F7F6F0] text-[#555C56] border border-[#E4E5DC]">
                <FileSpreadsheet className="w-3 h-3 text-[#245C45]" />
                Snapshot Dataset
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#6F756F]">
            Merchandise planning ledger, stock valuation, and SKU health. Active source: <strong className="text-[#252B28] font-mono">{datasetMeta?.sourceName || 'atliq_tshirts'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateToSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#252B28] bg-white border border-[#E4E5DC] hover:bg-[#F7F6F0] rounded-md transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#6F756F]" />
            <span>Alert Threshold: ≤ {lowStockThreshold} units</span>
          </button>

          <button
            onClick={() => {
              onRefresh();
              loadDatasetContext();
              fetchFilteredMetrics(activeFilters);
            }}
            disabled={isParentLoading || isDataLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#245C45] hover:bg-[#1C4A37] rounded-md transition-colors disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isParentLoading || isDataLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Active Data Source & Snapshot Telemetry Banner */}
      <div className="p-3.5 rounded-md border border-[#E4E5DC] bg-white text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {datasetMeta?.sourceType === 'csv' ? (
            <FileSpreadsheet className="w-4 h-4 text-[#245C45] shrink-0" />
          ) : datasetMeta?.sourceType === 'pdf' ? (
            <FileText className="w-4 h-4 text-[#C66A42] shrink-0" />
          ) : (
            <Database className="w-4 h-4 text-[#245C45] shrink-0" />
          )}
          <div>
            <span className="font-semibold text-[#252B28]">
              {datasetMeta?.sourceType === 'csv'
                ? `CSV File Snapshot: ${datasetMeta.sourceName}`
                : datasetMeta?.sourceType === 'pdf'
                ? `PDF Catalog Document: ${datasetMeta.sourceName}`
                : `Connected Store Database: ${datasetMeta?.sourceName || 'atliq_tshirts'}`}
            </span>
            <span className="text-[#6F756F] ml-2">
              ({totalProducts.toLocaleString()} items active
              {datasetMeta?.sourceType !== 'mysql' ? ' · Snapshot locked' : ' · 30s background poll'})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-[#7A807A] font-mono tabular-nums">
            Updated: {datasetMeta?.lastUpdated ? new Date(datasetMeta.lastUpdated).toLocaleTimeString() : 'Just now'}
          </span>
          <button
            onClick={onNavigateToSettings}
            className="font-semibold text-[#245C45] hover:underline cursor-pointer"
          >
            Manage Sources &rarr;
          </button>
        </div>
      </div>

      {/* Missing Field Limitations Notice (Acceptance Test 7) */}
      {datasetMeta?.missingFieldsNotes && datasetMeta.missingFieldsNotes.length > 0 && (
        <div className="p-3.5 rounded-md border border-[#F2D7C7] bg-[#FCF8F5] text-[#8C4625] text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#C66A42] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Merchandise Schema Notes:</span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#A25936]">
              {datasetMeta.missingFieldsNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Dynamic Scope & Merchandise Filter Bar */}
      <div className="bg-white rounded-md border border-[#E4E5DC] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#245C45]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#252B28]">
              Merchandise Scope & Filtering
            </h2>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#C66A42] text-white">
                {activeFilterCount} Active
              </span>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={handleClearAllFilters}
              className="flex items-center gap-1 text-xs font-semibold text-[#B9473F] hover:underline cursor-pointer self-start sm:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Scope</span>
            </button>
          )}
        </div>

        {/* Dynamic Dropdowns Detected from Active Columns */}
        {datasetMeta?.dimensions && datasetMeta.dimensions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {datasetMeta.dimensions.map((dim) => {
              const currentVal = activeFilters[dim.key] || 'all';
              return (
                <div key={dim.key} className="space-y-1">
                  <label className="block text-[11px] font-medium text-[#6F756F]">
                    {dim.label} ({dim.uniqueValues.length})
                  </label>
                  <select
                    value={currentVal}
                    onChange={(e) => handleFilterChange(dim.key, e.target.value)}
                    className="w-full text-xs bg-[#F7F6F0] border border-[#E4E5DC] rounded-md px-2.5 py-1.5 font-medium text-[#252B28] focus:outline-hidden focus:border-[#245C45] focus:ring-1 focus:ring-[#245C45] cursor-pointer"
                  >
                    <option value="all">All {dim.label}s ({dim.uniqueValues.length})</option>
                    {dim.uniqueValues.map((val) => (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            {/* Keyword Search */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#6F756F]">
                Catalog Keyword Filter
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9BA19B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter active items..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full text-xs bg-[#F7F6F0] border border-[#E4E5DC] rounded-md pl-8 pr-2.5 py-1.5 text-[#252B28] placeholder-[#9BA19B] focus:outline-hidden focus:border-[#245C45] focus:ring-1 focus:ring-[#245C45]"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-xs text-[#7A807A] bg-[#F7F6F0] rounded-md">
            No categorical dimensions detected. Displaying consolidated merchandise catalog.
          </div>
        )}
      </div>

      {/* Live AI Recommendations (Understated Ledger Inquiry Bar) */}
      {suggestions.length > 0 && (
        <div className="bg-[#FFFFFF] rounded-md border border-[#E4E5DC] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#252B28]">
              <Sparkles className="w-3.5 h-3.5 text-[#245C45]" />
              <span>Suggested Merchandising Inquiries</span>
            </div>
            <span className="text-[11px] text-[#7A807A]">
              Contextual to {datasetMeta?.sourceName || 'active dataset'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (onSelectSuggestion) onSelectSuggestion(s.query);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-[#F7F6F0] hover:bg-[#EAEBE2] border border-[#E4E5DC] hover:border-[#D0D2C8] text-[#252B28] transition-colors cursor-pointer"
              >
                <span className="font-medium text-left">{s.query}</span>
                <span className="text-[10px] text-[#6F756F] bg-white px-1.5 py-0.2 rounded border border-[#E4E5DC]">
                  {s.tag}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compact 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <MetricCard
          label="Catalog SKUs"
          value={totalProducts.toLocaleString()}
          subtext={activeFilterCount > 0 ? 'Filtered selection' : 'Total unique records'}
          icon={Package}
          tooltipText="Total count of inventory items matching active filters."
        />

        <MetricCard
          label="Units in Stock"
          value={hasStock && totalUnits !== null ? totalUnits.toLocaleString() : 'N/A'}
          subtext={hasStock && totalUnits !== null && totalProducts > 0 ? `Avg. ${Math.round(totalUnits / totalProducts)} units / SKU` : 'Quantity not present'}
          icon={Boxes}
          tooltipText={hasStock ? 'Total physical inventory units across matching items.' : 'Quantity column not available in dataset.'}
        />

        <MetricCard
          label="Stock Valuation"
          value={hasPrice && hasStock && totalValue !== null ? `$${totalValue.toLocaleString()}` : 'N/A'}
          subtext={hasPrice && averagePrice !== null ? `Avg. price: $${averagePrice}` : 'Price/stock missing'}
          icon={DollarSign}
          tooltipText={hasPrice && hasStock ? 'Calculated deterministically as SUM(price * stock_quantity).' : 'Requires both price and stock quantity.'}
        />

        <MetricCard
          label="Low-Stock Alerts"
          value={hasStock && lowStockCount !== null ? lowStockCount.toLocaleString() : 'N/A'}
          subtext={hasStock ? `Items ≤ ${lowStockThreshold} units` : 'No stock column'}
          icon={AlertTriangle}
          tooltipText={hasStock ? 'SKUs at or below replenishment threshold.' : 'Stock column unavailable.'}
          isAlert={hasStock && (lowStockCount || 0) > 0}
        />
      </div>

      {/* Inventory Visualizations: Stock by Brand & Inventory Concentration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Stock by Brand / Dimension (Clean Proportionate Bars) */}
        <div className="bg-white rounded-md border border-[#E4E5DC] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E5DC]">
              <div>
                <h2 className="text-sm font-bold text-[#252B28]">
                  {hasBrand ? 'Stock by Brand' : hasCategory ? 'Stock by Category' : 'Product Distribution'}
                </h2>
                <p className="text-xs text-[#6F756F]">
                  {hasBrand ? 'Available units per brand sorted by quantity' : hasCategory ? 'Available units per category' : 'Item distribution'}
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#6F756F]">
                {primaryDistribution.length} Groups
              </span>
            </div>

            {primaryDistribution.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8E958E]">
                No distribution data available for current selection.
              </div>
            ) : (
              <div className="space-y-3.5">
                {primaryDistribution.slice(0, 6).map((b, idx) => {
                  const widthPct = Math.round((b.units / maxUnits) * 100);
                  const color = chartColors[idx % chartColors.length];
                  return (
                    <div key={b.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#252B28]">{b.label}</span>
                        <div className="flex items-center gap-2 font-mono tabular-nums text-xs">
                          <span className="font-semibold text-[#252B28]">{b.units.toLocaleString()} units</span>
                          {b.pct > 0 && <span className="text-[#7A807A]">({b.pct}%)</span>}
                        </div>
                      </div>
                      <div className="h-2 w-full bg-[#EAEBE2] rounded-xs overflow-hidden">
                        <div
                          className="h-full rounded-xs transition-all duration-300"
                          style={{ width: `${Math.max(4, widthPct)}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 mt-4 border-t border-[#E4E5DC] text-[11px] text-[#7A807A] flex items-center justify-between">
            <span>Proportional physical availability</span>
            <span className="font-mono">Top {Math.min(6, primaryDistribution.length)} of {primaryDistribution.length}</span>
          </div>
        </div>

        {/* Chart 2: Inventory Concentration (SVG Donut with Retail Ledger Palette) */}
        <div className="bg-white rounded-md border border-[#E4E5DC] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E5DC]">
              <div>
                <h2 className="text-sm font-bold text-[#252B28]">Inventory Concentration</h2>
                <p className="text-xs text-[#6F756F]">Share of total stock across top merchandise segments</p>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#6F756F]">
                {primaryDistribution.length} Segments
              </span>
            </div>

            {primaryDistribution.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8E958E]">
                No concentration data available.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                <div className="relative w-36 h-36 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {donutSlices.map((slice, idx) => {
                      const strokeDasharray = `${(slice.pct * 251.2) / 100} 251.2`;
                      const strokeDashoffset = -((slice.startAngle / 360) * 251.2);
                      return (
                        <circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth="12"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-200"
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-base font-bold font-mono tabular-nums text-[#252B28]">
                      {totalUnits !== null ? totalUnits.toLocaleString() : totalProducts}
                    </span>
                    <span className="text-[9px] uppercase font-semibold text-[#7A807A] tracking-wider">
                      {totalUnits !== null ? 'Units' : 'Items'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1.5 w-full sm:w-auto">
                  {donutSlices.map((item) => (
                    <div key={item.label} className="flex items-center justify-between sm:justify-start gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-[#252B28] truncate max-w-[120px]">{item.label}</span>
                      </div>
                      <span className="font-mono tabular-nums text-[#6F756F] text-xs">
                        {item.pct}% ({item.units.toLocaleString()})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 mt-4 border-t border-[#E4E5DC] text-[11px] text-[#7A807A] flex items-center justify-between">
            <span>Derived from active ledger counts</span>
            <span className="font-mono">{hasBrand ? 'Brand share' : 'Category share'}</span>
          </div>
        </div>
      </div>

      {/* First-Class Merchandising Planning & Replenishment Table */}
      <div className="bg-white rounded-md border border-[#E4E5DC] overflow-hidden">
        <div className="p-4 md:p-5 border-b border-[#E4E5DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#252B28]">
                Replenishment Risk & Low-Stock Alerts
              </h2>
              {hasStock && (
                <span className="px-2 py-0.5 text-xs font-mono tabular-nums bg-[#F9ECEB] text-[#B9473F] border border-[#F0CECA] rounded font-semibold">
                  {lowStockItems.length} SKUs at Risk
                </span>
              )}
            </div>
            <p className="text-xs text-[#6F756F] mt-0.5">
              {hasStock
                ? `Products at or below reorder threshold (≤ ${lowStockThreshold} units). Prioritized for replenishment.`
                : 'Stock quantity column not detected in current dataset schema.'}
            </p>
          </div>
          <button
            onClick={onNavigateToInventory}
            className="flex items-center gap-1 text-xs font-semibold text-[#245C45] hover:underline shrink-0 cursor-pointer"
          >
            <span>Open Full Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!hasStock ? (
          <div className="p-8 text-center text-xs text-[#7A807A]">
            Stock quantity column is missing in this dataset. Replenishment risk cannot be calculated.
          </div>
        ) : lowStockItems.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-9 h-9 rounded bg-[#E8EFEA] text-[#245C45] flex items-center justify-center mx-auto mb-2.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-[#252B28]">All inventory is healthy</p>
            <p className="text-xs text-[#6F756F] mt-0.5">No products fall at or below {lowStockThreshold} units.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F7F6F0] text-[#555C56] font-semibold border-b border-[#E4E5DC]">
                <tr>
                  <th className="py-2.5 px-4">Product / SKU Identifier</th>
                  {hasBrand && <th className="py-2.5 px-4">Brand</th>}
                  <th className="py-2.5 px-4 text-right">Available Qty</th>
                  {hasPrice && <th className="py-2.5 px-4 text-right">Unit Price</th>}
                  {hasPrice && <th className="py-2.5 px-4 text-right">Inventory Value</th>}
                  <th className="py-2.5 px-4 text-right">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEBE2] font-mono tabular-nums">
                {lowStockItems.slice(0, 8).map((rawItem, idx) => {
                  const item = rawItem as Record<string, any>;
                  const name = item._name || item.name || item.product_name || `SKU #${item.id || item.t_shirt_id || idx + 1}`;
                  const stock = item._stock ?? item.stock_quantity ?? item.quantity ?? 0;
                  const price = item._price ?? item.price;
                  const val = (price !== undefined && stock !== undefined) ? Number(price) * Number(stock) : null;
                  return (
                    <tr key={idx} className="hover:bg-[#F9FAF6] transition-colors font-sans">
                      <td className="py-2.5 px-4 font-medium text-[#252B28]">
                        {name}
                      </td>
                      {hasBrand && (
                        <td className="py-2.5 px-4 font-semibold text-[#4A524C]">
                          {item.brand || '—'}
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#B9473F]">
                        {stock} units
                      </td>
                      {hasPrice && (
                        <td className="py-2.5 px-4 text-right font-mono text-[#555C56]">
                          {price !== undefined ? `$${Number(price).toFixed(2)}` : '—'}
                        </td>
                      )}
                      {hasPrice && (
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#252B28]">
                          {val !== null ? `$${val.toFixed(2)}` : '—'}
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-right">
                        <StockBadge status={stock === 0 ? 'out_of_stock' : 'low_stock'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
