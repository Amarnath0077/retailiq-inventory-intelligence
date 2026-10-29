import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltipText: string;
  accentColor?: string;
  isAlert?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  tooltipText,
  isAlert = false
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`relative bg-white rounded-md border p-4 transition-colors flex flex-col justify-between ${
      isAlert 
        ? 'border-[#F0CECA] bg-[#FCF7F6]' 
        : 'border-[#E4E5DC] hover:border-[#D5D7CC]'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[#6E746E] uppercase tracking-wider">
            {label}
          </span>
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              className="text-[#9BA19B] hover:text-[#252B28] focus:outline-hidden transition-colors cursor-pointer"
              aria-label={`Metric info for ${label}`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {showTooltip && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 p-2 bg-[#252B28] text-white text-[11px] rounded shadow-lg z-30 pointer-events-none leading-relaxed text-center">
                {tooltipText}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#252B28]" />
              </div>
            )}
          </div>
        </div>
        <div className={`p-1.5 rounded ${
          isAlert 
            ? 'bg-[#F9ECEB] text-[#B9473F]' 
            : 'bg-[#F7F6F0] text-[#245C45]'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3">
        <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
          isAlert ? 'text-[#B9473F]' : 'text-[#252B28]'
        }`}>
          {value}
        </div>
        {subtext && (
          <div className="mt-1 text-[11px] text-[#787E78] font-medium flex items-center gap-1.5">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
};
