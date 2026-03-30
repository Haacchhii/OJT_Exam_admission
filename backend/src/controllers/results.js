import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { cached } from '../utils/cache.js';

// Re-export submission and essay scoring controllers so routes/results.js keeps working
export { submitExam } from './examSubmission.js';
export { getEssayAnswers, scoreEssay } from './essayScoring.js';

// ═══════════════════════════════════════════════════════
// GET /api/results?search=&passed=&examId=&page=&limit=
// ═══════════════════════════════════════════════════════
export async function getResults(req, res, next) {
  try {
    const { search, passed, examId, page, limit } = req.query;
    const pg = paginate(page, limit);

    const where = {};
    if (passed === 'true')  where.passed = true;
    if (passed === 'false') where.passed = false;

    if (examId) {
      // Find schedules for this exam, then filter registrations
      const schedules = await prisma.examSchedule.findMany({ where: { examId: Number(examId) }, select: { id: true } });
      where.registration = { scheduleId: { in: schedules.map(s => s.id) } };
    }

    if (search) {
      where.registration = {
        ...where.registration,
        userEmail: { contains: search, mode: 'insensitive' },
      };
    }

    const [results, total] = await Promise.all([
      prisma.examResult.findMany({
        where, ...(pg && { skip: pg.skip, take: pg.take }),
        orderBy: { createdAt: 'desc' },
        include: {
          registration: {
            include: {
              schedule: { include: { exam: { select: { title: true, gradeLevel: true } } } },
            },
          },
        },
      }),
      prisma.examResult.count({ where }),
    ]);

    res.json(paginatedResponse(results, total, pg));
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════
// GET /api/results/mine
// ═══════════════════════════════════════════════════════
export async function getMyResult(req, res, next) {
  try {
    const where = { registration: { userEmail: req.user.email } };
    const { academicYearId } = req.query;
    if (academicYearId) {
      where.registration = { ...where.registration, schedule: { exam: { academicYearId: Number(academicYearId) } } };
    }

    const summary = await prisma.examResult.aggregate({
      where,
      _count: { _all: true },
      _max: { id: true, updatedAt: true },
    });

    const etag = `W/"results-mine:${req.user.id}:${academicYearId || 'all'}:${summary._count._all}:${summary._max.id || 0}:${summary._max.updatedAt ? summary._max.updatedAt.getTime() : 0}"`;
    res.set('ETag', etag);
    res.vary('Authorization');
    if (req.fresh) return res.status(304).end();

    const latest = await prisma.examResult.findFirst({
      where,
      include: {
        registration: {
          include: {
            schedule: { include: { exam: { select: { title: true, gradeLevel: true, academicYearId: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(latest || null);
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════
// GET /api/results/:registrationId
// ═══════════════════════════════════════════════════════
export async function getResult(req, res, next) {
  try {
    const result = await prisma.examResult.findUnique({
      where: { registrationId: Number(req.params.registrationId) },
      include: {
        registration: {
          include: {
            schedule: { include: { exam: { select: { title: true } } } },
          },
        },
      },
    });
    if (!result) return res.status(404).json({ error: 'Result not found', code: 'NOT_FOUND' });
    // Ownership: applicants can only view their own result
    if (req.user.role === 'applicant' && result.registration.userEmail !== req.user.email) {
      return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
    }
    res.json(result);
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════
// GET /api/results/answers/:registrationId
// ═══════════════════════════════════════════════════════
export async function getSubmittedAnswers(req, res, next) {
  try {
    const regId = Number(req.params.registrationId);
    // Ownership check for applicants
    if (req.user.role === 'applicant') {
      const reg = await prisma.examRegistration.findUnique({ where: { id: regId } });
      if (!reg || reg.userEmail !== req.user.email) {
        return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
      }
    }
    const answers = await prisma.submittedAnswer.findMany({
      where: { registrationId: regId },
      include: {
        question: { include: { choices: true } },
        selectedChoice: true,
      },
    });
    // Attach essay scoring data (comment, pointsAwarded) from EssayAnswer records
    const essayRecords = await prisma.essayAnswer.findMany({
      where: { registrationId: regId },
    });
    const essayMap = new Map(essayRecords.map(e => [e.questionId, e]));
    const enriched = answers.map(a => {
      const essay = essayMap.get(a.questionId);
      if (essay) {
        return { ...a, pointsAwarded: essay.pointsAwarded, essayComment: essay.comment };
      }
      return a;
    });
    res.json(enriched);
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════
// GET /api/results/analytics/:examId — Per-question analytics
// ═══════════════════════════════════════════════════════
export async function getQuestionAnalytics(req, res, next) {
  try {
    const examId = Number(req.params.examId);
    const { page, limit } = req.query;
    const pg = paginate(page, limit);

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });

    const totalQuestions = await prisma.examQuestion.count({ where: { examId } });

    const questions = await prisma.examQuestion.findMany({
      where: { examId },
      ...(pg && { skip: pg.skip, take: pg.take }),
      orderBy: { orderNum: 'asc' },
      include: { choices: { orderBy: { orderNum: 'asc' } } },
    });
    const questionIds = questions.map(q => q.id);

    // Get all schedules for this exam then all submitted answers
    const scheduleIds = (await prisma.examSchedule.findMany({ where: { examId }, select: { id: true } })).map(s => s.id);
    const registrationIds = (await prisma.examRegistration.findMany({
      where: { scheduleId: { in: scheduleIds }, status: 'done' },
      select: { id: true },
    })).map(r => r.id);

    const submissions = await prisma.submittedAnswer.findMany({
      where: {
        registrationId: { in: registrationIds },
        ...(questionIds.length > 0 && { questionId: { in: questionIds } }),
      },
    });
    const essayAnswers = await prisma.essayAnswer.findMany({
      where: {
        registrationId: { in: registrationIds },
        ...(questionIds.length > 0 && { questionId: { in: questionIds } }),
      },
    });

    const totalTakers = registrationIds.length;

    // Build Maps for O(1) lookup instead of O(n) .filter() per question
    const subsByQuestion = new Map();
    for (const s of submissions) {
      const arr = subsByQuestion.get(s.questionId);
      if (arr) arr.push(s);
      else subsByQuestion.set(s.questionId, [s]);
    }
    const essaysByQuestion = new Map();
    for (const e of essayAnswers) {
      const arr = essaysByQuestion.get(e.questionId);
      if (arr) arr.push(e);
      else essaysByQuestion.set(e.questionId, [e]);
    }

    const analytics = questions.map(q => {
      if (q.questionType === 'mc') {
        const qSubs = subsByQuestion.get(q.id) || [];
        const correctChoice = q.choices.find(c => c.isCorrect);
        // Build choice count map in one pass
        const choiceCounts = new Map();
        let correctCount = 0;
        for (const s of qSubs) {
          choiceCounts.set(s.selectedChoiceId, (choiceCounts.get(s.selectedChoiceId) || 0) + 1);
          if (correctChoice && s.selectedChoiceId === correctChoice.id) correctCount++;
        }
        const choiceDistribution = q.choices.map(c => ({
          choiceId: c.id,
          choiceText: c.choiceText,
          isCorrect: c.isCorrect,
          count: choiceCounts.get(c.id) || 0,
        }));
        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          points: q.points,
          totalAnswered: qSubs.length,
          correctCount,
          correctRate: qSubs.length > 0 ? Math.round((correctCount / qSubs.length) * 1000) / 10 : 0,
          choiceDistribution,
        };
      } else {
        const qEssays = essaysByQuestion.get(q.id) || [];
        const scoredEssays = qEssays.filter(e => e.scored);
        const avgScore = scoredEssays.length > 0
          ? Math.round((scoredEssays.reduce((sum, e) => sum + (e.pointsAwarded || 0), 0) / scoredEssays.length) * 10) / 10
          : null;
        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          points: q.points,
          totalAnswered: qEssays.length,
          scoredCount: scoredEssays.length,
          avgScore,
        };
      }
    });

    res.json({
      examId,
      examTitle: exam.title,
      totalTakers,
      analytics,
      pagination: {
        page: pg?.page || 1,
        limit: pg?.limit || totalQuestions,
        total: totalQuestions,
        totalPages: pg ? Math.ceil(totalQuestions / pg.limit) : 1,
      },
    });
  } catch (err) { next(err); }
}

// GET /api/results/employee-summary
export async function getEmployeeSummary(req, res, next) {
  try {
    const cacheKey = 'resultsEmployeeSummary:v1';
    const summary = await cached(cacheKey, async () => {
      const [results, regs, users, schedules, exams, essays] = await Promise.all([
        prisma.examResult.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            registrationId: true,
            totalScore: true,
            maxPossible: true,
            percentage: true,
            passed: true,
            essayReviewed: true,
            createdAt: true,
          },
        }),
        prisma.examRegistration.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            scheduleId: true,
            userEmail: true,
            userId: true,
            status: true,
          },
        }),
        prisma.user.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            applicantProfile: { select: { gradeLevel: true } },
          },
        }),
        prisma.examSchedule.findMany({
          orderBy: { scheduledDate: 'desc' },
          select: {
            id: true,
            examId: true,
            scheduledDate: true,
            startTime: true,
            endTime: true,
          },
        }),
        prisma.exam.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            gradeLevel: true,
            passingScore: true,
            academicYear: { select: { id: true } },
            semester: { select: { id: true } },
            questions: { select: { id: true, questionText: true } },
          },
        }),
        prisma.essayAnswer.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            question: { select: { questionText: true } },
          },
        }),
      ]);

      return { results, regs, users, schedules, exams, essays };
    }, 15_000);

    res.json(summary);
  } catch (err) { next(err); }
}
