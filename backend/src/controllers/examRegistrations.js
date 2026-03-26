import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { generateTrackingId } from '../utils/tracking.js';
import { sendExamBookingEmail } from '../utils/email.js';
import { ROLES } from '../utils/constants.js';

function getTodayLocalIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWithinRegistrationWindow(schedule, todayIso) {
  const opens = !schedule.registrationOpenDate || todayIso >= schedule.registrationOpenDate;
  const closes = !schedule.registrationCloseDate || todayIso <= schedule.registrationCloseDate;
  return opens && closes;
}

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

// GET /api/exams/registrations/mine?academicYearId=
export async function getMyRegistrations(req, res, next) {
  try {
    const where = { userEmail: req.user.email };
    const { academicYearId } = req.query;
    if (academicYearId) {
      where.schedule = { exam: { academicYearId: Number(academicYearId) } };
    }
    const registrations = await prisma.examRegistration.findMany({
      where,
      include: { schedule: { include: { exam: { select: { title: true, gradeLevel: true, durationMinutes: true, academicYearId: true } } } } },
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
    const schedule = await prisma.examSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        exam: {
          select: {
            id: true,
            academicYear: { select: { id: true, isActive: true } },
          },
        },
      },
    });
    if (!schedule) return res.status(404).json({ error: 'Schedule not found', code: 'NOT_FOUND' });
    if (schedule.exam?.academicYear && !schedule.exam.academicYear.isActive) {
      return res.status(400).json({ error: 'Registration is only allowed for exams in the active academic year', code: 'VALIDATION_ERROR' });
    }

    const today = getTodayLocalIso();
    if (schedule.scheduledDate < today) {
      return res.status(400).json({ error: 'This schedule is no longer available', code: 'VALIDATION_ERROR' });
    }
    if (schedule.visibilityStartDate && today < schedule.visibilityStartDate) {
      return res.status(400).json({ error: 'This schedule is not yet visible', code: 'VALIDATION_ERROR' });
    }
    if (schedule.visibilityEndDate && today > schedule.visibilityEndDate) {
      return res.status(400).json({ error: 'This schedule is no longer visible', code: 'VALIDATION_ERROR' });
    }
    if (!isWithinRegistrationWindow(schedule, today)) {
      return res.status(400).json({ error: 'Registration for this schedule is currently closed', code: 'VALIDATION_ERROR' });
    }

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
      const rows = await tx.$queryRaw`SELECT * FROM exam_schedules WHERE id = ${scheduleId} FOR UPDATE`;
      const [freshSchedule] = rows;
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

    // Fire-and-forget booking confirmation email
    prisma.user.findUnique({ where: { id: req.user.id }, select: { firstName: true, email: true } })
      .then(async (student) => {
        const sched = await prisma.examSchedule.findUnique({
          where: { id: scheduleId },
          include: { exam: { select: { title: true } } },
        });
        if (!student || !sched) return;
        let dateStr = 'TBD';
        if (sched.scheduledDate) {
          const [year, month, day] = String(sched.scheduledDate).split('-').map(Number);
          if (year && month && day) {
            const scheduleDate = new Date(Date.UTC(year, month - 1, day));
            dateStr = scheduleDate.toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC',
            });
          }
        }
        const timeStr = sched.startTime && sched.endTime ? `${sched.startTime} - ${sched.endTime}` : 'See portal for details';
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

// DELETE /api/exams/registrations/:id
export async function cancelRegistration(req, res, next) {
  try {
    const id = Number(req.params.id);
    const reg = await prisma.examRegistration.findUnique({ where: { id } });
    if (!reg) return res.status(404).json({ error: 'Registration not found', code: 'NOT_FOUND' });

    if (reg.userEmail !== req.user.email) {
      return res.status(403).json({ error: 'You can only cancel your own registration', code: 'FORBIDDEN' });
    }

    if (reg.status !== 'scheduled') {
      return res.status(400).json({ error: 'Only scheduled exams can be cancelled', code: 'VALIDATION_ERROR' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.examRegistration.delete({ where: { id } });
      await tx.examSchedule.update({
        where: { id: reg.scheduleId },
        data: { slotsTaken: { decrement: 1 } },
      });
    });

    res.status(204).end();
  } catch (err) { next(err); }
}
