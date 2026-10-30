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
  TrendingUp,
  Layers,
  UploadCloud,
  PlusCircle,
  Lock,
  PieChart,
  BarChart3,
  Flame,
  BadgeAlert,
  ShoppingBag,
  ExternalLink
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
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

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
  const outOfStockCount = dynamicMetrics ? dynamicMetrics.outOfStockCount : (fallbackMetrics?.outOfStockCount || 0);
  const averagePrice = dynamicMetrics ? dynamicMetrics.averagePrice : (fallbackMetrics?.averagePrice || 0);
  const lowStockItems = dynamicMetrics ? dynamicMetrics.lowStockItems : (fallbackMetrics?.lowStockItems || []);

  // Calculate estimated total sales / retail capacity (average price * units on hand)
  const salesCapacity = (averagePrice && totalUnits) ? Math.round(averagePrice * totalUnits * 1.15 * 100) / 100 : totalValue;

  // STRICT CHECK: Does user have any connected inventory data?
  const hasData = Boolean(
    (datasetMeta && datasetMeta.totalRecords > 0) ||
    totalProducts > 0
  );

  const hasStock = datasetMeta ? datasetMeta.hasStock : true;
  const hasPrice = datasetMeta ? datasetMeta.hasPrice : true;
  const hasBrand = datasetMeta ? datasetMeta.hasBrand : true;
  const hasCategory = datasetMeta ? datasetMeta.hasCategory : false;

  // Vibrant, intentional multi-colour palette for charts
  const chartColors = [
    '#6366F1', // Indigo
    '#3B82F6', // Blue
    '#06B6D4', // Cyan
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#F43F5E', // Rose
    '#14B8A6'  // Teal
  ];

  const primaryDistribution = (hasBrand && dynamicMetrics && dynamicMetrics.brandDistribution.length > 0)
    ? dynamicMetrics.brandDistribution.map(b => ({ label: b.brand, units: b.units, value: b.value, pct: b.pctOfTotalUnits, count: b.count }))
    : (hasCategory && dynamicMetrics && dynamicMetrics.categoryDistribution.length > 0)
    ? dynamicMetrics.categoryDistribution.map(c => ({ label: c.category, units: c.units, value: c.value, pct: c.pctOfTotalUnits, count: c.count }))
    : (dynamicMetrics?.productDistribution && dynamicMetrics.productDistribution.length > 0)
    ? dynamicMetrics.productDistribution.map(p => ({ label: p.product, units: p.units, value: p.value, pct: 0, count: p.count }))
    : fallbackMetrics?.brandDistribution.map(b => ({ label: b.brand, units: b.units, value: b.value, pct: b.pctOfTotalUnits, count: b.productCount })) || [];

  const maxUnits = Math.max(...primaryDistribution.map(d => d.units), 1);

  // SVG Donut calculation with interactive tooltips
  let cumulativeAngle = 0;
  const totalSliceUnits = primaryDistribution.reduce((acc, d) => acc + d.units, 0) || 1;
  const donutSlices = primaryDistribution.slice(0, 6).map((item, idx) => {
    const angle = (item.units / totalSliceUnits) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return {
      label: item.label,
      units: item.units,
      value: item.value,
      pct: Math.round((item.units / totalSliceUnits) * 100),
      startAngle,
      angle,
      color: chartColors[idx % chartColors.length]
    };
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* Top Header & Data Source Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Inventory Intelligence
            </h1>
            {hasData ? (
              datasetMeta?.isLive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live MySQL ({datasetMeta.sourceName})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                  {datasetMeta?.sourceName || 'Imported File'}
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                No Data Connected
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            {hasData
              ? 'Multi-dimensional retail performance, valuation matrix, and stock replenishment forecasts.'
              : 'Connect your business database or import inventory spreadsheets to unlock real-time intelligence.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {hasData && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-sm shadow-indigo-500/20 cursor-pointer active:scale-[0.98]"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Import Data</span>
              </button>
              <button
                onClick={() => setIsDbModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Database</span>
              </button>
            </>
          )}

          <button
            onClick={handleDataUpdate}
            disabled={isDataLoading || isParentLoading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-2xs disabled:opacity-40 cursor-pointer"
            title="Refresh inventory metrics"
          >
            <RotateCw className={`w-3.5 h-3.5 text-indigo-600 ${isDataLoading || isParentLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* STRICT EMPTY STATE: When user has not connected data source */}
      {/* ========================================================== */}
      {!hasData ? (
        <div className="space-y-8 py-4">
          {/* Main Empty State Banner */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 p-8 md:p-14 text-center shadow-sm relative overflow-hidden">
            {/* Subtle decorative background ambient gradients */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-100/40 via-purple-50/20 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-cyan-100/40 via-teal-50/20 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
                <Boxes className="w-8 h-8 text-white" />
              </div>

              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 mb-2">
                No inventory data available.
              </h2>
              <p className="text-sm text-slate-600 max-w-xl mx-auto mb-10 leading-relaxed">
                Connect your database or import a CSV/PDF file to get started. RetailIQ isolates your data securely per-tenant and calculates live merchandising metrics from your genuine records.
              </p>

              {/* Two Primary Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
                {/* Option 1: Connect Database */}
                <div 
                  onClick={() => setIsDbModalOpen(true)}
                  className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Database className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1.5 flex items-center gap-2">
                      <span>Connect Database</span>
                      <ArrowRight className="w-4 h-4 text-indigo-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                      Link a live MySQL or MariaDB database to introspect schemas, query stock tables, and enable automatic continuous synchronization.
                    </p>
                  </div>
                  <span className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-500/20 group-hover:from-indigo-700 group-hover:to-indigo-800 transition-all">
                    <Database className="w-4 h-4" />
                    <span>Configure MySQL Database</span>
                  </span>
                </div>

                {/* Option 2: Import Files (CSV / PDF) */}
                <div 
                  onClick={() => setIsImportModalOpen(true)}
                  className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1.5 flex items-center gap-2">
                      <span>Import Files (CSV & PDF)</span>
                      <ArrowRight className="w-4 h-4 text-cyan-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                      Upload your catalog spreadsheet or supplier invoice. RetailIQ validates rows with instant preview before committing to your workspace.
                    </p>
                  </div>
                  <span className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 text-white text-xs font-bold shadow-sm shadow-cyan-500/20 group-hover:from-cyan-700 group-hover:to-teal-700 transition-all">
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload CSV or PDF Document</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Locked Dashboard Preview State */}
          <div className="opacity-40 pointer-events-none select-none space-y-6 filter grayscale-30">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {['Catalog SKUs', 'Inventory Value', 'Available Units', 'Low Stock', 'Out of Stock', 'Sales Capacity'].map((title, i) => (
                <div key={i} className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">{title}</span>
                    <div className="text-xl font-bold font-mono text-slate-300 mt-1">—</div>
                  </div>
                  <Lock className="w-4 h-4 text-slate-300" />
                </div>
              ))}
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
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <span className="font-bold">Dataset Scope Notice: </span>
                {datasetMeta.missingFieldsNotes.join(' ')}
              </div>
            </div>
          )}

          {/* Dynamic Scope Filter Bar */}
          {datasetMeta?.dimensions && datasetMeta.dimensions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                  <span>Dynamic Dimension Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearAllFilters}
                    className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {/* Search across catalog */}
                <div className="relative col-span-2 sm:col-span-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Search by SKU, product, brand..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                  {filterSearch && (
                    <button
                      onClick={() => setFilterSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
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
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors cursor-pointer"
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

          {/* ========================================================== */}
          {/* 6 VISUALLY IMPRESSIVE KPI CARDS WITH DISTINCTIVE ACCENTS */}
          {/* ========================================================== */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Total Products (Indigo) */}
            <MetricCard
              label="Total Products"
              value={totalProducts.toLocaleString()}
              subtext={activeFilterCount > 0 ? 'Filtered subset' : 'Active catalog'}
              icon={Package}
              accent="indigo"
              tooltipText="Unique product SKUs in this inventory dataset."
              trend={totalProducts > 0 ? { value: `${totalProducts} SKUs`, isPositive: true } : undefined}
            />

            {/* 2. Total Inventory Value (Emerald) */}
            <MetricCard
              label="Inventory Value"
              value={totalValue !== null ? `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'N/A'}
              subtext={hasPrice && hasStock ? `Avg: $${averagePrice?.toFixed(2) || '0.00'}/unit` : 'Price/Stock missing'}
              icon={DollarSign}
              accent="emerald"
              tooltipText="Total gross value of all units in stock."
              trend={totalValue !== null && totalValue > 0 ? { value: 'Gross Value', isPositive: true } : undefined}
            />

            {/* 3. Total Units (Blue) */}
            <MetricCard
              label="Total Units"
              value={totalUnits !== null ? totalUnits.toLocaleString() : 'N/A'}
              subtext={hasStock ? 'Total units on hand' : 'Quantity missing'}
              icon={Boxes}
              accent="blue"
              tooltipText="Total physical stock units across all SKUs."
            />

            {/* 4. Low Stock (Orange/Amber) */}
            <MetricCard
              label="Low Stock"
              value={lowStockCount !== null ? lowStockCount.toLocaleString() : 'N/A'}
              subtext={hasStock ? `≤ ${lowStockThreshold} units threshold` : 'Requires stock'}
              icon={AlertTriangle}
              accent="orange"
              tooltipText={`Products with inventory at or below ${lowStockThreshold} units.`}
              isAlert={Boolean(lowStockCount && lowStockCount > 0)}
              trend={lowStockCount !== null && lowStockCount > 0 ? { value: 'At Risk', isPositive: false } : undefined}
            />

            {/* 5. Out of Stock (Rose) */}
            <MetricCard
              label="Out of Stock"
              value={outOfStockCount !== null ? outOfStockCount.toLocaleString() : 'N/A'}
              subtext={(outOfStockCount ?? 0) > 0 ? 'Immediate reorder needed' : 'Zero stockouts'}
              icon={BadgeAlert}
              accent="rose"
              tooltipText="Products currently with zero inventory units."
              isAlert={Boolean(outOfStockCount && outOfStockCount > 0)}
            />

            {/* 6. Total Sales Capacity (Purple) */}
            <MetricCard
              label="Sales Potential"
              value={salesCapacity !== null ? `$${salesCapacity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'N/A'}
              subtext="Projected sellout revenue"
              icon={ShoppingBag}
              accent="purple"
              tooltipText="Projected full-sellout revenue calculated from unit price and current units."
              trend={{ value: 'Projected', isPositive: true }}
            />
          </div>

          {/* Dynamic AI Queries Context Bar */}
          {suggestions.length > 0 && (
            <div className="bg-gradient-to-r from-purple-50/70 via-indigo-50/50 to-cyan-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 text-xs font-bold text-indigo-950 shrink-0">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span>Suggested AI Inquiries:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
                {suggestions.slice(0, 3).map((sugg, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectSuggestion && onSelectSuggestion(sugg.query)}
                    className="text-xs px-3 py-1.5 bg-white hover:bg-indigo-50/80 border border-indigo-200 text-indigo-700 font-semibold rounded-lg transition-all shadow-2xs hover:shadow-xs cursor-pointer text-left truncate max-w-xs"
                    title={sugg.query}
                  >
                    {sugg.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* ADVANCED MULTI-COLOUR ANALYTICS VISUALISATIONS */}
          {/* ========================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Multi-Colour Entity Distribution Bar Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      <span>{hasBrand ? 'Stock Volume by Brand' : hasCategory ? 'Stock Volume by Category' : 'Catalog Volume'}</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Relative inventory volume distribution across active entities
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {primaryDistribution.length} Entities
                  </span>
                </div>

                {primaryDistribution.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    No entity volume data available for current filters.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {primaryDistribution.slice(0, 6).map((item, idx) => {
                      const barWidth = Math.max(5, Math.round((item.units / maxUnits) * 100));
                      const color = chartColors[idx % chartColors.length];
                      return (
                        <div key={item.label} className="space-y-1.5 group">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-slate-800">{item.label}</span>
                            </div>
                            <span className="font-mono tabular-nums text-slate-600">
                              {item.units.toLocaleString()} units <span className="text-slate-400">({item.pct}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                            <div
                              className="h-full rounded-full transition-all duration-500 shadow-2xs"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: color
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 mt-6 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Calculated from live records</span>
                </span>
                <span className="font-mono font-bold text-slate-700">
                  {totalUnits !== null ? `${totalUnits.toLocaleString()} Total Units` : ''}
                </span>
              </div>
            </div>

            {/* Chart 2: Colourful Donut Chart Concentration Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-cyan-600" />
                      <span>Stock Concentration</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Top entity volume share</p>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                    Top 6
                  </span>
                </div>

                {donutSlices.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    No concentration data available.
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2">
                    {/* Donut SVG */}
                    <div className="relative w-44 h-44 shrink-0 my-2">
                      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                        {donutSlices.map((slice, idx) => {
                          const strokeDasharray = `${(slice.pct * 251.2) / 100} 251.2`;
                          const strokeDashoffset = -((slice.startAngle / 360) * 251.2);
                          const isHovered = hoveredSlice === idx;
                          return (
                            <circle
                              key={idx}
                              cx="50"
                              cy="50"
                              r="38"
                              fill="transparent"
                              stroke={slice.color}
                              strokeWidth={isHovered ? "14" : "11"}
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              onMouseEnter={() => setHoveredSlice(idx)}
                              onMouseLeave={() => setHoveredSlice(null)}
                              className="transition-all duration-200 cursor-pointer"
                            />
                          );
                        })}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
                          {hoveredSlice !== null ? donutSlices[hoveredSlice].units.toLocaleString() : (totalUnits !== null ? totalUnits.toLocaleString() : totalProducts)}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          {hoveredSlice !== null ? donutSlices[hoveredSlice].label : 'Units Total'}
                        </span>
                      </div>
                    </div>

                    {/* Donut Legend */}
                    <div className="grid grid-cols-2 gap-2 w-full mt-4">
                      {donutSlices.map((item, idx) => (
                        <div 
                          key={item.label} 
                          onMouseEnter={() => setHoveredSlice(idx)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                            hoveredSlice === idx ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-slate-800 truncate max-w-[85px]">{item.label}</span>
                          </div>
                          <span className="font-mono text-slate-500 text-[11px] font-semibold">
                            {item.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                <span>Concentration index</span>
                <span className="font-mono font-bold text-slate-700">{hasBrand ? 'Brand share' : 'Category share'}</span>
              </div>
            </div>
          </div>

          {/* ========================================================== */}
          {/* FIRST-CLASS REPLENISHMENT RISK & LOW-STOCK TABLE */}
          {/* ========================================================== */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500" />
                    <span>Replenishment Risk & Low-Stock Alerts</span>
                  </h2>
                  {hasStock && (
                    <span className="px-2.5 py-0.5 text-xs font-mono tabular-nums bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold shadow-2xs">
                      {lowStockItems.length} SKUs at Risk
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {hasStock
                    ? `Products at or below replenishment threshold (≤ ${lowStockThreshold} units). Prioritized for stock reorders.`
                    : 'Stock quantity column not detected in current dataset schema.'}
                </p>
              </div>

              <button
                onClick={onNavigateToInventory}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0 cursor-pointer"
              >
                <span>Open Merchandise Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {!hasStock ? (
              <div className="p-10 text-center text-xs text-slate-400">
                Stock quantity column is missing in this dataset. Replenishment risk cannot be calculated.
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-900">All inventory levels are healthy</p>
                <p className="text-xs text-slate-500 mt-1">No products currently fall at or below {lowStockThreshold} units threshold.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Product / SKU Identifier</th>
                      {hasBrand && <th className="py-3 px-4">Brand</th>}
                      <th className="py-3 px-4 text-right">Available Qty</th>
                      {hasPrice && <th className="py-3 px-4 text-right">Unit Price</th>}
                      {hasPrice && <th className="py-3 px-4 text-right">Valuation</th>}
                      <th className="py-3 px-4 text-right">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {lowStockItems.slice(0, 8).map((rawItem, idx) => {
                      const item = rawItem as Record<string, any>;
                      const name = item._name || item.name || item.product_name || `SKU #${item.id || item.t_shirt_id || idx + 1}`;
                      const stock = item._stock ?? item.stock_quantity ?? item.quantity ?? 0;
                      const price = item._price ?? item.price;
                      const val = (price !== undefined && stock !== undefined) ? Number(price) * Number(stock) : null;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors font-sans">
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {name}
                          </td>
                          {hasBrand && (
                            <td className="py-3 px-4 font-semibold text-slate-600">
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
                                {item.brand || '—'}
                              </span>
                            </td>
                          )}
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">
                            {stock} units
                          </td>
                          {hasPrice && (
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {price !== undefined ? `$${Number(price).toFixed(2)}` : '—'}
                            </td>
                          )}
                          {hasPrice && (
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {val !== null ? `$${val.toFixed(2)}` : '—'}
                            </td>
                          )}
                          <td className="py-3 px-4 text-right">
                            <StockBadge status={stock === 0 ? 'out_of_stock' : stock <= 5 ? 'critical' : 'low_stock'} />
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
