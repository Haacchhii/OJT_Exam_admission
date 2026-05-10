import fetch from 'node-fetch';

const baseUrl = process.env.PERF_LOAD_BASE_URL || 'http://localhost:3000';
const email = process.env.PERF_LOAD_EMAIL || 'admin@goldenkey.edu';
const password = process.env.PERF_LOAD_PASSWORD || '';

if (!password) {
  throw new Error('PERF_LOAD_PASSWORD must be set in the environment before running this script.');
}

async function login() {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json();
  return j.token;
}

(async () => {
  try {
    const token = await login();
    if (!token) {
      console.error('Failed to authenticate');
      process.exit(1);
    }

    console.log('Authenticated, requesting employee-summary once...');
    const params = process.env.SUMMARY_PARAMS || 'limit=300&includeEssays=false';
    const start = Date.now();
    const r = await fetch(`${baseUrl}/api/results/employee-summary?${params}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const duration = Date.now() - start;
    console.log('Status:', r.status, 'Duration(ms):', duration);
    const text = await r.text();
    console.log('Body length:', text.length);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();