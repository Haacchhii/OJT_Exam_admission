import env from '../config/env.js';
import { CACHE_DEFAULT_TTL_MS } from './constants.js';

/**
 * Simple in-memory cache with TTL.
 * Used for rarely-changing data like academic years and semesters.
 */

const store = new Map();
const CACHE_KEY_PREFIX = 'gk:cache:';

let redisClient = null;
let redisInitPromise = null;
let redisPermanentlyDisabled = false;

function cacheKey(key) {
  return `${CACHE_KEY_PREFIX}${key}`;
}

async function initRedisClient() {
  if (redisPermanentlyDisabled) return null;
  if (!env.ENABLE_REDIS_CACHE || !env.REDIS_URL) return null;
  if (redisClient?.isOpen) return redisClient;
  if (redisInitPromise) return redisInitPromise;

  redisInitPromise = (async () => {
    try {
      const redis = await import('redis');
      const client = redis.createClient({
        url: env.REDIS_URL,
        socket: { connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS },
      });

      client.on('error', (err) => {
        console.warn(`[cache] Redis error; using in-memory fallback: ${err?.message || err}`);
      });

      await client.connect();
      redisClient = client;
      console.log('[cache] Redis cache enabled');
      return redisClient;
    } catch (err) {
      redisPermanentlyDisabled = true;
      console.warn(`[cache] Redis init failed; using in-memory fallback: ${err?.message || err}`);
      return null;
    } finally {
      redisInitPromise = null;
    }
  })();

  return redisInitPromise;
}

async function readRedis(key) {
  const client = await initRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(cacheKey(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeRedis(key, value, ttlMs) {
  const client = await initRedisClient();
  if (!client) return;
  try {
    await client.set(cacheKey(key), JSON.stringify(value), { PX: ttlMs });
  } catch {
    // Ignore Redis write errors and keep serving from in-memory fallback.
  }
}

async function deleteRedisKey(key) {
  const client = await initRedisClient();
  if (!client) return;
  try {
    await client.del(cacheKey(key));
  } catch {
    // Best effort invalidation.
  }
}

async function deleteRedisByPrefix(prefix) {
  const client = await initRedisClient();
  if (!client) return;
  try {
    const pattern = cacheKey(`${prefix}*`);
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await client.del(key);
    }
  } catch {
    // Best effort invalidation.
  }
}

async function clearRedisNamespace() {
  const client = await initRedisClient();
  if (!client) return;
  try {
    const pattern = cacheKey('*');
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await client.del(key);
    }
  } catch {
    // Best effort clear.
  }
}

/**
 * Get a cached value, or compute & cache it if missing/expired.
 * @param {string} key Unique cache key
 * @param {Function} fn Async function that produces the value
 * @param {number} ttlMs Time-to-live in milliseconds
 */
export async function cached(key, fn, ttlMs = CACHE_DEFAULT_TTL_MS) {
  const redisValue = await readRedis(key);
  if (redisValue !== null) {
    return redisValue;
  }

  const entry = store.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) {
    return entry.value;
  }

  const value = await fn();
  store.set(key, { value, ts: Date.now() });
  void writeRedis(key, value, ttlMs);
  return value;
}

/** Invalidate a specific cache key. */
export function invalidate(key) {
  store.delete(key);
  void deleteRedisKey(key);
}

/** Invalidate all keys matching a prefix. */
export function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  void deleteRedisByPrefix(prefix);
}

/** Clear the entire cache. */
export function clearCache() {
  store.clear();
  void clearRedisNamespace();
}
