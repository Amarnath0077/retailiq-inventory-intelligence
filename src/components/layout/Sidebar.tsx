import React from 'react';
import { 
  LayoutDashboard, 
  MessageSquareText, 
  Package, 
  BarChart3, 
  Settings, 
  Boxes,
  Database,
  ShieldCheck,
  X,
  FileSpreadsheet,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

export type NavTab = 'dashboard' | 'assistant' | 'inventory' | 'analytics' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  databaseStatus?: {
    connected: boolean;
    database: string;
    isLiveMySQL?: boolean;
    activeSource?: 'mysql' | 'csv' | 'pdf';
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  databaseStatus
}) => {
  const { user, logout } = useAuth();
  const navItems: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Inventory Overview', icon: LayoutDashboard },
    { id: 'inventory', label: 'Merchandise Catalog', icon: Package },
    { id: 'analytics', label: 'Stock Distribution', icon: BarChart3 },
    { id: 'assistant', label: 'Retail Assistant', icon: MessageSquareText },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#1C2520] text-[#DCE7DD] select-none border-r border-[#2B3830]">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#2B3830]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#245C45] text-white flex items-center justify-center border border-[#377A5E] shadow-xs">
            <Boxes className="w-4 h-4 text-[#DCE7DD]" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
              <span>RetailIQ</span>
              <span className="text-[10px] uppercase font-mono font-medium px-1.5 py-0.5 rounded bg-[#2B3830] text-[#C66A42]">Ledger</span>
            </div>
            <div className="text-[11px] text-[#8E9F94] font-medium tracking-wide">
              Merchandising & Planning
            </div>
          </div>
        </div>
        {mobileOpen && (
          <button 
            onClick={onCloseMobile}
            className="p-1.5 text-[#8E9F94] hover:text-white rounded-md hover:bg-[#2B3830] lg:hidden cursor-pointer"
            aria-label="Close navigation drawer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-[#7E9085] uppercase">
          Inventory Planning
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer group ${
                isActive
                  ? 'bg-[#245C45] text-white font-semibold shadow-xs'
                  : 'text-[#BAC8BF] hover:text-white hover:bg-[#27342D]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#DCE7DD]' : 'text-[#8E9F94] group-hover:text-white'}`} />
                <span className="whitespace-nowrap">{item.label}</span>
              </div>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#C66A42]" />
              )}
            </button>
          );
        })}

        <div className="pt-5 pb-2 px-3">
          <div className="h-px bg-[#2B3830] mb-3" />
          <div className="text-[10px] font-semibold tracking-wider text-[#7E9085] uppercase">
            System & Sources
          </div>
        </div>

        <button
          onClick={() => handleNavClick('settings')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer group ${
            currentTab === 'settings'
              ? 'bg-[#245C45] text-white font-semibold shadow-xs'
              : 'text-[#BAC8BF] hover:text-white hover:bg-[#27342D]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Settings className={`w-4 h-4 transition-colors ${currentTab === 'settings' ? 'text-[#DCE7DD]' : 'text-[#8E9F94] group-hover:text-white'}`} />
            <span className="whitespace-nowrap">Data Sources & Config</span>
          </div>
          {currentTab === 'settings' && (
            <div className="w-1.5 h-1.5 rounded-full bg-[#C66A42]" />
          )}
        </button>
      </div>

      {/* Database & Active Store Status Widget */}
      <div className="p-3 mx-3 mb-3 bg-[#151D19] rounded-md border border-[#2B3830]">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <div className="flex items-center gap-1.5 text-[#BAC8BF] font-medium truncate">
            {databaseStatus?.activeSource === 'csv' || databaseStatus?.activeSource === 'pdf' ? (
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#C66A42] shrink-0" />
            ) : (
              <Database className="w-3.5 h-3.5 text-[#8E9F94] shrink-0" />
            )}
            <span className="font-mono text-[11px] text-white truncate">
              {databaseStatus?.connected ? (databaseStatus?.database || 'Connected Data') : 'No Data Connected'}
            </span>
          </div>
          <span className="text-[10px] font-mono font-medium text-[#BAC8BF] bg-[#222E27] px-1.5 py-0.5 rounded">
            {databaseStatus?.connected ? (databaseStatus?.isLiveMySQL ? 'LIVE' : 'LOADED') : 'STANDBY'}
          </span>
        </div>
        <div className="text-[10px] text-[#7E9085] flex items-center justify-between">
          <span className="flex items-center gap-1 text-[#8E9F94]">
            <ShieldCheck className="w-3 h-3 text-[#245C45] shrink-0" />
            <span>Read-Only Scope</span>
          </span>
          <span className="font-mono text-[9px] uppercase text-[#7E9085]">
            {databaseStatus?.isLiveMySQL ? 'MySQL 8.0' : 'SQL Engine'}
          </span>
        </div>
      </div>

      {/* User Profile & Sign Out */}
      <div className="p-3.5 border-t border-[#2B3830] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {user?.avatar ? (
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-8 h-8 rounded-md object-cover border border-[#377A5E] shrink-0" 
            />
          ) : (
            <div className="w-8 h-8 rounded-md bg-[#245C45] text-white flex items-center justify-center font-bold text-xs border border-[#377A5E] shrink-0">
              {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
            </div>
          )}
          <div className="overflow-hidden min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {user?.name || 'Retail Manager'}
            </div>
            <div className="text-[10px] text-[#8E9F94] truncate font-mono">
              {user?.email || 'manager@retailiq.internal'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          title="Sign out of RetailIQ"
          className="p-1.5 text-[#8E9F94] hover:text-white hover:bg-[#27342D] rounded-md transition-colors cursor-pointer shrink-0"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="fixed inset-0 bg-[#1C2520]/70 backdrop-blur-xs transition-opacity" 
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
