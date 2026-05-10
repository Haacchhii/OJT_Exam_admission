import prisma from '../config/db.js';
import path from 'path';
import { existsSync } from 'fs';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { VALID_TRANSITIONS, ROLES, MAX_BULK_OPERATIONS, getLevelGroup, shouldSkipEntranceExam } from '../utils/constants.js';
import { generateTrackingId, generateStudentNumber } from '../utils/tracking.js';
import { logAudit } from '../utils/auditLog.js';
import { getIo } from '../utils/socket.js';
import { sendAdmissionSubmittedEmail, sendAdmissionStatusEmail } from '../utils/email.js';
import { cached, invalidatePrefix } from '../utils/cache.js';
import env from '../config/env.js';
import { resolveUploadedFilePath } from '../utils/uploadPaths.js';
import { toManilaIsoDay } from '../utils/timezone.js';

const ADMISSION_IN_PROGRESS = ['Submitted', 'Under Screening', 'Under Evaluation'];
const REPORTS_DEFAULT_ADMISSIONS = 40;
const REPORTS_MAX_ADMISSIONS = 200;
const ADMISSIONS_LIST_DATA_TTL_MS = 30_000;
const ADMISSIONS_LIST_COUNT_TTL_MS = 45_000;
const ADMISSIONS_STATS_TTL_MS = 60_000;

async function invalidateAdmissionCaches(userIds = []) {
  await invalidatePrefix('admStats:');
  await invalidatePrefix('admissions:list:');
  await invalidatePrefix('admissions:ops:');
  await invalidatePrefix('dashboardSummary:');
  await invalidatePrefix('reportsSummary:');
  for (const userId of userIds) {
    if (userId) await invalidatePrefix(`adm:mine:${userId}`);
  }
}

