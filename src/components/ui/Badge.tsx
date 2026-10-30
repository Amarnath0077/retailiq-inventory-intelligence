import React from 'react';

interface BadgeProps {
  status: 'in_stock' | 'low_stock' | 'critical' | 'out_of_stock';
  children?: React.ReactNode;
}

export const StockBadge: React.FC<BadgeProps> = ({ status, children }) => {
  switch (status) {
    case 'in_stock':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          {children || 'Healthy Stock'}
        </span>
      );
    case 'low_stock':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          {children || 'Low Stock'}
        </span>
      );
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" aria-hidden="true" />
          {children || 'Critical'}
        </span>
      );
    case 'out_of_stock':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true" />
          {children || 'Out of Stock'}
        </span>
      );
  }
};
