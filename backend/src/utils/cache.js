import { CACHE_DEFAULT_TTL_MS } from './constants.js';

/**
 * Simple in-memory cache with TTL.
 * Used for rarely-changing data like academic years and semesters.
 */

const store = new Map();

/**
 * Get a cached value, or compute & cache it if missing/expired.
 * @param {string} key Unique cache key
 * @param {Function} fn Async function that produces the value
 * @param {number} ttlMs Time-to-live in milliseconds
 */
export async function cached(key, fn, ttlMs = CACHE_DEFAULT_TTL_MS) {
  const entry = store.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) {
    return entry.value;
  }
  const value = await fn();
  store.set(key, { value, ts: Date.now() });
  return value;
}

/** Invalidate a specific cache key. */
export function invalidate(key) {
  store.delete(key);
}

/** Invalidate all keys matching a prefix. */
export function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Clear the entire cache. */
export function clearCache() {
  store.clear();
}