function toIsoDay(d) {
  return toManilaIsoDay(d);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isWithinPeriod(day, start, end) {
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

function getPeriodStatus(todayDay, period) {
  if (!period) return 'missing';
  const endDay = toIsoDay(period.endDate);
  if (endDay && todayDay && todayDay > endDay) return 'overdue';
  return 'active';
}

function pickActiveSemester(activeSemesters, activeAcademicYearId) {
  if (!Array.isArray(activeSemesters) || activeSemesters.length === 0) return null;
  if (activeAcademicYearId) {
    const inActiveYear = activeSemesters.find((semester) => semester.academicYearId === activeAcademicYearId);
    if (inActiveYear) return inActiveYear;
  }
  return activeSemesters[0];
}

async function resolveStoredDocumentPath(doc) {
  const candidates = [];
  if (doc.filePath) candidates.push(doc.filePath);

  const latestSubmission = await prisma.admissionDocumentSubmission.findFirst({
    where: {
      OR: [
        { admissionDocumentId: doc.id },
        { admissionId: doc.admissionId, originalFileName: doc.documentName },
      ],
    },
    orderBy: { uploadedAt: 'desc' },
    select: { storedFilePath: true },
  });

  if (latestSubmission?.storedFilePath) {
    candidates.push(latestSubmission.storedFilePath);
  }

  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
  for (const candidate of uniqueCandidates) {
    const resolvedPath = resolveUploadedFilePath(candidate);
    if (resolvedPath && existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  return uniqueCandidates.length > 0 ? resolveUploadedFilePath(uniqueCandidates[0]) : '';
}

// Helper: shape admission for API response (include document names and file paths)
function shapeAdmission(adm) {
  if (!adm) return null;
  const { documents: docs, academicYear, semester, user, ...rest } = adm;
  return {
    ...rest,
    documentCount: docs ? docs.length : 0,
    documents: docs ? docs.map(d => d.documentName) : [],
    documentFiles: docs ? docs.map(d => ({ id: d.id, name: d.documentName, filePath: d.filePath, hasExtraction: !!(d.extractedText && d.extractedData), reviewStatus: d.reviewStatus, reviewNote: d.reviewNote || null, reviewedAt: d.reviewedAt })) : [],
    academicYear: academicYear ? { id: academicYear.id, year: academicYear.year, startDate: academicYear.startDate || null, endDate: academicYear.endDate || null } : null,
    semester: semester ? { id: semester.id, name: semester.name, startDate: semester.startDate || null, endDate: semester.endDate || null } : null,
  };
}

function shapeAdmissionList(adm) {
  if (!adm) return null;
  const { _count, academicYear, semester, ...rest } = adm;
  return {
    ...rest,
    documentCount: _count?.documents || 0,
    documents: [],
    documentFiles: [],
    academicYear: academicYear ? { id: academicYear.id, year: academicYear.year, startDate: academicYear.startDate || null, endDate: academicYear.endDate || null } : null,
    semester: semester ? { id: semester.id, name: semester.name, startDate: semester.startDate || null, endDate: semester.endDate || null } : null,
  };
}

function buildAdmissionsWhereFromQuery(query = {}) {
  const {
    status,
    grade,
    levelGroup,
    search,
    academicYearId,
    semesterId,
    staleOnly,
    slaDays,
  } = query;

  const where = { deletedAt: null };
  if (status) where.status = status;
  if (grade) where.gradeLevel = grade;
  if (levelGroup) where.levelGroup = levelGroup;
  if (academicYearId) where.academicYearId = Number(academicYearId);
  if (semesterId) where.semesterId = Number(semesterId);

  if (staleOnly === 'true') {
    const thresholdDays = Number(slaDays) > 0 ? Number(slaDays) : 7;
    where.status = { in: ADMISSION_IN_PROGRESS };
    where.submittedAt = { lt: new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000) };
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { middleName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}

function buildAdmissionsOrderBy(sort) {
  if (sort === 'oldest') return { submittedAt: 'asc' };
  if (sort === 'name') return [{ lastName: 'asc' }, { firstName: 'asc' }];
  if (sort === 'status') return [{ status: 'asc' }, { submittedAt: 'desc' }];
  return { submittedAt: 'desc' };
}

async function loadAdmissionsPageSnapshot(query = {}) {
  const pg = paginate(query.page ?? 1, query.limit ?? 50);
  const where = buildAdmissionsWhereFromQuery(query);
  const orderBy = buildAdmissionsOrderBy(query.sort);

  const countCacheKey = `admissions:list:count:${JSON.stringify(where)}`;
  const total = await cached(countCacheKey, () => prisma.admission.count({ where }), ADMISSIONS_LIST_COUNT_TTL_MS);

  const listCacheKey = `admissions:list:data:${JSON.stringify({ where, orderBy, skip: pg?.skip || 0, take: pg?.take || null })}`;
  const admissions = await cached(listCacheKey, () => prisma.admission.findMany({
    where,
    ...(pg && { skip: pg.skip, take: pg.take }),
    orderBy,
    select: {
      id: true,
      trackingId: true,
      userId: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      phone: true,
      gradeLevel: true,
      levelGroup: true,
      applicantType: true,
      status: true,
      submittedAt: true,
      updatedAt: true,
      academicYearId: true,
      semesterId: true,
      academicYear: { select: { id: true, year: true, startDate: true, endDate: true } },
      semester: { select: { id: true, name: true, startDate: true, endDate: true } },
      _count: { select: { documents: true } },
    },
  }), ADMISSIONS_LIST_DATA_TTL_MS);

  return {
    data: admissions.map(shapeAdmissionList),
    total,
    pg,
  };
}

function buildAdmissionStatsWhere(query = {}) {
  const { grade, levelGroup, from, to, academicYearId, semesterId } = query;
  const where = { deletedAt: null };
  if (grade) where.gradeLevel = grade;
  if (levelGroup) where.levelGroup = levelGroup;
  if (academicYearId) where.academicYearId = Number(academicYearId);
  if (semesterId) where.semesterId = Number(semesterId);
  if (from || to) {
    where.submittedAt = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) where.submittedAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) where.submittedAt.lte = d;
    }
  }
  return where;
}

async function loadAdmissionStatsSnapshot(query = {}) {
  const where = buildAdmissionStatsWhere(query);
  const staleThresholdDays = Number(query.slaDays) > 0 ? Number(query.slaDays) : 7;
  const staleThreshold = new Date(Date.now() - staleThresholdDays * 24 * 60 * 60 * 1000);

  const cacheKey = `admStats:${JSON.stringify({ where, staleThresholdDays })}`;
  return cached(cacheKey, async () => {
    const applicantWhere = { deletedAt: null, role: ROLES.APPLICANT };
    const [total, grouped, overSlaCount, applicantGroups, applicantsWithoutAdmissionsCount] = await Promise.all([
      prisma.admission.count({ where }),
      prisma.admission.groupBy({ by: ['status'], _count: { _all: true }, where }),
      prisma.admission.count({
        where: {
          ...where,
          status: { in: ADMISSION_IN_PROGRESS },
          submittedAt: { lt: staleThreshold },
        },
      }),
      prisma.user.groupBy({
        by: ['emailVerified', 'status'],
        _count: { _all: true },
        where: applicantWhere,
      }),
      prisma.user.count({
        where: {
          ...applicantWhere,
          admissions: { none: { deletedAt: null } },
        },
      }),
    ]);

    const registeredApplicants = applicantGroups.reduce((sum, group) => sum + group._count._all, 0);
    const unverifiedApplicants = applicantGroups
      .filter((group) => group.emailVerified === false)
      .reduce((sum, group) => sum + group._count._all, 0);
    const inactiveApplicants = applicantGroups
      .filter((group) => group.status === 'Inactive')
      .reduce((sum, group) => sum + group._count._all, 0);
    const applicantsWithoutAdmissions = applicantsWithoutAdmissionsCount;

    const statusMap = Object.fromEntries(grouped.map(g => [g.status, g._count._all]));
    return {
      total,
      submitted: statusMap['Submitted'] || 0,
      underScreening: statusMap['Under Screening'] || 0,
      underEvaluation: statusMap['Under Evaluation'] || 0,
      accepted: statusMap['Accepted'] || 0,
      rejected: statusMap['Rejected'] || 0,
      overSlaCount,
      registeredApplicants,
      applicantsWithoutAdmissions,
      unverifiedApplicants,
      inactiveApplicants,
    };
  }, ADMISSIONS_STATS_TTL_MS);
}

const myRegistrationInclude = {
  schedule: {
    select: {
      id: true,
      examId: true,
      scheduledDate: true,
      startTime: true,
      endTime: true,
      visibilityStartDate: true,
      visibilityEndDate: true,
      registrationOpenDate: true,
      registrationCloseDate: true,
      examWindowStartAt: true,
      examWindowEndAt: true,
      maxSlots: true,
      slotsTaken: true,
      venue: true,
      exam: {
        select: {
          id: true,
          title: true,
          gradeLevel: true,
          durationMinutes: true,
          passingScore: true,
          academicYearId: true,
        },
      },
    },
  },
};

const myResultInclude = {
  registration: {
    include: {
      schedule: { include: { exam: { select: { title: true, gradeLevel: true, academicYearId: true } } } },
    },
  },
};

function pickLatestByCreatedAt(primary, secondary) {
  if (!primary) return secondary || null;
  if (!secondary) return primary || null;
  const primaryTs = new Date(primary.createdAt).getTime();
  const secondaryTs = new Date(secondary.createdAt).getTime();
  return secondaryTs > primaryTs ? secondary : primary;
}

async function getOwnedRegistrationSummaryForUser(user, normalizedEmail) {
  const [latestByUserId, totalByUserId, completedByUserId] = await Promise.all([
    prisma.examRegistration.findFirst({
      where: { userId: user.id },
      include: myRegistrationInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.examRegistration.count({ where: { userId: user.id } }),
    prisma.examRegistration.count({ where: { userId: user.id, status: 'done' } }),
  ]);

  return {
    latest: latestByUserId,
    hasCompletedExam: completedByUserId > 0,
    totalRegistrations: totalByUserId,
  };
}

async function findLatestResultForUser(user, normalizedEmail) {
  const latestByUserId = await prisma.examResult.findFirst({
    where: { registration: { userId: user.id } },
    include: myResultInclude,
    orderBy: { createdAt: 'desc' },
  });

  return latestByUserId;
}

// GET /api/admissions?status=&grade=&search=&sort=&page=&limit=&academicYearId=&semesterId=
export async function getAdmissions(req, res, next) {
  try {
    const snapshot = await loadAdmissionsPageSnapshot(req.query);
    res.json(paginatedResponse(snapshot.data, snapshot.total, snapshot.pg));
  } catch (err) { next(err); }
}

// GET /api/admissions/ops-bootstrap
// Consolidated admin/registrar admissions bootstrap to reduce initial fanout.
export async function getOpsBootstrap(req, res, next) {
  try {
    const [admissionsPage, stats, academicYears, semesters] = await Promise.all([
      loadAdmissionsPageSnapshot(req.query),
      loadAdmissionStatsSnapshot(req.query),
      cached('ay:all:lite', () => prisma.academicYear.findMany({
        orderBy: { year: 'desc' },
        select: {
          id: true,
          year: true,
          isActive: true,
          startDate: true,
          endDate: true,
        },
      }), 120_000),
      cached('ay:semesters:all', () => prisma.semester.findMany({
        orderBy: [{ academicYearId: 'desc' }, { id: 'asc' }],
        include: { academicYear: { select: { year: true } } },
      }), 120_000),
    ]);

    res.json({
      admissionsPage: paginatedResponse(admissionsPage.data, admissionsPage.total, admissionsPage.pg),
      stats,
      academicYears,
      semesters,
    });
  } catch (err) { next(err); }
}

// GET /api/admissions/mine
export async function getMyAdmission(req, res, next) {
  try {
    const cacheKey = `adm:mine:${req.user.id}`;
    const admission = await cached(cacheKey, () =>
      prisma.admission.findFirst({
        where: { userId: req.user.id, deletedAt: null },
        include: { documents: true, academicYear: true, semester: true },
        orderBy: { submittedAt: 'desc' },
      }),
    60_000);
    res.json(shapeAdmission(admission));
  } catch (err) { next(err); }
}

// GET /api/admissions/mine-summary
// Bundled student bootstrap to reduce initial page fanout.
export async function getMyStudentSummary(req, res, next) {
  try {
    const normalizedEmail = normalizeEmail(req.user?.email);

    const [myAdmission, registrationSummary, myResult] = await Promise.all([
      prisma.admission.findFirst({
        where: { userId: req.user.id, deletedAt: null },
        include: { documents: true, academicYear: true, semester: true },
        orderBy: { submittedAt: 'desc' },
      }),
      getOwnedRegistrationSummaryForUser(req.user, normalizedEmail),
      findLatestResultForUser(req.user, normalizedEmail),
    ]);

    res.json({
      myAdmission: shapeAdmission(myAdmission),
      registrationSummary,
      myResult: myResult || null,
    });
  } catch (err) { next(err); }
}

// GET /api/admissions/:id
export async function getAdmission(req, res, next) {
  try {
    const admission = await prisma.admission.findUnique({
      where: { id: Number(req.params.id) },
      include: { documents: true, academicYear: true, semester: true },
    });
    if (!admission || admission.deletedAt) return res.status(404).json({ error: 'We could not find this admission record.', code: 'NOT_FOUND' });
    // Ownership: applicants can only view their own admission
    if (req.user.role === 'applicant' && admission.userId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to view this admission record.', code: 'FORBIDDEN' });
    }
    res.json(shapeAdmission(admission));
  } catch (err) { next(err); }
}

// GET /api/admissions/stats?grade=&from=&to=&academicYearId=&semesterId=
export async function getStats(req, res, next) {
  try {
    const counts = await loadAdmissionStatsSnapshot(req.query);
    res.json(counts);
  } catch (err) { next(err); }
}

// GET /api/admissions/dashboard-summary
export async function getDashboardSummary(req, res, next) {
  try {
    const role = req.user?.role;
    const roleAwareEnabled = env.DASHBOARD_ROLE_AWARE_QUERIES;
    const includeAdmissions = !roleAwareEnabled || role === ROLES.ADMIN || role === ROLES.REGISTRAR;
    const includeExams = !roleAwareEnabled || role === ROLES.ADMIN || role === ROLES.TEACHER;
    const includeResults = !roleAwareEnabled || role === ROLES.ADMIN || role === ROLES.REGISTRAR || role === ROLES.TEACHER;

    const cacheKey = `dashboardSummary:${role}:a${includeAdmissions ? 1 : 0}:e${includeExams ? 1 : 0}:r${includeResults ? 1 : 0}`;
    const summary = await cached(cacheKey, async () => {
      const [activeAcademicYear, activeSemesters] = await Promise.all([
        cached('ay:active:lite', () =>
          prisma.academicYear.findFirst({
            where: { isActive: true },
            select: {
              id: true,
              year: true,
              startDate: true,
              endDate: true,
            },
          })
        , 120_000),
        cached('ay:semesters:active', () =>
          prisma.semester.findMany({
            where: { isActive: true },
            orderBy: [{ academicYearId: 'desc' }, { id: 'asc' }],
            select: {
              id: true,
              name: true,
              academicYearId: true,
              startDate: true,
              endDate: true,
            },
          })
        , 120_000),
      ]);

      const activeSemester = pickActiveSemester(activeSemesters, activeAcademicYear?.id);
      const todayDay = toIsoDay(new Date());
      const academicYearStatus = getPeriodStatus(todayDay, activeAcademicYear);
      const semesterStatus = getPeriodStatus(todayDay, activeSemester);

      let stats = {
        total: 0,
        submitted: 0,
        underScreening: 0,
        underEvaluation: 0,
        accepted: 0,
        rejected: 0,
      };
      let trends = { total: 0, accepted: 0, inProgress: 0, rejected: 0 };
      let overdueCount = 0;
      let recentAdmissions = [];

      if (includeAdmissions) {
        const now = Date.now();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
        const overdueThreshold = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const [grouped, overdue, recentAdmissionsRows, trendRows] = await Promise.all([
          prisma.admission.groupBy({
            by: ['status'],
            _count: { _all: true },
            where: { deletedAt: null },
          }),
          prisma.admission.count({
            where: {
              deletedAt: null,
              status: { in: ADMISSION_IN_PROGRESS },
              submittedAt: { lt: overdueThreshold },
            },
          }),
          prisma.admission.findMany({
            where: { deletedAt: null },
            orderBy: { submittedAt: 'desc' },
            take: 5,
            select: {
              id: true,
              trackingId: true,
              userId: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
              gradeLevel: true,
              levelGroup: true,
              prevSchool: true,
              status: true,
              submittedAt: true,
              academicYear: { select: { id: true, year: true, startDate: true, endDate: true } },
              semester: { select: { id: true, name: true, startDate: true, endDate: true } },
            },
          }),
          prisma.admission.findMany({
            where: { deletedAt: null, submittedAt: { gte: twoWeeksAgo } },
            select: { status: true, submittedAt: true },
          }),
        ]);

        overdueCount = overdue;
        recentAdmissions = recentAdmissionsRows.map(shapeAdmissionList);
        const statusMap = Object.fromEntries(grouped.map(g => [g.status, g._count._all]));
        const total = Object.values(statusMap).reduce((sum, count) => sum + count, 0);
        stats = {
          total,
          submitted: statusMap['Submitted'] || 0,
          underScreening: statusMap['Under Screening'] || 0,
          underEvaluation: statusMap['Under Evaluation'] || 0,
          accepted: statusMap['Accepted'] || 0,
          rejected: statusMap['Rejected'] || 0,
        };

        const pct = (curr, prev) => (prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100));
        const inRange = (submittedAt, start, end) => {
          if (!submittedAt) return false;
          const ts = new Date(submittedAt);
          if (Number.isNaN(ts.getTime())) return false;
          if (start && ts < start) return false;
          if (end && ts >= end) return false;
          return true;
        };
        const thisWeekRows = trendRows.filter((row) => inRange(row.submittedAt, weekAgo, null));
        const lastWeekRows = trendRows.filter((row) => inRange(row.submittedAt, twoWeeksAgo, weekAgo));
        const thisWeekTotal = thisWeekRows.length;
        const lastWeekTotal = lastWeekRows.length;
        const statusCountMap = (rows) => {
          const counts = {};
          for (const row of rows) {
            const key = row.status;
            counts[key] = (counts[key] || 0) + 1;
          }
          return counts;
        };
        const thisWeekStatusMap = statusCountMap(thisWeekRows);
        const lastWeekStatusMap = statusCountMap(lastWeekRows);
        const countStatus = (map, status) => map[status] || 0;
        const countInProgress = (map) => ADMISSION_IN_PROGRESS.reduce((sum, status) => sum + (map[status] || 0), 0);
        trends = {
          total: pct(thisWeekTotal, lastWeekTotal),
          accepted: pct(countStatus(thisWeekStatusMap, 'Accepted'), countStatus(lastWeekStatusMap, 'Accepted')),
          inProgress: pct(countInProgress(thisWeekStatusMap), countInProgress(lastWeekStatusMap)),
          rejected: pct(countStatus(thisWeekStatusMap, 'Rejected'), countStatus(lastWeekStatusMap, 'Rejected')),
        };
      }

      let examActivity = [];
      let examCount = 0;
      let completed = 0;
      const pendingEssaysPromise = includeResults
        ? prisma.essayAnswer.count({ where: { scored: false } })
        : Promise.resolve(0);
      let pendingEssays = 0;
      if (includeExams) {
        const [exams, totalExams, completedCount, pendingEssaysCount] = await Promise.all([
          prisma.exam.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              id: true,
              title: true,
              gradeLevel: true,
              isActive: true,
              _count: { select: { questions: true, schedules: true } },
              schedules: {
                select: { slotsTaken: true },
              },
            },
          }),
          prisma.exam.count({ where: { deletedAt: null } }),
          prisma.examRegistration.count({ where: { status: 'done' } }),
          pendingEssaysPromise,
        ]);
        pendingEssays = pendingEssaysCount;
        examActivity = exams.map((exam) => {
          return {
            id: exam.id,
            title: exam.title,
            gradeLevel: exam.gradeLevel,
            questionCount: exam._count.questions,
            scheduleCount: exam._count.schedules,
            isActive: exam.isActive,
            registrations: exam.schedules.reduce((sum, schedule) => sum + (schedule.slotsTaken || 0), 0),
          };
        });

        examCount = totalExams;
        completed = completedCount;
      } else {
        pendingEssays = await pendingEssaysPromise;
      }

      return {
        stats,
        trends,
        admissions: recentAdmissions,
        overdue: overdueCount,
        exams: examActivity,
        examCount,
        completed,
        pendingEssays,
        activePeriod: {
          academicYear: activeAcademicYear || null,
          semester: activeSemester || null,
          academicYearStatus,
          semesterStatus,
          needsAttention: academicYearStatus !== 'active' || semesterStatus !== 'active',
        },
      };
    }, 60_000);

    res.json(summary);
  } catch (err) { next(err); }
}

