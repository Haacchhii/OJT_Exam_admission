import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const exam = await prisma.exam.findFirst({
    where: { title: 'Grade 12 Exam for Stem' }
  });
  
  if (!exam) {
    console.log('Exam not found');
    return;
  }
  
  const schedule = await prisma.examSchedule.findFirst({
    where: { examId: exam.id },
    orderBy: { scheduledDate: 'desc' }
  });
  
  if (schedule) {
    console.log('Schedule found:');
    console.log(`  ID: ${schedule.id}`);
    console.log(`  Exam ID: ${schedule.examId}`);
    console.log(`  Date: ${schedule.scheduledDate}`);
    console.log(`  Max Slots: ${schedule.maxSlots}`);
  } else {
    console.log('No schedules found for this exam');
  }
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
