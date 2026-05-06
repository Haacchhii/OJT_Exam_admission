const baseUrl = String(process.env.SMOKE_BASE_URL || process.env.PERF_SMOKE_BASE_URL || '').trim().replace(/\/+$/, '');
const token = String(process.env.SMOKE_TOKEN || process.env.PERF_SMOKE_TOKEN || '').trim();
const email = String(process.env.SMOKE_EMAIL || process.env.PERF_SMOKE_EMAIL || '').trim();
const password = String(process.env.SMOKE_PASSWORD || process.env.PERF_SMOKE_PASSWORD || '').trim();
const admissionTrackingId = String(process.env.SMOKE_ADMISSION_TRACKING_ID || 'GK-ADM-2026-00001').trim();
const examTrackingId = String(process.env.SMOKE_EXAM_TRACKING_ID || 'GK-EXM-2026-00001').trim();

if (!baseUrl) {
  console.error('[smoke] SMOKE_BASE_URL is required.');
  process.exit(1);
}

async function parseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.headers || {}),
    },
    body: options.body,
  });
  const body = await parseBody(response);
  return { response, body };
}

async function resolveToken() {
  if (token) {
    const me = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (me.response.ok) return token;
    console.warn('[smoke] Provided SMOKE_TOKEN is invalid or expired. Falling back to login.');
  }

  if (!email || !password) {
    return '';
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login.response.ok || !login.body?.token) {
    return '';
  }
  return String(login.body.token);
}

async function assertOk(label, path, options = {}) {
  const { response, body } = await request(path, options);
  if (!response.ok) {
    throw new Error(`[smoke] ${label} failed: HTTP ${response.status} ${JSON.stringify(body)}`);
  }
  return { response, body };
}

(async () => {
  const authToken = await resolveToken();
  if (!authToken) {
    console.error('[smoke] Unable to resolve an auth token. Provide SMOKE_TOKEN or SMOKE_EMAIL/SMOKE_PASSWORD.');
    process.exit(1);
  }

  await assertOk('health', '/api/health');
  await assertOk('auth.me', '/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } });
  await assertOk('admissions.dashboard-summary', '/api/admissions/dashboard-summary', { headers: { Authorization: `Bearer ${authToken}` } });
  await assertOk('exams.readiness', '/api/exams/readiness?limit=1', { headers: { Authorization: `Bearer ${authToken}` } });

  const tracking = await assertOk('exam tracking lookup', `/api/admissions/track/${encodeURIComponent(examTrackingId)}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const registrationId = tracking.body?.data?.id || tracking.body?.data?.registration?.id;
  if (!registrationId) {
    throw new Error('[smoke] Could not resolve exam registration id from tracking lookup.');
  }

  const exportRes = await request(`/api/results/${registrationId}/export-pdf`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!exportRes.response.ok || !(String(exportRes.response.headers.get('content-type') || '').includes('application/pdf'))) {
    throw new Error(`[smoke] PDF export failed: HTTP ${exportRes.response.status} ${JSON.stringify(exportRes.body)}`);
  }

  const missing = await request('/api/results/999999/export-pdf', {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (missing.response.status !== 404 || missing.body?.code !== 'NOT_FOUND') {
    throw new Error(`[smoke] Missing export did not return a clean 404: HTTP ${missing.response.status} ${JSON.stringify(missing.body)}`);
  }

  console.log('[smoke] Post-deploy smoke checks passed.');
})().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
