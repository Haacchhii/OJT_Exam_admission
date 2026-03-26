import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../generated/prisma-client/index.js';

const prisma = new PrismaClient();

const EMAIL_VERIFICATION_REQUIRED = (process.env.EMAIL_VERIFICATION_REQUIRED || 'true').toLowerCase() === 'true';

function bucketBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function pushIssue(issues, severity, code, message) {
  issues.push({ severity, code, message });
}

function latestByDate(items, dateKey) {
  if (!items.length) return null;
  return [...items].sort((a, b) => new Date(b[dateKey]) - new Date(a[dateKey]))[0];
}

async function main() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: {
      applicantProfile: true,
      staffProfile: true,
    },
    orderBy: { id: 'asc' },
  });

  const admissions = await prisma.admission.findMany({
    where: { deletedAt: null },
    include: { documents: true },
  });

  const registrations = await prisma.examRegistration.findMany({
    include: {
      result: true,
      schedule: { include: { exam: true } },
    },
  });

  const admissionsByUserId = bucketBy(admissions, (a) => a.userId);
  const regsByEmail = bucketBy(registrations, (r) => (r.userEmail || '').toLowerCase());

  const results = [];
  const summary = {
    users: users.length,
    byRole: {},
    error: 0,
    warning: 0,
    info: 0,
  };

  for (const u of users) {
    summary.byRole[u.role] = (summary.byRole[u.role] || 0) + 1;
    const issues = [];

    if (u.status !== 'Active') {
      pushIssue(issues, 'warning', 'ACCOUNT_INACTIVE', 'Account status is not Active.');
    }

    if (u.role === 'applicant') {
      if (!u.applicantProfile) {
        pushIssue(issues, 'error', 'MISSING_APPLICANT_PROFILE', 'Applicant profile record is missing.');
      }

      if (EMAIL_VERIFICATION_REQUIRED && !u.emailVerified) {
        pushIssue(issues, 'warning', 'EMAIL_NOT_VERIFIED', 'Email is not verified while EMAIL_VERIFICATION_REQUIRED=true.');
      }

      const userRegs = regsByEmail.get((u.email || '').toLowerCase()) || [];
      if (userRegs.length === 0) {
        pushIssue(issues, 'info', 'NO_EXAM_REGISTRATION', 'No exam registration found for this applicant email.');
      }

      const doneRegs = userRegs.filter((r) => r.status === 'done');
      const regsWithResults = userRegs.filter((r) => !!r.result);
      if (doneRegs.length > 0 && regsWithResults.length === 0) {
        pushIssue(issues, 'warning', 'DONE_WITHOUT_RESULT', 'Has done exam registration but no linked exam result.');
      }

      const userAdmissions = admissionsByUserId.get(u.id) || [];
      if (userAdmissions.length === 0) {
        pushIssue(issues, 'info', 'NO_ADMISSION_RECORD', 'No admission record found for this applicant.');
      } else {
        const latestAdmission = latestByDate(userAdmissions, 'submittedAt');
        if ((latestAdmission.documents || []).length === 0) {
          pushIssue(issues, 'warning', 'ADMISSION_NO_DOCUMENTS', 'Latest admission has no uploaded/submitted document records.');
        }

        if (latestAdmission.status === 'Accepted' && !u.applicantProfile?.studentNumber) {
          pushIssue(issues, 'error', 'ACCEPTED_NO_STUDENT_NUMBER', 'Accepted admission but applicantProfile.studentNumber is missing.');
        }
      }
    }

    if (u.role === 'administrator' || u.role === 'registrar' || u.role === 'teacher') {
      if (!u.staffProfile) {
        pushIssue(issues, 'warning', 'MISSING_STAFF_PROFILE', 'Employee account has no staffProfile record.');
      }
    }

    for (const issue of issues) {
      summary[issue.severity] += 1;
    }

    results.push({
      user: {
        id: u.id,
        email: u.email,
        name: `${u.firstName} ${u.lastName}`,
        role: u.role,
        status: u.status,
        emailVerified: u.emailVerified,
      },
      issueCount: issues.length,
      issues,
    });
  }

  const usersWithIssues = results.filter((r) => r.issueCount > 0);

  const report = {
    generatedAt: new Date().toISOString(),
    config: { EMAIL_VERIFICATION_REQUIRED },
    summary,
    usersWithIssues: usersWithIssues.length,
    users: results,
  };

  const reportsDir = path.resolve('reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const fileName = `account-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const outPath = path.join(reportsDir, fileName);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('Account audit complete.');
  console.log(`- Total users: ${summary.users}`);
  console.log(`- By role: ${JSON.stringify(summary.byRole)}`);
  console.log(`- Issues: errors=${summary.error}, warnings=${summary.warning}, info=${summary.info}`);
  console.log(`- Users with issues: ${usersWithIssues.length}`);
  console.log(`- Report file: ${outPath}`);

  if (usersWithIssues.length > 0) {
    console.log('\nTop accounts with missing items:');
    for (const row of usersWithIssues.slice(0, 20)) {
      const headline = row.issues.map((i) => `${i.severity}:${i.code}`).join(', ');
      console.log(`- [${row.user.role}] ${row.user.email} -> ${headline}`);
    }
  }
}

main()
  .catch((err) => {
    console.error('Account audit failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
