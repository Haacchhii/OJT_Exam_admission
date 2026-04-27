import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../generated/prisma-client/index.js';

const prisma = new PrismaClient();

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function bucketBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function makeIssue(code, severity, message) {
  return { code, severity, message };
}

function latestByCreatedAt(items) {
  if (!items.length) return null;
  return [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
}

async function main() {
  const [registrations, activeApplicants, deletedApplicants] = await Promise.all([
    prisma.examRegistration.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            deletedAt: true,
          },
        },
        schedule: {
          include: {
            exam: {
              select: {
                id: true,
                title: true,
                gradeLevel: true,
              },
            },
          },
        },
        result: {
          select: {
            id: true,
            totalScore: true,
            maxPossible: true,
            percentage: true,
            passed: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.user.findMany({
      where: { role: 'applicant', deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        deletedAt: true,
      },
    }),
    prisma.user.findMany({
      where: { role: 'applicant', deletedAt: { not: null } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        deletedAt: true,
      },
    }),
  ]);

  const activeApplicantsByEmail = bucketBy(activeApplicants, (user) => normalizeEmail(user.email));
  const deletedApplicantsByEmail = bucketBy(deletedApplicants, (user) => normalizeEmail(user.email));

  const findings = [];
  const summary = {
    totalRegistrations: registrations.length,
    linkedToActiveAccount: 0,
    linkedToSoftDeletedAccount: 0,
    orphanedEmailOnly: 0,
    orphanedButRelinkable: 0,
    emailMismatch: 0,
  };

  for (const reg of registrations) {
    const email = normalizeEmail(reg.userEmail);
    const owner = reg.user || null;
    const ownerEmail = normalizeEmail(owner?.email);
    const activeMatches = email ? activeApplicantsByEmail.get(email) || [] : [];
    const deletedMatches = email ? deletedApplicantsByEmail.get(email) || [] : [];

    const issues = [];
    let label = 'linked-active';

    if (owner && owner.deletedAt) {
      issues.push(makeIssue('OWNER_SOFT_DELETED', 'warning', 'The registration is linked to a soft-deleted applicant account.'));
      label = 'linked-soft-deleted';
      summary.linkedToSoftDeletedAccount += 1;
    } else if (reg.userId) {
      summary.linkedToActiveAccount += 1;
    }

    if (!reg.userId) {
      if (activeMatches.length > 0) {
        issues.push(makeIssue('EMAIL_RELINK_CANDIDATE', 'info', 'This legacy registration has no userId but matches an active applicant email.'));
        label = 'orphan-relink-candidate';
        summary.orphanedButRelinkable += 1;
      } else {
        issues.push(makeIssue('ORPHAN_EMAIL_ONLY', 'warning', 'This registration has no userId and does not match any active applicant account.'));
        label = 'orphan-email-only';
        summary.orphanedEmailOnly += 1;
      }
    }

    if (owner && email && ownerEmail && ownerEmail !== email) {
      issues.push(makeIssue('EMAIL_MISMATCH', 'warning', 'The registration email does not match the linked user account email.'));
      summary.emailMismatch += 1;
      label = label === 'linked-active' ? 'linked-email-mismatch' : `${label}+email-mismatch`;
    }

    if (deletedMatches.length > 0 && !owner) {
      issues.push(makeIssue('MATCHES_DELETED_ACCOUNT', 'info', 'The email matches a deleted applicant account, which may explain legacy history.'));
    }

    if (issues.length > 0) {
      findings.push({
        id: reg.id,
        trackingId: reg.trackingId,
        label,
        createdAt: reg.createdAt,
        userEmail: reg.userEmail,
        userId: reg.userId,
        status: reg.status,
        schedule: reg.schedule
          ? {
              id: reg.schedule.id,
              examId: reg.schedule.examId,
              examTitle: reg.schedule.exam?.title || null,
              gradeLevel: reg.schedule.exam?.gradeLevel || null,
            }
          : null,
        linkedUser: owner
          ? {
              id: owner.id,
              email: owner.email,
              status: owner.status,
              deletedAt: owner.deletedAt,
            }
          : null,
        issues,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    findingsCount: findings.length,
    findings,
  };

  const reportsDir = path.resolve('reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const fileName = `exam-registration-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const outPath = path.join(reportsDir, fileName);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('Exam registration audit complete.');
  console.log(`- Total registrations: ${summary.totalRegistrations}`);
  console.log(`- Linked to active account: ${summary.linkedToActiveAccount}`);
  console.log(`- Linked to soft-deleted account: ${summary.linkedToSoftDeletedAccount}`);
  console.log(`- Orphaned legacy registrations: ${summary.orphanedEmailOnly}`);
  console.log(`- Relink candidates: ${summary.orphanedButRelinkable}`);
  console.log(`- Email mismatches: ${summary.emailMismatch}`);
  console.log(`- Report file: ${outPath}`);

  const recent = latestByCreatedAt(findings);
  if (recent) {
    console.log(`- Most recent flagged registration: ${recent.trackingId} (${recent.label})`);
  }
}

main()
  .catch((err) => {
    console.error('Exam registration audit failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });