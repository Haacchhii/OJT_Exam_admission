const DEFAULT_MAX_SAMPLES = Number.parseInt(process.env.PERF_MAX_SAMPLES || '240', 10) || 240;
const DEFAULT_RETENTION_MINUTES = Number.parseInt(process.env.PERF_RETENTION_MINUTES || '180', 10) || 180;
const RETENTION_MS = DEFAULT_RETENTION_MINUTES * 60 * 1000;

const apiSeries = new Map();
const apiTimeline = new Map();
const dbSeries = new Map();
const dbTimeline = new Map();
const vitalsSeries = new Map();

function envInt(name, fallback) {
  const parsed = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SLO_TARGETS = [
  { key: 'GET /api/health', p95Ms: envInt('PERF_SLO_HEALTH_P95_MS', 1200) },
  { key: 'GET /api/exams/registrations/mine-summary', p95Ms: envInt('PERF_SLO_STUDENT_REG_SUMMARY_P95_MS', 900) },
  { key: 'GET /api/results/mine', p95Ms: envInt('PERF_SLO_STUDENT_RESULTS_MINE_P95_MS', 900) },
  { key: 'GET /api/exams/schedules/available', p95Ms: envInt('PERF_SLO_STUDENT_AVAILABLE_SCHEDULES_P95_MS', 1200) },
  { key: 'GET /api/admissions/dashboard-summary', p95Ms: envInt('PERF_SLO_EMP_DASHBOARD_SUMMARY_P95_MS', 1200) },
  { key: 'GET /api/admissions/reports-summary', p95Ms: envInt('PERF_SLO_EMP_REPORTS_SUMMARY_P95_MS', 1500) },
  { key: 'GET /api/results/employee-summary', p95Ms: envInt('PERF_SLO_EMP_RESULTS_SUMMARY_P95_MS', 1700) },
];

function toMinuteBucket(timestampMs) {
  return Math.floor(timestampMs / 60000) * 60000;
}

function pruneTimeline(timelineMap, nowMs) {
  const cutoff = nowMs - RETENTION_MS;
  for (const [bucketTs] of timelineMap) {
    if (bucketTs < cutoff) timelineMap.delete(bucketTs);
  }
}

function normalizeApiPath(rawPath) {
  let path = String(rawPath || '').split('?')[0] || '/';
  path = path.replace(/\/[0-9]+(?=\/|$)/g, '/:id');
  path = path.replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id');
  path = path.replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}(?=\/|$)/g, '/:id');
  path = path.replace(/\/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?=\/|$)/g, '/:email');
  return path;
}

