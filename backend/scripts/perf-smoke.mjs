const baseUrl = String(process.env.PERF_SMOKE_BASE_URL || '').trim().replace(/\/+$/, '');
const initialToken = String(process.env.PERF_SMOKE_TOKEN || '').trim();
const smokeEmail = String(process.env.PERF_SMOKE_EMAIL || '').trim();
const smokePassword = String(process.env.PERF_SMOKE_PASSWORD || '');

function parseIntOrFallback(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const sampleCount = Math.max(3, parseIntOrFallback(process.env.PERF_SMOKE_SAMPLES, 6));
const warmupCount = Math.max(0, parseIntOrFallback(process.env.PERF_SMOKE_WARMUP, 1));
const required = String(process.env.PERF_SMOKE_REQUIRED || 'false').toLowerCase() === 'true';

function thresholdFor(key, fallback) {
  const envKey = `PERF_SMOKE_THRESHOLD_${key}`;
  const fromEnv = Number.parseInt(process.env[envKey] || '', 10);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : fallback;
}

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
  { name: 'health', key: 'HEALTH', path: '/api/health', p95Ms: thresholdFor('HEALTH', 1200), requireAuth: false },
  { name: 'dashboard-summary', key: 'DASHBOARD_SUMMARY', path: '/api/admissions/dashboard-summary', p95Ms: thresholdFor('DASHBOARD_SUMMARY', 1200), requireAuth: true },
  { name: 'reports-summary', key: 'REPORTS_SUMMARY', path: '/api/admissions/reports-summary?limit=200', p95Ms: thresholdFor('REPORTS_SUMMARY', 1500), requireAuth: true },
  { name: 'employee-results-summary', key: 'EMPLOYEE_RESULTS_SUMMARY', path: '/api/results/employee-summary?limit=300&includeEssays=false', p95Ms: thresholdFor('EMPLOYEE_RESULTS_SUMMARY', 1700), requireAuth: true },
  { name: 'exams-list', key: 'EXAMS_LIST', path: '/api/exams?page=1&limit=50', p95Ms: thresholdFor('EXAMS_LIST', 900), requireAuth: true },
];

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function hitEndpoint(path, requiresAuth, authToken) {
  const started = process.hrtime.bigint();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
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

async function isTokenValid(candidateToken) {
  if (!candidateToken) return false;
  try {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${candidateToken}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function loginForToken() {
  if (!smokeEmail || !smokePassword) return null;
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: smokeEmail, password: smokePassword }),
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return typeof payload?.token === 'string' ? payload.token : null;
  } catch {
    return null;
  }
}

async function resolveAuthToken() {
  if (await isTokenValid(initialToken)) {
    return { token: initialToken, source: 'secret-token' };
  }

  const loginToken = await loginForToken();
  if (await isTokenValid(loginToken)) {
    return { token: loginToken, source: 'login' };
  }

  return { token: '', source: 'none' };
}

function summarizeStatuses(statusCounts) {
  const entries = Array.from(statusCounts.entries()).sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return 'none';
  return entries.map(([code, count]) => `${code}:${count}`).join(',');
}

async function runCheck(check, authToken) {
  const samples = [];
  let failures = 0;
  const statusCounts = new Map();
  const totalRequests = warmupCount + sampleCount;

  for (let i = 0; i < totalRequests; i += 1) {
    try {
      const result = await hitEndpoint(check.path, check.requireAuth, authToken);
      statusCounts.set(result.status, (statusCounts.get(result.status) || 0) + 1);
      if (i < warmupCount) continue;
      samples.push(result.ms);
      if (!result.ok) failures += 1;
    } catch {
      if (i < warmupCount) continue;
      failures += 1;
      samples.push(9999);
      statusCounts.set(0, (statusCounts.get(0) || 0) + 1);
    }
  }

  const p95 = percentile(samples, 95);
  const avg = samples.reduce((sum, val) => sum + val, 0) / Math.max(1, samples.length);
  const statusSummary = summarizeStatuses(statusCounts);

  return {
    name: check.name,
    key: check.key,
    path: check.path,
    thresholdP95Ms: check.p95Ms,
    p95Ms: Number(p95.toFixed(2)),
    avgMs: Number(avg.toFixed(2)),
    failures,
    statusSummary,
    sampleCount,
    pass: failures === 0 && p95 <= check.p95Ms,
  };
}

(async () => {
  const auth = await resolveAuthToken();
  const authInputProvided = Boolean(initialToken) || (Boolean(smokeEmail) && Boolean(smokePassword));

  if (!auth.token && authInputProvided) {
    console.error('[perf-smoke] Auth configuration is present but invalid. Refresh PERF_SMOKE_TOKEN or verify PERF_SMOKE_EMAIL/PERF_SMOKE_PASSWORD credentials and role access.');
    process.exit(1);
  }

  if (!auth.token && required) {
    console.error('[perf-smoke] PERF_SMOKE_REQUIRED=true but no valid auth token is available for protected checks.');
    process.exit(1);
  }

  const activeChecks = endpointChecks.filter((item) => !item.requireAuth || Boolean(auth.token));

  if (activeChecks.length === 0) {
    const msg = '[perf-smoke] No runnable checks. Set PERF_SMOKE_TOKEN or PERF_SMOKE_EMAIL/PERF_SMOKE_PASSWORD for protected endpoint checks.';
    if (required) {
      console.error(msg);
      process.exit(1);
    }
    console.log(msg);
    process.exit(0);
  }

  if (auth.source === 'login') {
    console.log('[perf-smoke] Auth token acquired from login credentials.');
  } else if (initialToken && auth.source === 'none') {
    console.warn('[perf-smoke] Provided PERF_SMOKE_TOKEN is invalid or expired.');
  }

  console.log(`[perf-smoke] Running ${activeChecks.length} endpoint checks against ${baseUrl} (warmup=${warmupCount}, samples=${sampleCount})`);
  const results = [];

  for (const check of activeChecks) {
    const result = await runCheck(check, auth.token);
    results.push(result);
    const status = result.pass ? 'PASS' : 'FAIL';
    console.log(
      `[perf-smoke] ${status} ${result.name} | p95=${result.p95Ms}ms threshold=${result.thresholdP95Ms}ms avg=${result.avgMs}ms failures=${result.failures}/${result.sampleCount} status=${result.statusSummary}`
    );
  }

  const failed = results.filter((item) => !item.pass);
  if (failed.length > 0) {
    const allAuthFailures = failed.every((item) => /^401:|,401:|^403:|,403:/.test(item.statusSummary));
    if (allAuthFailures) {
      console.error('[perf-smoke] Protected endpoint checks are unauthorized. Verify PERF_SMOKE_TOKEN or PERF_SMOKE_EMAIL/PERF_SMOKE_PASSWORD has employee/admin access.');
    }
    console.error(`[perf-smoke] ${failed.length} check(s) failed.`);
    failed.forEach((item) => {
      console.error(`[perf-smoke] fail-detail ${item.name} path=${item.path} status=${item.statusSummary}`);
    });
    process.exit(1);
  }

  console.log('[perf-smoke] All checks passed.');
})();
