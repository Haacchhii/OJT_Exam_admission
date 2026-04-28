import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { cached } from '../utils/cache.js';

const EMPLOYEE_SUMMARY_DEFAULT_LIMIT = 40;
const EMPLOYEE_SUMMARY_MAX_LIMIT = 200;

function parseBooleanQuery(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

const myResultInclude = {
  registration: {
    include: {
      schedule: { include: { exam: { select: { title: true, gradeLevel: true, academicYearId: true } } } },
    },
  },
};

function buildRegistrationScope(academicYearId) {
  if (!academicYearId) return {};
  return { schedule: { exam: { academicYearId: Number(academicYearId) } } };
}

async function findLatestOwnedResult(user, academicYearId) {
  const registrationScope = buildRegistrationScope(academicYearId);

  const byUserId = await prisma.examResult.findFirst({
    where: {
      registration: {
        userId: user.id,
        ...registrationScope,
      },
    },
    include: myResultInclude,
    orderBy: { createdAt: 'desc' },
  });
  if (byUserId) return byUserId;

  const normalizedEmail = normalizeEmail(user.email);
  if (!normalizedEmail) return null;

  const byExactEmail = await prisma.examResult.findFirst({
    where: {
      registration: {
        userId: null,
        userEmail: normalizedEmail,
        ...registrationScope,
      },
    },
    include: myResultInclude,
    orderBy: { createdAt: 'desc' },
  });
  if (byExactEmail) return byExactEmail;

  return prisma.examResult.findFirst({
    where: {
      registration: {
        userId: null,
        userEmail: { equals: normalizedEmail, mode: 'insensitive' },
        ...registrationScope,
      },
    },
    include: myResultInclude,
    orderBy: { createdAt: 'desc' },
  });
}

function registrationBelongsToUser(registration, user) {
  if (!registration || !user) return false;
  if (registration.userId != null && registration.userId === user.id) return true;
  return normalizeEmail(registration.userEmail) === normalizeEmail(user.email);
}

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

// Re-export submission and essay scoring controllers so routes/results.js keeps working
export { submitExam } from './examSubmission.js';
export { getEssayAnswers, scoreEssay } from './essayScoring.js';

// ═══════════════════════════════════════════════════════
// GET /api/results?search=&passed=&examId=&page=&limit=
// ═══════════════════════════════════════════════════════
export async function getResults(req, res, next) {
  try {
    const { search, passed, examId, page, limit } = req.query;
    const pg = paginate(page ?? 1, limit ?? 100);

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
    const { academicYearId } = req.query;

    const cacheKey = `results:mine:${req.user.id}:${academicYearId || 'all'}`;
    const latest = await cached(cacheKey, async () => {
      return findLatestOwnedResult(req.user, academicYearId);
    }, 120_000);

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
    if (req.user.role === 'applicant' && !registrationBelongsToUser(result.registration, req.user)) {
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
      if (!reg || !registrationBelongsToUser(reg, req.user)) {
        return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
      }
    }
    const cacheKey = `results:answers:${regId}`;
    const enriched = await cached(cacheKey, async () => {
      const answers = await prisma.submittedAnswer.findMany({
        where: { registrationId: regId },
        select: {
          id: true,
          registrationId: true,
          questionId: true,
          selectedChoiceId: true,
          essayText: true,
          question: {
            select: {
              id: true,
              questionType: true,
              points: true,
            },
          },
        },
      });

      // Attach essay scoring data (comment, pointsAwarded) from EssayAnswer records
      const essayRecords = await prisma.essayAnswer.findMany({
        where: { registrationId: regId },
      });
      const essayMap = new Map(essayRecords.map(e => [e.questionId, e]));
      return answers.map(a => {
        const essay = essayMap.get(a.questionId);
        if (essay) {
          return { ...a, pointsAwarded: essay.pointsAwarded, essayComment: essay.comment };
        }
        return a;
      });
    }, 120_000);

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
      include: {
        // Keep choice distribution for auto-graded objective types.
        choices: {
          orderBy: { orderNum: 'asc' },
          select: { id: true, choiceText: true, isCorrect: true },
        },
      },
    });
    const questionIds = questions.map(q => q.id);

    const [totalTakers, submissions, essayAnswers] = await Promise.all([
      prisma.examRegistration.count({
        where: {
          status: 'done',
          schedule: { examId },
        },
      }),
      questionIds.length
        ? prisma.submittedAnswer.findMany({
            where: {
              questionId: { in: questionIds },
              registration: {
                status: 'done',
                schedule: { examId },
              },
            },
            select: {
              questionId: true,
              selectedChoiceId: true,
              essayText: true,
            },
          })
        : Promise.resolve([]),
      questionIds.length
        ? prisma.essayAnswer.findMany({
            where: {
              questionId: { in: questionIds },
              registration: {
                status: 'done',
                schedule: { examId },
              },
            },
            select: {
              questionId: true,
              scored: true,
              pointsAwarded: true,
            },
          })
        : Promise.resolve([]),
    ]);

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
      if (q.questionType === 'mc' || q.questionType === 'true_false') {
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
      } else if (q.questionType === 'identification') {
        const qSubs = subsByQuestion.get(q.id) || [];
        let correctCount = 0;
        for (const s of qSubs) {
          if (isIdentificationMatch(s.essayText, q.identificationAnswer, q.identificationMatchMode)) {
            correctCount += 1;
          }
        }
        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          points: q.points,
          totalAnswered: qSubs.length,
          correctCount,
          correctRate: qSubs.length > 0 ? Math.round((correctCount / qSubs.length) * 1000) / 10 : 0,
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
    const requestedLimit = Number(req.query?.limit);
    const summaryLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), EMPLOYEE_SUMMARY_MAX_LIMIT)
      : EMPLOYEE_SUMMARY_DEFAULT_LIMIT;

    const includeResults = parseBooleanQuery(req.query?.includeResults, true);
    const includeEssays = parseBooleanQuery(req.query?.includeEssays, true);

    const cacheKey = `resultsEmployeeSummary:v6:${summaryLimit}:r${includeResults ? 1 : 0}:e${includeEssays ? 1 : 0}`;
    const summary = await cached(cacheKey, async () => {
      const [
        totalResults,
        totalEssays,
        totalPendingEssays,
        results,
        essays,
        academicYears,
        semesters,
      ] = await Promise.all([
        prisma.examResult.count(),
        prisma.essayAnswer.count(),
        prisma.essayAnswer.count({ where: { scored: false } }),
        includeResults
          ? prisma.examResult.findMany({
              orderBy: { createdAt: 'desc' },
              take: summaryLimit,
              select: {
                id: true,
                registrationId: true,
                totalScore: true,
                maxPossible: true,
                percentage: true,
                passed: true,
                essayReviewed: true,
                createdAt: true,
                registration: {
                  select: {
                    id: true,
                    scheduleId: true,
                    userEmail: true,
                    userId: true,
                    status: true,
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        email: true,
                        applicantProfile: { select: { gradeLevel: true } },
                      },
                    },
                    schedule: {
                      select: {
                        id: true,
                        examId: true,
                        scheduledDate: true,
                        startTime: true,
                        endTime: true,
                        exam: {
                          select: {
                            id: true,
                            title: true,
                            gradeLevel: true,
                            passingScore: true,
                            academicYear: { select: { id: true } },
                            semester: { select: { id: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            })
          : Promise.resolve([]),
        includeEssays
          ? prisma.essayAnswer.findMany({
              orderBy: { createdAt: 'desc' },
              take: summaryLimit,
              select: {
                id: true,
                registrationId: true,
                questionId: true,
                essayResponse: true,
                pointsAwarded: true,
                maxPoints: true,
                comment: true,
                scored: true,
                scoredById: true,
                scoredAt: true,
                question: { select: { questionText: true } },
                registration: {
                  select: {
                    id: true,
                    scheduleId: true,
                    userEmail: true,
                    userId: true,
                    status: true,
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        email: true,
                        applicantProfile: { select: { gradeLevel: true } },
                      },
                    },
                    schedule: {
                      select: {
                        id: true,
                        examId: true,
                        scheduledDate: true,
                        startTime: true,
                        endTime: true,
                        exam: {
                          select: {
                            id: true,
                            title: true,
                            gradeLevel: true,
                            passingScore: true,
                            academicYear: { select: { id: true } },
                            semester: { select: { id: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            })
          : Promise.resolve([]),
        prisma.academicYear.findMany({
          orderBy: { year: 'desc' },
          select: { id: true, year: true, isActive: true, startDate: true, endDate: true },
        }),
        prisma.semester.findMany({
          orderBy: [{ academicYearId: 'desc' }, { name: 'asc' }],
          select: { id: true, name: true, academicYearId: true, isActive: true, startDate: true, endDate: true },
        }),
      ]);

      const meta = {
        totalResults,
        returnedResults: results.length,
        totalEssays,
        returnedEssays: essays.length,
        totalPendingEssays,
        totalScoredEssays: Math.max(0, totalEssays - totalPendingEssays),
        summaryLimit,
        includeResults,
        includeEssays,
        capped: (includeResults && totalResults > results.length) || (includeEssays && totalEssays > essays.length),
      };

      const regsMap = new Map();
      const usersById = new Map();
      const usersByEmail = new Map();
      const schedulesMap = new Map();
      const examsMap = new Map();

      const registerUser = (user) => {
        if (!user || usersById.has(user.id)) return;
        const normalizedEmail = normalizeEmail(user.email);
        usersById.set(user.id, {
          id: user.id,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          email: user.email,
          applicantProfile: user.applicantProfile,
        });
        if (normalizedEmail && !usersByEmail.has(normalizedEmail)) {
          usersByEmail.set(normalizedEmail, usersById.get(user.id));
        }
      };

      const registerSchedule = (schedule) => {
        if (!schedule || schedulesMap.has(schedule.id)) return;
        schedulesMap.set(schedule.id, {
          id: schedule.id,
          examId: schedule.examId,
          scheduledDate: schedule.scheduledDate,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        });
        const exam = schedule.exam;
        if (exam && !examsMap.has(exam.id)) {
          examsMap.set(exam.id, {
            id: exam.id,
            title: exam.title,
            gradeLevel: exam.gradeLevel,
            passingScore: exam.passingScore,
            academicYear: exam.academicYear,
            semester: exam.semester,
          });
        }
      };

      const registerRegistration = (registration) => {
        if (!registration || regsMap.has(registration.id)) return;
        regsMap.set(registration.id, {
          id: registration.id,
          scheduleId: registration.scheduleId,
          userEmail: registration.userEmail,
          userId: registration.userId,
          status: registration.status,
        });
        registerUser(registration.user);
        registerSchedule(registration.schedule);
      };

      for (const result of results) {
        registerRegistration(result.registration);
      }
      for (const essay of essays) {
        registerRegistration(essay.registration);
      }

      const fallbackEmails = new Set();
      for (const registration of [...results.map((row) => row.registration), ...essays.map((row) => row.registration)]) {
        if (!registration || registration.user) continue;
        const normalizedEmail = normalizeEmail(registration.userEmail);
        if (normalizedEmail) fallbackEmails.add(normalizedEmail);
      }

      if (fallbackEmails.size > 0) {
        const fallbackUsers = await prisma.user.findMany({
          where: {
            deletedAt: null,
            email: { in: [...fallbackEmails] },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            applicantProfile: { select: { gradeLevel: true } },
          },
        });

        for (const user of fallbackUsers) {
          registerUser(user);
        }
      }

      return {
        results,
        regs: [...regsMap.values()],
        users: [...usersById.values()],
        schedules: [...schedulesMap.values()],
        exams: [...examsMap.values()],
        essays,
        academicYears,
        semesters,
        meta,
      };
    }, 120_000);

    res.json(summary);
  } catch (err) { next(err); }
}
