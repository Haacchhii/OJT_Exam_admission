import fetch from 'node-fetch';
const baseUrl = process.env.PERF_LOAD_BASE_URL || 'http://localhost:3000';
(async ()=>{
  const res = await fetch(`${baseUrl}/api/perf/summary`);
  console.log('Status:', res.status);
  const j = await res.json();
  console.log(JSON.stringify(j, null, 2));
})();