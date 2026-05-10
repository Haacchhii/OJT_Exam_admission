import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { EMPLOYEE_ROLES, EXAM_GRADE_LEVELS, getLevelGroup, shouldSkipEntranceExam } from '../utils/constants.js';
import { logAudit } from '../utils/auditLog.js';
import { getIo } from '../utils/socket.js';
import { cached, invalidatePrefix } from '../utils/cache.js';


// Re-export schedule and registration controllers so routes/exams.js keeps working
export { getSchedules, getAvailableSchedules, createSchedule, updateSchedule, deleteSchedule, notifyNoSchedule, closeSchedule } from './examSchedules.js';
export { getRegistrations, getMyRegistrations, getMyRegistrationById, getMyRegistrationSummary, createRegistration, startExam, saveDraftAnswers, cancelRegistration } from './examRegistrations.js';

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

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeQuestionType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'multiple choice' || raw === 'multiple_choice') return 'mc';
  if (raw === 'truefalse' || raw === 'true/false' || raw === 'true false') return 'true_false';
  if (raw === 'identification') return 'identification';
  if (raw === 'essay') return 'essay';
  return raw === 'mc' ? 'mc' : 'essay';
}

function normalizeIdentificationMatchMode(value) {
  return String(value || '').trim().toLowerCase() === 'partial' ? 'partial' : 'exact';
}

function normalizeTrueFalseToken(value) {
  const token = String(value || '').trim().toLowerCase();
  if (['true', 't', 'yes', 'y', '1'].includes(token)) return 'true';
  if (['false', 'f', 'no', 'n', '0'].includes(token)) return 'false';
  return null;
}

function buildQuestionChoices(questionType, rawChoices) {
  const inputChoices = Array.isArray(rawChoices) ? rawChoices : [];
  if (questionType === 'mc') {
    const choices = inputChoices
      .filter((c) => String(c?.choiceText || '').trim())
      .map((c, ci) => ({
        choiceText: String(c.choiceText || '').trim(),
        isCorrect: Boolean(c.isCorrect),
        orderNum: c.orderNum ?? ci + 1,
      }));
    return choices.length ? { create: choices } : undefined;
  }

  if (questionType === 'true_false') {
    let trueIsCorrect = false;
    let falseIsCorrect = false;

    for (const c of inputChoices) {
      const token = normalizeTrueFalseToken(c?.choiceText);
      if (token === 'true') trueIsCorrect = Boolean(c?.isCorrect);
      if (token === 'false') falseIsCorrect = Boolean(c?.isCorrect);
    }

    if (!trueIsCorrect && !falseIsCorrect) trueIsCorrect = true;
    if (trueIsCorrect && falseIsCorrect) falseIsCorrect = false;

    return {
      create: [
        { choiceText: 'True', isCorrect: trueIsCorrect, orderNum: 1 },
        { choiceText: 'False', isCorrect: !trueIsCorrect && falseIsCorrect ? true : !trueIsCorrect, orderNum: 2 },
      ],
    };
  }

  return undefined;
}

function toQuestionCreateInput(q, qi) {
  const questionType = normalizeQuestionType(q.questionType);
  return {
    questionText: q.questionText,
    questionType,
    points: q.points,
    orderNum: q.orderNum ?? qi + 1,
    identificationAnswer: questionType === 'identification' ? String(q.identificationAnswer || '').trim() : null,
    identificationMatchMode: questionType === 'identification' ? normalizeIdentificationMatchMode(q.identificationMatchMode) : null,
    choices: buildQuestionChoices(questionType, q.choices),
  };
}

function toQuestionCreateManyInput(q, qi) {
  const questionType = normalizeQuestionType(q.questionType);
  const parsedPoints = Number(q.points);
  const parsedOrderNum = Number(q.orderNum);
  return {
    questionText: String(q.questionText || '').trim(),
    questionType,
    points: Number.isFinite(parsedPoints) && parsedPoints > 0 ? parsedPoints : 1,
    orderNum: Number.isFinite(parsedOrderNum) && parsedOrderNum > 0 ? parsedOrderNum : qi + 1,
    identificationAnswer: questionType === 'identification' ? String(q.identificationAnswer || '').trim() : null,
    identificationMatchMode: questionType === 'identification' ? normalizeIdentificationMatchMode(q.identificationMatchMode) : null,
  };
}

