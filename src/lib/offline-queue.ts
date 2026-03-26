/**
 * Offline flight queue using IndexedDB.
 * Stores flight data when offline, syncs when back online.
 */

const DB_NAME = "flyary-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-flights";

export interface OfflineFlight {
  id: string; // client-generated UUID
  flightData: Record<string, any>;
  youtubeUrls: string[];
  selectedTrainingIds: string[];
  createdAt: string;
  syncStatus: "pending" | "syncing" | "failed";
  errorMessage?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineFlight(flight: OfflineFlight): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(flight);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingFlights(): Promise<OfflineFlight[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function removeOfflineFlight(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateOfflineFlightStatus(
  id: string,
  status: OfflineFlight["syncStatus"],
  errorMessage?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const flight = getReq.result;
      if (flight) {
        flight.syncStatus = status;
        if (errorMessage) flight.errorMessage = errorMessage;
        store.put(flight);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getPendingCount(): Promise<number> {
  return getPendingFlights().then(f => f.length);
}