// GET /api/admissions/reports-summary
export async function getReportsSummary(req, res, next) {
  try {
    const {
      status,
      levelGroup,
      grade,
      academicYearId,
      semesterId,
      dateFrom,
      dateTo,
      limit,
      sort,
      school,
    } = req.query;

    const requestedLimit = Number(limit);
    const admissionLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), REPORTS_MAX_ADMISSIONS)
      : REPORTS_DEFAULT_ADMISSIONS;

    const admissionWhere = { deletedAt: null };
    if (status) admissionWhere.status = status;
    if (levelGroup) admissionWhere.levelGroup = levelGroup;
    if (grade) admissionWhere.gradeLevel = grade;
    if (school) {
      admissionWhere.prevSchool = { contains: school, mode: 'insensitive' };
    }
    if (academicYearId) admissionWhere.academicYearId = Number(academicYearId);
    if (semesterId) admissionWhere.semesterId = Number(semesterId);
    if (dateFrom || dateTo) {
      admissionWhere.submittedAt = {};
      if (dateFrom) {
        const from = new Date(String(dateFrom));
        if (!Number.isNaN(from.getTime())) admissionWhere.submittedAt.gte = from;
      }
      if (dateTo) {
        const to = new Date(String(dateTo));
        if (!Number.isNaN(to.getTime())) admissionWhere.submittedAt.lte = to;
      }
      if (Object.keys(admissionWhere.submittedAt).length === 0) delete admissionWhere.submittedAt;
    }

    let admissionOrderBy = { submittedAt: 'desc' };
    if (sort === 'oldest') admissionOrderBy = { submittedAt: 'asc' };
    if (sort === 'alphabetical') admissionOrderBy = [{ lastName: 'asc' }, { firstName: 'asc' }, { submittedAt: 'desc' }];
    if (sort === 'school') admissionOrderBy = [{ prevSchool: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }, { submittedAt: 'desc' }];

    const cacheKey = `reportsSummary:v3:${JSON.stringify({
      status: status || null,
      levelGroup: levelGroup || null,
      grade: grade || null,
      school: school || null,
      academicYearId: academicYearId ? Number(academicYearId) : null,
      semesterId: semesterId ? Number(semesterId) : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      limit: admissionLimit,
      sort: sort || 'newest',
    })}`;
    const summary = await cached(cacheKey, async () => {
      const [totalAdmissions, admissions, academicYears, semesters] = await Promise.all([
        prisma.admission.count({ where: admissionWhere }),
        prisma.admission.findMany({
          where: admissionWhere,
          orderBy: admissionOrderBy,
          take: admissionLimit,
          select: {
            id: true,
            userId: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            gradeLevel: true,
            levelGroup: true,
            prevSchool: true,
            status: true,
            submittedAt: true,
            academicYear: { select: { id: true, year: true, startDate: true, endDate: true } },
            semester: { select: { id: true, name: true, startDate: true, endDate: true } },
          },
        }),
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
        admissionCountTotal: totalAdmissions,
        admissionCountReturned: admissions.length,
        admissionLimit,
        admissionsCapped: totalAdmissions > admissions.length,
      };

      if (!admissions.length) {
        return {
          admissions: [],
          results: [],
          exams: [],
          schedules: [],
          regs: [],
          academicYears,
          semesters,
          meta,
        };
      }

      const admissionUserIds = new Set(admissions.map((admission) => admission.userId).filter((id) => typeof id === 'number'));
      const admissionEmails = new Set(admissions.map((admission) => String(admission.email || '').trim().toLowerCase()).filter(Boolean));

      const regs = admissionUserIds.size === 0 && admissionEmails.size === 0 ? [] : await prisma.examRegistration.findMany({
        where: {
          OR: [
            admissionUserIds.size > 0 ? { userId: { in: [...admissionUserIds] } } : null,
            admissionEmails.size > 0 ? { userEmail: { in: [...admissionEmails] } } : null,
          ].filter(Boolean),
        },
        select: {
          id: true,
          scheduleId: true,
          userEmail: true,
          userId: true,
          status: true,
          result: {
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
          },
          schedule: {
            select: {
              id: true,
              examId: true,
              scheduledDate: true,
              startTime: true,
              endTime: true,
              registrationOpenDate: true,
              registrationCloseDate: true,
              maxSlots: true,
              slotsTaken: true,
              exam: {
                select: {
                  id: true,
                  title: true,
                  gradeLevel: true,
                },
              },
            },
          },
        },
      });

      const regsMap = new Map();
      const resultsMap = new Map();
      const schedulesMap = new Map();
      const examsMap = new Map();

      for (const reg of regs) {
        if (!regsMap.has(reg.id)) {
          regsMap.set(reg.id, {
            id: reg.id,
            scheduleId: reg.scheduleId,
            userEmail: reg.userEmail,
            userId: reg.userId,
            status: reg.status,
          });
        }

        if (reg.result && !resultsMap.has(reg.result.id)) {
          resultsMap.set(reg.result.id, reg.result);
        }

        if (reg.schedule && !schedulesMap.has(reg.schedule.id)) {
          schedulesMap.set(reg.schedule.id, {
            id: reg.schedule.id,
            examId: reg.schedule.examId,
            scheduledDate: reg.schedule.scheduledDate,
            startTime: reg.schedule.startTime,
            endTime: reg.schedule.endTime,
            registrationOpenDate: reg.schedule.registrationOpenDate,
            registrationCloseDate: reg.schedule.registrationCloseDate,
            maxSlots: reg.schedule.maxSlots,
            slotsTaken: reg.schedule.slotsTaken,
          });
        }

        if (reg.schedule?.exam && !examsMap.has(reg.schedule.exam.id)) {
          examsMap.set(reg.schedule.exam.id, reg.schedule.exam);
        }
      }

      return {
        admissions: admissions.map(shapeAdmission),
        results: [...resultsMap.values()],
        exams: [...examsMap.values()],
        schedules: [...schedulesMap.values()],
        regs: [...regsMap.values()],
        academicYears,
        semesters,
        meta,
      };
    }, 120_000);

    res.json(summary);
  } catch (err) { next(err); }
}

