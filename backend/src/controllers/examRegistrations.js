import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { generateTrackingId } from '../utils/tracking.js';
import { sendExamBookingEmail } from '../utils/email.js';
import { ROLES } from '../utils/constants.js';
import { sendEvent } from '../utils/sse.js';

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
    const email = req.user.role === ROLES.APPLICANT ? req.user.email : userEmail;
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
      }).then(n => sendEvent(req.user.id, 'notification', n)).catch(() => {});
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

// PATCH /api/exams/registrations/:id/save-draft
export async function saveDraftAnswers(req, res, next) {
  try {
    const id = Number(req.params.id);
    const reg = await prisma.examRegistration.findUnique({ where: { id } });
    if (!reg) return res.status(404).json({ error: 'Registration not found', code: 'NOT_FOUND' });

    if (reg.userEmail !== req.user.email) {
      return res.status(403).json({ error: 'You can only save answers for your own exam', code: 'FORBIDDEN' });
    }

    if (reg.status !== 'started') {
      return res.status(400).json({ error: 'Exam is not in progress', code: 'VALIDATION_ERROR' });
    }

    const { answers } = req.body;
    await prisma.examRegistration.update({
      where: { id },
      data: { draftAnswers: JSON.stringify(answers) },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
}
