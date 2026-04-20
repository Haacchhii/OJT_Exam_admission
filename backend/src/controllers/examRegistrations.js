import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { generateTrackingId } from '../utils/tracking.js';
import { sendExamBookingEmail } from '../utils/email.js';
import { ROLES } from '../utils/constants.js';
import { cached, invalidatePrefix } from '../utils/cache.js';
import { attachExamWindowStatus, evaluateExamStartAvailability, isNowWithinExamWindow, computeExamWindowStatus } from '../utils/examWindow.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function buildRegistrationScope(academicYearId) {
  if (!academicYearId) return {};
  return { schedule: { exam: { academicYearId: Number(academicYearId) } } };
}

async function findOwnedRegistrations(user, academicYearId, include) {
  const registrationScope = buildRegistrationScope(academicYearId);
  const email = normalizeEmail(user?.email);

  const byUserIdPromise = prisma.examRegistration.findMany({
    where: {
      userId: user.id,
      ...registrationScope,
    },
    include,
    orderBy: { createdAt: 'desc' },
  });

  const byEmailExactPromise = email
    ? prisma.examRegistration.findMany({
      where: {
        userId: null,
        userEmail: email,
        ...registrationScope,
      },
      include,
      orderBy: { createdAt: 'desc' },
    })
    : Promise.resolve([]);

  const [byUserId, byEmailExact] = await Promise.all([byUserIdPromise, byEmailExactPromise]);

  let byEmail = byEmailExact;
  if (email && byEmailExact.length === 0) {
    byEmail = await prisma.examRegistration.findMany({
      where: {
        userId: null,
        userEmail: { equals: email, mode: 'insensitive' },
        ...registrationScope,
      },
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  const merged = [...byUserId, ...byEmail];
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
}

function registrationBelongsToUser(registration, user) {
  if (!registration || !user) return false;
  if (registration.userId != null && registration.userId === user.id) return true;
  return normalizeEmail(registration.userEmail) === normalizeEmail(user.email);
}

function invalidateMyRegistrationCaches(userId) {
  if (!userId) return;
  invalidatePrefix(`regs:mine-summary:${userId}:`);
  invalidatePrefix(`regs:mine:${userId}:`);
}

function invalidateEmployeeRegistrationCaches() {
  invalidatePrefix('regs:list:');
  invalidatePrefix('readiness:list:');
  invalidatePrefix('resultsEmployeeSummary:');
}

function getTodayLocalIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWithinPeriod(todayIso, startDate, endDate) {
  if (startDate && todayIso < startDate) return false;
  if (endDate && todayIso > endDate) return false;
  return true;
}

function toIsoDay(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getActiveAcademicPeriod() {
  const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
  if (!activeYear) return null;

  const activeSemester = await prisma.semester.findFirst({
    where: { academicYearId: activeYear.id, isActive: true },
    orderBy: { id: 'asc' },
  });

  return { activeYear, activeSemester };
}

function withWindowStatus(registration) {
  if (!registration?.schedule) return registration;
  return {
    ...registration,
    schedule: attachExamWindowStatus(registration.schedule),
  };
}

const myRegistrationInclude = {
  schedule: {
    select: {
      id: true,
      examId: true,
      scheduledDate: true,
      startTime: true,
      endTime: true,
      visibilityStartDate: true,
      visibilityEndDate: true,
      registrationOpenDate: true,
      registrationCloseDate: true,
      examWindowStartAt: true,
      examWindowEndAt: true,
      maxSlots: true,
      slotsTaken: true,
      venue: true,
      exam: {
        select: {
          id: true,
          title: true,
          gradeLevel: true,
          durationMinutes: true,
          passingScore: true,
          academicYearId: true,
        },
      },
    },
  },
};

// GET /api/exams/registrations/list?search=&status=&page=&limit=
export async function getRegistrations(req, res, next) {
  try {
    const { search, status, examId, page, limit } = req.query;
    const pg = paginate(page ?? 1, limit ?? 200);

    const where = {};
    if (status) where.status = status;
    if (examId) {
      where.schedule = { examId: Number(examId) };
    }
    if (search) {
      where.userEmail = { contains: search, mode: 'insensitive' };
    }

    const cacheKey = `regs:list:${JSON.stringify({
      search: search || null,
      status: status || null,
      examId: examId ? Number(examId) : null,
      page: pg?.page || 1,
      limit: pg?.limit || null,
    })}`;

    const { registrations, total } = await cached(cacheKey, async () => {
      const [rows, count] = await Promise.all([
        prisma.examRegistration.findMany({
          where,
          ...(pg && { skip: pg.skip, take: pg.take }),
          orderBy: { createdAt: 'desc' },
          include: { schedule: { include: { exam: { select: { title: true } } } } },
        }),
        prisma.examRegistration.count({ where }),
      ]);
      return { registrations: rows, total: count };
    }, 45_000);

    res.json(paginatedResponse(registrations, total, pg));
  } catch (err) { next(err); }
}

// GET /api/exams/registrations/mine?academicYearId=
export async function getMyRegistrations(req, res, next) {
  try {
    const { academicYearId } = req.query;

    const cacheKey = `regs:mine:${req.user.id}:${academicYearId || 'all'}`;
    const registrations = await cached(cacheKey, async () => {
      return findOwnedRegistrations(req.user, academicYearId, myRegistrationInclude);
    }, 120_000);

    res.json(registrations.map(withWindowStatus));
  } catch (err) { next(err); }
}

// GET /api/exams/registrations/mine/:id
export async function getMyRegistrationById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid registration id', code: 'VALIDATION_ERROR' });
    }

    const cacheKey = `regs:mine:${req.user.id}:id:${id}`;
    const registration = await cached(cacheKey, async () => {
      return prisma.examRegistration.findUnique({
        where: { id },
        include: myRegistrationInclude,
      });
    }, 60_000);

    if (!registration || !registrationBelongsToUser(registration, req.user)) {
      return res.status(404).json({ error: 'Registration not found', code: 'NOT_FOUND' });
    }

    res.json(withWindowStatus(registration));
  } catch (err) { next(err); }
}

// GET /api/exams/registrations/mine-summary?academicYearId=
export async function getMyRegistrationSummary(req, res, next) {
  try {
    const { academicYearId } = req.query;

    const cacheKey = `regs:mine-summary:${req.user.id}:${academicYearId || 'all'}`;
    const summary = await cached(cacheKey, async () => {
      const registrations = await findOwnedRegistrations(req.user, academicYearId, myRegistrationInclude);
      const latest = registrations[0] || null;
      const completedCount = registrations.reduce((acc, registration) => {
        return acc + (registration.status === 'done' ? 1 : 0);
      }, 0);

      return {
        latest: latest ? withWindowStatus(latest) : null,
        hasCompletedExam: completedCount > 0,
        totalRegistrations: registrations.length,
      };
    }, 120_000);

    res.json(summary);
  } catch (err) { next(err); }
}

// POST /api/exams/registrations
export async function createRegistration(req, res, next) {
  try {
    const { userEmail, scheduleId } = req.body;
    if (!scheduleId) {
      return res.status(400).json({ error: 'Please select an exam schedule.', code: 'VALIDATION_ERROR' });
    }

    // For applicants, always use their authenticated email to prevent impersonation.
    const requestedEmail = req.user.role === ROLES.APPLICANT ? req.user.email : userEmail;
    const email = normalizeEmail(requestedEmail);
    if (!email) {
      return res.status(400).json({ error: 'Please provide the student email address.', code: 'VALIDATION_ERROR' });
    }

    let targetUser = null;
    if (req.user.role === ROLES.APPLICANT) {
      targetUser = {
        id: req.user.id,
        email,
        role: req.user.role,
        status: req.user.status || 'Active',
        firstName: req.user.firstName || null,
      };
    } else {
      targetUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, email: true, role: true, status: true, firstName: true },
      });
      if (!targetUser) {
        return res.status(404).json({ error: 'The selected student account was not found.', code: 'NOT_FOUND' });
      }
      if (targetUser.role !== ROLES.APPLICANT) {
        return res.status(400).json({ error: 'Exam registrations can only be created for applicant accounts.', code: 'VALIDATION_ERROR' });
      }
      if (targetUser.status === 'Inactive') {
        return res.status(400).json({ error: 'Cannot create registration for an inactive applicant account.', code: 'VALIDATION_ERROR' });
      }
    }

    const targetUserId = targetUser.id;

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
    if (!schedule) return res.status(404).json({ error: 'We could not find the selected exam schedule.', code: 'NOT_FOUND' });
    if (schedule.exam?.academicYear && !schedule.exam.academicYear.isActive) {
      return res.status(400).json({ error: 'Registration is only available for exams in the active academic year.', code: 'VALIDATION_ERROR' });
    }

    const today = getTodayLocalIso();
    const activePeriod = await getActiveAcademicPeriod();
    if (!activePeriod?.activeSemester) {
      return res.status(400).json({ error: 'Exam booking is currently closed because no active exam period is configured.', code: 'VALIDATION_ERROR' });
    }

    const semStartIso = toIsoDay(activePeriod.activeSemester.startDate);
    const semEndIso = toIsoDay(activePeriod.activeSemester.endDate);

    if (!isWithinPeriod(today, semStartIso, semEndIso)) {
      return res.status(400).json({ error: 'Exam booking is currently outside the active exam period.', code: 'VALIDATION_ERROR' });
    }

    if (schedule.exam?.academicYear?.id && schedule.exam.academicYear.id !== activePeriod.activeYear.id) {
      return res.status(400).json({ error: 'Registration is only available for exams in the active academic year.', code: 'VALIDATION_ERROR' });
    }

    if (schedule.visibilityStartDate && today < schedule.visibilityStartDate) {
      return res.status(400).json({ error: 'This exam schedule is not visible yet.', code: 'VALIDATION_ERROR' });
    }
    if (schedule.visibilityEndDate && today > schedule.visibilityEndDate) {
      return res.status(400).json({ error: 'This exam schedule is no longer visible.', code: 'VALIDATION_ERROR' });
    }
    if (!isNowWithinExamWindow(schedule, new Date())) {
      const windowStatus = computeExamWindowStatus(schedule, new Date());
      if (windowStatus.status === 'upcoming') {
        return res.status(400).json({ error: windowStatus.label, code: 'VALIDATION_ERROR' });
      }
      return res.status(400).json({ error: 'Registration for this schedule is currently closed.', code: 'VALIDATION_ERROR' });
    }

    const existing = await prisma.examRegistration.findFirst({
      where: {
        OR: [
          { userId: targetUserId },
          { userEmail: { equals: email, mode: 'insensitive' } },
        ],
        status: { not: 'done' },
        schedule: { examId: schedule.examId },
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'You already have an active registration for this exam.', code: 'CONFLICT' });
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
        throw Object.assign(new Error('This schedule is already full. Please choose another schedule.'), { statusCode: 400, code: 'VALIDATION_ERROR' });
      }
      const reg = await tx.examRegistration.create({
        data: { trackingId, userEmail: email, userId: targetUserId, scheduleId, status: 'scheduled' },
      });
      await tx.examSchedule.update({
        where: { id: scheduleId },
        data: { slotsTaken: { increment: 1 } },
      });
      return reg;
    });

    res.status(201).json(registration);
    invalidateMyRegistrationCaches(targetUserId);
    invalidateEmployeeRegistrationCaches();
    invalidatePrefix('schedules:available:');

    // Fire-and-forget booking confirmation email
    prisma.examSchedule.findUnique({
      where: { id: scheduleId },
      include: { exam: { select: { title: true } } },
    }).then((sched) => {
      if (!sched) return;
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
        to: targetUser.email,
        firstName: targetUser.firstName,
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
    const reg = await prisma.examRegistration.findUnique({
      where: { id },
      include: {
        schedule: {
          include: {
            exam: { select: { academicYearId: true } },
          },
        },
      },
    });
    if (!reg) return res.status(404).json({ error: 'We could not find this exam registration.', code: 'NOT_FOUND' });

    // Ownership check: only the registered student can start their own exam
    if (!registrationBelongsToUser(reg, req.user)) {
      return res.status(403).json({ error: 'You can only start exams assigned to your account.', code: 'FORBIDDEN' });
    }

    if (reg.status !== 'scheduled') {
      return res.status(400).json({ error: 'This exam has already been started or completed.', code: 'VALIDATION_ERROR' });
    }

    const activePeriod = await getActiveAcademicPeriod();
    if (!activePeriod?.activeSemester) {
      return res.status(400).json({ error: 'Exams are currently unavailable because no active exam period is configured.', code: 'VALIDATION_ERROR' });
    }

    const today = getTodayLocalIso();
    const semStartIso = toIsoDay(activePeriod.activeSemester.startDate);
    const semEndIso = toIsoDay(activePeriod.activeSemester.endDate);
    if (!isWithinPeriod(today, semStartIso, semEndIso)) {
      return res.status(400).json({ error: 'Exams are currently outside the active exam period.', code: 'VALIDATION_ERROR' });
    }

    if (reg.schedule?.exam?.academicYearId && reg.schedule.exam.academicYearId !== activePeriod.activeYear.id) {
      return res.status(400).json({ error: 'This exam can only be started during the active academic year.', code: 'VALIDATION_ERROR' });
    }

    const startAvailability = evaluateExamStartAvailability(reg.schedule, new Date());
    if (!startAvailability.allowed) {
      return res.status(400).json({ error: startAvailability.message, code: startAvailability.code || 'VALIDATION_ERROR' });
    }

    const questionCount = await prisma.examQuestion.count({ where: { examId: reg.schedule.examId } });
    if (questionCount === 0) {
      return res.status(400).json({
        error: 'This exam is not ready yet because no questions were published. Please contact staff.',
        code: 'VALIDATION_ERROR',
      });
    }

    const updated = await prisma.examRegistration.update({
      where: { id },
      data: { status: 'started', startedAt: new Date() },
    });

    invalidateMyRegistrationCaches(req.user.id);
    invalidateEmployeeRegistrationCaches();
    res.json(updated);
  } catch (err) { next(err); }
}

