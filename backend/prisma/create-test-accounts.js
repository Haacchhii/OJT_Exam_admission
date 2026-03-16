import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_PASSWORD = 'Tester!123';

function nowSuffix() {
  return String(Date.now()).slice(-6);
}

async function ensureAcademicContext() {
  let academicYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
  if (!academicYear) {
    academicYear = await prisma.academicYear.findFirst({ orderBy: { id: 'desc' } });
  }
  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: { year: '2026-2027', isActive: true },
    });
  }

  let semester = await prisma.semester.findFirst({
    where: { academicYearId: academicYear.id, isActive: true },
  });
  if (!semester) {
    semester = await prisma.semester.findFirst({ where: { academicYearId: academicYear.id } });
  }
  if (!semester) {
    semester = await prisma.semester.create({
      data: {
        name: 'First Semester',
        academicYearId: academicYear.id,
        isActive: true,
      },
    });
  }

  return { academicYear, semester };
}

async function ensureExamAndSchedule() {
  let exam = await prisma.exam.findFirst({
    where: {
      isActive: true,
      deletedAt: null,
      gradeLevel: { in: ['Grade 7-10', 'All Levels', 'Grade 11-12'] },
    },
    orderBy: { id: 'asc' },
  });

  if (!exam) {
    const admin = await prisma.user.findFirst({ where: { role: 'administrator', deletedAt: null } });
    exam = await prisma.exam.create({
      data: {
        title: 'QA Exam Access Test',
        gradeLevel: 'Grade 7-10',
        durationMinutes: 30,
        passingScore: 60,
        isActive: true,
        createdById: admin?.id ?? null,
        questions: {
          create: [
            {
              questionText: 'QA seed check question: 2 + 2 = ?',
              questionType: 'mc',
              points: 5,
              orderNum: 1,
              choices: {
                create: [
                  { choiceText: '3', isCorrect: false, orderNum: 1 },
                  { choiceText: '4', isCorrect: true, orderNum: 2 },
                  { choiceText: '5', isCorrect: false, orderNum: 3 },
                  { choiceText: '6', isCorrect: false, orderNum: 4 },
                ],
              },
            },
          ],
        },
      },
    });
  }

  let schedule = await prisma.examSchedule.findFirst({ where: { examId: exam.id }, orderBy: { id: 'asc' } });
  if (!schedule) {
    schedule = await prisma.examSchedule.create({
      data: {
        examId: exam.id,
        scheduledDate: '2026-04-01',
        startTime: '09:00',
        endTime: '10:00',
        maxSlots: 100,
        slotsTaken: 0,
        venue: 'QA Lab',
      },
    });
  }

  return { exam, schedule };
}

async function upsertUser({ firstName, lastName, email, role, status = 'Active', emailVerified = true }, passwordHash) {
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      role,
      status,
      emailVerified,
      passwordHash,
      deletedAt: null,
    },
    create: {
      firstName,
      lastName,
      email,
      role,
      status,
      emailVerified,
      passwordHash,
    },
  });

  if (role === 'applicant') {
    await prisma.applicantProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        gradeLevel: 'Grade 7',
      },
    });
  } else {
    const employeeId = `QA-${role.slice(0, 3).toUpperCase()}-${String(user.id).padStart(4, '0')}`;
    await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: { employeeId, position: role },
      create: {
        userId: user.id,
        employeeId,
        position: role,
      },
    });
  }

  return user;
}

async function ensureRegistration(user, scheduleId, status, passed = null) {
  const trackingId = `GK-EXM-QA-${user.id}-${nowSuffix()}`;
  let reg = await prisma.examRegistration.findFirst({
    where: { userEmail: user.email, scheduleId },
    orderBy: { id: 'desc' },
  });

  if (!reg) {
    reg = await prisma.examRegistration.create({
      data: {
        trackingId,
        userEmail: user.email,
        userId: user.id,
        scheduleId,
        status,
        startedAt: status !== 'scheduled' ? new Date() : null,
        submittedAt: status === 'done' ? new Date() : null,
      },
    });
  } else {
    reg = await prisma.examRegistration.update({
      where: { id: reg.id },
      data: {
        status,
        startedAt: status !== 'scheduled' ? (reg.startedAt ?? new Date()) : null,
        submittedAt: status === 'done' ? (reg.submittedAt ?? new Date()) : null,
        userId: user.id,
      },
    });
  }

  if (passed === null) {
    await prisma.examResult.deleteMany({ where: { registrationId: reg.id } });
    return reg;
  }

  await prisma.examResult.upsert({
    where: { registrationId: reg.id },
    update: {
      totalScore: passed ? 80 : 45,
      maxPossible: 100,
      percentage: passed ? 80 : 45,
      passed,
      essayReviewed: true,
    },
    create: {
      registrationId: reg.id,
      totalScore: passed ? 80 : 45,
      maxPossible: 100,
      percentage: passed ? 80 : 45,
      passed,
      essayReviewed: true,
    },
  });

  return reg;
}

