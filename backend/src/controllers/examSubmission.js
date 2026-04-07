import prisma from '../config/db.js';
import { logAudit } from '../utils/auditLog.js';
import { sendExamResultEmail } from '../utils/email.js';
import { EXAM_GRACE_MINUTES } from '../utils/constants.js';

// ═══════════════════════════════════════════════════════
// POST /api/results/submit
// SECURITY: grades server-side — only accepts { registrationId, answers }
// answers: { questionId: choiceId | essayText }
// ═══════════════════════════════════════════════════════
export async function submitExam(req, res, next) {
  try {
    const { registrationId, answers } = req.body;
    if (!registrationId || !answers) {
      return res.status(400).json({ error: 'registrationId and answers are required', code: 'VALIDATION_ERROR' });
    }

    // Get registration
    const reg = await prisma.examRegistration.findUnique({
      where: { id: registrationId },
      include: { schedule: true },
    });
    if (!reg) return res.status(404).json({ error: 'Registration not found', code: 'NOT_FOUND' });
    // Ownership check: only the registered student can submit
    if (reg.userEmail !== req.user.email) {
      return res.status(403).json({ error: 'You can only submit your own exam', code: 'FORBIDDEN' });
    }
    if (reg.status === 'done') {
      return res.status(400).json({ error: 'Exam already submitted', code: 'VALIDATION_ERROR' });
    }
    if (reg.status !== 'started') {
      return res.status(400).json({ error: 'Exam must be started before submission', code: 'VALIDATION_ERROR' });
    }

    // Get exam questions with correct answers from DB (NEVER from client)
    const exam = await prisma.exam.findUnique({
      where: { id: reg.schedule.examId },
      include: {
        questions: {
          include: { choices: true },
          orderBy: { orderNum: 'asc' },
        },
      },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found', code: 'NOT_FOUND' });

    // ── Server-side timer enforcement ────────────────────
    // Reject submissions that arrive well after the allowed duration.
    // A 1-minute grace period accounts for network latency.
    if (reg.startedAt && exam.durationMinutes) {
      const elapsedMs = Date.now() - new Date(reg.startedAt).getTime();
      const allowedMs = (exam.durationMinutes + EXAM_GRACE_MINUTES) * 60 * 1000;
      if (elapsedMs > allowedMs) {
        return res.status(400).json({
          error: 'Exam time has expired. Your submission was not accepted.',
          code: 'TIMER_EXPIRED',
        });
      }
    }

    let totalScore = 0;
    let maxPossible = 0;
    const submittedAnswerData = [];
    const essayAnswerData = [];

    for (const question of exam.questions) {
      maxPossible += question.points;
      const answer = answers[String(question.id)];

      if (question.questionType === 'mc') {
        const selectedId = answer ? Number(answer) : null;
        submittedAnswerData.push({
          registrationId,
          questionId: question.id,
          selectedChoiceId: selectedId,
          essayText: null,
        });

        // Grade MC
        if (selectedId) {
          const correct = question.choices.find(c => c.isCorrect);
          if (correct && correct.id === selectedId) {
            totalScore += question.points;
          }
        }
      } else if (question.questionType === 'essay') {
        const essayText = typeof answer === 'string' ? answer : '';
        submittedAnswerData.push({
          registrationId,
          questionId: question.id,
          selectedChoiceId: null,
          essayText,
        });

        // Essay → pending manual scoring
        essayAnswerData.push({
          registrationId,
          questionId: question.id,
          essayResponse: essayText,
          maxPoints: question.points,
          scored: false,
        });
      }
    }

    const percentage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 1000) / 10 : 0;
    const hasEssays = essayAnswerData.length > 0;
    const passed = percentage >= exam.passingScore;

    // Transaction: save all at once
    await prisma.$transaction([
      // Save submitted answers
      prisma.submittedAnswer.createMany({ data: submittedAnswerData }),
      // Save essay answers (for review)
      ...(essayAnswerData.length ? [prisma.essayAnswer.createMany({ data: essayAnswerData })] : []),
      // Create result
      prisma.examResult.create({
        data: {
          registrationId,
          totalScore,
          maxPossible,
          percentage,
          passed: hasEssays ? false : passed, // If essays exist, wait for review
          essayReviewed: !hasEssays,
        },
      }),
      // Mark registration as done
      prisma.examRegistration.update({
        where: { id: registrationId },
        data: { status: 'done', submittedAt: new Date() },
      }),
    ]);

    res.json({ totalScore, maxPossible, percentage, passed: hasEssays ? false : passed });

    logAudit({ userId: req.user.id, action: 'exam.submit', entity: 'result', entityId: registrationId, details: { totalScore, maxPossible, percentage, hasEssays }, ipAddress: req.ip });

    // If no essays, result is final → send result email now
    if (!hasEssays) {
      sendExamResultEmail({
        to: req.user.email,
        firstName: req.user.firstName || req.user.email,
        examTitle: exam.title,
        score: totalScore,
        maxPossible,
        percentage,
        passed,
      });
    }
  } catch (err) { next(err); }
}
