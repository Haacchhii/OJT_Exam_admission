import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '../generated/prisma-client/index.js';

const prisma = new PrismaClient();

function timestamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}-${hh}${mm}${ss}`;
}

async function main() {
  const root = process.cwd();
  const outDir = path.join(root, 'backups');
  await fs.mkdir(outDir, { recursive: true });

  const data = {
    meta: {
      createdAt: new Date().toISOString(),
      source: 'golden-key-backend',
      version: '1',
    },
    tables: {
      users: await prisma.user.findMany({ orderBy: { id: 'asc' } }),
      applicantProfiles: await prisma.applicantProfile.findMany({ orderBy: { id: 'asc' } }),
      staffProfiles: await prisma.staffProfile.findMany({ orderBy: { id: 'asc' } }),
      academicYears: await prisma.academicYear.findMany({ orderBy: { id: 'asc' } }),
      semesters: await prisma.semester.findMany({ orderBy: { id: 'asc' } }),
      admissions: await prisma.admission.findMany({ orderBy: { id: 'asc' } }),
      admissionDocuments: await prisma.admissionDocument.findMany({ orderBy: { id: 'asc' } }),
      exams: await prisma.exam.findMany({ orderBy: { id: 'asc' } }),
      examQuestions: await prisma.examQuestion.findMany({ orderBy: { id: 'asc' } }),
      questionChoices: await prisma.questionChoice.findMany({ orderBy: { id: 'asc' } }),
      examSchedules: await prisma.examSchedule.findMany({ orderBy: { id: 'asc' } }),
      examRegistrations: await prisma.examRegistration.findMany({ orderBy: { id: 'asc' } }),
      submittedAnswers: await prisma.submittedAnswer.findMany({ orderBy: { id: 'asc' } }),
      essayAnswers: await prisma.essayAnswer.findMany({ orderBy: { id: 'asc' } }),
      examResults: await prisma.examResult.findMany({ orderBy: { id: 'asc' } }),
      auditLogs: await prisma.auditLog.findMany({ orderBy: { id: 'asc' } }),
    },
  };

  const filePath = path.join(outDir, `backup-${timestamp()}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

  console.log(`✅ Backup complete: ${filePath}`);
}

main()
  .catch((e) => {
    console.error('Backup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
