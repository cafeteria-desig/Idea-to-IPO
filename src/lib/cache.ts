// In-memory lightweight cache for high-frequency read endpoints
// Provides sub-millisecond response times for browsers & prevents database connection saturation

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs: number = 2000): void {
  memoryStore.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateCache(prefixOrKey?: string): void {
  if (!prefixOrKey) {
    memoryStore.clear();
    return;
  }
  const keysToDelete: string[] = [];
  memoryStore.forEach((_, k) => {
    if (k === prefixOrKey || k.startsWith(prefixOrKey)) {
      keysToDelete.push(k);
    }
  });
  keysToDelete.forEach((k) => memoryStore.delete(k));
}
