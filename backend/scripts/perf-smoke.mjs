const baseUrl = String(process.env.PERF_SMOKE_BASE_URL || '').trim().replace(/\/+$/, '');
const token = String(process.env.PERF_SMOKE_TOKEN || '').trim();
const sampleCount = Math.max(3, Number.parseInt(process.env.PERF_SMOKE_SAMPLES || '6', 10) || 6);
const required = String(process.env.PERF_SMOKE_REQUIRED || 'false').toLowerCase() === 'true';

if (!baseUrl) {
  const msg = '[perf-smoke] PERF_SMOKE_BASE_URL is not set. Skipping perf smoke run.';
  if (required) {
    console.error(`${msg} Set PERF_SMOKE_BASE_URL or disable PERF_SMOKE_REQUIRED.`);
    process.exit(1);
  }
  console.log(msg);
  process.exit(0);
}

const endpointChecks = [
  { name: 'health', path: '/api/health', p95Ms: 350, requireAuth: false },
  { name: 'dashboard-summary', path: '/api/admissions/dashboard-summary', p95Ms: 1200, requireAuth: true },
  { name: 'reports-summary', path: '/api/admissions/reports-summary?limit=200', p95Ms: 1500, requireAuth: true },
  { name: 'employee-results-summary', path: '/api/results/employee-summary?limit=300&includeEssays=false', p95Ms: 1700, requireAuth: true },
  { name: 'exams-list', path: '/api/exams?page=1&limit=50', p95Ms: 900, requireAuth: true },
];

const activeChecks = endpointChecks.filter((item) => !item.requireAuth || Boolean(token));

if (activeChecks.length === 0) {
  const msg = '[perf-smoke] No runnable checks. Auth token is required for protected endpoint checks.';
  if (required) {
    console.error(msg);
    process.exit(1);
  }
  console.log(msg);
  process.exit(0);
}

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function hitEndpoint(path, requiresAuth) {
  const started = process.hrtime.bigint();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers,
  });

  const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  const headerMs = Number.parseFloat(response.headers.get('x-response-time-ms') || '');
  const effectiveMs = Number.isFinite(headerMs) && headerMs > 0 ? headerMs : elapsedMs;
  return {
    ok: response.ok,
    status: response.status,
    ms: effectiveMs,
  };
}

async function runCheck(check) {
  const samples = [];
  let failures = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    try {
      const result = await hitEndpoint(check.path, check.requireAuth);
      samples.push(result.ms);
      if (!result.ok) failures += 1;
    } catch {
      failures += 1;
      samples.push(9999);
    }
  }

  const p95 = percentile(samples, 95);
  const avg = samples.reduce((sum, val) => sum + val, 0) / Math.max(1, samples.length);

  return {
    name: check.name,
    path: check.path,
    thresholdP95Ms: check.p95Ms,
    p95Ms: Number(p95.toFixed(2)),
    avgMs: Number(avg.toFixed(2)),
    failures,
    sampleCount,
    pass: failures === 0 && p95 <= check.p95Ms,
  };
}

(async () => {
  console.log(`[perf-smoke] Running ${activeChecks.length} endpoint checks against ${baseUrl}`);
  const results = [];

  for (const check of activeChecks) {
    const result = await runCheck(check);
    results.push(result);
    const status = result.pass ? 'PASS' : 'FAIL';
    console.log(
      `[perf-smoke] ${status} ${result.name} | p95=${result.p95Ms}ms threshold=${result.thresholdP95Ms}ms avg=${result.avgMs}ms failures=${result.failures}/${result.sampleCount}`
    );
  }

  const failed = results.filter((item) => !item.pass);
  if (failed.length > 0) {
    console.error(`[perf-smoke] ${failed.length} check(s) failed.`);
    process.exit(1);
  }

  console.log('[perf-smoke] All checks passed.');
})();