function buildQuestionChoiceRows(questions, savedQuestions) {
  const questionIdByOrderNum = new Map(
    savedQuestions.map((question) => [question.orderNum, question.id])
  );

  const rows = [];

  questions.forEach((question, qi) => {
    const questionType = normalizeQuestionType(question.questionType);
    const savedQuestionId = questionIdByOrderNum.get(question.orderNum ?? qi + 1);
    if (!savedQuestionId) return;

    const inputChoices = Array.isArray(question.choices) ? question.choices : [];

    if (questionType === 'mc') {
      inputChoices
        .filter((choice) => String(choice?.choiceText || '').trim())
        .forEach((choice, ci) => {
          rows.push({
            questionId: savedQuestionId,
            choiceText: String(choice.choiceText || '').trim(),
            isCorrect: Boolean(choice.isCorrect),
            orderNum: choice.orderNum ?? ci + 1,
          });
        });
      return;
    }

    if (questionType === 'true_false') {
      let trueIsCorrect = false;
      let falseIsCorrect = false;

      for (const choice of inputChoices) {
        const token = normalizeTrueFalseToken(choice?.choiceText);
        if (token === 'true') trueIsCorrect = Boolean(choice?.isCorrect);
        if (token === 'false') falseIsCorrect = Boolean(choice?.isCorrect);
      }

      if (!trueIsCorrect && !falseIsCorrect) trueIsCorrect = true;
      if (trueIsCorrect && falseIsCorrect) falseIsCorrect = false;

      rows.push(
        { questionId: savedQuestionId, choiceText: 'True', isCorrect: trueIsCorrect, orderNum: 1 },
        { questionId: savedQuestionId, choiceText: 'False', isCorrect: !trueIsCorrect && falseIsCorrect ? true : !trueIsCorrect, orderNum: 2 },
      );
    }
  });

  return rows;
}

async function persistQuestionsAndChoices(tx, examId, questions) {
  if (!questions?.length) {
    return;
  }

  const questionRows = questions.map((question, qi) => ({
    examId,
    ...toQuestionCreateManyInput(question, qi),
  }));
  await tx.examQuestion.createMany({ data: questionRows });
  const savedQuestions = await tx.examQuestion.findMany({
    where: {
      examId,
      orderNum: {
        in: questionRows.map((question) => question.orderNum),
      },
    },
    select: { id: true, orderNum: true },
  });
  const choiceRows = buildQuestionChoiceRows(questions, savedQuestions);

  if (choiceRows.length > 0) {
    await tx.questionChoice.createMany({ data: choiceRows });
  }
}

async function createExamWithQuestions(tx, examData, questions) {
  const exam = await tx.exam.create({ data: examData });
  await persistQuestionsAndChoices(tx, exam.id, questions);
  return exam;
}

async function findOwnedRegistrationForExamStatus({ user, examId, status, select }) {
  return prisma.examRegistration.findFirst({
    where: {
      userId: user.id,
      status,
      schedule: { examId },
    },
    ...(select ? { select } : {}),
  });
}

async function invalidateExamCaches() {
  await invalidatePrefix('exams:list:');
  await invalidatePrefix('exams:detail:');
  await invalidatePrefix('schedules:available:');
}

async function getExamDetailCached(examId) {
  return cached(`exams:detail:${examId}`, async () => {
    return prisma.exam.findUnique({ where: { id: examId }, include: examDetailInclude });
  }, 60_000);
}

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
      identificationAnswer: null,
      identificationMatchMode: null,
      choices: q.choices?.map(({ isCorrect, ...c }) => c) || [],
    })) || [],
  };
}

