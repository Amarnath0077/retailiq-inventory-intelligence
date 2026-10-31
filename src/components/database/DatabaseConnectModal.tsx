import React, { useState, useEffect } from 'react';
import { 
  Database, 
  X, 
  AlertTriangle, 
  Loader2, 
  ArrowRight,
  Server,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  Terminal,
  HelpCircle
} from 'lucide-react';
import { apiFetch } from '../../utils/api.ts';

interface DatabaseConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectSuccess: () => void;
}

export const DatabaseConnectModal: React.FC<DatabaseConnectModalProps> = ({
  isOpen,
  onClose,
  onConnectSuccess
}) => {
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(3306);
  const [user, setUser] = useState('root');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('ecommerce_db');
  const [ssl, setSsl] = useState(false);
  const [createIfNotExists, setCreateIfNotExists] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLaunchingSandbox, setIsLaunchingSandbox] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [discoveredDbs, setDiscoveredDbs] = useState<string[]>([]);
  const [showTunnelGuide, setShowTunnelGuide] = useState(false);

  const isLocalHost = host.trim() === '127.0.0.1' || host.trim().toLowerCase() === 'localhost';

  useEffect(() => {
    if (isOpen) {
      apiFetch('/api/database/databases')
        .then(res => res.json())
        .then(data => {
          if (data.databases && Array.isArray(data.databases)) {
            setDiscoveredDbs(data.databases);
            if (!database && data.databases.length > 0) {
              setDatabase(data.databases[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLaunchSandbox = async () => {
    setIsLaunchingSandbox(true);
    setErrorNotice(null);
    try {
      const res = await apiFetch('/api/database/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseName: database.trim() || 'ecommerce_db'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to initialize sandbox database.');
      }

      onConnectSuccess();
      onClose();
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to launch sandbox database.');
    } finally {
      setIsLaunchingSandbox(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host || !user || !database) {
      setErrorNotice('Host, username, and database name are required.');
      return;
    }

    setIsConnecting(true);
    setErrorNotice(null);

    try {
      const res = await apiFetch('/api/database/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: host.trim(),
          port: Number(port) || 3306,
          user: user.trim(),
          password,
          database: database.trim(),
          ssl,
          createIfNotExists
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Connection failed.');
      }

      onConnectSuccess();
      onClose();
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to connect to MySQL database.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden text-slate-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Connect MySQL Database</h2>
              <p className="text-xs text-slate-500">Link your live MySQL or MariaDB inventory database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto flex-1">
          {/* Fast-Track 1-Click Sandbox Option */}
          <div className="p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border-b border-indigo-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    Built-in Sandbox SQL Database
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-1.5 py-0.5 rounded">1-Click</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Connect immediately to an isolated <code className="font-mono text-indigo-700 font-semibold">ecommerce_db</code> with realistic retail records & discounts.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLaunchSandbox}
                disabled={isConnecting || isLaunchingSandbox}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLaunchingSandbox ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Launching...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Launch DB</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <form onSubmit={handleConnect} className="p-6 space-y-4">
            {errorNotice && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-3 text-xs text-rose-800">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <span className="font-bold">Connection Error: </span>
                    {errorNotice}
                  </div>
                </div>

                {/* Intelligent 1-click fallback if user hit 127.0.0.1 / localhost in cloud */}
                {isLocalHost && (
                  <div className="pt-2 border-t border-rose-200/60 flex flex-col gap-2">
                    <p className="text-[11px] text-rose-700">
                      <strong>Why did this happen?</strong> RetailIQ is running on a cloud deployment. When you enter <code className="bg-rose-100 px-1 rounded text-rose-800">127.0.0.1</code>, it looks for MySQL inside the cloud container, not your computer.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleLaunchSandbox}
                        disabled={isLaunchingSandbox}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Launch Sandbox Database Instead</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTunnelGuide(!showTunnelGuide)}
                        className="px-2.5 py-1.5 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Tunnel local MySQL</span>
                        {showTunnelGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Expandable Tunnel Guide for connecting local MySQL */}
            {showTunnelGuide && (
              <div className="p-3.5 bg-slate-900 text-slate-200 rounded-xl text-xs space-y-2 border border-slate-700 font-sans">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Connect your computer&apos;s local MySQL via ngrok</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  To securely expose your local MySQL (port 3306) to this cloud deployment, run in your terminal:
                </p>
                <div className="bg-black/60 p-2 rounded font-mono text-[11px] text-emerald-300 select-all border border-slate-800">
                  ngrok tcp 3306
                </div>
                <p className="text-[11px] text-slate-400">
                  Copy the forwarded host (e.g. <code className="text-white">0.tcp.ngrok.io</code>) into Host and the assigned port (e.g. <code className="text-white">14321</code>) into Port.
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Host / Server Address
                </label>
                <div className="relative">
                  <Server className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="127.0.0.1 or db.example.com"
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                </div>
                {isLocalHost && (
                  <p className="mt-1 text-[10px] text-amber-600 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 shrink-0" />
                    <span>In cloud mode, 127.0.0.1 targets the cloud container. Use Sandbox or a remote host.</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  required
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  placeholder="3306"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Database Username
                </label>
                <input
                  type="text"
                  required
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="root"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Database password"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Database Name
              </label>
              <input
                type="text"
                required
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="e.g. ecommerce_db, inventory_db"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white font-mono"
              />
              {discoveredDbs.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-medium">Discovered on server:</span>
                  {discoveredDbs.slice(0, 4).map(db => (
                    <button
                      key={db}
                      type="button"
                      onClick={() => setDatabase(db)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    >
                      {db}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ssl}
                  onChange={(e) => setSsl(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Enable SSL Encryption</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createIfNotExists}
                  onChange={(e) => setCreateIfNotExists(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Create DB if not exists</span>
              </label>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                disabled={isConnecting || isLaunchingSandbox}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isConnecting || isLaunchingSandbox}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Connect & Load Data</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
