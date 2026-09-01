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

    const outcome = await prisma.$transaction(async (tx) => {
      const essay = await tx.essayAnswer.findUnique({ where: { id } });
      if (!essay) return { status: 'not_found' };

      // Serialize every scoring operation for this registration so two teachers
      // cannot finalize totals from different snapshots.
      await tx.$queryRaw`SELECT id FROM exam_registrations WHERE id = ${essay.registrationId} FOR UPDATE`;

      const clampedPoints = Math.max(0, Math.min(essay.maxPoints, Number(points)));
      const updated = await tx.essayAnswer.update({
        where: { id },
        data: {
          pointsAwarded: clampedPoints,
          comment: comment ?? null,
          scored: true,
          scoredById: req.user.id,
          scoredAt: new Date(),
        },
      });

      const [allEssays, result, reg] = await Promise.all([
        tx.essayAnswer.findMany({
          where: { registrationId: essay.registrationId },
          select: { id: true, scored: true, pointsAwarded: true },
        }),
        tx.examResult.findUnique({
          where: { registrationId: essay.registrationId },
          select: { id: true, maxPossible: true, essayReviewed: true },
        }),
        tx.examRegistration.findUnique({
          where: { id: essay.registrationId },
          select: { userEmail: true, schedule: { select: { examId: true } } },
        }),
      ]);
      const allScored = allEssays.every(e => e.scored);
      let notification = null;

      if (allScored && result && reg?.schedule?.examId) {
        const [exam, submitted, student] = await Promise.all([
          tx.exam.findUnique({
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
          tx.submittedAnswer.findMany({
            where: { registrationId: essay.registrationId },
            select: { questionId: true, selectedChoiceId: true, essayText: true },
          }),
          tx.user.findFirst({
            where: { email: reg.userEmail },
            select: { id: true, email: true, firstName: true },
          }),
        ]);

        if (exam) {
          const answerByQuestionId = new Map(submitted.map(s => [s.questionId, s]));
          const essayPoints = allEssays.reduce((sum, e) => sum + (e.pointsAwarded || 0), 0);
          let objectiveScore = 0;

          for (const question of exam.questions) {
            const answer = answerByQuestionId.get(question.id);
            if (!answer) continue;
            if (question.questionType === 'identification') {
              if (isIdentificationMatch(answer.essayText, question.identificationAnswer, question.identificationMatchMode)) {
                objectiveScore += question.points;
              }
              continue;
            }
            const correctChoiceId = question.choices[0]?.id;
            if (answer.selectedChoiceId && correctChoiceId && answer.selectedChoiceId === correctChoiceId) {
              objectiveScore += question.points;
            }
          }

          const totalScore = objectiveScore + essayPoints;
          const percentage = result.maxPossible > 0 ? Math.round((totalScore / result.maxPossible) * 1000) / 10 : 0;
          const passed = percentage >= exam.passingScore;
          await tx.examResult.update({
            where: { id: result.id },
            data: { totalScore, percentage, passed, essayReviewed: true, reviewedById: req.user.id },
          });

          if (!result.essayReviewed && student) {
            notification = {
              student,
              examTitle: exam.title,
              score: totalScore,
              maxPossible: result.maxPossible,
              percentage,
              passed,
            };
          }
        }
      }

      return { status: 'ok', updated, essay, clampedPoints, allScored, notification };
    });

    if (outcome.status === 'not_found') {
      return res.status(404).json({ error: 'Essay answer not found', code: 'NOT_FOUND' });
    }

    if (outcome.notification?.student) {
      sendExamResultEmail({
        to: outcome.notification.student.email,
        firstName: outcome.notification.student.firstName,
        examTitle: outcome.notification.examTitle,
        score: outcome.notification.score,
        maxPossible: outcome.notification.maxPossible,
        percentage: outcome.notification.percentage,
        passed: outcome.notification.passed,
      });
    }

    if (outcome.notification?.student?.id) {
      await invalidatePrefix(`results:mine:${outcome.notification.student.id}:`);
    }
    await invalidatePrefix(`results:answers:${outcome.essay.registrationId}`);
    await invalidatePrefix('readiness:list:');
    await invalidatePrefix('resultsEmployeeSummary:');

    res.json(outcome.updated);
    logAudit({ userId: req.user.id, action: 'essay.score', entity: 'result', entityId: id, details: { points: outcome.clampedPoints, maxPoints: outcome.essay.maxPoints, comment: comment || null, allScored: outcome.allScored }, ipAddress: req.ip });
  } catch (err) { next(err); }
}
