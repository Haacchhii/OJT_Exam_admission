import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { logAudit } from '../utils/auditLog.js';
import { sendExamResultEmail } from '../utils/email.js';

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
    res.json(answers);
  } catch (err) { next(err); }
}

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
      const allowedMs = (exam.durationMinutes + 1) * 60 * 1000; // +1 min grace
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

    // Fire-and-forget notification for employees
    prisma.user.findMany({ where: { role: { in: ['administrator', 'registrar', 'teacher'] } }, select: { id: true } })
      .then(employees => {
        const notifs = employees.map(e => ({
          userId: e.id, type: 'exam', title: 'Exam Submitted',
          message: `${req.user.email} has completed the exam. Score: ${totalScore}/${maxPossible} (${percentage}%).`,
        }));
        if (notifs.length) return prisma.notification.createMany({ data: notifs });
      }).catch(() => {});

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
    const { points } = req.body;
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
        // MC score = totalScore already recorded (before essay was scored)
        // We need submitted answers to recalculate MC score
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
          }).catch(() => {});

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

    logAudit({ userId: req.user.id, action: 'essay.score', entity: 'result', entityId: id, details: { points: clampedPoints, maxPoints: essay.maxPoints, allScored }, ipAddress: req.ip });
  } catch (err) { next(err); }
}
