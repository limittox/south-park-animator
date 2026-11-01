/*
 * A tiny IndexedDB wrapper. Episodes and synthesized voice lines live here: they're too big
 * for localStorage, and voice lines cost money, so they're kept until the user clears them.
 */

const DB_NAME = 'ptstudio';
const VERSION = 1;
export type StoreName = 'episodes' | 'tts';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('episodes')) db.createObjectStore('episodes');
        if (!db.objectStoreNames.contains('tts')) db.createObjectStore('tts');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Could not open storage.'));
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Storage error.'));
      }),
  );
}

export const dbGet = <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
export const dbPut = (store: StoreName, key: string, value: unknown) => run(store, 'readwrite', (s) => s.put(value, key)).then(() => undefined);
export const dbDelete = (store: StoreName, key: string) => run(store, 'readwrite', (s) => s.delete(key)).then(() => undefined);
export const dbAll = <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
export const dbClear = (store: StoreName) => run(store, 'readwrite', (s) => s.clear()).then(() => undefined);
