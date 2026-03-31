import { Router } from 'express';
import env from '../config/env.js';

const router = Router();

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

  console.log(`[vitals] ${JSON.stringify(payload)}`);
  return res.status(202).json({ ok: true });
});

export default router;
