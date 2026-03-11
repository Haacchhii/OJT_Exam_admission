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
