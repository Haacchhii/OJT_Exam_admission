import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { generateTrackingId } from '../utils/tracking.js';
import { EMPLOYEE_ROLES } from '../utils/constants.js';
import { logAudit } from '../utils/auditLog.js';
import { sendExamBookingEmail } from '../utils/email.js';

// ═══════════════════════════════════════════════════════
// EXAMS CRUD
// ═══════════════════════════════════════════════════════

// Helper: include questions + choices + creator (for detail views)
const examDetailInclude = {
  createdBy: { select: { firstName: true, lastName: true } },
  academicYear: { select: { id: true, year: true } },
  semester: { select: { id: true, name: true } },
  questions: {
    orderBy: { orderNum: 'asc' },
    include: { choices: { orderBy: { orderNum: 'asc' } } },
  },
};

// Lightweight include for list views (no nested questions/choices)
const examListInclude = {
  createdBy: { select: { firstName: true, lastName: true } },
  academicYear: { select: { id: true, year: true } },
  semester: { select: { id: true, name: true } },
  _count: { select: { questions: true, schedules: true } },
};

function shapeExam(exam) {
  if (!exam) return null;
  const { createdBy: creator, createdById, academicYear, semester, _count, ...rest } = exam;
  const shaped = {
    ...rest,
    createdBy: creator ? `${creator.firstName} ${creator.lastName}`.trim() : 'Unknown',
    academicYear: academicYear || null,
    semester: semester || null,
  };
  // List shape: replace nested questions with counts
  if (_count) {
    shaped.questionCount = _count.questions;
    shaped.scheduleCount = _count.schedules;
    shaped.questions = [];
  } else {
    shaped.questions = exam.questions?.map(q => ({
      ...q,
      choices: q.choices || [],
    })) || [];
  }
  return shaped;
}

// Strip isCorrect for student view
function stripAnswers(exam) {
  if (!exam) return null;
  return {
    ...exam,
    questions: exam.questions?.map(q => ({
      ...q,
      choices: q.choices?.map(({ isCorrect, ...c }) => c) || [],
    })) || [],
  };
}

// GET /api/exams?search=&grade=&status=&academicYearId=&semesterId=&page=&limit=
export async function getExams(req, res, next) {
  try {
    const { search, grade, status, academicYearId, semesterId, page, limit } = req.query;
    const pg = paginate(page, limit);

    const where = {};
    if (grade)          where.gradeLevel = grade;
    if (academicYearId) where.academicYearId = Number(academicYearId);
    if (semesterId)     where.semesterId = Number(semesterId);
    if (status === 'active')   where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { gradeLevel: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({ where, ...(pg && { skip: pg.skip, take: pg.take }), orderBy: { createdAt: 'desc' }, include: examListInclude }),
      prisma.exam.count({ where }),
    ]);

    // Strip correct answers for non-employee roles (prevents students from seeing answer keys)
    const isEmployee = EMPLOYEE_ROLES.includes(req.user.role);
    const shaped = exams.map(e => isEmployee ? shapeExam(e) : stripAnswers(shapeExam(e)));
    res.json(paginatedResponse(shaped, total, pg));
  } catch (err) { next(err); }
}

// GET /api/exams/:id  (full — with isCorrect)
export async function getExam(req, res, next) {
  try {
    const exam = await prisma.exam.findUnique({ where: { id: Number(req.params.id) }, include: examDetailInclude });
    if (!exam) return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });
    res.json(shapeExam(exam));
  } catch (err) { next(err); }
}

// GET /api/exams/:id/student  (safe — no isCorrect)
export async function getExamForStudent(req, res, next) {
  try {
    const exam = await prisma.exam.findUnique({ where: { id: Number(req.params.id) }, include: examDetailInclude });
    if (!exam) return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });
    res.json(stripAnswers(shapeExam(exam)));
  } catch (err) { next(err); }
}

// GET /api/exams/:id/review  (full exam with answers — only for students who completed it)
export async function getExamForReview(req, res, next) {
  try {
    const examId = Number(req.params.id);
    // Verify the student has a 'done' registration for this exam
    const reg = await prisma.examRegistration.findFirst({
      where: {
        userEmail: req.user.email,
        status: 'done',
        schedule: { examId },
      },
    });
    if (!reg) {
      return res.status(403).json({ error: 'You must complete this exam before viewing the review', code: 'FORBIDDEN' });
    }
    const exam = await prisma.exam.findUnique({ where: { id: examId }, include: examDetailInclude });
    if (!exam) return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });
    res.json(shapeExam(exam)); // full exam with correct answers
  } catch (err) { next(err); }
}

