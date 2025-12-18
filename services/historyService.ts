
import { HistoryItem } from '../types';

const DB_NAME = 'PromptopiaDB';
const STORE_NAME = 'history';
const DB_VERSION = 1;

// Helper to open DB
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => reject("IndexedDB error");

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveItem = async (item: HistoryItem): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(item);

        request.onsuccess = () => resolve();
        request.onerror = () => reject("Failed to save item");
    });
};

export const getItems = async (): Promise<HistoryItem[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            // Sort by timestamp desc
            const items = (request.result as HistoryItem[]).sort((a, b) => b.timestamp - a.timestamp);
            resolve(items);
        };
        request.onerror = () => reject("Failed to get items");
    });
};

export const deleteItem = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject("Failed to delete item");
    });
};

export const clearHistory = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject("Failed to clear history");
    });
};