// GET /api/exams?search=&grade=&status=&academicYearId=&semesterId=&page=&limit=
export async function getExams(req, res, next) {
  try {
    const { search, grade, levelGroup, status, academicYearId, semesterId, page, limit } = req.query;
    const pg = paginate(page ?? 1, limit ?? 20);

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
        prisma.exam.findMany({
          where,
          ...(pg && { skip: pg.skip, take: pg.take }),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            gradeLevel: true,
            levelGroup: true,
            passingScore: true,
            isActive: true,
            createdAt: true,
            createdBy: { select: { firstName: true, middleName: true, lastName: true } },
            academicYear: { select: { id: true, year: true, startDate: true, endDate: true } },
            semester: { select: { id: true, name: true, startDate: true, endDate: true } },
            _count: { select: { questions: true, schedules: true } },
          },
        }),
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
    const pg = paginate(page ?? 1, limit ?? 100);

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

    const cacheKey = `readiness:list:${JSON.stringify({
      search: search || null,
      status,
      page: pg?.page || 1,
      limit: pg?.limit || null,
    })}`;

    const { rows, total } = await cached(cacheKey, async () => {
      const [listRows, count] = await Promise.all([
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
      return { rows: listRows, total: count };
    }, 30_000);

    res.json(paginatedResponse(rows, total, pg));
  } catch (err) { next(err); }
}

// GET /api/exams/:id  (full — with isCorrect)
export async function getExam(req, res, next) {
  try {
    const exam = await getExamDetailCached(Number(req.params.id));
    if (!exam || exam.deletedAt) return res.status(404).json({ error: 'We could not find this exam.', code: 'NOT_FOUND' });
    res.json(shapeExam(exam));
  } catch (err) { next(err); }
}

// GET /api/exams/:id/student  (safe — no isCorrect)
export async function getExamForStudent(req, res, next) {
  try {
    const examId = Number(req.params.id);
    if (req.user?.role === 'applicant') {
      const profile = await prisma.applicantProfile.findUnique({
        where: { userId: req.user.id },
        select: { gradeLevel: true },
      });
      if (shouldSkipEntranceExam(profile?.gradeLevel)) {
        return res.status(403).json({
          error: 'This account uses the online application form and does not have an entrance exam.',
          code: 'FORBIDDEN',
        });
      }
    }
    const activeRegistration = await findOwnedRegistrationForExamStatus({
      user: req.user,
      examId,
      status: 'started',
      select: { id: true },
    });
    if (!activeRegistration) {
      return res.status(403).json({ error: 'Please start your scheduled exam before viewing questions.', code: 'FORBIDDEN' });
    }

    const exam = await getExamDetailCached(examId);
    if (!exam || exam.deletedAt) return res.status(404).json({ error: 'We could not find this exam.', code: 'NOT_FOUND' });
    if (!exam.questions?.length) {
      return res.status(400).json({
        error: 'This exam is not ready yet because no questions were published. Please contact staff.',
        code: 'VALIDATION_ERROR',
      });
    }
    res.json(stripAnswers(shapeExam(exam)));
  } catch (err) { next(err); }
}

// GET /api/exams/:id/review  (full exam with answers — only for students who completed it)
export async function getExamForReview(req, res, next) {
  try {
    const examId = Number(req.params.id);
    if (req.user?.role === 'applicant') {
      const profile = await prisma.applicantProfile.findUnique({
        where: { userId: req.user.id },
        select: { gradeLevel: true },
      });
      if (shouldSkipEntranceExam(profile?.gradeLevel)) {
        return res.status(403).json({
          error: 'This account uses the online application form and does not have an entrance exam.',
          code: 'FORBIDDEN',
        });
      }
    }
    // Verify the student has a 'done' registration for this exam
    const reg = await findOwnedRegistrationForExamStatus({
      user: req.user,
      examId,
      status: 'done',
    });
    if (!reg) {
      return res.status(403).json({ error: 'Please complete this exam before viewing the review.', code: 'FORBIDDEN' });
    }
    const exam = await getExamDetailCached(examId);
    if (!exam) return res.status(404).json({ error: 'We could not find this exam.', code: 'NOT_FOUND' });
    res.json(shapeExam(exam)); // full exam with correct answers
  } catch (err) { next(err); }
}

// POST /api/exams
export async function createExam(req, res, next) {
  try {
    const { title, gradeLevel, durationMinutes, passingScore, isActive, academicYearId, semesterId, questions } = req.body;
    if (!title || !gradeLevel || !durationMinutes || passingScore == null) {
      return res.status(400).json({ error: 'Please provide title, grade level, duration, and passing score.', code: 'VALIDATION_ERROR' });
    }
    if (!EXAM_GRADE_LEVELS.includes(gradeLevel)) {
      return res.status(400).json({ error: 'Entrance exams are only available for Grade 7 and above.', code: 'VALIDATION_ERROR' });
    }

    const exam = await prisma.$transaction(async (tx) => {
      const createdExam = await createExamWithQuestions(tx, {
        title,
        gradeLevel,
        levelGroup: getLevelGroup(gradeLevel),
        durationMinutes,
        passingScore,
        isActive: isActive ?? true,
        ...(academicYearId && { academicYearId: Number(academicYearId) }),
        ...(semesterId && { semesterId: Number(semesterId) }),
        createdById: req.user.id,
      }, questions);

      return tx.exam.findUnique({ where: { id: createdExam.id }, include: examDetailInclude });
    }, { timeout: 20000 });

    await invalidateExamCaches();

    res.status(201).json(shapeExam(exam));

    logAudit({ userId: req.user.id, action: 'exam.create', entity: 'exam', entityId: exam.id, details: { title, gradeLevel }, ipAddress: req.ip });
  } catch (err) { next(err); }
}

// PUT /api/exams/:id
export async function updateExam(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { title, gradeLevel, durationMinutes, passingScore, isActive, questions } = req.body;
    if (gradeLevel !== undefined && !EXAM_GRADE_LEVELS.includes(gradeLevel)) {
      return res.status(400).json({ error: 'Entrance exams are only available for Grade 7 and above.', code: 'VALIDATION_ERROR' });
    }

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
        await tx.exam.update({
          where: { id },
          data,
        });
        await persistQuestionsAndChoices(tx, id, questions);
        return tx.exam.findUnique({ where: { id }, include: examDetailInclude });
      }, { timeout: 20000 });  // Increased from 10s → 20s for Vercel cold starts
      await invalidateExamCaches();
      return res.json(shapeExam(result));
    }

    const exam = await prisma.exam.update({
      where: { id },
      data,
      include: examDetailInclude,
    });

    await invalidateExamCaches();

    res.json(shapeExam(exam));
  } catch (err) { next(err); }
}