function normalizeDbSignature(query, target) {
  const compact = String(query || '').replace(/\s+/g, ' ').trim();
  if (!compact) {
    const fallbackTarget = String(target || 'db').split('.').pop() || 'db';
    return `QUERY ${fallbackTarget}`;
  }

  const operation = compact.split(' ')[0].toUpperCase();
  const tableMatch = compact.match(/(?:from|into|update|join)\s+["`]?([a-zA-Z0-9_.]+)/i);
  const tableName = tableMatch?.[1]?.split('.')?.pop() || String(target || 'db').split('.').pop() || 'db';
  return `${operation} ${tableName}`;
}

function pushSample(series, value, nowMs, errored) {
  series.count += 1;
  series.total += value;
  series.min = Math.min(series.min, value);
  series.max = Math.max(series.max, value);
  if (errored) series.errors += 1;
  series.lastAt = nowMs;
  series.samples.push(value);
  if (series.samples.length > DEFAULT_MAX_SAMPLES) {
    series.samples.shift();
  }
}

function ensureSeries(store, key) {
  let entry = store.get(key);
  if (!entry) {
    entry = {
      count: 0,
      errors: 0,
      total: 0,
      min: Number.POSITIVE_INFINITY,
      max: 0,
      lastAt: 0,
      samples: [],
    };
    store.set(key, entry);
  }
  return entry;
}

function ensureTimelineBucket(timelineStore, key, nowMs) {
  let timeline = timelineStore.get(key);
  if (!timeline) {
    timeline = new Map();
    timelineStore.set(key, timeline);
  }

  const minuteTs = toMinuteBucket(nowMs);
  let bucket = timeline.get(minuteTs);
  if (!bucket) {
    bucket = { count: 0, errors: 0, total: 0, max: 0 };
    timeline.set(minuteTs, bucket);
  }

  return { timeline, bucket };
}

function percentileFromSamples(samples, pct) {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
}

function seriesToStats(key, series) {
  const avg = series.count > 0 ? series.total / series.count : 0;
  return {
    key,
    count: series.count,
    errors: series.errors,
    errorRate: series.count > 0 ? Number(((series.errors / series.count) * 100).toFixed(2)) : 0,
    avgMs: Number(avg.toFixed(2)),
    minMs: Number((Number.isFinite(series.min) ? series.min : 0).toFixed(2)),
    maxMs: Number(series.max.toFixed(2)),
    p50Ms: Number(percentileFromSamples(series.samples, 50).toFixed(2)),
    p95Ms: Number(percentileFromSamples(series.samples, 95).toFixed(2)),
    p99Ms: Number(percentileFromSamples(series.samples, 99).toFixed(2)),
    lastAt: series.lastAt,
  };
}

function timelineToArray(timeline, minutes, nowMs) {
  const fromTs = nowMs - (Math.max(1, minutes) * 60 * 1000);
  const result = [];
  for (const [minuteTs, bucket] of timeline.entries()) {
    if (minuteTs < fromTs) continue;
    result.push({
      minute: minuteTs,
      count: bucket.count,
      errors: bucket.errors,
      avgMs: bucket.count > 0 ? Number((bucket.total / bucket.count).toFixed(2)) : 0,
      maxMs: Number(bucket.max.toFixed(2)),
    });
  }
  return result.sort((a, b) => a.minute - b.minute);
}

export function observeApiRequest({ method, path, status, durationMs }) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;

  const nowMs = Date.now();
  const normalizedPath = normalizeApiPath(path);
  const key = `${String(method || 'GET').toUpperCase()} ${normalizedPath}`;
  const errored = Number(status) >= 500;

  const series = ensureSeries(apiSeries, key);
  pushSample(series, durationMs, nowMs, errored);

  const { timeline, bucket } = ensureTimelineBucket(apiTimeline, key, nowMs);
  bucket.count += 1;
  if (errored) bucket.errors += 1;
  bucket.total += durationMs;
  bucket.max = Math.max(bucket.max, durationMs);
  pruneTimeline(timeline, nowMs);

  const { timeline: overallTimeline, bucket: overallBucket } = ensureTimelineBucket(apiTimeline, 'ALL', nowMs);
  overallBucket.count += 1;
  if (errored) overallBucket.errors += 1;
  overallBucket.total += durationMs;
  overallBucket.max = Math.max(overallBucket.max, durationMs);
  pruneTimeline(overallTimeline, nowMs);
}

export function observeDbQuery({ method, routePath, target, durationMs, query }) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;

  const nowMs = Date.now();
  const routeKey = routePath
    ? `${String(method || 'GET').toUpperCase()} ${normalizeApiPath(routePath)}`
    : 'SYSTEM';
  const signature = normalizeDbSignature(query, target);
  const key = `${routeKey} :: ${signature}`;

  const series = ensureSeries(dbSeries, key);
  pushSample(series, durationMs, nowMs, false);

  const { timeline, bucket } = ensureTimelineBucket(dbTimeline, key, nowMs);
  bucket.count += 1;
  bucket.total += durationMs;
  bucket.max = Math.max(bucket.max, durationMs);
  pruneTimeline(timeline, nowMs);

  const { timeline: overallTimeline, bucket: overallBucket } = ensureTimelineBucket(dbTimeline, 'ALL_DB', nowMs);
  overallBucket.count += 1;
  overallBucket.total += durationMs;
  overallBucket.max = Math.max(overallBucket.max, durationMs);
  pruneTimeline(overallTimeline, nowMs);
}

