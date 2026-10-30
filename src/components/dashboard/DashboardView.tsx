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
  Layers,
  UploadCloud,
  PlusCircle,
  Lock
} from 'lucide-react';
import { InventoryMetrics, ActiveDatasetMeta, CalculatedMetrics } from '../../types/inventory.ts';
import { apiFetch } from '../../utils/api.ts';
import { MetricCard } from '../ui/MetricCard.tsx';
import { StockBadge } from '../ui/Badge.tsx';
import { FileImportModal } from '../import/FileImportModal.tsx';
import { DatabaseConnectModal } from '../database/DatabaseConnectModal.tsx';

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

  // Modals for Data Connection & Import
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

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
        setActiveFilters(prev => {
          const validKeys = new Set(meta.dimensions?.map(d => d.key) || []);
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

  const handleDataUpdate = () => {
    loadDatasetContext();
    fetchFilteredMetrics(activeFilters);
    onRefresh();
  };

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

  // Total products determination
  const totalProducts = dynamicMetrics ? dynamicMetrics.totalRecords : (fallbackMetrics?.totalProducts || 0);
  const totalUnits = dynamicMetrics ? dynamicMetrics.totalStock : (fallbackMetrics?.totalUnits || 0);
  const totalValue = dynamicMetrics ? dynamicMetrics.totalValue : (fallbackMetrics?.totalInventoryValue || 0);
  const lowStockCount = dynamicMetrics ? dynamicMetrics.lowStockCount : (fallbackMetrics?.lowStockCount || 0);
  const averagePrice = dynamicMetrics ? dynamicMetrics.averagePrice : (fallbackMetrics?.averagePrice || 0);
  const lowStockItems = dynamicMetrics ? dynamicMetrics.lowStockItems : (fallbackMetrics?.lowStockItems || []);

  // STRICT CHECK: Does user have any connected inventory data?
  const hasData = Boolean(
    (datasetMeta && datasetMeta.totalRecords > 0) ||
    totalProducts > 0
  );

  const hasStock = datasetMeta ? datasetMeta.hasStock : true;
  const hasPrice = datasetMeta ? datasetMeta.hasPrice : true;
  const hasBrand = datasetMeta ? datasetMeta.hasBrand : true;
  const hasCategory = datasetMeta ? datasetMeta.hasCategory : false;

  // Chart Palette
  const chartColors = ['#245C45', '#7E9F8B', '#C66A42', '#3D4A43', '#D48D3B', '#5A7568', '#A25936', '#87948B'];

  const primaryDistribution = (hasBrand && dynamicMetrics && dynamicMetrics.brandDistribution.length > 0)
    ? dynamicMetrics.brandDistribution.map(b => ({ label: b.brand, units: b.units, value: b.value, pct: b.pctOfTotalUnits, count: b.count }))
    : (hasCategory && dynamicMetrics && dynamicMetrics.categoryDistribution.length > 0)
    ? dynamicMetrics.categoryDistribution.map(c => ({ label: c.category, units: c.units, value: c.value, pct: c.pctOfTotalUnits, count: c.count }))
    : (dynamicMetrics?.productDistribution && dynamicMetrics.productDistribution.length > 0)
    ? dynamicMetrics.productDistribution.map(p => ({ label: p.product, units: p.units, value: p.value, pct: 0, count: p.count }))
    : fallbackMetrics?.brandDistribution.map(b => ({ label: b.brand, units: b.units, value: b.value, pct: b.pctOfTotalUnits, count: b.productCount })) || [];

  const maxUnits = Math.max(...primaryDistribution.map(d => d.units), 1);

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
      {/* Top Header & Data Source Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E5DC] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#252B28]">
              Inventory Overview
            </h1>
            {hasData ? (
              datasetMeta?.isLive ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#E8EFEA] text-[#245C45] border border-[#CCDACC]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#245C45]" />
                  Live MySQL ({datasetMeta.sourceName})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#F7F6F0] text-[#555C56] border border-[#E4E5DC]">
                  <FileSpreadsheet className="w-3 h-3 text-[#245C45]" />
                  {datasetMeta?.sourceName || 'Imported File'}
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#F9ECEB] text-[#B9473F] border border-[#F0CECA]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B9473F]" />
                No Data Connected
              </span>
            )}
          </div>
          <p className="text-xs text-[#6F756F] mt-1">
            {hasData
              ? 'Real-time multi-dimensional inventory ledger and replenishment analytics.'
              : 'Connect your business database or import a file to initialize your inventory workspace.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasData && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-[#CCDACC] bg-white text-[#245C45] hover:bg-[#E8EFEA] transition-colors cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Import File</span>
              </button>
              <button
                onClick={() => setIsDbModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-[#E4E5DC] bg-white text-[#555C56] hover:bg-[#EAEBE2] transition-colors cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Database</span>
              </button>
            </>
          )}

          <button
            onClick={handleDataUpdate}
            disabled={isDataLoading || isParentLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-[#E4E5DC] bg-white hover:bg-[#EAEBE2] text-[#252B28] transition-colors cursor-pointer disabled:opacity-40"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isDataLoading || isParentLoading ? 'animate-spin text-[#245C45]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* STRICT EMPTY STATE: When user has not connected data source */}
      {/* ========================================================== */}
      {!hasData ? (
        <div className="space-y-8 py-4">
          {/* Main Empty State Banner */}
          <div className="bg-white rounded-lg border-2 border-dashed border-[#CCDACC] p-8 md:p-12 text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#E8EFEA] text-[#245C45] flex items-center justify-center mx-auto mb-4">
              <Boxes className="w-7 h-7" />
            </div>

            <h2 className="text-lg md:text-xl font-bold text-[#252B28] mb-2">
              No inventory data available.
            </h2>
            <p className="text-sm text-[#6F756F] max-w-lg mx-auto mb-8">
              Connect your database or import a CSV/PDF file to get started. RetailIQ isolates your data securely and calculates live stock intelligence from your records.
            </p>

            {/* Two Primary Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
              {/* Option 1: Connect Database */}
              <div 
                onClick={() => setIsDbModalOpen(true)}
                className="p-6 rounded-lg border border-[#E4E5DC] bg-[#FAF9F5] hover:border-[#245C45] hover:bg-white transition-all cursor-pointer group shadow-xs"
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-[#CCDACC] text-[#245C45] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#252B28] mb-1 flex items-center gap-1.5">
                  <span>Connect Database</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#245C45] opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-[#6F756F] mb-4">
                  Connect a live MySQL or MariaDB database to inspect relational schemas, query stock tables, and enable continuous synchronization.
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#245C45] text-white text-xs font-semibold group-hover:bg-[#1C4A37] transition-colors">
                  <Database className="w-3.5 h-3.5" />
                  <span>Configure MySQL</span>
                </span>
              </div>

              {/* Option 2: Import Files (CSV / PDF) */}
              <div 
                onClick={() => setIsImportModalOpen(true)}
                className="p-6 rounded-lg border border-[#E4E5DC] bg-[#FAF9F5] hover:border-[#245C45] hover:bg-white transition-all cursor-pointer group shadow-xs"
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-[#CCDACC] text-[#245C45] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#252B28] mb-1 flex items-center gap-1.5">
                  <span>Import Files (CSV & PDF)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#245C45] opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-[#6F756F] mb-4">
                  Upload CSV spreadsheets or PDF invoices. RetailIQ extracts and validates records with instant preview before committing.
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#245C45] text-white text-xs font-semibold group-hover:bg-[#1C4A37] transition-colors">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </span>
              </div>
            </div>
          </div>

          {/* Locked Dashboard Analytics Indicator */}
          <div className="opacity-45 pointer-events-none select-none space-y-6 filter grayscale-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-md border border-[#E4E5DC] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7A807A]">Total SKUs</span>
                  <div className="text-xl font-bold font-mono text-[#7A807A] mt-1">—</div>
                </div>
                <Lock className="w-4 h-4 text-[#7A807A]" />
              </div>
              <div className="p-4 bg-white rounded-md border border-[#E4E5DC] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7A807A]">Available Units</span>
                  <div className="text-xl font-bold font-mono text-[#7A807A] mt-1">—</div>
                </div>
                <Lock className="w-4 h-4 text-[#7A807A]" />
              </div>
              <div className="p-4 bg-white rounded-md border border-[#E4E5DC] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7A807A]">Valuation</span>
                  <div className="text-xl font-bold font-mono text-[#7A807A] mt-1">—</div>
                </div>
                <Lock className="w-4 h-4 text-[#7A807A]" />
              </div>
              <div className="p-4 bg-white rounded-md border border-[#E4E5DC] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7A807A]">Replenishment Alerts</span>
                  <div className="text-xl font-bold font-mono text-[#7A807A] mt-1">—</div>
                </div>
                <Lock className="w-4 h-4 text-[#7A807A]" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================== */
        /* ACTIVE DASHBOARD: Populated from genuine connected records */
        /* ========================================================== */
        <>
          {/* Missing Fields Notice if applicable */}
          {datasetMeta?.missingFieldsNotes && datasetMeta.missingFieldsNotes.length > 0 && (
            <div className="p-3 bg-[#FFF9EB] border border-[#F5E2B3] rounded-md text-xs text-[#8A6116] flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#C66A42]" />
              <div>
                <span className="font-semibold">Dataset Column Scope: </span>
                {datasetMeta.missingFieldsNotes.join(' ')}
              </div>
            </div>
          )}

          {/* Dynamic Scope Filter Bar */}
          {datasetMeta?.dimensions && datasetMeta.dimensions.length > 0 && (
            <div className="bg-white rounded-md border border-[#E4E5DC] p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#252B28]">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#245C45]" />
                  <span>Dynamic Dimension Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E8EFEA] text-[#245C45] border border-[#CCDACC]">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearAllFilters}
                    className="flex items-center gap-1 text-xs text-[#B9473F] hover:underline font-semibold cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear all filters</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {/* Search across catalog */}
                <div className="relative col-span-2 sm:col-span-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#7A807A]" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Search SKUs, names..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-md border border-[#CCDACC] bg-[#FAF9F5] focus:outline-hidden focus:border-[#245C45]"
                  />
                  {filterSearch && (
                    <button
                      onClick={() => setFilterSearch('')}
                      className="absolute right-2 top-2 text-[#7A807A] hover:text-[#252B28]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dynamic Dimension Selects */}
                {datasetMeta.dimensions.map((dim) => (
                  <div key={dim.key}>
                    <select
                      value={activeFilters[dim.key] || 'all'}
                      onChange={(e) => handleFilterChange(dim.key, e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CCDACC] bg-[#FAF9F5] text-[#252B28] focus:outline-hidden focus:border-[#245C45] cursor-pointer"
                    >
                      <option value="all">All {dim.label}s ({dim.count})</option>
                      {dim.uniqueValues.map((val) => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Catalog SKUs"
              value={totalProducts.toLocaleString()}
              subtext={activeFilterCount > 0 ? 'Filtered subset' : 'Total unique items'}
              icon={Package}
              tooltipText="Total distinct inventory items currently active."
            />

            <MetricCard
              label="Stocked Units"
              value={totalUnits !== null ? totalUnits.toLocaleString() : 'N/A'}
              subtext={hasStock ? 'Across active products' : 'Stock column not detected'}
              icon={Boxes}
              tooltipText="Aggregate units on hand across active products."
            />

            <MetricCard
              label="Inventory Valuation"
              value={totalValue !== null ? `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
              subtext={hasPrice && hasStock ? `Avg: $${averagePrice?.toFixed(2) || '0.00'}/unit` : 'Price/Stock missing'}
              icon={DollarSign}
              tooltipText="Gross dollar value of merchandise in stock."
            />

            <MetricCard
              label="Low-Stock Alerts"
              value={lowStockCount !== null ? lowStockCount.toLocaleString() : 'N/A'}
              subtext={hasStock ? `≤ ${lowStockThreshold} units threshold` : 'Requires stock column'}
              icon={AlertTriangle}
              tooltipText={`Products with inventory at or below ${lowStockThreshold} units.`}
              isAlert={Boolean(lowStockCount && lowStockCount > 0)}
            />
          </div>

          {/* Dynamic AI Queries Context Bar */}
          {suggestions.length > 0 && (
            <div className="bg-[#FAF9F5] border border-[#E4E5DC] rounded-md p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#252B28] shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#245C45]" />
                <span>Dataset AI Insights:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
                {suggestions.slice(0, 3).map((sugg, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectSuggestion && onSelectSuggestion(sugg.query)}
                    className="text-[11px] px-2.5 py-1 bg-white hover:bg-[#E8EFEA] border border-[#CCDACC] text-[#245C45] rounded-md transition-colors cursor-pointer text-left truncate max-w-xs"
                    title={sugg.query}
                  >
                    {sugg.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Visual Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Distribution Bar Breakdown */}
            <div className="lg:col-span-2 bg-white rounded-md border border-[#E4E5DC] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#252B28]">
                      {hasBrand ? 'Stock Distribution by Brand' : hasCategory ? 'Stock Distribution by Category' : 'Catalog Distribution'}
                    </h2>
                    <p className="text-xs text-[#6F756F]">
                      Proportional volume allocation across available product entities
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#245C45]">
                    {primaryDistribution.length} Detected
                  </span>
                </div>

                {primaryDistribution.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#7A807A]">
                    No entity breakdown available for active filters.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {primaryDistribution.slice(0, 6).map((item, idx) => {
                      const barWidth = Math.max(4, Math.round((item.units / maxUnits) * 100));
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-[#252B28]">{item.label}</span>
                            <span className="font-mono tabular-nums text-[#6F756F]">
                              {item.units.toLocaleString()} units ({item.pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-[#F7F6F0] rounded-xs overflow-hidden">
                            <div
                              className="h-full rounded-xs transition-all duration-300"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: chartColors[idx % chartColors.length]
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 mt-4 border-t border-[#E4E5DC] text-[11px] text-[#7A807A] flex items-center justify-between">
                <span>Calculated directly from connected inventory data</span>
                <span className="font-mono">{totalUnits !== null ? `${totalUnits.toLocaleString()} Total Units` : ''}</span>
              </div>
            </div>

            {/* Donut Concentration Breakdown */}
            <div className="bg-white rounded-md border border-[#E4E5DC] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-[#252B28]">Share Concentration</h2>
                  <span className="text-[10px] font-mono uppercase bg-[#F7F6F0] px-1.5 py-0.5 rounded text-[#555C56]">
                    Top 5
                  </span>
                </div>

                {donutSlices.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#7A807A]">
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

          {/* Replenishment Risk & Low-Stock Alerts Table */}
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
        </>
      )}

      {/* Import Modal */}
      <FileImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleDataUpdate}
        isDatabaseConnected={Boolean(datasetMeta?.isLive)}
      />

      {/* Database Connect Modal */}
      <DatabaseConnectModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onConnectSuccess={handleDataUpdate}
      />
    </div>
  );
};
