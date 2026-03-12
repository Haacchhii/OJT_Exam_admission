import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { logAudit } from '../utils/auditLog.js';
import { sendExamResultEmail } from '../utils/email.js';
import { sendEvent } from '../utils/sse.js';

// ═══════════════════════════════════════════════════════
// GET /api/results/essays?status=&page=&limit=
// ═══════════════════════════════════════════════════════
export async function getEssayAnswers(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const pg = paginate(page, limit);

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
    const allEssays = await prisma.essayAnswer.findMany({
      where: { registrationId: essay.registrationId },
    });
    const allScored = allEssays.every(e => e.scored);

    if (allScored) {
      // Recalculate total score
      const result = await prisma.examResult.findUnique({
        where: { registrationId: essay.registrationId },
      });

      if (result) {
        const essayPoints = allEssays.reduce((sum, e) => sum + (e.pointsAwarded || 0), 0);
        const reg = await prisma.examRegistration.findUnique({
          where: { id: essay.registrationId },
          include: { schedule: true },
        });
        const exam = await prisma.exam.findUnique({
          where: { id: reg.schedule.examId },
          include: { questions: { include: { choices: true } } },
        });
        const submitted = await prisma.submittedAnswer.findMany({
          where: { registrationId: essay.registrationId },
        });

        let mcScore = 0;
        for (const q of exam.questions) {
          if (q.questionType === 'mc') {
            const ans = submitted.find(s => s.questionId === q.id);
            if (ans?.selectedChoiceId) {
              const correct = q.choices.find(c => c.isCorrect);
              if (correct && correct.id === ans.selectedChoiceId) mcScore += q.points;
            }
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

        // Notify the student that their essay has been reviewed
        const student = await prisma.user.findFirst({ where: { email: reg.userEmail } });
        if (student) {
          await prisma.notification.create({
            data: {
              userId: student.id,
              type: passed ? 'success' : 'warning',
              title: 'Essay Review Complete',
              message: `Your exam has been fully reviewed. Final score: ${newTotal}/${maxPossible} (${newPct}%). ${passed ? 'You passed!' : 'Unfortunately, you did not pass.'}`,
            },
          }).then(n => sendEvent(student.id, 'notification', n)).catch(() => {});

          // Send result email now that all essays are scored
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
