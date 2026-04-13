import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { RATE_LIMITS } from '../src/utils/constants.js';

describe('security guards', () => {
  it('rejects invalid verify-email payload with validation error', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid perf vitals payload with validation error', async () => {
    const res = await request(app)
      .post('/api/perf/vitals')
      .send({ metric: 'LCP' });

    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('VALIDATION_ERROR');
  });

  it('enforces auth route rate limiting', async () => {
    let sawRateLimit = false;

    for (let i = 0; i < RATE_LIMITS.AUTH.max + 3; i++) {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({});

      if (res.status === 429) {
        sawRateLimit = true;
        expect(res.body?.code).toBe('RATE_LIMIT');
        break;
      }
    }

    expect(sawRateLimit).toBe(true);
  });

  it('enforces perf ingestion rate limiting', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let sawRateLimit = false;

    try {
      for (let i = 0; i < RATE_LIMITS.PERF_INGEST.max + 5; i++) {
        const res = await request(app)
          .post('/api/perf/vitals')
          .send({ metric: 'LCP', value: 1234, rating: 'good' });

        if (res.status === 429) {
          sawRateLimit = true;
          expect(res.body?.code).toBe('RATE_LIMIT');
          break;
        }
      }
    } finally {
      logSpy.mockRestore();
    }

    expect(sawRateLimit).toBe(true);
  });
});