// POST /api/exams
export async function createExam(req, res, next) {
  try {
    const { title, gradeLevel, durationMinutes, passingScore, isActive, academicYearId, semesterId, questions } = req.body;
    if (!title || !gradeLevel || !durationMinutes || passingScore == null) {
      return res.status(400).json({ error: 'title, gradeLevel, durationMinutes, passingScore are required', code: 'VALIDATION_ERROR' });
    }

    const exam = await prisma.exam.create({
      data: {
        title,
        gradeLevel,
        durationMinutes,
        passingScore,
        isActive: isActive ?? true,
        ...(academicYearId && { academicYearId: Number(academicYearId) }),
        ...(semesterId && { semesterId: Number(semesterId) }),
        createdById: req.user.id,
        questions: questions?.length ? {
          create: questions.map((q, qi) => ({
            questionText: q.questionText,
            questionType: q.questionType,
            points: q.points,
            orderNum: q.orderNum ?? qi + 1,
            choices: q.choices?.length ? {
              create: q.choices.map((c, ci) => ({
                choiceText: c.choiceText,
                isCorrect: c.isCorrect || false,
                orderNum: c.orderNum ?? ci + 1,
              })),
            } : undefined,
          })),
        } : undefined,
      },
      include: examDetailInclude,
    });

    res.status(201).json(shapeExam(exam));

    logAudit({ userId: req.user.id, action: 'exam.create', entity: 'exam', entityId: exam.id, details: { title, gradeLevel }, ipAddress: req.ip });
  } catch (err) { next(err); }
}

// PUT /api/exams/:id
export async function updateExam(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { title, gradeLevel, durationMinutes, passingScore, isActive, questions } = req.body;

    // Update exam fields
    const data = {};
    if (title !== undefined)           data.title = title;
    if (gradeLevel !== undefined)      data.gradeLevel = gradeLevel;
    if (durationMinutes !== undefined) data.durationMinutes = durationMinutes;
    if (passingScore !== undefined)    data.passingScore = passingScore;
    if (isActive !== undefined)        data.isActive = isActive;

    // If questions are provided, replace all questions (delete + recreate) in a transaction
    if (questions) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.examQuestion.deleteMany({ where: { examId: id } });
        return tx.exam.update({
          where: { id },
          data: {
            ...data,
            questions: {
              create: questions.map((q, qi) => ({
                questionText: q.questionText,
                questionType: q.questionType,
                points: q.points,
                orderNum: q.orderNum ?? qi + 1,
                choices: q.choices?.length ? {
                  create: q.choices.map((c, ci) => ({
                    choiceText: c.choiceText,
                    isCorrect: c.isCorrect || false,
                    orderNum: c.orderNum ?? ci + 1,
                  })),
                } : undefined,
              })),
            },
          },
          include: examDetailInclude,
        });
      });
      return res.json(shapeExam(result));
    }

    const exam = await prisma.exam.update({
      where: { id },
      data,
      include: examDetailInclude,
    });

    res.json(shapeExam(exam));
  } catch (err) { next(err); }
}

// DELETE /api/exams/:id  — Prisma cascade: exam → questions → choices, exam → schedules → registrations → results/answers
export async function deleteExam(req, res, next) {
  try {
    const id = Number(req.params.id);
    await prisma.exam.delete({ where: { id } });

    logAudit({ userId: req.user.id, action: 'exam.delete', entity: 'exam', entityId: id, ipAddress: req.ip });

    res.status(204).end();
  } catch (err) { next(err); }
}