export function observeVitalMetric(payload) {
  if (!payload || typeof payload !== 'object') return;
  const metric = String(payload.metric || payload.name || '').trim();
  const page = String(payload.page || '/').trim() || '/';
  const value = Number(payload.value);
  if (!metric || !Number.isFinite(value)) return;

  const nowMs = Date.now();
  const key = `${metric} ${page}`;
  const series = ensureSeries(vitalsSeries, key);
  pushSample(series, value, nowMs, false);
}

function evaluateApiSlo(apiStats) {
  const apiStatsMap = new Map(apiStats.map((item) => [item.key, item]));
  const evaluatedTargets = SLO_TARGETS.map((target) => {
    const observed = apiStatsMap.get(target.key) || null;
    if (!observed) {
      return {
        key: target.key,
        thresholdP95Ms: target.p95Ms,
        observedP95Ms: null,
        sampleCount: 0,
        status: 'no_data',
      };
    }
    const breached = observed.p95Ms > target.p95Ms;
    return {
      key: target.key,
      thresholdP95Ms: target.p95Ms,
      observedP95Ms: observed.p95Ms,
      sampleCount: observed.count,
      status: breached ? 'breach' : 'pass',
    };
  });

  return {
    targets: evaluatedTargets,
    breaches: evaluatedTargets.filter((item) => item.status === 'breach'),
    noData: evaluatedTargets.filter((item) => item.status === 'no_data'),
  };
}

export function getPerfSummary({ minutes = 60, limit = 25 } = {}) {
  const nowMs = Date.now();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 25));
  const safeMinutes = Math.max(1, Math.min(1440, Number(minutes) || 60));

  const apiStats = Array.from(apiSeries.entries())
    .map(([key, series]) => seriesToStats(key, series))
    .sort((a, b) => b.p95Ms - a.p95Ms);

  const topApi = apiStats.slice(0, safeLimit).map((item) => {
    const timeline = apiTimeline.get(item.key);
    return {
      ...item,
      timeline: timeline ? timelineToArray(timeline, safeMinutes, nowMs) : [],
    };
  });

  const overallTimeline = apiTimeline.get('ALL');
  const slo = evaluateApiSlo(apiStats);

  const dbStats = Array.from(dbSeries.entries())
    .map(([key, series]) => seriesToStats(key, series))
    .sort((a, b) => b.p95Ms - a.p95Ms);

  const dbTopByP95 = dbStats.slice(0, Math.min(3, safeLimit)).map((item) => {
    const timeline = dbTimeline.get(item.key);
    return {
      ...item,
      timeline: timeline ? timelineToArray(timeline, safeMinutes, nowMs) : [],
    };
  });

  const dbOverallTimeline = dbTimeline.get('ALL_DB');

  const vitalsStats = Array.from(vitalsSeries.entries())
    .map(([key, series]) => seriesToStats(key, series))
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .slice(0, safeLimit);

  return {
    generatedAt: nowMs,
    retentionMinutes: DEFAULT_RETENTION_MINUTES,
    api: {
      totalSeries: apiStats.length,
      topByP95: topApi,
      overallTimeline: overallTimeline ? timelineToArray(overallTimeline, safeMinutes, nowMs) : [],
    },
    db: {
      totalSeries: dbStats.length,
      topByP95: dbTopByP95,
      overallTimeline: dbOverallTimeline ? timelineToArray(dbOverallTimeline, safeMinutes, nowMs) : [],
    },
    vitals: {
      totalSeries: vitalsSeries.size,
      topByP95: vitalsStats,
    },
    slo,
  };
}
