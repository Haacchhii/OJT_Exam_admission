import app from '../src/app.js';

const TEST_ACCOUNTS = [
  {
    name: 'admin',
    email: process.env.TEST_ADMIN_EMAIL || 'admin@goldenkey.edu',
    password: process.env.TEST_ADMIN_PASSWORD || '',
  },
  {
    name: 'registrar',
    email: process.env.TEST_REGISTRAR_EMAIL || 'registrar@goldenkey.edu',
    password: process.env.TEST_REGISTRAR_PASSWORD || '',
  },
  {
    name: 'teacher',
    email: process.env.TEST_TEACHER_EMAIL || 'teacher@goldenkey.edu',
    password: process.env.TEST_TEACHER_PASSWORD || '',
  },
  {
    name: 'applicant',
    email: process.env.TEST_APPLICANT_EMAIL || 'joseirineo0418@gmail.com',
    password: process.env.TEST_APPLICANT_PASSWORD || '',
  },
];

async function parseBody(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

async function main() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    const base = `http://127.0.0.1:${port}/api`;

    const tests = [
      ['GET', '/users?page=1&limit=1'],
      ['GET', '/admissions?page=1&limit=1'],
      ['GET', '/results?page=1&limit=1'],
      ['GET', '/audit-logs?page=1&limit=1'],
      ['GET', '/academic-years'],
    ];

    let loginFailures = 0;

    for (const { name, email, password } of TEST_ACCOUNTS) {
      const loginRes = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginBody = await parseBody(loginRes);

      const role = loginBody && typeof loginBody === 'object' && loginBody.user ? loginBody.user.role : null;
      const err = loginBody && typeof loginBody === 'object' && loginBody.error ? loginBody.error : null;
      console.log(`LOGIN ${name} ${loginRes.status} ${role || err || ''}`);

      if (!loginRes.ok || !loginBody || typeof loginBody !== 'object' || !loginBody.token) {
        loginFailures += 1;
        continue;
      }

      for (const [method, route] of tests) {
        const res = await fetch(`${base}${route}`, {
          method,
          headers: { Authorization: `Bearer ${loginBody.token}` },
        });
        const body = await parseBody(res);
        let msg = 'ok';
        if (body && typeof body === 'object' && body.error) msg = body.error;
        console.log(`  ${name} ${method} ${route} => ${res.status} ${msg}`);
      }
    }

    if (loginFailures > 0) {
      console.error(`Integration role access check failed: ${loginFailures} account login(s) were rejected.`);
      process.exitCode = 1;
    }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