// PATCH /api/exams/registrations/:id/save-draft
export async function saveDraftAnswers(req, res, next) {
  try {
    const id = Number(req.params.id);
    const reg = await prisma.examRegistration.findUnique({ where: { id } });
    if (!reg) return res.status(404).json({ error: 'We could not find this exam registration.', code: 'NOT_FOUND' });

    if (!registrationBelongsToUser(reg, req.user)) {
      return res.status(403).json({ error: 'You can only save answers for exams assigned to your account.', code: 'FORBIDDEN' });
    }

    if (reg.status !== 'started') {
      return res.status(400).json({ error: 'You can save answers only while the exam is in progress.', code: 'VALIDATION_ERROR' });
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
    if (!reg) return res.status(404).json({ error: 'We could not find this exam registration.', code: 'NOT_FOUND' });

    if (!registrationBelongsToUser(reg, req.user)) {
      return res.status(403).json({ error: 'You can only cancel registrations assigned to your account.', code: 'FORBIDDEN' });
    }

    if (reg.status !== 'scheduled') {
      return res.status(400).json({ error: 'Only registrations with a scheduled status can be cancelled.', code: 'VALIDATION_ERROR' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.examRegistration.delete({ where: { id } });
      await tx.examSchedule.update({
        where: { id: reg.scheduleId },
        data: { slotsTaken: { decrement: 1 } },
      });
    });

    invalidateMyRegistrationCaches(req.user.id);
    invalidateEmployeeRegistrationCaches();
    invalidatePrefix('schedules:available:');
    res.status(204).end();
  } catch (err) { next(err); }
}
