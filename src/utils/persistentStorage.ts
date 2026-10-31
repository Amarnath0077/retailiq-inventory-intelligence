/**
 * RetailIQ User-Isolated Persistent Dataset Storage
 * Provides reliable, long-term persistence across serverless container recycles
 * and browser reloads using IndexedDB with localStorage fallback.
 */

const DB_NAME = 'RetailIQ_OfflineStore';
const DB_VERSION = 1;
const STORE_NAME = 'user_datasets';

export interface StoredUserDataset {
  userId: string;
  fileType: 'csv' | 'pdf' | 'database';
  fileName: string;
  records: Record<string, any>[];
  importedAt: string;
  summary?: any;
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target?.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save confirmed user dataset persistently (user-isolated)
 */
export async function saveUserDataset(dataset: StoredUserDataset): Promise<void> {
  if (!dataset.userId) return;

  // 1. Try IndexedDB (handles large datasets up to hundreds of MBs)
  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(dataset);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to localStorage:', err);
  }

  // 2. Also save to localStorage as fast-path fallback (if size permits)
  try {
    const key = `retailiq_dataset_${dataset.userId}`;
    const payload = JSON.stringify(dataset);
    // Only store in localStorage if payload < 4.5 MB to avoid quota errors
    if (payload.length < 4.5 * 1024 * 1024) {
      localStorage.setItem(key, payload);
    }
  } catch (err) {
    // LocalStorage quota exceeded or disabled, IndexedDB already has it
  }
}

/**
 * Load confirmed user dataset from persistent storage
 */
export async function loadUserDataset(userId: string): Promise<StoredUserDataset | null> {
  if (!userId) return null;

  // 1. Try IndexedDB first
  try {
    const db = await openDB();
    if (db) {
      const result = await new Promise<StoredUserDataset | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(userId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (result && Array.isArray(result.records) && result.records.length > 0) {
        return result;
      }
    }
  } catch (err) {
    console.warn('IndexedDB read failed:', err);
  }

  // 2. Fallback to localStorage
  try {
    const key = `retailiq_dataset_${userId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: StoredUserDataset = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Delete persistent dataset for a specific user (on manual disconnect/reset)
 */
export async function clearUserDataset(userId: string): Promise<void> {
  if (!userId) return;

  try {
    const db = await openDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(userId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    }
  } catch {}

  try {
    localStorage.removeItem(`retailiq_dataset_${userId}`);
  } catch {}
}
