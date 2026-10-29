import React from 'react';

interface BadgeProps {
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  children?: React.ReactNode;
}

export const StockBadge: React.FC<BadgeProps> = ({ status, children }) => {
  switch (status) {
    case 'in_stock':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#E8EFEA] text-[#245C45] border border-[#CCDACC] whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#245C45]" aria-hidden="true" />
          {children || 'In Stock'}
        </span>
      );
    case 'low_stock':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FDF3EC] text-[#C66A42] border border-[#F2D7C7] whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C66A42]" aria-hidden="true" />
          {children || 'Low Stock'}
        </span>
      );
    case 'out_of_stock':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F9ECEB] text-[#B9473F] border border-[#F0CECA] whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B9473F]" aria-hidden="true" />
          {children || 'Out of Stock'}
        </span>
      );
  }
};
