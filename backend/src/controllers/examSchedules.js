import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { GRADE_TO_EXAM_LEVEL, GRADE_TO_LEGACY_EXAM_LEVEL, ROLES } from '../utils/constants.js';
import { getIo } from '../utils/socket.js';
import { logAudit } from '../utils/auditLog.js';

function getTodayLocalIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function isWithinPeriod(todayIso, startDate, endDate) {
  if (startDate && todayIso < startDate) return false;
  if (endDate && todayIso > endDate) return false;
  return true;
}

function validateScheduleFields({ scheduledDate, startTime, endTime }, { checkPastDate = false } = {}) {
  if (startTime && endTime && startTime >= endTime) {
    return 'endTime must be after startTime';
  }
  if (checkPastDate && scheduledDate) {
    const today = getTodayLocalIso();
    if (scheduledDate < today) {
      return 'scheduledDate cannot be in the past';
    }
  }
  return null;
}

function validateRegistrationPeriod({ scheduledDate, registrationOpenDate, registrationCloseDate }) {
  if (registrationOpenDate && registrationCloseDate && registrationOpenDate > registrationCloseDate) {
    return 'registrationCloseDate must be on or after registrationOpenDate';
  }
  if (registrationCloseDate && scheduledDate && registrationCloseDate > scheduledDate) {
    return 'registrationCloseDate cannot be after scheduledDate';
  }
  return null;
}

function addDaysIso(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeVisibilityWindow({ scheduledDate, visibilityStartDate, visibilityEndDate }) {
  const start = visibilityStartDate || null;
  let end = visibilityEndDate || null;

  // If visibility start is set but end is omitted, default to a 10-day window.
  if (start && !end) {
    end = addDaysIso(start, 9);
  }

  if (start && end && start > end) {
    return { error: 'visibilityEndDate must be on or after visibilityStartDate' };
  }
  if (end && scheduledDate && end > scheduledDate) {
    return { error: 'visibilityEndDate cannot be after scheduledDate' };
  }

  return { start, end, error: null };
}

function normalizeGradeLabel(value = '') {
  return String(value).toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
}

function resolveGradeKey(gradeLevel = '') {
  const keys = Object.keys(GRADE_TO_EXAM_LEVEL);
  const normalizedInput = normalizeGradeLabel(gradeLevel);
  return keys.find(k => normalizeGradeLabel(k) === normalizedInput) || null;
}

function inferLegacyGradeBucket(gradeLevel = '') {
  const g = normalizeGradeLabel(gradeLevel);
  if (g.includes('nursery') || g.includes('kinder')) return 'Preschool';
  if (/grade\s*[1-6](\b|\D)/.test(g)) return 'Grade 1-6';
  if (/grade\s*(7|8|9|10)(\b|\D)/.test(g)) return 'Grade 7-10';
  if (/grade\s*(11|12)(\b|\D)/.test(g)) return 'Grade 11-12';
  return null;
}

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
    const today = getTodayLocalIso();
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!activeYear) {
      return res.json([]);
    }

    const activeSemester = await prisma.semester.findFirst({
      where: { academicYearId: activeYear.id, isActive: true },
      orderBy: { id: 'asc' },
    });
    if (!activeSemester) {
      return res.json([]);
    }

    const semStart = toIsoDay(activeSemester.startDate);
    const semEnd = toIsoDay(activeSemester.endDate);
    if (!isWithinPeriod(today, semStart, semEnd)) {
      return res.json([]);
    }

    // If the requester is an applicant, filter schedules to their grade level
    let gradeFilter = {};
    if (req.user?.role === ROLES.APPLICANT) {
      const profile = await prisma.applicantProfile.findUnique({ where: { userId: req.user.id } });
      // If grade profile is missing (manual account creation), do not block exam visibility.
      if (profile?.gradeLevel) {
        const resolvedKey = resolveGradeKey(profile.gradeLevel);
        const examLevel = resolvedKey ? GRADE_TO_EXAM_LEVEL[resolvedKey] : null;
        const legacyLevel = resolvedKey ? GRADE_TO_LEGACY_EXAM_LEVEL[resolvedKey] : null;
        const inferredLegacy = inferLegacyGradeBucket(profile.gradeLevel);
        const allowedLevels = [...new Set([examLevel, legacyLevel, inferredLegacy, profile.gradeLevel, 'All Levels'].filter(Boolean))];
        if (allowedLevels.length > 0) {
          gradeFilter = { gradeLevel: { in: allowedLevels } };
        }
      }
    }

    const schedules = await prisma.examSchedule.findMany({
      where: {
        scheduledDate: { gte: today },
        exam: { isActive: true, academicYearId: activeYear.id, ...gradeFilter },
      },
      include: { exam: { select: { title: true, gradeLevel: true } } },
      orderBy: { scheduledDate: 'asc' },
    });

    // Filter: remaining slots > 0, visibility window open, and registration window is open (if configured)
    const available = schedules.filter(s => {
      if (s.slotsTaken >= s.maxSlots) return false;
      // Check visibility dates: exam must be within visibility window
      if (s.visibilityStartDate && today < s.visibilityStartDate) return false;
      if (s.visibilityEndDate && today > s.visibilityEndDate) return false;
      // Check registration window: if configured, today must be within registration dates
      if (s.registrationOpenDate && today < s.registrationOpenDate) return false;
      if (s.registrationCloseDate && today > s.registrationCloseDate) return false;
      return true;
    });
    res.json(available);
  } catch (err) { next(err); }
}

