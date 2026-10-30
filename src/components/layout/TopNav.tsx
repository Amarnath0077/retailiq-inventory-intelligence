import React from 'react';
import { 
  Menu, 
  RotateCw, 
  Clock, 
  CheckCircle2, 
  FileSpreadsheet, 
  FileText, 
  Database,
  Sparkles,
  LogOut,
  User as UserIcon,
  Shield,
  Layers
} from 'lucide-react';
import { NavTab } from './Sidebar.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface TopNavProps {
  currentTab: NavTab;
  onOpenMobile: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: string;
  onNavigateToSettings?: () => void;
  aiStatus?: {
    configured: boolean;
    model: string;
    provider?: string;
  };
  databaseStatus?: {
    connected: boolean;
    database: string;
    totalRecords: number;
    isLiveMySQL?: boolean;
    activeSource?: 'mysql' | 'csv' | 'pdf';
    importSummary?: any;
  };
}

export const TopNav: React.FC<TopNavProps> = ({
  currentTab,
  onOpenMobile,
  onRefresh,
  isRefreshing,
  lastUpdated,
  onNavigateToSettings,
  aiStatus,
  databaseStatus
}) => {
  const { user, logout } = useAuth();

  const getTabBreadcrumb = () => {
    switch (currentTab) {
      case 'dashboard':
        return { section: 'RetailIQ Platform', current: 'Inventory Overview' };
      case 'inventory':
        return { section: 'Catalog', current: 'Merchandise Inventory' };
      case 'analytics':
        return { section: 'Reporting', current: 'Stock Distribution & Analytics' };
      case 'assistant':
        return { section: 'Intelligence', current: 'Retail AI Assistant' };
      case 'settings':
        return { section: 'Configuration', current: 'Data Sources & Architecture' };
      default:
        return { section: 'RetailIQ Platform', current: 'Overview' };
    }
  };

  const breadcrumb = getTabBreadcrumb();

  const formattedTime = React.useMemo(() => {
    if (!lastUpdated) return 'Just now';
    try {
      const d = new Date(lastUpdated);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Just now';
    }
  }, [lastUpdated]);

  return (
    <header className="h-16 px-4 md:px-7 bg-white/95 backdrop-blur-md border-b border-slate-200/90 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Zone 1: Mobile toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="p-1.5 -ml-1.5 text-slate-500 hover:text-slate-800 rounded-lg lg:hidden cursor-pointer hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium hidden sm:inline">{breadcrumb.section}</span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
          <span className="font-bold text-slate-800 tracking-tight">{breadcrumb.current}</span>
        </nav>
      </div>

      {/* Zone 2: System Telemetry & Metadata */}
      <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
        <button
          type="button"
          onClick={onNavigateToSettings}
          title="Active Data Store - Click to manage Data Sources & Imports in Settings"
          className="flex items-center gap-2 font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 cursor-pointer transition-all shadow-2xs hover:border-slate-300"
        >
          {databaseStatus?.activeSource === 'csv' ? (
            <>
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dataset: <strong className="font-semibold font-mono text-slate-900">{databaseStatus.database}</strong></span>
            </>
          ) : databaseStatus?.activeSource === 'pdf' ? (
            <>
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Document: <strong className="font-semibold font-mono text-slate-900">{databaseStatus.database}</strong></span>
            </>
          ) : databaseStatus?.connected && databaseStatus.isLiveMySQL ? (
            <>
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>MySQL: <strong className="font-semibold font-mono text-slate-900">{databaseStatus.database}</strong></span>
            </>
          ) : (
            <>
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">No Data Connected</span>
            </>
          )}
        </button>

        <span className="text-slate-300" aria-hidden="true">·</span>

        <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-500 text-[11px]">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Synced {formattedTime}</span>
        </div>

        <span className="text-slate-300" aria-hidden="true">·</span>

        {aiStatus?.configured ? (
          <span 
            title="Google GenAI Gemini 3.8 Flash is active"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
            <span>Gemini 3.8 Flash</span>
          </span>
        ) : (
          <span 
            title="AI reasoning running in offline resilient mode"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
          >
            <span>Heuristic Engine</span>
          </span>
        )}
      </div>

      {/* Zone 3: Primary Action & User Profile */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shadow-2xs hover:shadow-xs disabled:opacity-50 whitespace-nowrap cursor-pointer active:scale-[0.98]"
          title="Refresh inventory metrics from active dataset"
        >
          <RotateCw className={`w-3.5 h-3.5 text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh Data</span>
        </button>

        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[140px]">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono leading-tight truncate max-w-[140px]">
                {user.email}
              </span>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              title="Sign out of RetailIQ"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