async function ensureAdmission(user, academicYearId, semesterId, status, withDocs = true, applicantType = 'New') {
  let admission = await prisma.admission.findFirst({
    where: { userId: user.id, deletedAt: null },
    orderBy: { id: 'desc' },
  });

  const data = {
    trackingId: `GK-ADM-QA-${user.id}-${nowSuffix()}`,
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: '+63 900 000 0000',
    dob: '2010-01-01',
    gender: 'Male',
    address: 'QA Address',
    gradeLevel: 'Grade 7',
    prevSchool: 'QA Previous School',
    schoolYear: '2026-2027',
    lrn: null,
    applicantType,
    guardian: 'QA Guardian',
    guardianRelation: 'Father',
    guardianPhone: '+63 900 111 1111',
    guardianEmail: 'guardian.qa@example.com',
    status,
    notes: `QA scenario: ${status}`,
    academicYearId,
    semesterId,
  };

  if (!admission) {
    admission = await prisma.admission.create({ data });
  } else {
    admission = await prisma.admission.update({
      where: { id: admission.id },
      data: {
        ...data,
        trackingId: admission.trackingId,
      },
    });
  }

  await prisma.admissionDocument.deleteMany({ where: { admissionId: admission.id } });
  if (withDocs) {
    await prisma.admissionDocument.createMany({
      data: [
        { admissionId: admission.id, documentName: 'PSA Birth Certificate' },
        { admissionId: admission.id, documentName: '2x2 ID Photos' },
        { admissionId: admission.id, documentName: 'Report Card / Form 138' },
      ],
    });
  }

  if (status === 'Accepted') {
    await prisma.applicantProfile.upsert({
      where: { userId: user.id },
      update: { studentNumber: `GKISSJ-2026-${String(user.id).padStart(5, '0')}` },
      create: {
        userId: user.id,
        studentNumber: `GKISSJ-2026-${String(user.id).padStart(5, '0')}`,
        gradeLevel: 'Grade 7',
      },
    });
  }

  return admission;
}

