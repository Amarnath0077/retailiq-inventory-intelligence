import React, { useState, useEffect } from 'react';
import { 
  Database, 
  X, 
  AlertTriangle, 
  Loader2, 
  ArrowRight,
  Server
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
  const [database, setDatabase] = useState('');
  const [ssl, setSsl] = useState(false);
  const [createIfNotExists, setCreateIfNotExists] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [discoveredDbs, setDiscoveredDbs] = useState<string[]>([]);

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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
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

        {/* Form Body */}
        <form onSubmit={handleConnect}>
          <div className="p-6 space-y-4">
            {errorNotice && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <span className="font-semibold">Connection Error: </span>
                  {errorNotice}
                </div>
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
                placeholder="e.g. inventory_db, ecommerce_db"
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
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isConnecting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConnecting}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting to MySQL...</span>
                </>
              ) : (
                <>
                  <span>Connect & Load Data</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