// POST /api/admissions
export async function createAdmission(req, res, next) {
  try {
    const {
      firstName, middleName, lastName, email, phone, dob, gender, address,
      gradeLevel, prevSchool, schoolYear, lrn, applicantType,
      guardian, guardianRelation, guardianPhone, guardianEmail,
      academicYearId, semesterId, studentNumber,
      documents: docNames,
    } = req.body;

    const normalizedDocNames = Array.isArray(docNames)
      ? Array.from(new Set(
          docNames
            .map((d) => String(d || '').trim())
            .filter(Boolean)
        ))
      : [];

    const guardianName = String(guardian || '').trim();
    const guardianRel = String(guardianRelation || '').trim();

    // Validate required fields
    if (!firstName || !lastName || !email || !dob || !gender || !address || !gradeLevel || !schoolYear) {
      return res.status(400).json({ error: 'Please complete all required fields before submitting.', code: 'VALIDATION_ERROR' });
    }
    if (guardianName && !guardianRel) {
      return res.status(400).json({
        error: 'Guardian relationship is required when guardian name is provided',
        code: 'VALIDATION_ERROR',
      });
    }

    const skipEntranceExam = shouldSkipEntranceExam(gradeLevel);

    // Enforce exam-completion gate only for grade levels that require entrance exams.
    const completedExam = skipEntranceExam ? null : await prisma.examRegistration.findFirst({
      where: {
        status: 'done',
        OR: [
          { userId: req.user.id },
          { userEmail: req.user.email },
        ],
      },
      select: { id: true },
    });
    if (!skipEntranceExam && !completedExam) {
      return res.status(400).json({
        error: 'Please complete your entrance exam before submitting an admission application.',
        code: 'VALIDATION_ERROR',
      });
    }

    const trackingId = await generateTrackingId('ADM');

    // Auto-link to active academic year/semester when not provided by client.
    // Also enforce that admissions can only be submitted during the active period window.
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!activeYear) {
      return res.status(400).json({ error: 'Admissions are currently closed because there is no active academic year yet.', code: 'VALIDATION_ERROR' });
    }

    const activeSemester = await prisma.semester.findFirst({
      where: { academicYearId: activeYear.id, isActive: true },
      orderBy: { id: 'asc' },
    });
    if (!activeSemester) {
      return res.status(400).json({ error: 'Admissions are currently closed because no active application period is set.', code: 'VALIDATION_ERROR' });
    }

    const today = toIsoDay(new Date());
    const semStart = toIsoDay(activeSemester.startDate);
    const semEnd = toIsoDay(activeSemester.endDate);

    if (!today || !isWithinPeriod(today, semStart, semEnd)) {
      return res.status(400).json({
        error: 'Admissions are outside the active application period.',
        code: 'VALIDATION_ERROR',
      });
    }

    const resolvedYearId = activeYear.id;
    const resolvedSemesterId = activeSemester.id;

    const admission = await prisma.admission.create({
      data: {
        trackingId,
        userId: req.user.id,
        firstName, middleName, lastName, email, phone, dob, gender, address,
        gradeLevel, levelGroup: getLevelGroup(gradeLevel), prevSchool: prevSchool || null, schoolYear,
        lrn: lrn || null, applicantType: applicantType || 'New',
        studentNumber: studentNumber || null,
        guardian: guardianName,
        guardianRelation: guardianName ? guardianRel : '',
        guardianPhone: guardianPhone || null,
        guardianEmail: guardianEmail || null,
        ...(resolvedYearId && { academicYearId: resolvedYearId }),
        ...(resolvedSemesterId && { semesterId: resolvedSemesterId }),
        status: 'Submitted',
        ...(normalizedDocNames.length
          ? {
              documents: {
                create: normalizedDocNames.map((name) => ({ documentName: name })),
              },
            }
          : {}),
      },
      include: { documents: true, academicYear: true, semester: true },
    });

    logAudit({ userId: req.user.id, action: 'admission.create', entity: 'admission', entityId: admission.id, details: { trackingId, gradeLevel, applicantType: applicantType || 'New' }, ipAddress: req.ip });

    await invalidateAdmissionCaches([req.user.id]);

    // Fire-and-forget confirmation email to the applicant
    sendAdmissionSubmittedEmail({ to: email, firstName, trackingId, gradeLevel });

    res.status(201).json(shapeAdmission(admission));
  } catch (err) { next(err); }
}

