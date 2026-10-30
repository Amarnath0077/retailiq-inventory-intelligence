import React, { useState } from 'react';
import { HelpCircle, TrendingUp, TrendingDown } from 'lucide-react';

export type MetricAccent = 'indigo' | 'blue' | 'cyan' | 'purple' | 'emerald' | 'orange' | 'rose' | 'teal';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltipText: string;
  accent?: MetricAccent;
  isAlert?: boolean;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
}

const ACCENT_STYLES: Record<MetricAccent, {
  bgLight: string;
  iconColor: string;
  borderLight: string;
  barColor: string;
}> = {
  indigo: {
    bgLight: 'bg-indigo-50 text-indigo-600',
    iconColor: 'text-indigo-600',
    borderLight: 'border-indigo-100 hover:border-indigo-300',
    barColor: 'bg-indigo-500'
  },
  blue: {
    bgLight: 'bg-blue-50 text-blue-600',
    iconColor: 'text-blue-600',
    borderLight: 'border-blue-100 hover:border-blue-300',
    barColor: 'bg-blue-500'
  },
  cyan: {
    bgLight: 'bg-cyan-50 text-cyan-600',
    iconColor: 'text-cyan-600',
    borderLight: 'border-cyan-100 hover:border-cyan-300',
    barColor: 'bg-cyan-500'
  },
  purple: {
    bgLight: 'bg-purple-50 text-purple-600',
    iconColor: 'text-purple-600',
    borderLight: 'border-purple-100 hover:border-purple-300',
    barColor: 'bg-purple-500'
  },
  emerald: {
    bgLight: 'bg-emerald-50 text-emerald-600',
    iconColor: 'text-emerald-600',
    borderLight: 'border-emerald-100 hover:border-emerald-300',
    barColor: 'bg-emerald-500'
  },
  orange: {
    bgLight: 'bg-amber-50 text-amber-600',
    iconColor: 'text-amber-600',
    borderLight: 'border-amber-100 hover:border-amber-300',
    barColor: 'bg-amber-500'
  },
  rose: {
    bgLight: 'bg-rose-50 text-rose-600',
    iconColor: 'text-rose-600',
    borderLight: 'border-rose-100 hover:border-rose-300',
    barColor: 'bg-rose-500'
  },
  teal: {
    bgLight: 'bg-teal-50 text-teal-600',
    iconColor: 'text-teal-600',
    borderLight: 'border-teal-100 hover:border-teal-300',
    barColor: 'bg-teal-500'
  }
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  tooltipText,
  accent = 'indigo',
  isAlert = false,
  trend
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.indigo;

  return (
    <div className={`relative bg-white rounded-xl border p-5 transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md ${
      isAlert 
        ? 'border-rose-200 bg-rose-50/20' 
        : `border-slate-200/90 ${styles.borderLight}`
    }`}>
      {/* Top row: Label, tooltip, and colorful icon badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {label}
          </span>
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              className="text-slate-400 hover:text-slate-600 focus:outline-hidden transition-colors cursor-pointer"
              aria-label={`Metric info for ${label}`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {showTooltip && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2.5 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl z-30 pointer-events-none leading-relaxed text-center">
                {tooltipText}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
              </div>
            )}
          </div>
        </div>

        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
          isAlert ? 'bg-rose-100 text-rose-600' : styles.bgLight
        }`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {/* Middle row: Large value */}
      <div className="mt-3">
        <div className={`text-2xl lg:text-3xl font-extrabold font-mono tabular-nums tracking-tight ${
          isAlert ? 'text-rose-600' : 'text-slate-900'
        }`}>
          {value}
        </div>

        {/* Bottom row: Subtext or trend badge */}
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          {subtext && (
            <span className="text-slate-500 font-medium truncate">
              {subtext}
            </span>
          )}

          {trend && (
            <span className={`inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full ${
              trend.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{trend.value}</span>
            </span>
          )}
        </div>
      </div>

      {/* Subtle bottom accent line */}
      <div className={`absolute bottom-0 left-4 right-4 h-0.5 rounded-full ${
        isAlert ? 'bg-rose-500' : styles.barColor
      } opacity-80`} />
    </div>
  );
};
