import { beforeEach, describe, expect, it, vi } from 'vitest';

const disconnect = vi.fn().mockResolvedValue(undefined);
const get = vi.fn(() => new Promise(() => {}));

vi.mock('../src/config/env.js', () => ({
  default: {
    ENABLE_REDIS_CACHE: true,
    REDIS_URL: 'redis://audit.invalid',
    REDIS_CONNECT_TIMEOUT_MS: 20,
    REDIS_COMMAND_TIMEOUT_MS: 20,
  },
}));

vi.mock('redis', () => ({
  createClient: () => ({
    isOpen: false,
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    get,
    set: vi.fn().mockResolvedValue(undefined),
    disconnect,
  }),
}));

describe('Redis cache resilience', () => {
  beforeEach(() => {
    disconnect.mockClear();
    get.mockClear();
  });

  it('falls back to the source when a Redis command stops responding', async () => {
    const { cached } = await import('../src/utils/cache.js');

    await expect(cached('redis:timeout', async () => 'database-value'))
      .resolves.toBe('database-value');
    expect(disconnect).toHaveBeenCalled();
  }, 250);
});
