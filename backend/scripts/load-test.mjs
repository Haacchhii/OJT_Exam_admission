/**
 * Extended Performance Testing Suite
 * Tests critical endpoints under load: perf-ingest, uploads, exam queries
 * Generates performance report with bottleneck analysis
 */

const baseUrl = String(process.env.PERF_LOAD_BASE_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
const email = String(process.env.PERF_LOAD_EMAIL || 'admin@goldenkey.edu').trim();
const password = String(process.env.PERF_LOAD_PASSWORD || 'admin123').trim();

// Load test configuration
const CONCURRENT_REQUESTS = 10;
const REQUESTS_PER_ENDPOINT = 30;
const BATCH_SIZE = 5; // requests per batch to avoid overwhelming server

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loginForToken() {
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return typeof payload?.token === 'string' ? payload.token : null;
  } catch {
    return null;
  }
}

/**
 * Test perf-ingest endpoint with concurrent load
 */
async function testPerfIngest(token) {
  console.log('\n[PERF] Testing /api/perf/vitals endpoint under load...');
  const samples = [];
  const errors = [];

  for (let batch = 0; batch < Math.ceil(REQUESTS_PER_ENDPOINT / BATCH_SIZE); batch++) {
    const promises = [];

    for (let i = 0; i < BATCH_SIZE && batch * BATCH_SIZE + i < REQUESTS_PER_ENDPOINT; i++) {
      promises.push((async () => {
        try {
          const started = process.hrtime.bigint();
          const response = await fetch(`${baseUrl}/api/perf/vitals`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              metric: 'test_metric',
              value: Math.random() * 1000,
              timestamp: Date.now(),
            }),
          });

          const elapsed = Number(process.hrtime.bigint() - started) / 1_000_000;
          samples.push(elapsed);

          if (!response.ok) {
            errors.push({ status: response.status, path: '/api/perf/vitals' });
          }
        } catch (err) {
          errors.push({ error: err.message, path: '/api/perf/vitals' });
        }
      })());
    }

    await Promise.all(promises);
    if (batch < Math.ceil(REQUESTS_PER_ENDPOINT / BATCH_SIZE) - 1) {
      await sleep(50); // rate limiting between batches
    }
  }

  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const p99 = percentile(samples, 99);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const max = Math.max(...samples);

  console.log(`  Requests: ${REQUESTS_PER_ENDPOINT}`);
  console.log(`  Avg: ${avg.toFixed(2)}ms | P50: ${p50.toFixed(2)}ms | P95: ${p95.toFixed(2)}ms | P99: ${p99.toFixed(2)}ms | Max: ${max.toFixed(2)}ms`);
  console.log(`  Errors: ${errors.length}`);

  return { endpoint: 'perf/vitals', samples, errors, p95, p99, avg };
}

/**
 * Test exam query endpoint under concurrent load
 */