// POST /api/exams/bulk-delete
export async function bulkDeleteExams(req, res, next) {
  try {
    const { ids } = req.body;

    await prisma.exam.deleteMany({ where: { id: { in: ids } } });

    logAudit({ userId: req.user.id, action: 'exam.bulkDelete', entity: 'exam', details: { count: ids.length, ids }, ipAddress: req.ip });

    res.json({ deleted: ids.length });
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════
// SCHEDULES
// ═══════════════════════════════════════════════════════

// GET /api/exams/schedules?examId=&search=&page=&limit=
export async function getSchedules(req, res, next) {
  try {
    const { examId, search, page, limit } = req.query;
    const pg = paginate(page, limit);

    const where = {};
    if (examId) where.examId = Number(examId);
    if (search) {
      where.OR = [
        { venue: { contains: search, mode: 'insensitive' } },
        { exam: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [schedules, total] = await Promise.all([
      prisma.examSchedule.findMany({
        where, ...(pg && { skip: pg.skip, take: pg.take }), orderBy: { scheduledDate: 'desc' },
        include: { exam: { select: { title: true, gradeLevel: true } } },
      }),
      prisma.examSchedule.count({ where }),
    ]);

    res.json(paginatedResponse(schedules, total, pg));
  } catch (err) { next(err); }
}

// GET /api/exams/schedules/available
export async function getAvailableSchedules(req, res, next) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const schedules = await prisma.examSchedule.findMany({
      where: {
        scheduledDate: { gte: today },
        exam: { isActive: true },
      },
      include: { exam: { select: { title: true, gradeLevel: true } } },
      orderBy: { scheduledDate: 'asc' },
    });

    // Filter: remaining slots > 0
    const available = schedules.filter(s => s.slotsTaken < s.maxSlots);
    res.json(available);
  } catch (err) { next(err); }
}

// POST /api/exams/schedules
export async function createSchedule(req, res, next) {
  try {
    const { examId, scheduledDate, startTime, endTime, maxSlots, venue } = req.body;
    if (!examId || !scheduledDate || !startTime || !endTime || !maxSlots) {
      return res.status(400).json({ error: 'examId, scheduledDate, startTime, endTime, maxSlots required', code: 'VALIDATION_ERROR' });
    }

    const schedule = await prisma.examSchedule.create({
      data: { examId, scheduledDate, startTime, endTime, maxSlots, venue: venue || null, slotsTaken: 0 },
    });

    res.status(201).json(schedule);
  } catch (err) { next(err); }
}

// PUT /api/exams/schedules/:id
export async function updateSchedule(req, res, next) {
  try {
    const { scheduledDate, startTime, endTime, maxSlots, venue } = req.body;
    const data = {};
    if (scheduledDate !== undefined) data.scheduledDate = scheduledDate;
    if (startTime !== undefined)     data.startTime = startTime;
    if (endTime !== undefined)       data.endTime = endTime;
    if (maxSlots !== undefined)      data.maxSlots = maxSlots;
    if (venue !== undefined)         data.venue = venue;

    const schedule = await prisma.examSchedule.update({
      where: { id: Number(req.params.id) },
      data,
    });

    res.json(schedule);
  } catch (err) { next(err); }
}

// DELETE /api/exams/schedules/:id
export async function deleteSchedule(req, res, next) {
  try {
    const id = Number(req.params.id);
    // Cascade: delete registrations first (which cascade to results/answers)
    await prisma.examRegistration.deleteMany({ where: { scheduleId: id } });
    await prisma.examSchedule.delete({ where: { id } });
    res.status(204).end();
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════
// REGISTRATIONS
// ═══════════════════════════════════════════════════════

// GET /api/exams/registrations/list?search=&status=&page=&limit=
export async function getRegistrations(req, res, next) {
  try {
    const { search, status, page, limit } = req.query;
    const pg = paginate(page, limit);

    const where = {};
    if (status) where.status = status;
    if (search) {
      where.userEmail = { contains: search, mode: 'insensitive' };
    }

    const [registrations, total] = await Promise.all([
      prisma.examRegistration.findMany({
        where, ...(pg && { skip: pg.skip, take: pg.take }), orderBy: { createdAt: 'desc' },
        include: { schedule: { include: { exam: { select: { title: true } } } } },
      }),
      prisma.examRegistration.count({ where }),
    ]);

    res.json(paginatedResponse(registrations, total, pg));
  } catch (err) { next(err); }
}

// GET /api/exams/registrations/mine
export async function getMyRegistrations(req, res, next) {
  try {
    const registrations = await prisma.examRegistration.findMany({
      where: { userEmail: req.user.email },
      include: { schedule: { include: { exam: { select: { title: true, gradeLevel: true, durationMinutes: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(registrations);
  } catch (err) { next(err); }
}

// POST /api/exams/registrations
export async function createRegistration(req, res, next) {
  try {
    const { userEmail, scheduleId } = req.body;
    if (!scheduleId) {
      return res.status(400).json({ error: 'scheduleId is required', code: 'VALIDATION_ERROR' });
    }

    // For applicants, always use their authenticated email to prevent impersonation
    const email = req.user.role === 'applicant' ? req.user.email : userEmail;
    if (!email) {
      return res.status(400).json({ error: 'userEmail is required', code: 'VALIDATION_ERROR' });
    }

    // Check for existing active registration for this specific schedule's exam
    const schedule = await prisma.examSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) return res.status(404).json({ error: 'Schedule not found', code: 'NOT_FOUND' });

    const existing = await prisma.examRegistration.findFirst({
      where: {
        userEmail: email,
        status: { not: 'done' },
        schedule: { examId: schedule.examId },
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'Student already has an active registration for this exam', code: 'CONFLICT' });
    }

    // Atomic slot booking: check + increment inside an interactive transaction
    // to prevent overbooking from concurrent requests
    const trackingId = await generateTrackingId('EXM');
    const registration = await prisma.$transaction(async (tx) => {
      // Re-read schedule with row-level lock (SELECT ... FOR UPDATE) inside the transaction
      const [freshSchedule] = await tx.$queryRawUnsafe(
        `SELECT * FROM exam_schedules WHERE id = $1 FOR UPDATE`, scheduleId
      );
      // Map snake_case DB columns to camelCase
      if (freshSchedule) {
        freshSchedule.maxSlots = freshSchedule.max_slots ?? freshSchedule.maxSlots;
        freshSchedule.slotsTaken = freshSchedule.slots_taken ?? freshSchedule.slotsTaken;
      }
      if (!freshSchedule || freshSchedule.slotsTaken >= freshSchedule.maxSlots) {
        throw Object.assign(new Error('Schedule is full'), { statusCode: 400, code: 'VALIDATION_ERROR' });
      }
      const reg = await tx.examRegistration.create({
        data: { trackingId, userEmail: email, userId: req.user.id, scheduleId, status: 'scheduled' },
      });
      await tx.examSchedule.update({
        where: { id: scheduleId },
        data: { slotsTaken: { increment: 1 } },
      });
      return reg;
    });

    res.status(201).json(registration);

    // Fire-and-forget in-app notification for exam booking
    prisma.examSchedule.findUnique({
      where: { id: scheduleId },
      include: { exam: { select: { title: true } } },
    }).then(sched => {
      if (!sched) return;
      prisma.notification.create({
        data: {
          userId: req.user.id,
          type: 'exam',
          title: 'Exam Registration Confirmed',
          message: `You have been registered for "${sched.exam?.title || 'Entrance Exam'}" (Tracking ID: ${registration.trackingId}).`,
        },
      }).catch(() => {});
    }).catch(() => {});

    // Fire-and-forget booking confirmation email
    prisma.user.findUnique({ where: { id: req.user.id }, select: { firstName: true, email: true } })
      .then(async (student) => {
        const sched = await prisma.examSchedule.findUnique({
          where: { id: scheduleId },
          include: { exam: { select: { title: true } } },
        });
        if (!student || !sched) return;
        const dateStr = sched.scheduledDate
          ? new Date(sched.scheduledDate + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'TBD';
        const timeStr = sched.startTime && sched.endTime ? `${sched.startTime} – ${sched.endTime}` : 'See portal for details';
        sendExamBookingEmail({
          to: student.email,
          firstName: student.firstName,
          examTitle: sched.exam?.title || 'Entrance Exam',
          scheduleDate: dateStr,
          scheduleTime: timeStr,
          trackingId: registration.trackingId,
        });
      }).catch(() => {});
  } catch (err) { next(err); }
}

// PATCH /api/exams/registrations/:id/start
export async function startExam(req, res, next) {
  try {
    const id = Number(req.params.id);
    const reg = await prisma.examRegistration.findUnique({ where: { id } });
    if (!reg) return res.status(404).json({ error: 'Registration not found', code: 'NOT_FOUND' });

    // Ownership check: only the registered student can start their own exam
    if (reg.userEmail !== req.user.email) {
      return res.status(403).json({ error: 'You can only start your own exam', code: 'FORBIDDEN' });
    }

    if (reg.status !== 'scheduled') {
      return res.status(400).json({ error: 'Exam already started or completed', code: 'VALIDATION_ERROR' });
    }

    const updated = await prisma.examRegistration.update({
      where: { id },
      data: { status: 'started', startedAt: new Date() },
    });

    res.json(updated);
  } catch (err) { next(err); }
}
