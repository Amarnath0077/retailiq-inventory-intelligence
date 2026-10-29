import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely attempt to patch global fetch with Authorization headers if browser environment allows
try {
  const originalFetch = window.fetch.bind(window);
  const authPatchedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const token = localStorage.getItem('retailiq_token');
      if (token) {
        init = init ? { ...init } : {};
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init.headers = headers;
      }
    } catch {
      // LocalStorage access may fail in private/sandboxed contexts; continue gracefully
    }
    return originalFetch(input, init);
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: authPatchedFetch,
      writable: true,
      configurable: true,
    });
  } catch {
    try {
      (window as any).fetch = authPatchedFetch;
    } catch {
      // In sandboxed browsers where window.fetch is getter-only/sealed,
      // requests use apiFetch or session cookies cleanly.
    }
  }
} catch {
  // Graceful fallback to avoid unhandled runtime bootstrap error
}

createRoot(document.getElementById('root')!).render(<App />);