// POST /api/admissions/:id/documents  (multipart/form-data)
export async function uploadDocuments(req, res, next) {
  try {
    const admissionId = Number(req.params.id);
    // Ownership check
    const admission = await prisma.admission.findUnique({ where: { id: admissionId } });
    if (!admission) return res.status(404).json({ error: 'We could not find this admission record.', code: 'NOT_FOUND' });
    if (req.user.role === ROLES.APPLICANT && admission.userId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to upload documents for this admission.', code: 'FORBIDDEN' });
    }
    const files = req.files;
    if (!files?.length) {
      return res.status(400).json({ error: 'Please upload at least one file before continuing.', code: 'VALIDATION_ERROR' });
    }

    const docs = await Promise.all(
      files.map(f =>
        prisma.admissionDocument.create({
          data: {
            admissionId,
            documentName: f.originalname,
            filePath: f.filename,
          },
        })
      )
    );

    await prisma.admissionDocumentSubmission.createMany({
      data: docs.map((d, i) => ({
        admissionId,
        admissionDocumentId: d.id,
        originalFileName: files[i].originalname,
        storedFilePath: files[i].filename,
        mimeType: files[i].mimetype || null,
        fileSize: Number.isFinite(files[i].size) ? files[i].size : null,
      })),
    });

    await invalidateAdmissionCaches([admission.userId]);

    // Return public URLs
    const baseUrl = `${req.protocol}://${req.get('host')}/uploads`;
    const urls = docs.map(d => `${baseUrl}/${d.filePath}`);
    res.json({ urls });
  } catch (err) { next(err); }
}

