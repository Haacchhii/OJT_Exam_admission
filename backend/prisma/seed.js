import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear all data
  await prisma.$transaction([
    prisma.notification.deleteMany(),
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
    prisma.semester.deleteMany(),
    prisma.academicYear.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // ─── Academic Years ───────────────────────────────
  const academicYears = await Promise.all([
    prisma.academicYear.create({ data: { id: 1, year: '2025-2026', isActive: false } }),
    prisma.academicYear.create({ data: { id: 2, year: '2026-2027', isActive: true } }),
  ]);
  console.log(`  ✅ ${academicYears.length} academic years`);

  // ─── Semesters ────────────────────────────────────
  const semesters = await Promise.all([
    prisma.semester.create({ data: { id: 1, name: 'First Semester',  academicYearId: 2, isActive: true } }),
    prisma.semester.create({ data: { id: 2, name: 'Second Semester', academicYearId: 2, isActive: false } }),
    prisma.semester.create({ data: { id: 3, name: 'Summer',          academicYearId: 2, isActive: false } }),
  ]);
  console.log(`  ✅ ${semesters.length} semesters`);

  // ─── Users ────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 12);
  const studentHash = await bcrypt.hash('student123', 12);

  const userRecords = [
    { id: 1, firstName: 'Admin',     lastName: 'Staff',    email: 'admin@goldenkey.edu',       passwordHash: adminHash,   role: 'administrator', status: 'Active' },
    { id: 2, firstName: 'Registrar', lastName: 'Office',   email: 'registrar@goldenkey.edu',   passwordHash: adminHash,   role: 'registrar',     status: 'Active' },
    { id: 9, firstName: 'Teacher',   lastName: 'Examiner', email: 'teacher@goldenkey.edu',     passwordHash: adminHash,   role: 'teacher',       status: 'Active' },
    { id: 3, firstName: 'Maria',     lastName: 'Santos',   email: 'maria.santos@email.com',    passwordHash: studentHash, role: 'applicant',     status: 'Active' },
    { id: 4, firstName: 'Juan',      lastName: 'Dela Cruz', email: 'juan.dc@email.com',        passwordHash: studentHash, role: 'applicant',     status: 'Active' },
    { id: 5, firstName: 'Ana',       lastName: 'Reyes',    email: 'ana.reyes@email.com',       passwordHash: studentHash, role: 'applicant',     status: 'Active' },
    { id: 6, firstName: 'Carlos',    lastName: 'Garcia',   email: 'c.garcia@email.com',        passwordHash: studentHash, role: 'applicant',     status: 'Active' },
    { id: 7, firstName: 'Isabella',  lastName: 'Torres',   email: 'bella.t@email.com',         passwordHash: studentHash, role: 'applicant',     status: 'Active' },
    { id: 8, firstName: 'Miguel',    lastName: 'Ramos',    email: 'm.ramos@email.com',         passwordHash: studentHash, role: 'applicant',     status: 'Active' },
  ];
  for (const u of userRecords) { await prisma.user.create({ data: u }); }
  console.log(`  ✅ ${userRecords.length} users`);

  // ─── Admissions ───────────────────────────────────
  const admissions = [
    { id: 1, userId: 3, academicYearId: 2, semesterId: 1, firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@email.com', phone: '+63 912 345 6789', dob: '2010-05-14', gender: 'Female', address: '123 Rizal St, San Jose, Batangas', gradeLevel: 'Grade 7', prevSchool: 'Manila Elementary School', schoolYear: '2026-2027', lrn: '123456789012', applicantType: 'New', guardian: 'Elena Santos', guardianRelation: 'Mother', guardianPhone: '+63 912 000 1111', guardianEmail: 'elena.santos@email.com', status: 'Accepted', notes: 'Complete requirements. Approved for admission.', documents: ['PSA Birth Certificate', '2x2 ID Photos', 'Baptismal Certificate', 'Report Card / Form 138', 'Certificate of Good Moral Character', 'Latest Income Tax Return'] },
    { id: 2, userId: 4, academicYearId: 2, semesterId: 1, firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan.dc@email.com', phone: '+63 917 654 3210', dob: '2009-11-22', gender: 'Male', address: '456 Mabini Ave, San Jose, Batangas', gradeLevel: 'Grade 11 — STEM', prevSchool: 'Makati High School', schoolYear: '2026-2027', lrn: '234567890123', applicantType: 'Transferee', guardian: 'Pedro Dela Cruz', guardianRelation: 'Father', guardianPhone: '+63 917 000 2222', guardianEmail: '', status: 'Under Screening', notes: '', documents: ['PSA Birth Certificate', 'Report Card / Form 138'] },
    { id: 3, userId: 5, academicYearId: 2, semesterId: 1, firstName: 'Ana', lastName: 'Reyes', email: 'ana.reyes@email.com', phone: '+63 926 111 2233', dob: '2011-03-08', gender: 'Female', address: '789 Luna St, San Jose, Batangas', gradeLevel: 'Grade 10', prevSchool: 'Pasig National High School', schoolYear: '2026-2027', lrn: '345678901234', applicantType: 'New', guardian: 'Rosa Reyes', guardianRelation: 'Mother', guardianPhone: '+63 926 000 3333', guardianEmail: '', status: 'Under Evaluation', notes: 'Excellent grades. Scholarship candidate.', documents: ['PSA Birth Certificate', '2x2 ID Photos', 'Baptismal Certificate', 'Report Card / Form 138', 'Certificate of Good Moral Character', 'ESC Certificate'] },
    { id: 4, userId: 6, academicYearId: 2, semesterId: 1, firstName: 'Carlos', lastName: 'Garcia', email: 'c.garcia@email.com', phone: '+63 935 222 4455', dob: '2012-07-30', gender: 'Male', address: '321 Aguinaldo Blvd, San Jose, Batangas', gradeLevel: 'Grade 8', prevSchool: 'Cavite Academy', schoolYear: '2026-2027', lrn: '', applicantType: 'Transferee', guardian: 'Jose Garcia', guardianRelation: 'Father', guardianPhone: '+63 935 000 4444', guardianEmail: '', status: 'Rejected', notes: 'Incomplete requirements. Missing PSA birth certificate and good moral.', documents: ['Report Card / Form 138'] },
    { id: 5, userId: 7, academicYearId: 2, semesterId: 1, firstName: 'Isabella', lastName: 'Torres', email: 'bella.t@email.com', phone: '+63 905 333 6677', dob: '2008-12-15', gender: 'Female', address: '567 Bonifacio Dr, San Jose, Batangas', gradeLevel: 'Grade 12 — ABM', prevSchool: 'BGC International School', schoolYear: '2026-2027', lrn: '567890123456', applicantType: 'New', guardian: 'Carmen Torres', guardianRelation: 'Mother', guardianPhone: '+63 905 000 5555', guardianEmail: '', status: 'Submitted', notes: '', documents: ['PSA Birth Certificate', '2x2 ID Photos', 'Report Card / Form 138', 'Certificate of Good Moral Character'] },
    { id: 6, userId: 8, academicYearId: 2, semesterId: 1, firstName: 'Miguel', lastName: 'Ramos', email: 'm.ramos@email.com', phone: '+63 918 444 8899', dob: '2011-09-03', gender: 'Male', address: '890 Del Pilar St, San Jose, Batangas', gradeLevel: 'Grade 9', prevSchool: 'Manila Science High School', schoolYear: '2026-2027', lrn: '678901234567', applicantType: 'New', guardian: 'Luis Ramos', guardianRelation: 'Father', guardianPhone: '+63 918 000 6666', guardianEmail: '', status: 'Under Evaluation', notes: '', documents: ['PSA Birth Certificate', '2x2 ID Photos', 'Report Card / Form 138'] },
  ];

  for (const { documents, ...adm } of admissions) {
    await prisma.admission.create({
      data: {
        ...adm,
        trackingId: `GK-ADM-2026-${String(adm.id).padStart(5, '0')}`,
        documents: documents.length ? { create: documents.map(d => ({ documentName: d })) } : undefined,
      },
    });
  }
  console.log(`  ✅ ${admissions.length} admissions`);

  // ─── Exams ────────────────────────────────────────
  // Exam 1: Grade 7-10
  await prisma.exam.create({
    data: {
      id: 1,
      title: 'Entrance Exam — Grade 7-10',
      gradeLevel: 'Grade 7-10',
      durationMinutes: 60,
      passingScore: 60,
      isActive: true,
      createdById: 1,
      academicYearId: 2,
      semesterId: 1,
      questions: {
        create: [
          { questionText: 'What is the capital of the Philippines?', questionType: 'mc', points: 5, orderNum: 1, choices: { create: [
            { choiceText: 'Cebu', isCorrect: false, orderNum: 1 },
            { choiceText: 'Manila', isCorrect: true, orderNum: 2 },
            { choiceText: 'Davao', isCorrect: false, orderNum: 3 },
            { choiceText: 'Quezon City', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'Solve: 15 × 8 + 12 = ?', questionType: 'mc', points: 5, orderNum: 2, choices: { create: [
            { choiceText: '120', isCorrect: false, orderNum: 1 },
            { choiceText: '132', isCorrect: true, orderNum: 2 },
            { choiceText: '140', isCorrect: false, orderNum: 3 },
            { choiceText: '128', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'Which planet is known as the Red Planet?', questionType: 'mc', points: 5, orderNum: 3, choices: { create: [
            { choiceText: 'Venus', isCorrect: false, orderNum: 1 },
            { choiceText: 'Jupiter', isCorrect: false, orderNum: 2 },
            { choiceText: 'Mars', isCorrect: true, orderNum: 3 },
            { choiceText: 'Saturn', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: "What is the Filipino word for 'freedom'?", questionType: 'mc', points: 5, orderNum: 4, choices: { create: [
            { choiceText: 'Kalayaan', isCorrect: true, orderNum: 1 },
            { choiceText: 'Kapayapaan', isCorrect: false, orderNum: 2 },
            { choiceText: 'Kasarinlan', isCorrect: false, orderNum: 3 },
            { choiceText: 'Katarungan', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'Who is the national hero of the Philippines?', questionType: 'mc', points: 5, orderNum: 5, choices: { create: [
            { choiceText: 'Andres Bonifacio', isCorrect: false, orderNum: 1 },
            { choiceText: 'Jose Rizal', isCorrect: true, orderNum: 2 },
            { choiceText: 'Emilio Aguinaldo', isCorrect: false, orderNum: 3 },
            { choiceText: 'Apolinario Mabini', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'Simplify: 3/4 + 1/2 = ?', questionType: 'mc', points: 5, orderNum: 6, choices: { create: [
            { choiceText: '1', isCorrect: false, orderNum: 1 },
            { choiceText: '5/4', isCorrect: true, orderNum: 2 },
            { choiceText: '4/6', isCorrect: false, orderNum: 3 },
            { choiceText: '7/4', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'What is the largest organ in the human body?', questionType: 'mc', points: 5, orderNum: 7, choices: { create: [
            { choiceText: 'Heart', isCorrect: false, orderNum: 1 },
            { choiceText: 'Liver', isCorrect: false, orderNum: 2 },
            { choiceText: 'Skin', isCorrect: true, orderNum: 3 },
            { choiceText: 'Brain', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'Which of the following is a renewable energy source?', questionType: 'mc', points: 5, orderNum: 8, choices: { create: [
            { choiceText: 'Coal', isCorrect: false, orderNum: 1 },
            { choiceText: 'Natural Gas', isCorrect: false, orderNum: 2 },
            { choiceText: 'Solar Energy', isCorrect: true, orderNum: 3 },
            { choiceText: 'Petroleum', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'What is the value of x if 2x + 6 = 20?', questionType: 'mc', points: 5, orderNum: 9, choices: { create: [
            { choiceText: '5', isCorrect: false, orderNum: 1 },
            { choiceText: '7', isCorrect: true, orderNum: 2 },
            { choiceText: '8', isCorrect: false, orderNum: 3 },
            { choiceText: '10', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'Write a short paragraph about why education is important.', questionType: 'essay', points: 15, orderNum: 10 },
        ],
      },
    },
  });

  // Exam 2: Senior High
  await prisma.exam.create({
    data: {
      id: 2,
      title: 'Entrance Exam — Senior High',
      gradeLevel: 'Grade 11-12',
      durationMinutes: 90,
      passingScore: 70,
      isActive: true,
      createdById: 1,
      academicYearId: 2,
      semesterId: 1,
      questions: {
        create: [
          { questionText: 'What is the derivative of f(x) = 3x² + 2x?', questionType: 'mc', points: 5, orderNum: 1, choices: { create: [
            { choiceText: '6x + 2', isCorrect: true, orderNum: 1 },
            { choiceText: '3x + 2', isCorrect: false, orderNum: 2 },
            { choiceText: '6x² + 2', isCorrect: false, orderNum: 3 },
            { choiceText: 'x² + 2x', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: "Who wrote 'Noli Me Tangere'?", questionType: 'mc', points: 5, orderNum: 2, choices: { create: [
            { choiceText: 'Andres Bonifacio', isCorrect: false, orderNum: 1 },
            { choiceText: 'Jose Rizal', isCorrect: true, orderNum: 2 },
            { choiceText: 'Marcelo H. del Pilar', isCorrect: false, orderNum: 3 },
            { choiceText: 'Graciano Lopez Jaena', isCorrect: false, orderNum: 4 },
          ] } },
          { questionText: 'Discuss the importance of critical thinking in modern education.', questionType: 'essay', points: 20, orderNum: 3 },
        ],
      },
    },
  });
  console.log('  ✅ 2 exams with questions');

  // ─── Schedules ────────────────────────────────────
  await prisma.examSchedule.createMany({
    data: [
      { id: 1, examId: 1, scheduledDate: '2026-03-05', startTime: '09:00', endTime: '10:00', maxSlots: 30, slotsTaken: 12 },
      { id: 2, examId: 1, scheduledDate: '2026-03-12', startTime: '09:00', endTime: '10:00', maxSlots: 30, slotsTaken: 8 },
      { id: 3, examId: 2, scheduledDate: '2026-03-12', startTime: '13:00', endTime: '14:30', maxSlots: 25, slotsTaken: 5 },
      { id: 4, examId: 1, scheduledDate: '2026-03-20', startTime: '09:00', endTime: '10:00', maxSlots: 30, slotsTaken: 0 },
    ],
  });
  console.log('  ✅ 4 schedules');

  // ─── Registrations ────────────────────────────────
  await prisma.examRegistration.createMany({
    data: [
      { id: 1, trackingId: 'GK-EXM-2026-00001', userEmail: 'maria.santos@email.com', scheduleId: 1, status: 'done', startedAt: new Date('2026-03-05T09:02:00'), submittedAt: new Date('2026-03-05T09:55:00') },
      { id: 2, trackingId: 'GK-EXM-2026-00002', userEmail: 'ana.reyes@email.com',    scheduleId: 1, status: 'done', startedAt: new Date('2026-03-05T09:01:00'), submittedAt: new Date('2026-03-05T09:48:00') },
    ],
  });
  console.log('  ✅ 2 registrations');

  // ─── Results ──────────────────────────────────────
  await prisma.examResult.createMany({
    data: [
      { registrationId: 1, totalScore: 47, maxPossible: 60, percentage: 78.3, passed: true, essayReviewed: true, reviewedById: 1 },
      { registrationId: 2, totalScore: 45, maxPossible: 60, percentage: 75.0, passed: false, essayReviewed: false },
    ],
  });
  console.log('  ✅ 2 exam results');

  // ─── Notifications ────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: 5, type: 'admission', title: 'Application Received', message: 'Your admission application has been received.', isRead: true },
      { userId: 5, type: 'status', title: 'Status Updated', message: 'Your application status has been updated to: Under Screening.', isRead: false },
      { userId: 5, type: 'exam', title: 'Exam Scheduled', message: 'You have been scheduled for the Entrance Exam on March 5, 2026.', isRead: false },
      { userId: 1, type: 'admission', title: 'New Application', message: 'New admission application received from Miguel Ramos.', isRead: false },
      { userId: 1, type: 'exam', title: 'Exam Update', message: 'Entrance Exam Batch 1 has 12 registered applicants.', isRead: true },
      { userId: 1, type: 'scoring', title: 'Essay Review', message: '2 essay answers are pending review.', isRead: false },
    ],
  });
  console.log('  ✅ 6 notifications');

  // ─── Reset PostgreSQL auto-increment sequences ───
  const tables = [
    'users', 'admissions', 'admission_documents', 'exams',
    'exam_questions', 'question_choices', 'exam_schedules',
    'exam_registrations', 'exam_results', 'submitted_answers',
    'essay_answers', 'notifications', 'academic_years', 'semesters',
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`
    );
  }
  console.log('  ✅ PostgreSQL sequences reset');

  console.log('✨ Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