async function testExamQueries(token) {
  console.log('\n[PERF] Testing /api/exams endpoint under load...');
  const samples = [];
  const errors = [];

  for (let batch = 0; batch < Math.ceil(REQUESTS_PER_ENDPOINT / BATCH_SIZE); batch++) {
    const promises = [];

    for (let i = 0; i < BATCH_SIZE && batch * BATCH_SIZE + i < REQUESTS_PER_ENDPOINT; i++) {
      promises.push((async () => {
        try {
          const started = process.hrtime.bigint();
          const response = await fetch(`${baseUrl}/api/exams?page=1&limit=50`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          const elapsed = Number(process.hrtime.bigint() - started) / 1_000_000;
          samples.push(elapsed);

          if (!response.ok) {
            errors.push({ status: response.status, path: '/api/exams' });
          }
        } catch (err) {
          errors.push({ error: err.message, path: '/api/exams' });
        }
      })());
    }

    await Promise.all(promises);
    if (batch < Math.ceil(REQUESTS_PER_ENDPOINT / BATCH_SIZE) - 1) {
      await sleep(50);
    }
  }

  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const p99 = percentile(samples, 99);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const max = Math.max(...samples);

  console.log(`  Requests: ${REQUESTS_PER_ENDPOINT}`);
  console.log(`  Avg: ${avg.toFixed(2)}ms | P50: ${p50.toFixed(2)}ms | P95: ${p95.toFixed(2)}ms | P99: ${p99.toFixed(2)}ms | Max: ${max.toFixed(2)}ms`);
  console.log(`  Errors: ${errors.length}`);

  return { endpoint: 'exams', samples, errors, p95, p99, avg };
}

/**
 * Test results dashboard endpoint (heavy query)
 */
async function testResultsDashboard(token) {
  console.log('\n[PERF] Testing /api/results/employee-summary endpoint (heavy query)...');
  const samples = [];
  const errors = [];

  for (let i = 0; i < 10; i++) { // Fewer requests for heavy endpoint
    try {
      const started = process.hrtime.bigint();
      const response = await fetch(`${baseUrl}/api/results/employee-summary?limit=300&includeEssays=false`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const elapsed = Number(process.hrtime.bigint() - started) / 1_000_000;
      samples.push(elapsed);

      if (!response.ok) {
        errors.push({ status: response.status, path: '/api/results/employee-summary' });
      }
    } catch (err) {
      errors.push({ error: err.message, path: '/api/results/employee-summary' });
    }

    if (i < 9) await sleep(100);
  }

  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const p99 = percentile(samples, 99);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const max = Math.max(...samples);

  console.log(`  Requests: ${samples.length}`);
  console.log(`  Avg: ${avg.toFixed(2)}ms | P50: ${p50.toFixed(2)}ms | P95: ${p95.toFixed(2)}ms | P99: ${p99.toFixed(2)}ms | Max: ${max.toFixed(2)}ms`);
  console.log(`  Errors: ${errors.length}`);

  return { endpoint: 'results/employee-summary', samples, errors, p95, p99, avg };
}

/**
 * Analyze results and identify bottlenecks
 */
function analyzeBottlenecks(results) {
  console.log('\n[ANALYSIS] Performance Bottleneck Report');
  console.log('━'.repeat(70));

  const sorted = [...results].sort((a, b) => b.p95 - a.p95);

  sorted.forEach((result, idx) => {
    const status = result.p95 > 1500 ? '⚠️ SLOW' : result.p95 > 1000 ? '⚡ MEDIUM' : '✅ FAST';
    console.log(`${idx + 1}. ${status} ${result.endpoint}`);
    console.log(`   P95: ${result.p95.toFixed(2)}ms | P99: ${result.p99.toFixed(2)}ms | Avg: ${result.avg.toFixed(2)}ms`);

    if (result.errors.length > 0) {
      console.log(`   ⚠️  ${result.errors.length} errors detected`);
    }
  });

  // Recommendations
  console.log('\n[RECOMMENDATIONS]');
  const slowEndpoints = results.filter(r => r.p95 > 1500);
  const mediumEndpoints = results.filter(r => r.p95 > 1000 && r.p95 <= 1500);

  if (slowEndpoints.length > 0) {
    console.log(`\n🔴 CRITICAL: ${slowEndpoints.length} endpoint(s) exceed 1500ms P95`);
    slowEndpoints.forEach(r => {
      console.log(`   - ${r.endpoint}: Consider database indexing, query optimization, or caching`);
    });
  }

  if (mediumEndpoints.length > 0) {
    console.log(`\n🟡 MEDIUM: ${mediumEndpoints.length} endpoint(s) exceed 1000ms P95`);
    mediumEndpoints.forEach(r => {
      console.log(`   - ${r.endpoint}: Monitor and optimize if impact grows`);
    });
  }

  if (slowEndpoints.length === 0 && mediumEndpoints.length === 0) {
    console.log('\n✅ All endpoints performing well');
  }
}

/**
 * Main execution
 */
(async () => {
  console.log('[LOAD TEST] Starting Extended Performance Test Suite');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Concurrent: ${CONCURRENT_REQUESTS} | Requests per endpoint: ${REQUESTS_PER_ENDPOINT}`);

  // Authenticate
  const token = await loginForToken();
  if (!token) {
    console.error('[ERROR] Failed to authenticate. Check PERF_LOAD_EMAIL and PERF_LOAD_PASSWORD.');
    process.exit(1);
  }

  console.log('[AUTH] Successfully authenticated');

  // Run load tests
  const results = [];

  try {
    results.push(await testPerfIngest(token));
    results.push(await testExamQueries(token));
    results.push(await testResultsDashboard(token));
  } catch (err) {
    console.error('[ERROR] Load test failed:', err.message);
    process.exit(1);
  }

  // Analyze and report
  analyzeBottlenecks(results);

  console.log('\n[LOAD TEST] Complete');
  console.log('━'.repeat(70));
})();
