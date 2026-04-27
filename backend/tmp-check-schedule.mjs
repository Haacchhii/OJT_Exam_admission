import prisma from './src/config/db.js';

const exam = await prisma.exam.findFirst({
  where: { title: 'Grade 12 Exam for Stem' },
  select: { id: true, title: true },
});

const schedule = exam
  ? await prisma.examSchedule.findFirst({
      where: { examId: exam.id },
      orderBy: { scheduledDate: 'desc' },
      select: { id: true, examId: true, scheduledDate: true, maxSlots: true, slotsTaken: true },
    })
  : null;

console.log(JSON.stringify({ exam, schedule }, null, 2));
await prisma.$disconnect();