// POST /api/exams/schedules
export async function createSchedule(req, res, next) {
  try {
    const { examId, scheduledDate, startTime, endTime, visibilityStartDate, visibilityEndDate, registrationOpenDate, registrationCloseDate, maxSlots, venue } = req.body;
    if (!examId || !scheduledDate || !startTime || !endTime || !maxSlots) {
      return res.status(400).json({ error: 'examId, scheduledDate, startTime, endTime, maxSlots required', code: 'VALIDATION_ERROR' });
    }

    const validationError = validateScheduleFields({ scheduledDate, startTime, endTime }, { checkPastDate: true });
    if (validationError) {
      return res.status(400).json({ error: validationError, code: 'VALIDATION_ERROR' });
    }

    const periodError = validateRegistrationPeriod({ scheduledDate, registrationOpenDate, registrationCloseDate });
    if (periodError) {
      return res.status(400).json({ error: periodError, code: 'VALIDATION_ERROR' });
    }

    const visibility = normalizeVisibilityWindow({ scheduledDate, visibilityStartDate, visibilityEndDate });
    if (visibility.error) {
      return res.status(400).json({ error: visibility.error, code: 'VALIDATION_ERROR' });
    }

    const schedule = await prisma.examSchedule.create({
      data: {
        examId,
        scheduledDate,
        startTime,
        endTime,
        visibilityStartDate: visibility.start,
        visibilityEndDate: visibility.end,
        registrationOpenDate: registrationOpenDate || null,
        registrationCloseDate: registrationCloseDate || null,
        maxSlots,
        venue: venue || null,
        slotsTaken: 0,
      },
    });

    res.status(201).json(schedule);
  } catch (err) { next(err); }
}

