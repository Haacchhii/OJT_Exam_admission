import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { GRADE_TO_EXAM_LEVEL } from '../utils/constants.js';

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

    // If the requester is an applicant, filter schedules to their grade level
    let gradeFilter = {};
    if (req.user) {
      const profile = await prisma.applicantProfile.findUnique({ where: { userId: req.user.id } });
      if (profile?.gradeLevel) {
        const examLevel = GRADE_TO_EXAM_LEVEL[profile.gradeLevel];
        if (examLevel) {
          gradeFilter = { gradeLevel: { in: [examLevel, 'All Levels'] } };
        }
      }
    }

    const schedules = await prisma.examSchedule.findMany({
      where: {
        scheduledDate: { gte: today },
        exam: { isActive: true, ...gradeFilter },
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
