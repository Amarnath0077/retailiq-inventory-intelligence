import React, { useState } from 'react';
import { 
  BarChart3, 
  PieChart, 
  Filter, 
  Info
} from 'lucide-react';
import { InventoryMetrics } from '../../types/inventory.ts';

interface AnalyticsViewProps {
  metrics: InventoryMetrics | null;
  isLoading: boolean;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ metrics, isLoading }) => {
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all');

  if (isLoading && !metrics) {
    return (
      <div className="p-6 md:p-8 space-y-5 max-w-7xl mx-auto">
        <div className="h-6 w-48 bg-[#EAEBE2] animate-pulse rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-white rounded-md border border-[#E4E5DC] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return <div className="p-8 text-center text-xs text-[#7A807A]">Analytics data currently unavailable.</div>;
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

  const colorPalette: Record<string, string> = {
    White: '#FFFFFF',
    Black: '#252B28',
    Red: '#B9473F',
    Blue: '#3B6B8A'
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto text-[#252B28]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E5DC] pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#252B28]">
            Stock Distribution & Valuation
          </h1>
          <p className="mt-1 text-xs text-[#6F756F]">
            Merchandise performance matrix, colorway concentration, and asset valuation.
          </p>
        </div>

        {/* Global Brand Filter */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-[#E4E5DC]">
          <Filter className="w-3.5 h-3.5 text-[#6F756F]" />
          <span className="text-xs text-[#6F756F] font-medium">Scope:</span>
          <select
            value={selectedBrandFilter}
            onChange={(e) => setSelectedBrandFilter(e.target.value)}
            className="text-xs font-semibold text-[#252B28] bg-transparent focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Brands (Consolidated)</option>
            {metrics.brandDistribution.map(b => (
              <option key={b.brand} value={b.brand}>{b.brand}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Accounting Distinction Notice */}
      <div className="bg-white border border-[#E4E5DC] rounded-md p-3.5 flex items-start gap-2.5 text-xs text-[#555C56]">
        <Info className="w-4 h-4 text-[#245C45] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-[#252B28]">Merchandise Accounting Principle:</strong> <strong>Inventory Valuation</strong> represents held physical asset capital calculated at base unit list prices (<span className="font-mono font-medium">Price × Quantity</span>). POS realized revenue adjusts dynamically after campaign discounts.
        </div>
      </div>

      {/* Analytical KPI summary (Compact 3-column panel) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white rounded-md border border-[#E4E5DC] p-4">
          <div className="text-[11px] font-semibold text-[#6E746E] uppercase tracking-wider">
            {isAllBrands ? 'Analyzed Physical Stock' : `${selectedBrandFilter} Physical Stock`}
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#252B28]">
            {activeUnits.toLocaleString()} units
          </div>
          <div className="mt-1 text-[11px] text-[#787E78]">
            {isAllBrands ? 'Consolidated catalog units' : `${Math.round((activeUnits / metrics.totalUnits) * 100)}% of total held inventory`}
          </div>
        </div>

        <div className="bg-white rounded-md border border-[#E4E5DC] p-4">
          <div className="text-[11px] font-semibold text-[#6E746E] uppercase tracking-wider">
            {isAllBrands ? 'Held Capital Valuation' : `${selectedBrandFilter} Capital Valuation`}
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#245C45]">
            ${activeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-[#787E78]">
            Average unit price: ${metrics.averagePrice.toFixed(2)}
          </div>
        </div>

        <div className="bg-white rounded-md border border-[#E4E5DC] p-4">
          <div className="text-[11px] font-semibold text-[#6E746E] uppercase tracking-wider">
            Lead Brand Concentration
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#C66A42]">
            {topBrandShare}%
          </div>
          <div className="mt-1 text-[11px] text-[#787E78]">
            Held by primary brand: <strong className="text-[#252B28]">{topBrand?.brand}</strong>
          </div>
        </div>
      </div>

      {/* Analytical Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Brand Comparison Matrix */}
        <div className="bg-white rounded-md border border-[#E4E5DC] p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E5DC]">
            <div>
              <h2 className="text-sm font-bold text-[#252B28]">Brand Merchandising Matrix</h2>
              <p className="text-xs text-[#6F756F]">Unit volume vs capital tied up in stock</p>
            </div>
            <BarChart3 className="w-4 h-4 text-[#7A807A]" />
          </div>

          <div className="space-y-3">
            {filteredBrandData.map((b) => (
              <div key={b.brand} className="p-3 bg-[#F7F6F0] rounded-md border border-[#E4E5DC] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#252B28]">{b.brand}</span>
                  <span className="font-mono tabular-nums text-[#6F756F] text-[11px]">
                    {b.productCount} SKU variants
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono tabular-nums pt-1 border-t border-[#E4E5DC]">
                  <div>
                    <span className="text-[10px] uppercase font-sans text-[#7A807A] block">Stock Share</span>
                    <span className="font-semibold text-[#252B28]">{b.units.toLocaleString()} units ({b.pctOfTotalUnits}%)</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-sans text-[#7A807A] block">Held Capital</span>
                    <span className="font-bold text-[#245C45]">${b.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Color Distribution */}
        <div className="bg-white rounded-md border border-[#E4E5DC] p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E5DC]">
            <div>
              <h2 className="text-sm font-bold text-[#252B28]">Colorway Concentration</h2>
              <p className="text-xs text-[#6F756F]">Unit breakdown across core fabric colorways</p>
            </div>
            <PieChart className="w-4 h-4 text-[#7A807A]" />
          </div>

          <div className="space-y-3">
            {metrics.colorDistribution.map((c) => {
              const maxUnits = Math.max(...metrics.colorDistribution.map(x => x.units), 1);
              const widthPct = Math.round((c.units / maxUnits) * 100);
              const share = Math.round((c.units / metrics.totalUnits) * 100);
              return (
                <div key={c.color} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-xs border border-[#CCD0C5]"
                        style={{ backgroundColor: colorPalette[c.color] || '#A2A9A0' }}
                      />
                      <span className="font-medium text-[#252B28]">{c.color}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums text-xs">
                      <span className="font-semibold text-[#252B28]">{c.units.toLocaleString()} units</span>
                      <span className="text-[#7A807A]">({share}%)</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-[#EAEBE2] rounded-xs overflow-hidden">
                    <div 
                      className="h-full bg-[#245C45] rounded-xs transition-all duration-300"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Analytical Summary Table */}
      <div className="bg-white rounded-md border border-[#E4E5DC] overflow-hidden">
        <div className="p-4 border-b border-[#E4E5DC]">
          <h2 className="text-sm font-bold text-[#252B28]">Consolidated Brand Merchandising Audit Table</h2>
          <p className="text-xs text-[#6F756F] mt-0.5">Audited from active database tables t_shirts and discounts</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F7F6F0] text-[#555C56] font-semibold border-b border-[#E4E5DC]">
              <tr>
                <th className="py-2.5 px-4">Brand</th>
                <th className="py-2.5 px-4 text-right">SKU Count</th>
                <th className="py-2.5 px-4 text-right">Total Units</th>
                <th className="py-2.5 px-4 text-right">Unit Share</th>
                <th className="py-2.5 px-4 text-right">Avg Unit Price</th>
                <th className="py-2.5 px-4 text-right">Inventory Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEBE2] font-mono tabular-nums">
              {metrics.brandDistribution.map((b) => (
                <tr key={b.brand} className="hover:bg-[#F9FAF6] font-sans">
                  <td className="py-2.5 px-4 font-semibold text-[#252B28]">{b.brand}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-[#555C56]">{b.productCount}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-[#252B28]">{b.units.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-[#6F756F]">{b.pctOfTotalUnits}%</td>
                  <td className="py-2.5 px-4 text-right font-mono text-[#555C56]">
                    ${(b.value / Math.max(b.units, 1)).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-[#245C45]">
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
