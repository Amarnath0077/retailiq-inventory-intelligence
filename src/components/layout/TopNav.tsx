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
  User as UserIcon
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
        return { section: 'RetailIQ Ledger', current: 'Inventory Overview' };
      case 'inventory':
        return { section: 'Catalog', current: 'Merchandise Inventory' };
      case 'analytics':
        return { section: 'Reporting', current: 'Stock Distribution' };
      case 'assistant':
        return { section: 'Intelligence', current: 'Retail Assistant' };
      case 'settings':
        return { section: 'Configuration', current: 'Data Sources & Architecture' };
      default:
        return { section: 'RetailIQ Ledger', current: 'Overview' };
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
    <header className="h-16 px-4 md:px-7 bg-[#FFFFFF] border-b border-[#E4E5DC] flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Zone 1: Mobile toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="p-1.5 -ml-1.5 text-[#5F6560] hover:text-[#252B28] rounded-md lg:hidden cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
          <span className="text-[#7F857F] font-medium hidden sm:inline">{breadcrumb.section}</span>
          <span className="text-[#C5C8C0] hidden sm:inline" aria-hidden="true">/</span>
          <span className="font-semibold text-[#252B28] tracking-tight">{breadcrumb.current}</span>
        </nav>
      </div>

      {/* Zone 2: System Telemetry & Metadata (Unboxed, clean typographic style) */}
      <div className="hidden md:flex items-center gap-3 text-xs text-[#5F6560]">
        <button
          type="button"
          onClick={onNavigateToSettings}
          title="Active Data Store - Click to manage Data Sources & Imports in Settings"
          className="flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-md border border-[#E4E5DC] bg-[#F7F6F0] hover:bg-[#EFEFE7] text-[#252B28] cursor-pointer transition-colors"
        >
          {databaseStatus?.activeSource === 'csv' ? (
            <>
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#245C45]" />
              <span>Dataset: <strong className="font-semibold font-mono">{databaseStatus.database}</strong></span>
            </>
          ) : databaseStatus?.activeSource === 'pdf' ? (
            <>
              <FileText className="w-3.5 h-3.5 text-[#C66A42]" />
              <span>Document: <strong className="font-semibold font-mono">{databaseStatus.database}</strong></span>
            </>
          ) : (
            <>
              <Database className="w-3.5 h-3.5 text-[#245C45]" />
              <span>Store: <strong className="font-semibold font-mono">{databaseStatus?.database || 'atliq_tshirts'}</strong></span>
            </>
          )}
        </button>

        <span className="text-[#D0D2C8]" aria-hidden="true">·</span>

        <div className="flex items-center gap-1.5 font-mono tabular-nums text-[#6F756F]">
          <Clock className="w-3.5 h-3.5 text-[#8F958F]" />
          <span>Sync {formattedTime}</span>
        </div>

        <span className="text-[#D0D2C8]" aria-hidden="true">·</span>

        {aiStatus?.configured ? (
          <span 
            title="Google GenAI Gemini 3.8 Flash is active"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#DCE7DD]/60 text-[#245C45] border border-[#CCD9CD]"
          >
            <Sparkles className="w-3 h-3 text-[#245C45]" />
            <span>Gemini 3.8 Flash</span>
          </span>
        ) : (
          <span 
            title="AI reasoning running in offline resilient mode"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7EBE5] text-[#C66A42] border border-[#EACEC0]"
          >
            <span>Heuristic Engine</span>
          </span>
        )}
      </div>

      {/* Zone 3: Primary Action & User Profile */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#252B28] bg-[#F7F6F0] hover:bg-[#EFEFE7] border border-[#E4E5DC] rounded-md transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer active:scale-[0.99]"
          title="Refresh inventory metrics from active dataset"
        >
          <RotateCw className={`w-3.5 h-3.5 text-[#5F6560] ${isRefreshing ? 'animate-spin text-[#245C45]' : ''}`} />
          <span className="hidden sm:inline">Refresh Ledger</span>
        </button>

        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-[#E4E5DC]">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-[#252B28] leading-tight truncate max-w-[130px]">
                {user.name}
              </span>
              <span className="text-[10px] text-[#7F857F] font-mono leading-tight truncate max-w-[130px]">
                {user.email}
              </span>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              title="Sign out of RetailIQ"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#7F857F] hover:text-[#B9473F] hover:bg-[#F9ECEB] rounded-md transition-colors cursor-pointer"
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