// PATCH /api/admissions/:id/status
export async function updateStatus(req, res, next) {
  try {
    const { status, notes } = req.body;
    const id = Number(req.params.id);

    const admission = await prisma.admission.findUnique({ where: { id }, include: { documents: true, academicYear: true, semester: true } });
    if (!admission || admission.deletedAt) return res.status(404).json({ error: 'We could not find this admission record.', code: 'NOT_FOUND' });

    // Validate transition
    const allowed = VALID_TRANSITIONS[admission.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `This status change is not allowed: "${admission.status}" to "${status}".`,
        code: 'VALIDATION_ERROR',
      });
    }

    const updated = await prisma.admission.update({
      where: { id },
      data: { status, notes: notes !== undefined ? notes : admission.notes },
      include: { documents: true, academicYear: true, semester: true },
    });

    // When accepted, auto-assign a student number if the student doesn't have one yet
    if (status === 'Accepted') {
      try {
        const profile = await prisma.applicantProfile.findUnique({ where: { userId: admission.userId }, select: { studentNumber: true } });
        if (!profile?.studentNumber) {
          const studentNumber = await generateStudentNumber();
          await prisma.applicantProfile.upsert({
            where: { userId: admission.userId },
            update: { studentNumber },
            create: { userId: admission.userId, studentNumber },
          });
        }
      } catch (_) { /* student number failure should not block the response */ }
    }

    logAudit({ userId: req.user.id, action: 'admission.status_update', entity: 'admission', entityId: id, details: { from: admission.status, to: status, notes: notes || null }, ipAddress: req.ip });

    await invalidateAdmissionCaches([admission.userId]);

    // Fire-and-forget status update email to the applicant
    sendAdmissionStatusEmail({
      to: admission.email,
      firstName: admission.firstName,
      trackingId: admission.trackingId,
      status,
      notes: notes || null,
    });

    try {
      const io = getIo();
      io.to('role_administrator').to('role_registrar').emit('admission_status_updated', { id, status, prevStatus: admission.status });
      io.to(`user_${admission.userId}`).emit('admission_status_updated', { id, status, prevStatus: admission.status, trackingId: admission.trackingId });
    } catch (_) {}

    res.json(shapeAdmission(updated));
  } catch (err) { next(err); }
}