// PUT /api/exams/schedules/:id
export async function updateSchedule(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { scheduledDate, startTime, endTime, visibilityStartDate, visibilityEndDate, registrationOpenDate, registrationCloseDate, maxSlots, venue } = req.body;
    const existing = await prisma.examSchedule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Schedule not found', code: 'NOT_FOUND' });
    }

    const nextScheduledDate = scheduledDate !== undefined ? scheduledDate : existing.scheduledDate;
    const nextStartTime = startTime !== undefined ? startTime : existing.startTime;
    const nextEndTime = endTime !== undefined ? endTime : existing.endTime;
    const nextVisibilityStartDate = visibilityStartDate !== undefined ? visibilityStartDate : existing.visibilityStartDate;
    const nextVisibilityEndDate = visibilityEndDate !== undefined ? visibilityEndDate : existing.visibilityEndDate;
    const nextRegistrationOpenDate = registrationOpenDate !== undefined ? registrationOpenDate : existing.registrationOpenDate;
    const nextRegistrationCloseDate = registrationCloseDate !== undefined ? registrationCloseDate : existing.registrationCloseDate;

    const validationError = validateScheduleFields(
      { scheduledDate: nextScheduledDate, startTime: nextStartTime, endTime: nextEndTime },
      { checkPastDate: scheduledDate !== undefined }
    );
    if (validationError) {
      return res.status(400).json({ error: validationError, code: 'VALIDATION_ERROR' });
    }

    const periodError = validateRegistrationPeriod({
      scheduledDate: nextScheduledDate,
      registrationOpenDate: nextRegistrationOpenDate,
      registrationCloseDate: nextRegistrationCloseDate,
    });
    if (periodError) {
      return res.status(400).json({ error: periodError, code: 'VALIDATION_ERROR' });
    }

    const visibility = normalizeVisibilityWindow({
      scheduledDate: nextScheduledDate,
      visibilityStartDate: nextVisibilityStartDate,
      visibilityEndDate: nextVisibilityEndDate,
    });
    if (visibility.error) {
      return res.status(400).json({ error: visibility.error, code: 'VALIDATION_ERROR' });
    }

    const data = {};
    if (scheduledDate !== undefined) data.scheduledDate = scheduledDate;
    if (startTime !== undefined)     data.startTime = startTime;
    if (endTime !== undefined)       data.endTime = endTime;
    if (visibilityStartDate !== undefined || visibilityEndDate !== undefined) {
      data.visibilityStartDate = visibility.start;
      data.visibilityEndDate = visibility.end;
    }
    if (registrationOpenDate !== undefined) data.registrationOpenDate = registrationOpenDate || null;
    if (registrationCloseDate !== undefined) data.registrationCloseDate = registrationCloseDate || null;
    if (maxSlots !== undefined)      data.maxSlots = maxSlots;
    if (venue !== undefined)         data.venue = venue;

    const schedule = await prisma.examSchedule.update({
      where: { id },
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

// POST /api/exams/schedules/notice
export async function notifyNoSchedule(req, res, next) {
  try {
    if (req.user?.role !== ROLES.APPLICANT) {
      return res.status(403).json({ error: 'Only applicants can send schedule notices', code: 'FORBIDDEN' });
    }

    const profile = await prisma.applicantProfile.findUnique({ where: { userId: req.user.id } });
    const gradeLevel = profile?.gradeLevel;
    if (!gradeLevel) {
      return res.status(400).json({ error: 'Applicant grade level is required before sending a notice', code: 'VALIDATION_ERROR' });
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 500) : '';
    const payload = {
      userId: req.user.id,
      studentName: `${req.user.firstName || ''} ${req.user.middleName || ''} ${req.user.lastName || ''}`.replace(/\s+/g, ' ').trim() || req.user.email,
      email: req.user.email,
      gradeLevel,
      message,
      createdAt: new Date().toISOString(),
    };

    try {
      getIo().to('role_teacher').to('role_registrar').to('role_administrator').emit('exam_schedule_notice', payload);
    } catch (_) {
      // Non-fatal: request should still succeed even if socket emit fails.
    }

    logAudit({
      userId: req.user.id,
      action: 'exam.schedule_notice',
      entity: 'exam_schedule',
      details: { gradeLevel, message: message || null },
      ipAddress: req.ip,
    });

    res.json({ ok: true, message: 'Your notice has been sent to the staff.' });
  } catch (err) { next(err); }
}
