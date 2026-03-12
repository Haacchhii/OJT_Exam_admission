import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';

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
    const results = await prisma.examResult.findMany({
      where: { registration: { userEmail: req.user.email } },
      include: {
        registration: {
          include: {
            schedule: { include: { exam: { select: { title: true, gradeLevel: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    // Return the most recent result for backward compatibility (single object),
    // but also include all results in an 'all' property.
    const latest = results[0] || null;
    res.json(latest);
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
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { orderBy: { orderNum: 'asc' }, include: { choices: { orderBy: { orderNum: 'asc' } } } } },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });

    // Get all schedules for this exam then all submitted answers
    const scheduleIds = (await prisma.examSchedule.findMany({ where: { examId }, select: { id: true } })).map(s => s.id);
    const registrationIds = (await prisma.examRegistration.findMany({
      where: { scheduleId: { in: scheduleIds }, status: 'done' },
      select: { id: true },
    })).map(r => r.id);

    const submissions = await prisma.submittedAnswer.findMany({
      where: { registrationId: { in: registrationIds } },
    });
    const essayAnswers = await prisma.essayAnswer.findMany({
      where: { registrationId: { in: registrationIds } },
    });

    const totalTakers = registrationIds.length;
    const analytics = exam.questions.map(q => {
      if (q.questionType === 'mc') {
        const qSubs = submissions.filter(s => s.questionId === q.id);
        const correctChoice = q.choices.find(c => c.isCorrect);
        const correctCount = qSubs.filter(s => correctChoice && s.selectedChoiceId === correctChoice.id).length;
        const choiceDistribution = q.choices.map(c => ({
          choiceId: c.id,
          choiceText: c.choiceText,
          isCorrect: c.isCorrect,
          count: qSubs.filter(s => s.selectedChoiceId === c.id).length,
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
        const qEssays = essayAnswers.filter(e => e.questionId === q.id);
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

    res.json({ examId, examTitle: exam.title, totalTakers, analytics });
  } catch (err) { next(err); }
}
