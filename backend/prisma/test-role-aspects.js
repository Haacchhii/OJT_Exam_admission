import fs from 'fs';
import path from 'path';
import app from '../src/app.js';

const TEST_ACCOUNTS = {
  administrator: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@goldenkey.edu',
    password: process.env.TEST_ADMIN_PASSWORD || 'admin123',
  },
  registrar: {
    email: process.env.TEST_REGISTRAR_EMAIL || 'registrar@goldenkey.edu',
    password: process.env.TEST_REGISTRAR_PASSWORD || 'admin123',
  },
  teacher: {
    email: process.env.TEST_TEACHER_EMAIL || 'teacher@goldenkey.edu',
    password: process.env.TEST_TEACHER_PASSWORD || 'admin123',
  },
  applicant: {
    email: process.env.TEST_APPLICANT_EMAIL || 'joseirineo0418@gmail.com',
    password: process.env.TEST_APPLICANT_PASSWORD || 'Changeme123!',
  },
  // Optional special-case accounts. Leave empty to skip these checks.
  unverifiedApplicant: {
    email: process.env.TEST_UNVERIFIED_EMAIL || '',
    password: process.env.TEST_UNVERIFIED_PASSWORD || '',
  },
  inactiveApplicant: {
    email: process.env.TEST_INACTIVE_EMAIL || '',
    password: process.env.TEST_INACTIVE_PASSWORD || '',
  },
};

const ROLE_ORDER = ['administrator', 'registrar', 'teacher', 'applicant'];

function nowFileStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function extractArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function isAllowedStatusForAuthorized(status) {
  return status !== 401 && status !== 403;
}

function normalizeText(bodyText) {
  if (!bodyText) return '';
  return bodyText.replace(/\s+/g, ' ').trim().slice(0, 280);
}

function reportAccountMeta(accounts) {
  return Object.fromEntries(
    Object.entries(accounts).map(([name, account]) => [
      name,
      {
        email: account.email,
        hasPassword: Boolean(account.password),
      },
    ])
  );
}

async function request(baseUrl, token, method, route, body) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: res.status,
    ok: res.ok,
    json,
    text,
  };
}

async function login(baseUrl, email, password) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: res.status,
    ok: res.ok,
    json,
    text,
  };
}

function buildChecks(ctx) {
  return [
    {
      id: 'auth.me',
      method: 'GET',
      route: '/auth/me',
      allowedRoles: ROLE_ORDER,
      area: 'auth',
    },

    {
      id: 'admissions.mine',
      method: 'GET',
      route: '/admissions/mine',
      allowedRoles: ROLE_ORDER,
      area: 'admissions',
    },
    {
      id: 'admissions.list',
      method: 'GET',
      route: '/admissions?page=1&limit=5',
      allowedRoles: ['administrator', 'registrar', 'teacher'],
      area: 'admissions',
    },
    {
      id: 'admissions.stats',
      method: 'GET',
      route: '/admissions/stats',
      allowedRoles: ['administrator', 'registrar', 'teacher'],
      area: 'admissions',
    },
    {
      id: 'admissions.create',
      method: 'POST',
      route: '/admissions',
      body: {},
      allowedRoles: ['applicant'],
      area: 'admissions',
    },
    {
      id: 'admissions.updateStatus',
      method: 'PATCH',
      route: `/admissions/${ctx.admissionId}/status`,
      body: { status: 'Under Screening' },
      allowedRoles: ['administrator', 'registrar'],
      area: 'admissions',
    },

    {
      id: 'exams.list',
      method: 'GET',
      route: '/exams?page=1&limit=5',
      allowedRoles: ROLE_ORDER,
      area: 'exams',
    },
    {
      id: 'exams.create',
      method: 'POST',
      route: '/exams',
      body: {},
      allowedRoles: ['administrator', 'teacher'],
      area: 'exams',
    },
    {
      id: 'exams.registrations.list',
      method: 'GET',
      route: '/exams/registrations?page=1&limit=5',
      allowedRoles: ['administrator', 'registrar', 'teacher'],
      area: 'exams',
    },
    {
      id: 'exams.registrations.mine',
      method: 'GET',
      route: '/exams/registrations/mine',
      allowedRoles: ['applicant'],
      area: 'exams',
    },
    {
      id: 'exams.studentView',
      method: 'GET',
      route: `/exams/${ctx.applicantExamId || ctx.examId}/student`,
      allowedRoles: ['applicant'],
      area: 'exams',
    },
    {
      id: 'exams.start',
      method: 'PATCH',
      route: `/exams/registrations/${ctx.applicantRegistrationId || ctx.registrationId}/start`,
      allowedRoles: ['applicant'],
      area: 'exams',
    },

    {
      id: 'results.mine',
      method: 'GET',
      route: '/results/mine',
      allowedRoles: ['applicant'],
      area: 'results',
    },
    {
      id: 'results.list',
      method: 'GET',
      route: '/results?page=1&limit=5',
      allowedRoles: ['administrator', 'registrar', 'teacher'],
      area: 'results',
    },
    {
      id: 'results.essays',
      method: 'GET',
      route: '/results/essays?page=1&limit=5',
      allowedRoles: ['administrator', 'registrar', 'teacher'],
      area: 'results',
    },
    {
      id: 'results.scoreEssay',
      method: 'PATCH',
      route: `/results/essays/${ctx.essayId}/score`,
      body: {},
      allowedRoles: ['administrator', 'teacher'],
      area: 'results',
    },
    {
      id: 'results.submit',
      method: 'POST',
      route: '/results/submit',
      body: {},
      allowedRoles: ['applicant'],
      area: 'results',
    },

    {
      id: 'users.list',
      method: 'GET',
      route: '/users?page=1&limit=5',
      allowedRoles: ['administrator', 'registrar', 'teacher'],
      area: 'users',
    },
    {
      id: 'users.getOne',
      method: 'GET',
      route: `/users/${ctx.userId}`,
      allowedRoles: ['administrator'],
      area: 'users',
    },
    {
      id: 'users.create',
      method: 'POST',
      route: '/users',
      body: {},
      allowedRoles: ['administrator'],
      area: 'users',
    },

    {
      id: 'audit.list',
      method: 'GET',
      route: '/audit-logs?page=1&limit=5',
      allowedRoles: ['administrator'],
      area: 'audit',
    },

    {
      id: 'academicYears.list',
      method: 'GET',
      route: '/academic-years',
      allowedRoles: ['administrator', 'registrar', 'teacher'],
      area: 'settings',
    },
    {
      id: 'academicYears.create',
      method: 'POST',
      route: '/academic-years',
      body: {},
      allowedRoles: ['administrator'],
      area: 'settings',
    },
    {
      id: 'academicYears.createSemester',
      method: 'POST',
      route: '/academic-years/semesters',
      body: {},
      allowedRoles: ['administrator'],
      area: 'settings',
    },
  ];
}