// POST /api/admissions/:id/handoff  — registrar marks enrollment handoff completed
export async function handoffAdmission(req, res, next) {
  try {
    const id = Number(req.params.id);
    const admission = await prisma.admission.findUnique({ where: { id } });
    if (!admission || admission.deletedAt) return res.status(404).json({ error: 'We could not find this admission record.', code: 'NOT_FOUND' });
    if (admission.status !== 'Accepted') return res.status(400).json({ error: 'Only accepted applications can be handed off to the registrar.', code: 'VALIDATION_ERROR' });

    const timestamp = new Date().toISOString();
    const handoffNote = `Enrollment handoff completed by ${req.user.firstName || req.user.email} (${req.user.role}) on ${timestamp}`;

    const updated = await prisma.admission.update({ where: { id }, data: { notes: (admission.notes ? admission.notes + '\n\n' : '') + handoffNote }, include: { documents: true, academicYear: true, semester: true } });

    logAudit({ userId: req.user.id, action: 'admission.handoff', entity: 'admission', entityId: id, details: { handoffNote }, ipAddress: req.ip });

    await invalidateAdmissionCaches([admission.userId]);

    try {
      const io = getIo();
      io.to('role_registrar').emit('admission_handoff', { id, handoffNote });
      io.to(`user_${admission.userId}`).emit('admission_handoff', { id, handoffNote });
    } catch (_) {}

    res.json(shapeAdmission(updated));
  } catch (err) { next(err); }
}

// POST /api/admissions/bulk-handoff — registrar marks multiple accepted applications as handed off
export async function bulkHandoffAdmissions(req, res, next) {
  try {
    const { ids } = req.body;
    if (!ids?.length) {
      return res.status(400).json({ error: 'Please select at least one admission.', code: 'VALIDATION_ERROR' });
    }
    if (ids.length > MAX_BULK_OPERATIONS) {
      return res.status(400).json({ error: `Please select ${MAX_BULK_OPERATIONS} admissions or fewer per bulk handoff.`, code: 'VALIDATION_ERROR' });
    }

    const admissions = await prisma.admission.findMany({ where: { id: { in: ids } } });
    for (const adm of admissions) {
      if (adm.deletedAt) {
        return res.status(404).json({ error: `Admission #${adm.id} could not be found.`, code: 'NOT_FOUND' });
      }
      if (adm.status !== 'Accepted') {
        return res.status(400).json({ error: `Admission #${adm.id} must be Accepted before handoff.`, code: 'VALIDATION_ERROR' });
      }
    }

    const timestamp = new Date().toISOString();
    const updates = await prisma.$transaction(admissions.map((adm) => {
      const handoffNote = `Enrollment handoff completed by ${req.user.firstName || req.user.email} (${req.user.role}) on ${timestamp}`;
      return prisma.admission.update({
        where: { id: adm.id },
        data: { notes: (adm.notes ? adm.notes + '\n\n' : '') + handoffNote },
        include: { documents: true, academicYear: true, semester: true },
      });
    }));

    logAudit({
      userId: req.user.id,
      action: 'admission.bulk_handoff',
      entity: 'admission',
      entityId: null,
      details: { ids, count: updates.length, handoffBy: req.user.role },
      ipAddress: req.ip,
    });

    await invalidateAdmissionCaches(admissions.map((adm) => adm.userId));

    try {
      const io = getIo();
      io.to('role_registrar').emit('admission_bulk_handoff', { ids, count: updates.length });
      for (const adm of admissions) {
        io.to(`user_${adm.userId}`).emit('admission_handoff', { id: adm.id, bulk: true });
      }
    } catch (_) {}

    res.json({ updated: updates.length });
  } catch (err) { next(err); }
}

