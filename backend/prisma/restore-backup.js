import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '../generated/prisma-client/index.js';

const prisma = new PrismaClient();

function usage() {
  console.log('Usage: npm run db:restore -- <path-to-backup-json>');
}

async function clearAll() {
  await prisma.$transaction([
    prisma.essayAnswer.deleteMany(),
    prisma.submittedAnswer.deleteMany(),
    prisma.examResult.deleteMany(),
    prisma.examRegistration.deleteMany(),
    prisma.examSchedule.deleteMany(),
    prisma.questionChoice.deleteMany(),
    prisma.examQuestion.deleteMany(),
    prisma.exam.deleteMany(),
    prisma.admissionDocument.deleteMany(),
    prisma.admission.deleteMany(),
    prisma.staffProfile.deleteMany(),
    prisma.applicantProfile.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.semester.deleteMany(),
    prisma.academicYear.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function resetSequences() {
  const tables = [
    'users', 'applicant_profiles', 'staff_profiles',
    'academic_years', 'semesters',
    'admissions', 'admission_documents',
    'exams', 'exam_questions', 'question_choices',
    'exam_schedules', 'exam_registrations',
    'submitted_answers', 'essay_answers', 'exam_results',
    'audit_logs',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`
    );
  }
}

async function createManyIf(model, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  await model.createMany({ data: rows });
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    usage();
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const content = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(content);
  const t = parsed?.tables;

  if (!t) {
    throw new Error('Invalid backup file: missing tables object');
  }

  await clearAll();

  await createManyIf(prisma.user, t.users);
  await createManyIf(prisma.academicYear, t.academicYears);
  await createManyIf(prisma.semester, t.semesters);
  await createManyIf(prisma.applicantProfile, t.applicantProfiles);
  await createManyIf(prisma.staffProfile, t.staffProfiles);
  await createManyIf(prisma.admission, t.admissions);
  await createManyIf(prisma.admissionDocument, t.admissionDocuments);
  await createManyIf(prisma.exam, t.exams);
  await createManyIf(prisma.examQuestion, t.examQuestions);
  await createManyIf(prisma.questionChoice, t.questionChoices);
  await createManyIf(prisma.examSchedule, t.examSchedules);
  await createManyIf(prisma.examRegistration, t.examRegistrations);
  await createManyIf(prisma.submittedAnswer, t.submittedAnswers);
  await createManyIf(prisma.essayAnswer, t.essayAnswers);
  await createManyIf(prisma.examResult, t.examResults);
  await createManyIf(prisma.auditLog, t.auditLogs);

  await resetSequences();
  console.log('✅ Restore complete.');
}

main()
  .catch((e) => {
    console.error('Restore failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
