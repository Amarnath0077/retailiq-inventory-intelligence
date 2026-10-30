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
  FileText,
  LogOut,
  Sparkles,
  ChevronRight
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
  
  const navItems: Array<{ 
    id: NavTab; 
    label: string; 
    badge?: string;
    badgeColor?: string;
    icon: React.ComponentType<{ className?: string }> 
  }> = [
    { id: 'dashboard', label: 'Inventory Overview', icon: LayoutDashboard },
    { id: 'inventory', label: 'Merchandise Catalog', icon: Package },
    { id: 'analytics', label: 'Stock Distribution', icon: BarChart3 },
    { id: 'assistant', label: 'Retail Assistant', icon: MessageSquareText, badge: 'AI', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-200 select-none border-r border-slate-800/80 shadow-xl">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Boxes className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>RetailIQ</span>
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Enterprise Inventory AI
            </div>
          </div>
        </div>
        {mobileOpen && (
          <button 
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 lg:hidden cursor-pointer"
            aria-label="Close navigation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-5 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          Inventory Analytics
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer group ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'
                }`} />
                <span className="whitespace-nowrap">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    isActive ? 'bg-white/20 text-white border-white/30' : item.badgeColor
                  }`}>
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-xs shadow-cyan-300" />
                )}
              </div>
            </button>
          );
        })}

        <div className="pt-6 pb-2 px-3">
          <div className="h-px bg-slate-800/80 mb-3" />
          <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Platform & Data
          </div>
        </div>

        <button
          onClick={() => handleNavClick('settings')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer group ${
            currentTab === 'settings'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <Settings className={`w-4 h-4 transition-transform group-hover:scale-110 ${
              currentTab === 'settings' ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'
            }`} />
            <span className="whitespace-nowrap">Data Sources & Config</span>
          </div>
          {currentTab === 'settings' && (
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-xs shadow-cyan-300" />
          )}
        </button>
      </div>

      {/* Database & Active Store Status Widget */}
      <div className="p-3.5 mx-3 mb-3 bg-slate-900/90 rounded-xl border border-slate-800 shadow-inner">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <div className="flex items-center gap-2 text-slate-300 font-medium truncate">
            {databaseStatus?.activeSource === 'csv' ? (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : databaseStatus?.activeSource === 'pdf' ? (
              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            )}
            <span className="font-mono text-[11px] text-white font-semibold truncate">
              {databaseStatus?.connected ? (databaseStatus?.database || 'Connected Data') : 'No Source Connected'}
            </span>
          </div>

          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            databaseStatus?.connected
              ? (databaseStatus?.isLiveMySQL 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30')
              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
          }`}>
            {databaseStatus?.connected ? (databaseStatus?.isLiveMySQL ? 'LIVE' : 'LOADED') : 'STANDBY'}
          </span>
        </div>

        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
          <span className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>Read-Only Sandbox</span>
          </span>
          <span className="font-mono text-[9px] uppercase text-slate-400 font-semibold">
            {databaseStatus?.isLiveMySQL ? 'MySQL 8.0' : 'Multi-Tenant'}
          </span>
        </div>
      </div>

      {/* User Profile & Sign Out */}
      <div className="p-4 border-t border-slate-800/80 flex items-center justify-between gap-2 bg-slate-900/50">
        <div className="flex items-center gap-3 min-w-0">
          {user?.avatar ? (
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-9 h-9 rounded-xl object-cover border border-indigo-500/40 shrink-0" 
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs border border-indigo-400/30 shrink-0 shadow-sm">
              {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
            </div>
          )}
          <div className="overflow-hidden min-w-0">
            <div className="text-xs font-bold text-white truncate">
              {user?.name || 'Retail Manager'}
            </div>
            <div className="text-[10px] text-slate-400 truncate font-mono">
              {user?.email || 'manager@retailiq.internal'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          title="Sign out of RetailIQ"
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer shrink-0"
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
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" 
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
