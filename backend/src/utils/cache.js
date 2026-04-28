import env from '../config/env.js';
import { CACHE_DEFAULT_TTL_MS } from './constants.js';

const store = new Map();
const inflight = new Map();
const CACHE_KEY_PREFIX = 'gk:cache:';

let redisClient = null;
let redisInitPromise = null;

function cacheKey(key) {
  return `${CACHE_KEY_PREFIX}${key}`;
}

async function initRedisClient() {
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
        console.warn(`[cache] Redis error: ${err?.message || err}`);
        // Reset so next call can retry — don't permanently disable
        redisClient = null;
      });
      await client.connect();
      redisClient = client;
      console.log('[cache] Redis connected');
      return redisClient;
    } catch (err) {
      console.warn(`[cache] Redis init failed, using in-memory: ${err?.message || err}`);
      redisClient = null;
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
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function writeRedis(key, value, ttlMs) {
  const client = await initRedisClient();
  if (!client) return;
  try {
    await client.set(cacheKey(key), JSON.stringify(value), { PX: ttlMs });
  } catch { /* ignore write errors */ }
}

async function deleteRedisKey(key) {
  const client = await initRedisClient();
  if (!client) return;
  try { await client.del(cacheKey(key)); } catch { /* best effort */ }
}

async function deleteRedisByPrefix(prefix) {
  const client = await initRedisClient();
  if (!client) return;
  try {
    const pattern = cacheKey(`${prefix}*`);
    const keys = [];
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }
    if (keys.length) await client.del(keys); // batch delete, one round-trip
  } catch { /* best effort */ }
}

export async function cached(key, fn, ttlMs = CACHE_DEFAULT_TTL_MS) {
  const redisValue = await readRedis(key);
  if (redisValue !== null) return redisValue;

  const entry = store.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) return entry.value;
  store.delete(key);

  const pending = inflight.get(key);
  if (pending) return pending;

  const pendingCompute = (async () => {
    const value = await fn();
    store.set(key, { value, ts: Date.now() });
    void writeRedis(key, value, ttlMs);
    return value;
  })();

  inflight.set(key, pendingCompute);
  try {
    return await pendingCompute;
  } finally {
    inflight.delete(key);
  }
}

export async function invalidate(key) {
  store.delete(key);
  inflight.delete(key);
  await deleteRedisKey(key);
}

export async function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
  await deleteRedisByPrefix(prefix); // awaited now
}

export async function clearCache() {
  store.clear();
  inflight.clear();
}
