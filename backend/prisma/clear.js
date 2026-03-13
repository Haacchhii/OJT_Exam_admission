import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clear() {
  console.log('Clearing all tables...');
  await prisma.essayAnswer.deleteMany();
  await prisma.submittedAnswer.deleteMany();
  await prisma.examResult.deleteMany();
  await prisma.examRegistration.deleteMany();
  await prisma.examSchedule.deleteMany();
  await prisma.questionChoice.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.admissionDocument.deleteMany();
  await prisma.admission.deleteMany();
  await prisma.user.deleteMany();
  console.log('All tables cleared — database is empty.');
  await prisma.$disconnect();
}

clear().catch(e => { console.error(e); process.exit(1); });
