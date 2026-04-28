import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { logAudit } from '../utils/auditLog.js';
import { sendExamResultEmail } from '../utils/email.js';
import { invalidatePrefix } from '../utils/cache.js';

function normalizeFreeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isIdentificationMatch(answer, key, mode) {
  const normAnswer = normalizeFreeText(answer);
  const normKey = normalizeFreeText(key);
  if (!normAnswer || !normKey) return false;
  if (mode === 'partial') {
    return normAnswer.includes(normKey) || normKey.includes(normAnswer);
  }
  return normAnswer === normKey;
}

// ═══════════════════════════════════════════════════════
// GET /api/results/essays?status=&page=&limit=
// ═══════════════════════════════════════════════════════
export async function getEssayAnswers(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const pg = paginate(page ?? 1, limit ?? 100);

    const where = {};
    if (status === 'pending') where.scored = false;
    if (status === 'scored')  where.scored = true;

    const [essays, total] = await Promise.all([
      prisma.essayAnswer.findMany({
        where, ...(pg && { skip: pg.skip, take: pg.take }),
        orderBy: { createdAt: 'desc' },
        include: {
          question: { select: { questionText: true } },
          registration: { select: { userEmail: true } },
        },
      }),
      prisma.essayAnswer.count({ where }),
    ]);

    res.json(paginatedResponse(essays, total, pg));
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════
// PATCH /api/results/essays/:id/score
// ═══════════════════════════════════════════════════════
export async function scoreEssay(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { points, comment } = req.body;
    if (points == null) {
      return res.status(400).json({ error: 'points is required', code: 'VALIDATION_ERROR' });
    }

    const essay = await prisma.essayAnswer.findUnique({ where: { id } });
    if (!essay) return res.status(404).json({ error: 'Essay answer not found', code: 'NOT_FOUND' });

    // Clamp points to [0, maxPoints]
    const clampedPoints = Math.max(0, Math.min(essay.maxPoints, Number(points)));

    const updated = await prisma.essayAnswer.update({
      where: { id },
      data: {
        pointsAwarded: clampedPoints,
        comment: comment ?? null,
        scored: true,
        scoredById: req.user.id,
        scoredAt: new Date(),
      },
    });

    // Check if ALL essays for this registration are scored → recalculate result
    const [allEssays, result, reg] = await Promise.all([
      prisma.essayAnswer.findMany({
        where: { registrationId: essay.registrationId },
        select: { id: true, scored: true, pointsAwarded: true },
      }),
      prisma.examResult.findUnique({
        where: { registrationId: essay.registrationId },
        select: { id: true, maxPossible: true },
      }),
      prisma.examRegistration.findUnique({
        where: { id: essay.registrationId },
        select: { userEmail: true, schedule: { select: { examId: true } } },
      }),
    ]);

    const allScored = allEssays.every(e => e.scored);

    if (allScored && result && reg?.schedule?.examId) {
      const [exam, submitted, student] = await Promise.all([
        prisma.exam.findUnique({
          where: { id: reg.schedule.examId },
          select: {
            title: true,
            passingScore: true,
            questions: {
              where: { questionType: { in: ['mc', 'true_false', 'identification'] } },
              select: {
                id: true,
                questionType: true,
                points: true,
                identificationAnswer: true,
                identificationMatchMode: true,
                choices: { where: { isCorrect: true }, select: { id: true } },
              },
            },
          },
        }),
        prisma.submittedAnswer.findMany({
          where: { registrationId: essay.registrationId },
          select: { questionId: true, selectedChoiceId: true, essayText: true },
        }),
        prisma.user.findFirst({
          where: { email: reg.userEmail },
          select: { id: true, email: true, firstName: true },
        }),
      ]);

      if (exam) {
        const answerByQuestionId = new Map(submitted.map(s => [s.questionId, s]));
        const essayPoints = allEssays.reduce((sum, e) => sum + (e.pointsAwarded || 0), 0);

        let mcScore = 0;
        for (const q of exam.questions) {
          const ans = answerByQuestionId.get(q.id);
          if (!ans) continue;

          if (q.questionType === 'identification') {
            if (isIdentificationMatch(ans.essayText, q.identificationAnswer, q.identificationMatchMode)) {
              mcScore += q.points;
            }
            continue;
          }

          const correctChoiceId = q.choices[0]?.id;
          if (ans.selectedChoiceId && correctChoiceId && ans.selectedChoiceId === correctChoiceId) {
            mcScore += q.points;
          }
        }

        const newTotal = mcScore + essayPoints;
        const maxPossible = result.maxPossible;
        const newPct = maxPossible > 0 ? Math.round((newTotal / maxPossible) * 1000) / 10 : 0;
        const passed = newPct >= exam.passingScore;

        await prisma.examResult.update({
          where: { id: result.id },
          data: {
            totalScore: newTotal,
            percentage: newPct,
            passed,
            essayReviewed: true,
            reviewedById: req.user.id,
          },
        });

        if (student?.id) {
          await invalidatePrefix(`results:mine:${student.id}:`);
        }
        await invalidatePrefix(`results:answers:${essay.registrationId}`);
        await invalidatePrefix('readiness:list:');
        await invalidatePrefix('resultsEmployeeSummary:');

        if (student) {
          sendExamResultEmail({
            to: student.email,
            firstName: student.firstName,
            examTitle: exam.title,
            score: newTotal,
            maxPossible,
            percentage: newPct,
            passed,
          });
        }
      }
    }

    res.json(updated);

    logAudit({ userId: req.user.id, action: 'essay.score', entity: 'result', entityId: id, details: { points: clampedPoints, maxPoints: essay.maxPoints, comment: comment || null, allScored }, ipAddress: req.ip });
  } catch (err) { next(err); }
}