// PATCH /api/admissions/bulk-status
export async function bulkUpdateStatus(req, res, next) {
  try {
    const { ids, status } = req.body;
    if (!ids?.length || !status) {
      return res.status(400).json({ error: 'Please select at least one admission and choose a target status.', code: 'VALIDATION_ERROR' });
    }
    if (ids.length > MAX_BULK_OPERATIONS) {
      return res.status(400).json({ error: `Please select ${MAX_BULK_OPERATIONS} admissions or fewer per bulk update.`, code: 'VALIDATION_ERROR' });
    }

    // Validate each admission's transition
    const admissions = await prisma.admission.findMany({ where: { id: { in: ids } } });
    for (const adm of admissions) {
      const allowed = VALID_TRANSITIONS[adm.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Admission #${adm.id} cannot be moved from "${adm.status}" to "${status}".`,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    const result = await prisma.admission.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    logAudit({ userId: req.user.id, action: 'admission.bulk_status_update', entity: 'admission', entityId: null, details: { ids, to: status, count: result.count }, ipAddress: req.ip });

    await invalidateAdmissionCaches(admissions.map((adm) => adm.userId));

    try {
      const io = getIo();
      io.to('role_administrator').to('role_registrar').emit('admission_bulk_status_updated', { ids, status, count: result.count });
      for (const adm of admissions) {
        io.to(`user_${adm.userId}`).emit('admission_status_updated', { id: adm.id, status, prevStatus: adm.status, trackingId: adm.trackingId, bulk: true });
      }
    } catch (_) {}

    res.json({ updated: result.count });
  } catch (err) { next(err); }
}

// GET /api/admissions/track/:trackingId
export async function trackApplication(req, res, next) {
  try {
    const { trackingId } = req.params;
    if (!trackingId) {
      return res.status(400).json({ error: 'Please enter a tracking ID.', code: 'VALIDATION_ERROR' });
    }

    const upper = trackingId.toUpperCase();
    const results = {};

    // Check admission tracking
    if (upper.includes('ADM')) {
      const admission = await prisma.admission.findUnique({
        where: { trackingId: upper },
        include: { documents: true, academicYear: true, semester: true },
      });
      if (admission && !admission.deletedAt) {
        // Ownership: applicants can only view their own tracking data
        if (req.user.role === ROLES.APPLICANT && admission.userId !== req.user.id) {
          return res.status(403).json({ error: 'You do not have permission to view this tracking record.', code: 'FORBIDDEN' });
        }
        results.type = 'admission';
        results.trackingId = admission.trackingId;
        results.data = shapeAdmission(admission);
      }
    }

    // Check exam registration tracking
    if (upper.includes('EXM')) {
      const registration = await prisma.examRegistration.findUnique({
        where: { trackingId: upper },
        include: {
          schedule: { include: { exam: { select: { title: true, gradeLevel: true, passingScore: true } } } },
          result: true,
        },
      });
      if (registration) {
        // Ownership: applicants can only view their own tracking data
        if (req.user.role === ROLES.APPLICANT && registration.userEmail !== req.user.email) {
          return res.status(403).json({ error: 'You do not have permission to view this tracking record.', code: 'FORBIDDEN' });
        }
        results.type = 'exam';
        results.trackingId = registration.trackingId;
        results.data = registration;
      }
    }

    // If neither prefix matched, try both
    if (!results.type) {
      const admission = await prisma.admission.findUnique({
        where: { trackingId: upper },
        include: { documents: true, academicYear: true, semester: true },
      }).catch(() => null);
      if (admission) {
        results.type = 'admission';
        results.trackingId = admission.trackingId;
        results.data = shapeAdmission(admission);
      } else {
        const registration = await prisma.examRegistration.findUnique({
          where: { trackingId: upper },
          include: {
            schedule: { include: { exam: { select: { title: true, gradeLevel: true, passingScore: true } } } },
            result: true,
          },
        }).catch(() => null);
        if (registration) {
          results.type = 'exam';
          results.trackingId = registration.trackingId;
          results.data = registration;
        }
      }
    }

    if (!results.type) {
      return res.status(404).json({ error: 'We could not find an admission or exam using that tracking ID.', code: 'NOT_FOUND' });
    }

    res.json(results);
  } catch (err) { next(err); }
}

// POST /api/admissions/bulk-delete
export async function bulkDeleteAdmissions(req, res, next) {
  try {
    const { ids } = req.body;

    await prisma.admission.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });

    logAudit({ userId: req.user.id, action: 'admission.bulkDelete', entity: 'admission', details: { count: ids.length, ids }, ipAddress: req.ip });

    await invalidateAdmissionCaches();

    res.json({ deleted: ids.length });
  } catch (err) { next(err); }
}

// GET /api/admissions/:id/documents/:docId/download
export async function downloadDocument(req, res, next) {
  try {
    const admissionId = Number(req.params.id);
    const docId = Number(req.params.docId);

    const doc = await prisma.admissionDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.admissionId !== admissionId) {
      return res.status(404).json({ error: 'We could not find this document.', code: 'NOT_FOUND' });
    }

    // Ownership check
    if (req.user.role === ROLES.APPLICANT) {
      const admission = await prisma.admission.findUnique({ where: { id: admissionId } });
      if (!admission || admission.userId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to download this document.', code: 'FORBIDDEN' });
      }
    }

    const filePath = await resolveStoredDocumentPath(doc);
    if (!filePath || !existsSync(filePath)) {
      return res.status(404).json({ error: 'We could not access this file on the server. Please try again. If this keeps happening, please contact the developers or support team.', code: 'NOT_FOUND' });
    }

    res.download(filePath, doc.documentName);
  } catch (err) { next(err); }
}

// PATCH /api/admissions/:id/documents/:docId/review
export async function reviewDocument(req, res, next) {
  try {
    const admissionId = Number(req.params.id);
    const docId = Number(req.params.docId);
    const { reviewStatus, reviewNote } = req.body;

    if (!['accepted', 'rejected'].includes(reviewStatus)) {
      return res.status(400).json({ error: 'Please choose a valid review status: accepted or rejected.', code: 'VALIDATION_ERROR' });
    }

    const doc = await prisma.admissionDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.admissionId !== admissionId) {
      return res.status(404).json({ error: 'We could not find this document.', code: 'NOT_FOUND' });
    }

    const updated = await prisma.admissionDocument.update({
      where: { id: docId },
      data: {
        reviewStatus,
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
        reviewedById: req.user.id,
      },
    });

    logAudit({
      userId: req.user.id,
      action: 'document.review',
      entity: 'AdmissionDocument',
      entityId: docId,
      details: { admissionId, reviewStatus, reviewNote },
      ipAddress: req.ip,
    });

    res.json({ id: updated.id, reviewStatus: updated.reviewStatus, reviewNote: updated.reviewNote, reviewedAt: updated.reviewedAt });
  } catch (err) { next(err); }
}