// DELETE /api/exams/:id  — Prisma cascade: exam → questions → choices, exam → schedules → registrations → results/answers
export async function deleteExam(req, res, next) {
  try {
    const id = Number(req.params.id);
    await prisma.exam.update({ where: { id }, data: { deletedAt: new Date() } });

    await invalidateExamCaches();

    logAudit({ userId: req.user.id, action: 'exam.delete', entity: 'exam', entityId: id, ipAddress: req.ip });

    res.status(204).end();
  } catch (err) { next(err); }
}

// POST /api/exams/bulk-delete
export async function bulkDeleteExams(req, res, next) {
  try {
    const { ids } = req.body;

    await prisma.exam.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });

    await invalidateExamCaches();

    logAudit({ userId: req.user.id, action: 'exam.bulkDelete', entity: 'exam', details: { count: ids.length, ids }, ipAddress: req.ip });

    res.json({ deleted: ids.length });
  } catch (err) { next(err); }
}

// POST /api/exams/:id/clone  — deep-copy exam + questions + choices
export async function cloneExam(req, res, next) {
  try {
    const sourceId = Number(req.params.id);
    const source = await prisma.exam.findUnique({ where: { id: sourceId }, include: examDetailInclude });
    if (!source || source.deletedAt) return res.status(404).json({ error: 'We could not find this exam.', code: 'NOT_FOUND' });

    const clone = await prisma.$transaction(async (tx) => {
      const cloneExam = await createExamWithQuestions(tx, {
        title: `${source.title} (Copy)`,
        gradeLevel: source.gradeLevel,
        levelGroup: source.levelGroup,
        durationMinutes: source.durationMinutes,
        passingScore: source.passingScore,
        isActive: false,
        academicYearId: source.academicYearId,
        semesterId: source.semesterId,
        createdById: req.user.id,
      }, source.questions);

      return tx.exam.findUnique({ where: { id: cloneExam.id }, include: examDetailInclude });
    }, { timeout: 20000 });

    await invalidateExamCaches();

    logAudit({ userId: req.user.id, action: 'exam.clone', entity: 'exam', entityId: clone.id, details: { sourceId, title: clone.title }, ipAddress: req.ip });

    res.status(201).json(shapeExam(clone));
  } catch (err) { next(err); }
}

// POST /api/exams/:id/publish  — mark exam as active and ready for scheduling/registrations
export async function publishExam(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.exam.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) return res.status(404).json({ error: 'We could not find this exam.', code: 'NOT_FOUND' });

    const exam = await prisma.exam.update({ where: { id }, data: { isActive: true } });

    await invalidateExamCaches();

    logAudit({ userId: req.user.id, action: 'exam.publish', entity: 'exam', entityId: id, details: { title: existing.title }, ipAddress: req.ip });

    // Return full shaped exam detail
    const detailed = await getExamDetailCached(id);
    res.json(shapeExam(detailed));
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════
// SCHEDULES & REGISTRATIONS → see examSchedules.js & examRegistrations.js
// ═══════════════════════════════════════════════════════

