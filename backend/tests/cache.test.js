import { describe, it, expect } from 'vitest';
import { cached, invalidate, invalidatePrefix, clearCache } from '../src/utils/cache.js';

describe('cache utility', () => {
  it('returns computed value on first call', async () => {
    const result = await cached('test:1', () => Promise.resolve(42));
    expect(result).toBe(42);
    clearCache();
  });

  it('returns cached value on subsequent calls', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve('hello'); };
    await cached('test:2', fn);
    await cached('test:2', fn);
    expect(calls).toBe(1);
    clearCache();
  });

  it('invalidate clears a specific key', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve('val'); };
    await cached('test:3', fn);
    invalidate('test:3');
    await cached('test:3', fn);
    expect(calls).toBe(2);
    clearCache();
  });

  it('invalidatePrefix clears matching keys', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve('v'); };
    await cached('pf:a', fn);
    await cached('pf:b', fn);
    await cached('other:c', fn);
    expect(calls).toBe(3);
    invalidatePrefix('pf:');
    await cached('pf:a', fn);
    await cached('other:c', fn);
    expect(calls).toBe(4); // pf:a re-computed, other:c still cached
    clearCache();
  });

  it('respects TTL', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve('t'); };
    await cached('test:ttl', fn, 10); // 10ms TTL
    await new Promise(r => setTimeout(r, 20));
    await cached('test:ttl', fn, 10);
    expect(calls).toBe(2);
    clearCache();
  });
});
