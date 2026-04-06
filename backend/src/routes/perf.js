import { Router } from 'express';
import env from '../config/env.js';
import { getPerfSummary, observeVitalMetric } from '../utils/perfStore.js';

const router = Router();

function hasSummaryAccess(req) {
  if (env.NODE_ENV !== 'production' && !env.PERF_MONITOR_KEY) return true;
  const provided = req.get('x-perf-key') || req.query?.key;
  return Boolean(env.PERF_MONITOR_KEY) && provided === env.PERF_MONITOR_KEY;
}

// Lightweight endpoint for browser-side Web Vitals ingestion.
router.post('/vitals', (req, res) => {
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

  if (!metric || typeof value !== 'number') {
    return res.status(400).json({ error: 'Invalid vitals payload', code: 'VALIDATION_ERROR' });
  }

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

router.get('/summary', (req, res) => {
  if (!hasSummaryAccess(req)) {
    return res.status(403).json({ error: 'Performance summary access denied', code: 'FORBIDDEN' });
  }

  const minutes = Number(req.query?.minutes);
  const limit = Number(req.query?.limit);
  return res.json(getPerfSummary({ minutes, limit }));
});

export default router;
