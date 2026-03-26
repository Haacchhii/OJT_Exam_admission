import { PrismaClient } from '../generated/prisma-client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function isoDatePlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

async function main() {
  console.log('🌱 Seeding comprehensive test dataset...');
  await clearAll();

  const currentYear = new Date().getFullYear();
  const activeYearName = `${currentYear}-${currentYear + 1}`;

  const ayOld = await prisma.academicYear.create({
    data: { year: `${currentYear - 1}-${currentYear}`, isActive: false },
  });
  const ayActive = await prisma.academicYear.create({
    data: { year: activeYearName, isActive: true },
  });

  const sem1 = await prisma.semester.create({ data: { name: 'First Semester', academicYearId: ayActive.id, isActive: true } });
  const sem2 = await prisma.semester.create({ data: { name: 'Second Semester', academicYearId: ayActive.id, isActive: false } });
  await prisma.semester.create({ data: { name: 'Summer', academicYearId: ayActive.id, isActive: false } });

  const adminHash = await bcrypt.hash('admin123', 12);
  const teacherHash = await bcrypt.hash('teacher123', 12);
  const registrarHash = await bcrypt.hash('registrar123', 12);
  const studentHash = await bcrypt.hash('student123', 12);

  const users = await Promise.all([
    prisma.user.create({ data: { firstName: 'Admin', middleName: 'System', lastName: 'User', email: 'admin@goldenkey.edu', passwordHash: adminHash, role: 'administrator', status: 'Active', emailVerified: true } }),
    prisma.user.create({ data: { firstName: 'Registrar', middleName: 'Office', lastName: 'Staff', email: 'registrar@goldenkey.edu', passwordHash: registrarHash, role: 'registrar', status: 'Active', emailVerified: true } }),
    prisma.user.create({ data: { firstName: 'Teacher', middleName: 'Exam', lastName: 'Proctor', email: 'teacher@goldenkey.edu', passwordHash: teacherHash, role: 'teacher', status: 'Active', emailVerified: true } }),
    prisma.user.create({ data: { firstName: 'Maria', middleName: 'Lopez', lastName: 'Santos', email: 'maria.santos@email.com', passwordHash: studentHash, role: 'applicant', status: 'Active', emailVerified: true } }),
    prisma.user.create({ data: { firstName: 'Juan', middleName: 'Perez', lastName: 'Cruz', email: 'juan.cruz@email.com', passwordHash: studentHash, role: 'applicant', status: 'Active', emailVerified: true } }),
    prisma.user.create({ data: { firstName: 'Ana', middleName: 'Ramos', lastName: 'Reyes', email: 'ana.reyes@email.com', passwordHash: studentHash, role: 'applicant', status: 'Active', emailVerified: true } }),
    prisma.user.create({ data: { firstName: 'Carlo', middleName: 'Mendoza', lastName: 'Garcia', email: 'carlo.garcia@email.com', passwordHash: studentHash, role: 'applicant', status: 'Active', emailVerified: true } }),
  ]);

  const [admin, registrar, teacher, maria, juan, ana, carlo] = users;

  await prisma.staffProfile.createMany({
    data: [
      { userId: admin.id, employeeId: 'EMP-ADM-0001', position: 'System Administrator' },
      { userId: registrar.id, employeeId: 'EMP-REG-0001', position: 'Registrar Officer' },
      { userId: teacher.id, employeeId: 'EMP-TCH-0001', position: 'Entrance Exam Teacher' },
    ],
  });

  await prisma.applicantProfile.createMany({
    data: [
      { userId: maria.id, studentNumber: 'S-2026-0001', gradeLevel: 'Grade 7', guardian: 'Elena Santos', guardianPhone: '+63 912 000 0001', guardianEmail: 'elena.santos@email.com' },
      { userId: juan.id, studentNumber: 'S-2026-0002', gradeLevel: 'Grade 11 - STEM', guardian: 'Pedro Cruz', guardianPhone: '+63 912 000 0002', guardianEmail: 'pedro.cruz@email.com' },
      { userId: ana.id, studentNumber: 'S-2026-0003', gradeLevel: 'Grade 10', guardian: 'Rosa Reyes', guardianPhone: '+63 912 000 0003', guardianEmail: 'rosa.reyes@email.com' },
      { userId: carlo.id, studentNumber: 'S-2026-0004', gradeLevel: 'Grade 8', guardian: 'Jose Garcia', guardianPhone: '+63 912 000 0004', guardianEmail: 'jose.garcia@email.com' },
    ],
  });

  const admissions = await Promise.all([
    prisma.admission.create({
      data: {
        trackingId: 'GK-ADM-2026-00001',
        userId: maria.id,
        firstName: 'Maria', middleName: 'Lopez', lastName: 'Santos',
        email: maria.email, phone: '+63 912 345 6789', dob: '2010-05-14', gender: 'Female',
        address: '123 Rizal St, San Jose, Batangas',
        gradeLevel: 'Grade 7', schoolYear: activeYearName, applicantType: 'New',
        guardian: 'Elena Santos', guardianRelation: 'Mother', guardianPhone: '+63 912 000 0001', guardianEmail: 'elena.santos@email.com',
        status: 'Accepted', notes: 'Complete requirements. Approved.',
        academicYearId: ayActive.id, semesterId: sem1.id,
      },
    }),
    prisma.admission.create({
      data: {
        trackingId: 'GK-ADM-2026-00002',
        userId: juan.id,
        firstName: 'Juan', middleName: 'Perez', lastName: 'Cruz',
        email: juan.email, phone: '+63 917 111 1111', dob: '2009-09-21', gender: 'Male',
        address: '456 Mabini Ave, San Jose, Batangas',
        gradeLevel: 'Grade 11 - STEM', schoolYear: activeYearName, applicantType: 'Transferee',
        guardian: 'Pedro Cruz', guardianRelation: 'Father', guardianPhone: '+63 912 000 0002', guardianEmail: 'pedro.cruz@email.com',
        status: 'Under Screening', notes: 'Awaiting final document checks.',
        academicYearId: ayActive.id, semesterId: sem1.id,
      },
    }),
    prisma.admission.create({
      data: {
        trackingId: 'GK-ADM-2026-00003',
        userId: ana.id,
        firstName: 'Ana', middleName: 'Ramos', lastName: 'Reyes',
        email: ana.email, phone: '+63 905 222 2222', dob: '2011-03-08', gender: 'Female',
        address: '789 Luna St, San Jose, Batangas',
        gradeLevel: 'Grade 10', schoolYear: activeYearName, applicantType: 'New',
        guardian: 'Rosa Reyes', guardianRelation: 'Mother', guardianPhone: '+63 912 000 0003', guardianEmail: 'rosa.reyes@email.com',
        status: 'Submitted', notes: '',
        academicYearId: ayActive.id, semesterId: sem1.id,
      },
    }),
  ]);

  await prisma.admissionDocument.createMany({
    data: [
      { admissionId: admissions[0].id, documentName: 'PSA Birth Certificate', reviewStatus: 'accepted', reviewedAt: new Date(), reviewedById: registrar.id },
      { admissionId: admissions[0].id, documentName: 'Report Card / Form 138', reviewStatus: 'accepted', reviewedAt: new Date(), reviewedById: registrar.id },
      { admissionId: admissions[1].id, documentName: 'PSA Birth Certificate', reviewStatus: 'pending' },
      { admissionId: admissions[1].id, documentName: 'Good Moral Certificate', reviewStatus: 'pending' },
      { admissionId: admissions[2].id, documentName: 'PSA Birth Certificate', reviewStatus: 'pending' },
    ],
  });

  const examGrade7 = await prisma.exam.create({
    data: {
      title: 'Entrance Exam - Grade 7',
      gradeLevel: 'Grade 7',
      durationMinutes: 60,
      passingScore: 70,
      isActive: true,
      academicYearId: ayActive.id,
      semesterId: sem1.id,
      createdById: teacher.id,
      questions: {
        create: [
          { questionText: '2 + 2 = ?', questionType: 'mc', points: 5, orderNum: 1, choices: { create: [
            { choiceText: '3', isCorrect: false, orderNum: 1 },
            { choiceText: '4', isCorrect: true, orderNum: 2 },
            { choiceText: '5', isCorrect: false, orderNum: 3 },
            { choiceText: '6', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'What is the capital of the Philippines?', questionType: 'mc', points: 5, orderNum: 2, choices: { create: [
            { choiceText: 'Cebu', isCorrect: false, orderNum: 1 },
            { choiceText: 'Manila', isCorrect: true, orderNum: 2 },
            { choiceText: 'Davao', isCorrect: false, orderNum: 3 },
            { choiceText: 'Baguio', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'Why is education important?', questionType: 'essay', points: 10, orderNum: 3 },
        ],
      },
    },
  });

  const examSHS = await prisma.exam.create({
    data: {
      title: 'Entrance Exam - Grade 11 STEM',
      gradeLevel: 'Grade 11 - STEM',
      durationMinutes: 90,
      passingScore: 75,
      isActive: true,
      academicYearId: ayActive.id,
      semesterId: sem1.id,
      createdById: teacher.id,
      questions: {
        create: [
          { questionText: 'Derivative of 3x^2 + 2x is?', questionType: 'mc', points: 10, orderNum: 1, choices: { create: [
            { choiceText: '6x + 2', isCorrect: true, orderNum: 1 },
            { choiceText: '3x + 2', isCorrect: false, orderNum: 2 },
            { choiceText: '6x^2 + 2', isCorrect: false, orderNum: 3 },
            { choiceText: '2x + 3', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'Explain one real-world use of calculus.', questionType: 'essay', points: 20, orderNum: 2 },
        ],
      },
    },
  });

  const examAll = await prisma.exam.create({
    data: {
      title: 'General Aptitude Screening',
      gradeLevel: 'All Levels',
      durationMinutes: 45,
      passingScore: 60,
      isActive: true,
      academicYearId: ayActive.id,
      semesterId: sem2.id,
      createdById: teacher.id,
      questions: {
        create: [
          { questionText: 'The sun rises in the?', questionType: 'mc', points: 5, orderNum: 1, choices: { create: [
            { choiceText: 'North', isCorrect: false, orderNum: 1 },
            { choiceText: 'South', isCorrect: false, orderNum: 2 },
            { choiceText: 'East', isCorrect: true, orderNum: 3 },
            { choiceText: 'West', isCorrect: false, orderNum: 4 },
          ] } },
        ],
      },
    },
  });

  const schedules = await Promise.all([
    prisma.examSchedule.create({
      data: {
        examId: examGrade7.id,
        scheduledDate: isoDatePlus(3),
        startTime: '09:00',
        endTime: '10:00',
        visibilityStartDate: isoDatePlus(0),
        visibilityEndDate: isoDatePlus(9),
        registrationOpenDate: isoDatePlus(0),
        registrationCloseDate: isoDatePlus(2),
        maxSlots: 40,
        slotsTaken: 1,
        venue: 'Computer Lab A',
      },
    }),
    prisma.examSchedule.create({
      data: {
        examId: examSHS.id,
        scheduledDate: isoDatePlus(5),
        startTime: '13:00',
        endTime: '14:30',
        visibilityStartDate: isoDatePlus(0),
        visibilityEndDate: isoDatePlus(10),
        registrationOpenDate: isoDatePlus(0),
        registrationCloseDate: isoDatePlus(4),
        maxSlots: 30,
        slotsTaken: 1,
        venue: 'Science Hall',
      },
    }),
    prisma.examSchedule.create({
      data: {
        examId: examAll.id,
        scheduledDate: isoDatePlus(7),
        startTime: '10:30',
        endTime: '11:15',
        visibilityStartDate: isoDatePlus(0),
        visibilityEndDate: isoDatePlus(12),
        registrationOpenDate: isoDatePlus(0),
        registrationCloseDate: isoDatePlus(6),
        maxSlots: 60,
        slotsTaken: 0,
        venue: 'Multipurpose Room',
      },
    }),
  ]);

  const regDone = await prisma.examRegistration.create({
    data: {
      trackingId: 'GK-EXM-2026-00001',
      userEmail: maria.email,
      userId: maria.id,
      scheduleId: schedules[0].id,
      status: 'done',
      startedAt: new Date(Date.now() - 3600000),
      submittedAt: new Date(Date.now() - 1800000),
    },
  });

  const regStarted = await prisma.examRegistration.create({
    data: {
      trackingId: 'GK-EXM-2026-00002',
      userEmail: juan.email,
      userId: juan.id,
      scheduleId: schedules[1].id,
      status: 'started',
      startedAt: new Date(),
    },
  });

  await prisma.examResult.create({
    data: {
      registrationId: regDone.id,
      totalScore: 18,
      maxPossible: 20,
      percentage: 90,
      passed: true,
      essayReviewed: true,
      reviewedById: teacher.id,
    },
  });

  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, action: 'system.seed', entity: 'system', details: JSON.stringify({ phase: 'rebuild-dataset' }), ipAddress: '127.0.0.1' },
      { userId: registrar.id, action: 'admission.review', entity: 'admission', entityId: admissions[0].id, details: JSON.stringify({ status: 'Accepted' }), ipAddress: '127.0.0.1' },
      { userId: teacher.id, action: 'exam.create', entity: 'exam', entityId: examGrade7.id, details: JSON.stringify({ title: examGrade7.title }), ipAddress: '127.0.0.1' },
    ],
  });

  await resetSequences();

  console.log('✅ Dataset created successfully.');
  console.log('Accounts:');
  console.log('  admin@goldenkey.edu / admin123');
  console.log('  registrar@goldenkey.edu / registrar123');
  console.log('  teacher@goldenkey.edu / teacher123');
  console.log('  maria.santos@email.com / student123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
