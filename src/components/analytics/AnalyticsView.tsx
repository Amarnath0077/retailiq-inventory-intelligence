import React, { useState } from 'react';
import { 
  BarChart3, 
  PieChart, 
  Filter, 
  Info,
  TrendingUp,
  Layers,
  Sparkles,
  Award,
  DollarSign,
  Boxes,
  Package
} from 'lucide-react';
import { InventoryMetrics } from '../../types/inventory.ts';

interface AnalyticsViewProps {
  metrics: InventoryMetrics | null;
  isLoading: boolean;
}

const BRAND_PALETTE: string[] = [
  '#6366F1', // Indigo
  '#3B82F6', // Blue
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#F43F5E', // Rose
  '#14B8A6'  // Teal
];

const FABRIC_SWATCHES: Record<string, { bg: string; border: string; text: string }> = {
  White: { bg: '#FFFFFF', border: '#CBD5E1', text: '#0F172A' },
  Black: { bg: '#0F172A', border: '#334155', text: '#FFFFFF' },
  Red: { bg: '#EF4444', border: '#DC2626', text: '#FFFFFF' },
  Blue: { bg: '#2563EB', border: '#1D4ED8', text: '#FFFFFF' },
  Green: { bg: '#10B981', border: '#059669', text: '#FFFFFF' },
  Yellow: { bg: '#F59E0B', border: '#D97706', text: '#0F172A' },
  Grey: { bg: '#64748B', border: '#475569', text: '#FFFFFF' },
  Standard: { bg: '#6366F1', border: '#4F46E5', text: '#FFFFFF' }
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ metrics, isLoading }) => {
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all');
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

  if (isLoading && !metrics) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics || metrics.totalProducts === 0) {
    return (
      <div className="p-8 md:p-14 text-center max-w-lg mx-auto my-14 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1.5">No inventory data available</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Connect your database or import a CSV/PDF file to get started. Stock distribution, entity concentrations, and valuation analytics will calculate once inventory records are loaded.
        </p>
      </div>
    );
  }

  // Filter calculations based on brand filter
  const isAllBrands = selectedBrandFilter === 'all';
  const filteredBrandData = isAllBrands 
    ? metrics.brandDistribution 
    : metrics.brandDistribution.filter(b => b.brand.toLowerCase() === selectedBrandFilter.toLowerCase());

  const activeUnits = filteredBrandData.reduce((acc, b) => acc + b.units, 0);
  const activeValue = filteredBrandData.reduce((acc, b) => acc + b.value, 0);

  // Top brand concentration (Pareto principle)
  const topBrand = metrics.brandDistribution[0];
  const topBrandShare = topBrand ? topBrand.pctOfTotalUnits : 0;

  // Donut chart calculation
  let cumulativeAngle = 0;
  const totalBrandUnits = metrics.brandDistribution.reduce((acc, b) => acc + b.units, 0) || 1;
  const donutSlices = metrics.brandDistribution.slice(0, 6).map((b, idx) => {
    const angle = (b.units / totalBrandUnits) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return {
      label: b.brand,
      units: b.units,
      value: b.value,
      pct: Math.round((b.units / totalBrandUnits) * 100),
      startAngle,
      angle,
      color: BRAND_PALETTE[idx % BRAND_PALETTE.length]
    };
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Stock Distribution & Valuation
          </h1>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            Brand allocation matrix, fabric colorway concentration, and asset capital distribution.
          </p>
        </div>

        {/* Global Brand Filter */}
        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span className="text-xs text-slate-500 font-semibold">Scope:</span>
          <select
            value={selectedBrandFilter}
            onChange={(e) => setSelectedBrandFilter(e.target.value)}
            className="text-xs font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Brands (Consolidated)</option>
            {metrics.brandDistribution.map(b => (
              <option key={b.brand} value={b.brand}>{b.brand}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Accounting Distinction Notice */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-slate-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-600 shadow-2xs">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-900">Merchandise Accounting Principle:</strong> <strong>Inventory Valuation</strong> represents capital invested in physical assets calculated as <span className="font-mono font-bold text-indigo-700">Unit Price × Stock Quantity</span>. Realized revenue adjusts dynamically with sales and promotional discounts.
        </div>
      </div>

      {/* Analytical KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Physical Stock Card (Blue) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isAllBrands ? 'Analyzed Physical Stock' : `${selectedBrandFilter} Physical Stock`}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            {activeUnits.toLocaleString()} units
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            <span>{isAllBrands ? 'Total catalog units' : `${Math.round((activeUnits / metrics.totalUnits) * 100)}% of total held inventory`}</span>
          </div>
          <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-500 rounded-full" />
        </div>

        {/* Capital Valuation Card (Emerald) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isAllBrands ? 'Held Capital Valuation' : `${selectedBrandFilter} Capital Valuation`}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-extrabold font-mono tabular-nums text-emerald-600">
            ${activeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>Average unit price: ${metrics.averagePrice.toFixed(2)}</span>
          </div>
          <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-500 rounded-full" />
        </div>

        {/* Brand Concentration Card (Purple) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Lead Brand Share
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-extrabold font-mono tabular-nums text-purple-600">
            {topBrandShare}%
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
            <span>Leading entity: <strong className="text-slate-800">{topBrand?.brand}</strong></span>
          </div>
          <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-purple-500 rounded-full" />
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand Merchandising Matrix */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <span>Brand Capital & Volume Allocation</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Physical units versus capital invested per brand</p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {filteredBrandData.length} Brands
              </span>
            </div>

            <div className="space-y-3.5">
              {filteredBrandData.map((b, idx) => {
                const color = BRAND_PALETTE[idx % BRAND_PALETTE.length];
                return (
                  <div key={b.brand} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span>{b.brand}</span>
                      </div>
                      <span className="font-mono text-slate-500 text-[11px] font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                        {b.productCount} SKUs
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-mono tabular-nums pt-2 border-t border-slate-200/60">
                      <div>
                        <span className="text-[10px] uppercase font-sans text-slate-400 font-bold block mb-0.5">Units & Share</span>
                        <span className="font-bold text-slate-800">{b.units.toLocaleString()} units</span>
                        <span className="text-slate-400 ml-1">({b.pctOfTotalUnits}%)</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-sans text-slate-400 font-bold block mb-0.5">Held Valuation</span>
                        <span className="font-bold text-emerald-600">${b.value.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Donut Chart: Brand Volume Share Concentration */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-cyan-600" />
                  <span>Volume Share Donut</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Interactive percentage concentration of inventory</p>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                Interactive
              </span>
            </div>

            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative w-48 h-48 my-2">
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
                  <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                    {hoveredSlice !== null ? `${donutSlices[hoveredSlice].pct}%` : `${metrics.totalProducts}`}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {hoveredSlice !== null ? donutSlices[hoveredSlice].label : 'Total SKUs'}
                  </span>
                </div>
              </div>

              {/* Legends with direct click/hover highlight */}
              <div className="grid grid-cols-2 gap-2 w-full mt-4">
                {donutSlices.map((item, idx) => (
                  <div
                    key={item.label}
                    onMouseEnter={() => setHoveredSlice(idx)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                      hoveredSlice === idx ? 'bg-indigo-50 font-bold border border-indigo-200' : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-800 truncate max-w-[90px]">{item.label}</span>
                    </div>
                    <span className="font-mono text-slate-600 font-bold text-xs">
                      {item.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Hover slices for live breakdowns</span>
            <span className="font-mono font-bold text-slate-700">${metrics.totalInventoryValue.toLocaleString()} Total</span>
          </div>
        </div>
      </div>

      {/* Colorway & Size Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colorway Concentration */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>Colorway Fabric Concentration</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Physical unit distribution across color variations</p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md border border-purple-200">
              {metrics.colorDistribution.length} Colors
            </span>
          </div>

          <div className="space-y-3.5">
            {metrics.colorDistribution.map((c) => {
              const maxUnits = Math.max(...metrics.colorDistribution.map(x => x.units), 1);
              const widthPct = Math.round((c.units / maxUnits) * 100);
              const share = Math.round((c.units / metrics.totalUnits) * 100);
              const swatch = FABRIC_SWATCHES[c.color] || FABRIC_SWATCHES.Standard;

              return (
                <div key={c.color} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span 
                        className="w-4 h-4 rounded-md shadow-xs shrink-0"
                        style={{ 
                          backgroundColor: swatch.bg,
                          border: `1px solid ${swatch.border}`
                        }}
                      />
                      <span className="font-bold text-slate-800">{c.color}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums text-xs">
                      <span className="font-bold text-slate-800">{c.units.toLocaleString()} units</span>
                      <span className="text-slate-400 font-medium">({share}%)</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Size Distribution Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-600" />
                <span>Size & Spec Allocation</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Sizing curve volume and stock allocation</p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md border border-teal-200">
              {metrics.sizeDistribution.length > 0 ? `${metrics.sizeDistribution.length} Sizes` : 'Standard'}
            </span>
          </div>

          {metrics.sizeDistribution.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Size curve distribution not specified in current dataset.
            </div>
          ) : (
            <div className="space-y-3.5">
              {metrics.sizeDistribution.map((s, idx) => {
                const maxSizeUnits = Math.max(...metrics.sizeDistribution.map(x => x.units), 1);
                const widthPct = Math.round((s.units / maxSizeUnits) * 100);
                const color = BRAND_PALETTE[idx % BRAND_PALETTE.length];
                return (
                  <div key={s.size} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">
                        {s.size}
                      </span>
                      <span className="font-mono tabular-nums text-xs font-bold text-slate-700">
                        {s.units.toLocaleString()} units
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                      <div 
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${widthPct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Analytical Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <h2 className="text-base font-bold text-slate-900">Consolidated Brand Merchandising Audit Table</h2>
          <p className="text-xs text-slate-500 mt-1">Directly aggregated from connected inventory data rows</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4 text-right">SKU Count</th>
                <th className="py-3 px-4 text-right">Total Units</th>
                <th className="py-3 px-4 text-right">Unit Share</th>
                <th className="py-3 px-4 text-right">Avg Unit Price</th>
                <th className="py-3 px-4 text-right">Inventory Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {metrics.brandDistribution.map((b, idx) => (
                <tr key={b.brand} className="hover:bg-slate-50/80 font-sans transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: BRAND_PALETTE[idx % BRAND_PALETTE.length] }} />
                    <span>{b.brand}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">{b.productCount}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">{b.units.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-indigo-600">{b.pctOfTotalUnits}%</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">
                    ${(b.value / Math.max(b.units, 1)).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                    ${b.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