async function run() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    accounts: reportAccountMeta(TEST_ACCOUNTS),
    login: {},
    context: {},
    checks: [],
    summary: {
      totalChecks: 0,
      passed: 0,
      failed: 0,
      failedByRole: {},
      failedByArea: {},
      byRole: {},
    },
    specialAuthCases: [],
  };

  try {
    const sessions = {};

    for (const role of ROLE_ORDER) {
      const account = TEST_ACCOUNTS[role];
      const email = account.email;
      const loginRes = await login(baseUrl, email, account.password);
      report.login[role] = {
        email,
        status: loginRes.status,
        ok: loginRes.ok,
        error: loginRes.json?.error || normalizeText(loginRes.text),
      };

      if (!loginRes.ok || !loginRes.json?.token) {
        throw new Error(`Login failed for role ${role} (${email}) with status ${loginRes.status}.`);
      }

      sessions[role] = {
        email,
        token: loginRes.json.token,
        user: loginRes.json.user,
      };
    }

    // Special auth behavior checks
    const inactiveAccount = TEST_ACCOUNTS.inactiveApplicant;
    if (inactiveAccount.email && inactiveAccount.password) {
      const inactiveRes = await login(baseUrl, inactiveAccount.email, inactiveAccount.password);
      report.specialAuthCases.push({
        case: 'inactive-applicant-login',
        email: inactiveAccount.email,
        expectedStatus: 403,
        actualStatus: inactiveRes.status,
        pass: inactiveRes.status === 403,
        message: inactiveRes.json?.error || normalizeText(inactiveRes.text),
      });
    } else {
      report.specialAuthCases.push({
        case: 'inactive-applicant-login',
        skipped: true,
        reason: 'TEST_INACTIVE_EMAIL and TEST_INACTIVE_PASSWORD are not configured.',
      });
    }

    const unverifiedAccount = TEST_ACCOUNTS.unverifiedApplicant;
    if (unverifiedAccount.email && unverifiedAccount.password) {
      const unverifiedRes = await login(baseUrl, unverifiedAccount.email, unverifiedAccount.password);
      report.specialAuthCases.push({
        case: 'unverified-applicant-login',
        email: unverifiedAccount.email,
        expectedStatus: 200,
        actualStatus: unverifiedRes.status,
        pass: unverifiedRes.status === 200,
        message: unverifiedRes.json?.error || normalizeText(unverifiedRes.text),
      });
    } else {
      report.specialAuthCases.push({
        case: 'unverified-applicant-login',
        skipped: true,
        reason: 'TEST_UNVERIFIED_EMAIL and TEST_UNVERIFIED_PASSWORD are not configured.',
      });
    }

    // Build context IDs from admin account so checks can hit concrete endpoints.
    const adminToken = sessions.administrator.token;

    const applicantToken = sessions.applicant.token;

    const [admList, examList, regList, userList, essayList, applicantRegList] = await Promise.all([
      request(baseUrl, adminToken, 'GET', '/admissions?page=1&limit=1'),
      request(baseUrl, adminToken, 'GET', '/exams?page=1&limit=1'),
      request(baseUrl, adminToken, 'GET', '/exams/registrations?page=1&limit=1'),
      request(baseUrl, adminToken, 'GET', '/users?page=1&limit=1'),
      request(baseUrl, adminToken, 'GET', '/results/essays?page=1&limit=1&status=all'),
      request(baseUrl, applicantToken, 'GET', '/exams/registrations/mine'),
    ]);

    const admissionId = extractArray(admList.json)[0]?.id || 1;
    const examId = extractArray(examList.json)[0]?.id || 1;
    const registrationId = extractArray(regList.json)[0]?.id || 1;
    const userId = extractArray(userList.json)[0]?.id || 1;
    const essayId = extractArray(essayList.json)[0]?.id || 1;
    const applicantRegistrationId = extractArray(applicantRegList.json)[0]?.id || null;
    const applicantExamId = extractArray(applicantRegList.json)[0]?.schedule?.exam?.id || null;

    report.context = { admissionId, examId, registrationId, userId, essayId, applicantRegistrationId, applicantExamId };

    const checks = buildChecks(report.context);

    for (const role of ROLE_ORDER) {
      const token = sessions[role].token;

      for (const check of checks) {
        const res = await request(baseUrl, token, check.method, check.route, check.body);
        const shouldAllow = check.allowedRoles.includes(role);
        if (!report.summary.byRole[role]) {
          report.summary.byRole[role] = {
            expectedAllowed: 0,
            expectedDenied: 0,
            passedAllowed: 0,
            passedDenied: 0,
            failedAllowed: 0,
            failedDenied: 0,
          };
        }

        if (shouldAllow) report.summary.byRole[role].expectedAllowed += 1;
        else report.summary.byRole[role].expectedDenied += 1;

        let pass = false;
        let expectation = '';
        if (shouldAllow) {
          expectation = 'authorized (not 401/403)';
          pass = isAllowedStatusForAuthorized(res.status);
        } else {
          expectation = 'forbidden (403)';
          pass = res.status === 403;
        }

        const row = {
          role,
          area: check.area,
          checkId: check.id,
          method: check.method,
          route: check.route,
          expected: expectation,
          actualStatus: res.status,
          pass,
          error: res.json?.error || normalizeText(res.text),
        };

        report.checks.push(row);
        report.summary.totalChecks += 1;

        if (pass) {
          report.summary.passed += 1;
          if (shouldAllow) report.summary.byRole[role].passedAllowed += 1;
          else report.summary.byRole[role].passedDenied += 1;
        } else {
          report.summary.failed += 1;
          report.summary.failedByRole[role] = (report.summary.failedByRole[role] || 0) + 1;
          report.summary.failedByArea[check.area] = (report.summary.failedByArea[check.area] || 0) + 1;
          if (shouldAllow) report.summary.byRole[role].failedAllowed += 1;
          else report.summary.byRole[role].failedDenied += 1;
        }
      }
    }

    const reportsDir = path.resolve('reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const outPath = path.join(reportsDir, `role-aspect-smoke-${nowFileStamp()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('Role-aspect smoke test complete.');
    console.log(`- Total checks: ${report.summary.totalChecks}`);
    console.log(`- Passed: ${report.summary.passed}`);
    console.log(`- Failed: ${report.summary.failed}`);
    console.log(`- Failed by role: ${JSON.stringify(report.summary.failedByRole)}`);
    console.log(`- Failed by area: ${JSON.stringify(report.summary.failedByArea)}`);
    console.log(`- Report file: ${outPath}`);

    console.log('\nRole matrix (allowed vs denied checks):');
    for (const role of ROLE_ORDER) {
      const m = report.summary.byRole[role] || {
        expectedAllowed: 0,
        expectedDenied: 0,
        passedAllowed: 0,
        passedDenied: 0,
        failedAllowed: 0,
        failedDenied: 0,
      };
      console.log(
        `- ${role}: allowed ${m.passedAllowed}/${m.expectedAllowed} passed (failed ${m.failedAllowed}), ` +
        `denied ${m.passedDenied}/${m.expectedDenied} passed (failed ${m.failedDenied})`
      );
    }

    if (report.summary.failed > 0) {
      console.log('\nSample failures:');
      for (const f of report.checks.filter((c) => !c.pass).slice(0, 20)) {
        console.log(`- [${f.role}] ${f.method} ${f.route} -> ${f.actualStatus} (${f.expected})`);
      }
    }

    // Exit non-zero if there are failed checks so CI/local runs can catch regressions.
    if (report.summary.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

run().catch((err) => {
  console.error('Role-aspect smoke test failed:', err.message);
  process.exit(1);
});
