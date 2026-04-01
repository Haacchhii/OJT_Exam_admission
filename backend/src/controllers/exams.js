import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { EMPLOYEE_ROLES, getLevelGroup } from '../utils/constants.js';
import { logAudit } from '../utils/auditLog.js';
import { getIo } from '../utils/socket.js';
import { cached } from '../utils/cache.js';


// Re-export schedule and registration controllers so routes/exams.js keeps working
export { getSchedules, getAvailableSchedules, createSchedule, updateSchedule, deleteSchedule, notifyNoSchedule } from './examSchedules.js';
export { getRegistrations, getMyRegistrations, createRegistration, startExam, saveDraftAnswers, cancelRegistration } from './examRegistrations.js';

// ═══════════════════════════════════════════════════════
// EXAMS CRUD
// ═══════════════════════════════════════════════════════

// Helper: include questions + choices + creator (for detail views)
const examDetailInclude = {
  createdBy: { select: { firstName: true, middleName: true, lastName: true } },
  academicYear: { select: { id: true, year: true, startDate: true, endDate: true } },
  semester: { select: { id: true, name: true, startDate: true, endDate: true } },
  questions: {
    orderBy: { orderNum: 'asc' },
    include: { choices: { orderBy: { orderNum: 'asc' } } },
  },
};

// Lightweight include for list views (no nested questions/choices)
const examListInclude = {
  createdBy: { select: { firstName: true, middleName: true, lastName: true } },
  academicYear: { select: { id: true, year: true, startDate: true, endDate: true } },
  semester: { select: { id: true, name: true, startDate: true, endDate: true } },
  _count: { select: { questions: true, schedules: true } },
};

function shapeExam(exam) {
  if (!exam) return null;
  const { createdBy: creator, createdById, academicYear, semester, _count, ...rest } = exam;
  const shaped = {
    ...rest,
    createdBy: creator ? [creator.firstName, creator.middleName, creator.lastName].filter(Boolean).join(' ').trim() : 'Unknown',
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
    const { search, grade, levelGroup, status, academicYearId, semesterId, page, limit } = req.query;
    const pg = paginate(page, limit);

    const where = { deletedAt: null };
    if (grade)  where.gradeLevel = grade;
    if (levelGroup) where.levelGroup = levelGroup;
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

    const cacheKey = `exams:list:${JSON.stringify({
      where,
      role: req.user.role,
      page: pg?.page || 1,
      limit: pg?.limit || null,
    })}`;
    const { exams, total } = await cached(cacheKey, async () => {
      const [rows, count] = await Promise.all([
        prisma.exam.findMany({ where, ...(pg && { skip: pg.skip, take: pg.take }), orderBy: { createdAt: 'desc' }, include: examListInclude }),
        prisma.exam.count({ where }),
      ]);
      return { exams: rows, total: count };
    }, 30_000);

    // Strip correct answers for non-employee roles (prevents students from seeing answer keys)
    const isEmployee = EMPLOYEE_ROLES.includes(req.user.role);
    const shaped = exams.map(e => isEmployee ? shapeExam(e) : stripAnswers(shapeExam(e)));
    res.json(paginatedResponse(shaped, total, pg));
  } catch (err) { next(err); }
}

// GET /api/exams/readiness?search=&status=&page=&limit=
export async function getReadiness(req, res, next) {
  try {
    const { search, status = 'all', page, limit } = req.query;
    const pg = paginate(page, limit);

    const where = {};

    if (search) {
      where.OR = [
        { userEmail: { contains: search, mode: 'insensitive' } },
        {
          user: {
            is: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { middleName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    if (status === 'pending') {
      where.status = { in: ['scheduled', 'started'] };
    } else if (status === 'done') {
      where.status = 'done';
    } else if (status === 'passed') {
      where.result = { is: { passed: true } };
    } else if (status === 'failed') {
      where.result = { is: { passed: false } };
    }

    const [rows, total] = await Promise.all([
      prisma.examRegistration.findMany({
        where,
        ...(pg && { skip: pg.skip, take: pg.take }),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userEmail: true,
          status: true,
          schedule: {
            select: {
              exam: {
                select: {
                  title: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
            },
          },
          result: {
            select: {
              totalScore: true,
              maxPossible: true,
              percentage: true,
              passed: true,
              essayReviewed: true,
            },
          },
        },
      }),
      prisma.examRegistration.count({ where }),
    ]);

    res.json(paginatedResponse(rows, total, pg));
  } catch (err) { next(err); }
}

// GET /api/exams/:id  (full — with isCorrect)
export async function getExam(req, res, next) {
  try {
    const exam = await prisma.exam.findUnique({ where: { id: Number(req.params.id) }, include: examDetailInclude });
    if (!exam || exam.deletedAt) return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });
    res.json(shapeExam(exam));
  } catch (err) { next(err); }
}

// GET /api/exams/:id/student  (safe — no isCorrect)
export async function getExamForStudent(req, res, next) {
  try {
    const exam = await prisma.exam.findUnique({ where: { id: Number(req.params.id) }, include: examDetailInclude });
    if (!exam || exam.deletedAt) return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });
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
        levelGroup: getLevelGroup(gradeLevel),
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
    if (gradeLevel !== undefined) {
      data.gradeLevel = gradeLevel;
      data.levelGroup = getLevelGroup(gradeLevel);
    }
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
      }, { timeout: 20000 });  // Increased from 10s → 20s for Vercel cold starts
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
    await prisma.exam.update({ where: { id }, data: { deletedAt: new Date() } });

    logAudit({ userId: req.user.id, action: 'exam.delete', entity: 'exam', entityId: id, ipAddress: req.ip });

    res.status(204).end();
  } catch (err) { next(err); }
}

// POST /api/exams/bulk-delete
export async function bulkDeleteExams(req, res, next) {
  try {
    const { ids } = req.body;

    await prisma.exam.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });

    logAudit({ userId: req.user.id, action: 'exam.bulkDelete', entity: 'exam', details: { count: ids.length, ids }, ipAddress: req.ip });

    res.json({ deleted: ids.length });
  } catch (err) { next(err); }
}

// POST /api/exams/:id/clone  — deep-copy exam + questions + choices
export async function cloneExam(req, res, next) {
  try {
    const sourceId = Number(req.params.id);
    const source = await prisma.exam.findUnique({ where: { id: sourceId }, include: examDetailInclude });
    if (!source || source.deletedAt) return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });

    const clone = await prisma.exam.create({
      data: {
        title: `${source.title} (Copy)`,
        gradeLevel: source.gradeLevel,
        levelGroup: source.levelGroup,
        durationMinutes: source.durationMinutes,
        passingScore: source.passingScore,
        isActive: false,
        academicYearId: source.academicYearId,
        semesterId: source.semesterId,
        createdById: req.user.id,
        questions: {
          create: source.questions.map((q, qi) => ({
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

    logAudit({ userId: req.user.id, action: 'exam.clone', entity: 'exam', entityId: clone.id, details: { sourceId, title: clone.title }, ipAddress: req.ip });

    res.status(201).json(shapeExam(clone));
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════
// SCHEDULES & REGISTRATIONS → see examSchedules.js & examRegistrations.js
// ═══════════════════════════════════════════════════════