async function main() {
  console.log('Creating QA tester accounts...');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const { academicYear, semester } = await ensureAcademicContext();
  const { schedule } = await ensureExamAndSchedule();

  const accountDefs = [
    { key: 'qa.admin', firstName: 'QA', lastName: 'Admin', email: 'qa.admin@goldenkey.local', role: 'administrator', scenario: 'Full admin access' },
    { key: 'qa.registrar', firstName: 'QA', lastName: 'Registrar', email: 'qa.registrar@goldenkey.local', role: 'registrar', scenario: 'Admissions and registrar flows' },
    { key: 'qa.teacher', firstName: 'QA', lastName: 'Teacher', email: 'qa.teacher@goldenkey.local', role: 'teacher', scenario: 'Exam and scoring flows' },

    { key: 'qa.student.fresh', firstName: 'QA', lastName: 'Fresh', email: 'qa.student.fresh@goldenkey.local', role: 'applicant', scenario: 'No exam result, admission locked' },
    { key: 'qa.student.started', firstName: 'QA', lastName: 'Started', email: 'qa.student.started@goldenkey.local', role: 'applicant', scenario: 'Exam started/in-progress' },
    { key: 'qa.student.passed', firstName: 'QA', lastName: 'Passed', email: 'qa.student.passed@goldenkey.local', role: 'applicant', scenario: 'Exam passed, can open admission wizard' },
    { key: 'qa.student.failed', firstName: 'QA', lastName: 'Failed', email: 'qa.student.failed@goldenkey.local', role: 'applicant', scenario: 'Exam failed, admission locked' },
    { key: 'qa.student.submitted', firstName: 'QA', lastName: 'Submitted', email: 'qa.student.submitted@goldenkey.local', role: 'applicant', scenario: 'Admission Submitted' },
    { key: 'qa.student.screening', firstName: 'QA', lastName: 'Screening', email: 'qa.student.screening@goldenkey.local', role: 'applicant', scenario: 'Admission Under Screening' },
    { key: 'qa.student.evaluation', firstName: 'QA', lastName: 'Evaluation', email: 'qa.student.evaluation@goldenkey.local', role: 'applicant', scenario: 'Admission Under Evaluation' },
    { key: 'qa.student.accepted', firstName: 'QA', lastName: 'Accepted', email: 'qa.student.accepted@goldenkey.local', role: 'applicant', scenario: 'Admission Accepted + student number' },
    { key: 'qa.student.rejected', firstName: 'QA', lastName: 'Rejected', email: 'qa.student.rejected@goldenkey.local', role: 'applicant', scenario: 'Admission Rejected' },
    { key: 'qa.student.nodocs', firstName: 'QA', lastName: 'NoDocs', email: 'qa.student.nodocs@goldenkey.local', role: 'applicant', scenario: 'Submitted admission with no docs' },
    { key: 'qa.student.unverified', firstName: 'QA', lastName: 'Unverified', email: 'qa.student.unverified@goldenkey.local', role: 'applicant', emailVerified: false, scenario: 'Email verification gate test' },
    { key: 'qa.student.inactive', firstName: 'QA', lastName: 'Inactive', email: 'qa.student.inactive@goldenkey.local', role: 'applicant', status: 'Inactive', scenario: 'Inactive-account login denied' },
  ];

  const created = [];

  for (const def of accountDefs) {
    const user = await upsertUser({
      firstName: def.firstName,
      lastName: def.lastName,
      email: def.email,
      role: def.role,
      status: def.status ?? 'Active',
      emailVerified: def.emailVerified ?? true,
    }, passwordHash);

    if (def.key === 'qa.student.started') {
      await ensureRegistration(user, schedule.id, 'started', null);
    }
    if (def.key === 'qa.student.passed') {
      await ensureRegistration(user, schedule.id, 'done', true);
    }
    if (def.key === 'qa.student.failed') {
      await ensureRegistration(user, schedule.id, 'done', false);
    }

    if (def.key === 'qa.student.submitted') {
      await ensureRegistration(user, schedule.id, 'done', true);
      await ensureAdmission(user, academicYear.id, semester.id, 'Submitted', true);
    }
    if (def.key === 'qa.student.screening') {
      await ensureRegistration(user, schedule.id, 'done', true);
      await ensureAdmission(user, academicYear.id, semester.id, 'Under Screening', true);
    }
    if (def.key === 'qa.student.evaluation') {
      await ensureRegistration(user, schedule.id, 'done', true);
      await ensureAdmission(user, academicYear.id, semester.id, 'Under Evaluation', true);
    }
    if (def.key === 'qa.student.accepted') {
      await ensureRegistration(user, schedule.id, 'done', true);
      await ensureAdmission(user, academicYear.id, semester.id, 'Accepted', true, 'Continuing');
    }
    if (def.key === 'qa.student.rejected') {
      await ensureRegistration(user, schedule.id, 'done', false);
      await ensureAdmission(user, academicYear.id, semester.id, 'Rejected', true);
    }
    if (def.key === 'qa.student.nodocs') {
      await ensureRegistration(user, schedule.id, 'done', true);
      await ensureAdmission(user, academicYear.id, semester.id, 'Submitted', false);
    }

    created.push({
      key: def.key,
      email: def.email,
      password: TEST_PASSWORD,
      role: def.role,
      scenario: def.scenario,
      status: def.status ?? 'Active',
      emailVerified: def.emailVerified ?? true,
    });
  }

  console.log('\nQA accounts ready:');
  for (const row of created) {
    console.log(`- ${row.key} | ${row.email} | ${row.password} | role=${row.role} | status=${row.status} | verified=${row.emailVerified} | ${row.scenario}`);
  }
}

main()
  .catch((err) => {
    console.error('Failed to create QA accounts:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
