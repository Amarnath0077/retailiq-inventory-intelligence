import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AuthPage } from './components/auth/AuthPage.tsx';
import { Sidebar, NavTab } from './components/layout/Sidebar.tsx';
import { TopNav } from './components/layout/TopNav.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { InventoryView } from './components/inventory/InventoryView.tsx';
import { AssistantView } from './components/assistant/AssistantView.tsx';
import { AnalyticsView } from './components/analytics/AnalyticsView.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { InventoryMetrics, DatabaseStatus, AppSettings } from './types/inventory.ts';
import { apiFetch } from './utils/api.ts';
import { RefreshCw, Boxes } from 'lucide-react';

function AuthenticatedApp() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; model: string; provider?: string } | null>(null);
  const [assistantQuery, setAssistantQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    lowStockThreshold: 15,
    queryRoutingMode: 'hybrid',
    databaseName: 'atliq_tshirts',
    dbHost: 'localhost:3306',
    pythonBackendUrl: 'http://localhost:8000',
    lastSyncTime: new Date().toISOString()
  });

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      const [metricsRes, healthRes, settingsRes, aiRes] = await Promise.all([
        apiFetch('/api/metrics'),
        apiFetch('/api/health'),
        apiFetch('/api/settings'),
        apiFetch('/api/ai/status')
      ]);

      // If session expired or unauthorized, sign out to return to login cleanly
      if (metricsRes.status === 401 || settingsRes.status === 401) {
        logout();
        return;
      }

      if (metricsRes.ok) {
        const m: InventoryMetrics = await metricsRes.json();
        setMetrics(m);
      }

      if (healthRes.ok) {
        const h: DatabaseStatus = await healthRes.json();
        setDatabaseStatus(h);
      }

      if (settingsRes.ok) {
        const s: AppSettings = await settingsRes.json();
        setSettings(s);
      }

      if (aiRes.ok) {
        const a = await aiRes.json();
        setAiStatus(a);
      }
    } catch (err) {
      console.error('Error fetching RetailIQ application data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [user, logout]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // Live polling for connected MySQL database (every 30 seconds)
  useEffect(() => {
    if (!databaseStatus?.isLiveMySQL || !user) return;

    const intervalId = setInterval(() => {
      apiFetch('/api/dataset/refresh', { method: 'POST' })
        .then(() => loadData())
        .catch(() => {});
    }, 30000);

    return () => clearInterval(intervalId);
  }, [databaseStatus?.isLiveMySQL, user, loadData]);

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        // Recalculate metrics immediately with the new threshold
        const metricsRes = await apiFetch('/api/metrics');
        if (metricsRes.ok) {
          const m = await metricsRes.json();
          setMetrics(m);
        }
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  // State 1: Authenticating Session Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 animate-in fade-in">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
            <Boxes className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
            <span>Verifying RetailIQ workspace session...</span>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Unauthenticated Visitor -> Render Professional Login & Registration Page
  if (!user) {
    return <AuthPage />;
  }

  // State 3: Authenticated User -> Render Protected Retail Ledger Dashboard
  return (
    <div className="min-h-screen bg-[#F7F6F0] flex text-[#252B28] font-sans antialiased">
      {/* Dark Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        databaseStatus={databaseStatus ? { 
          connected: databaseStatus.connected, 
          database: databaseStatus.database,
          isLiveMySQL: databaseStatus.isLiveMySQL
        } : undefined}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Navigation */}
        <TopNav
          currentTab={currentTab}
          onOpenMobile={() => setMobileOpen(true)}
          onRefresh={loadData}
          isRefreshing={isRefreshing}
          lastUpdated={metrics?.lastUpdated || new Date().toISOString()}
          databaseStatus={databaseStatus || undefined}
          aiStatus={aiStatus || undefined}
          onNavigateToSettings={() => setCurrentTab('settings')}
        />

        {/* Dynamic Viewport */}
        <main className="flex-1 pb-12">
          {currentTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              isLoading={isRefreshing && !metrics}
              onRefresh={loadData}
              onNavigateToInventory={() => setCurrentTab('inventory')}
              onNavigateToSettings={() => setCurrentTab('settings')}
              lowStockThreshold={settings.lowStockThreshold}
              onSelectSuggestion={(query) => {
                setAssistantQuery(query);
                setCurrentTab('assistant');
              }}
            />
          )}

          {currentTab === 'inventory' && (
            <InventoryView
              lowStockThreshold={settings.lowStockThreshold}
            />
          )}

          {currentTab === 'assistant' && (
            <AssistantView
              lowStockThreshold={settings.lowStockThreshold}
              databaseName={databaseStatus?.database || settings.databaseName}
              initialQuery={assistantQuery}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView
              metrics={metrics}
              isLoading={isRefreshing && !metrics}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              currentSettings={settings}
              onUpdateSettings={handleUpdateSettings}
              databaseStatus={databaseStatus}
              onRefreshDatabase={loadData}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
