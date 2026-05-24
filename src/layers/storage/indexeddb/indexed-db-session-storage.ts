import type { SessionState } from '@/layers/core/session/session-state';
import type { SessionStorageProvider } from '../session-storage-provider';

const DEFAULT_DB_NAME = 'drop-ai-v3';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

export interface IndexedDbSessionStorageOptions {
  dbName?: string;
}

export class IndexedDbSessionStorage implements SessionStorageProvider {
  private readonly dbName: string;

  constructor(options: IndexedDbSessionStorageOptions = {}) {
    this.dbName = options.dbName ?? DEFAULT_DB_NAME;
  }

  async loadLatest(): Promise<SessionState | null> {
    const db = await this.openDb();
    try {
      const all = await this.getAllSnapshots(db);
      if (all.length === 0) return null;
      const latest = all.reduce((a, b) =>
        a.updatedAt > b.updatedAt ? a : b
      );
      return structuredClone(latest);
    } finally {
      db.close();
    }
  }

  async save(session: SessionState): Promise<void> {
    const db = await this.openDb();
    try {
      await runTransaction(db, 'readwrite', store => {
        store.put(structuredClone(session));
      });
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    const db = await this.openDb();
    try {
      await runTransaction(db, 'readwrite', store => {
        store.clear();
      });
    } finally {
      db.close();
    }
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private getAllSnapshots(db: IDBDatabase): Promise<SessionState[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const raw: unknown = request.result;
        if (!Array.isArray(raw)) {
          resolve([]);
          return;
        }
        resolve(raw.filter(isSessionStateLike));
      };
      request.onerror = () => reject(request.error);
    });
  }
}

function isSessionStateLike(value: unknown): value is SessionState {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'trackOrder' in value &&
    Array.isArray(value.trackOrder) &&
    'tracksById' in value &&
    typeof value.tracksById === 'object' &&
    'playback' in value &&
    typeof value.playback === 'object' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'string'
  );
}

function runTransaction(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    work(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
