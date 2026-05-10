import { Router } from 'express';
import env from '../config/env.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { perfVitalSchema, perfSummaryQuerySchema } from '../utils/schemas.js';
import { getPerfSummary, observeVitalMetric } from '../utils/perfStore.js';

const router = Router();

// Warmup ping endpoint — no auth required, returns instantly
router.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true });
});

function hasSummaryAccess(req) {
  if (env.NODE_ENV !== 'production' && !env.PERF_MONITOR_KEY) return true;
  const provided = req.get('x-perf-key') || req.query?.key;
  return Boolean(env.PERF_MONITOR_KEY) && provided === env.PERF_MONITOR_KEY;
}

// Lightweight endpoint for browser-side Web Vitals ingestion.
router.post('/vitals', validate(perfVitalSchema), (req, res) => {
  if (!env.PERF_INGEST_ENABLED) {
    return res.status(202).json({ ok: true, ignored: true });
  }

  const {
    metric,
    value,
    rating,
    id,
    page,
    timestamp,
    navigationType,
    userAgent,
  } = req.body || {};

  const payload = {
    metric,
    value,
    rating: rating || 'unknown',
    id: id || null,
    page: page || null,
    timestamp: timestamp || Date.now(),
    navigationType: navigationType || null,
    userAgent: userAgent || null,
    ip: req.ip,
  };

  observeVitalMetric(payload);
  console.log(`[vitals] ${JSON.stringify(payload)}`);
  return res.status(202).json({ ok: true });
});

router.get('/summary', validateQuery(perfSummaryQuerySchema), (req, res) => {
  if (!hasSummaryAccess(req)) {
    return res.status(403).json({ error: 'Performance summary access denied', code: 'FORBIDDEN' });
  }

  const minutes = Number(req.query?.minutes);
  const limit = Number(req.query?.limit);
  return res.json(getPerfSummary({ minutes, limit }));
});

export default router;
