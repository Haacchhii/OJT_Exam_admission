import prisma from '../config/db.js';
import path from 'path';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { VALID_TRANSITIONS, ROLES, MAX_BULK_OPERATIONS, getLevelGroup } from '../utils/constants.js';
import { generateTrackingId, generateStudentNumber } from '../utils/tracking.js';
import { logAudit } from '../utils/auditLog.js';
import { getIo } from '../utils/socket.js';
import { sendAdmissionSubmittedEmail, sendAdmissionStatusEmail } from '../utils/email.js';
import { cached, invalidatePrefix } from '../utils/cache.js';
import env from '../config/env.js';

const ADMISSION_IN_PROGRESS = ['Submitted', 'Under Screening', 'Under Evaluation'];
const REPORTS_DEFAULT_ADMISSIONS = 300;
const REPORTS_MAX_ADMISSIONS = 400;

function toIsoDay(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWithinPeriod(day, start, end) {
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

// Helper: shape admission for API response (include document names and file paths)
function shapeAdmission(adm) {
  if (!adm) return null;
  const { documents: docs, academicYear, semester, ...rest } = adm;
  return {
    ...rest,
    documents: docs ? docs.map(d => d.documentName) : [],
    documentFiles: docs ? docs.map(d => ({ id: d.id, name: d.documentName, filePath: d.filePath, hasExtraction: !!(d.extractedText && d.extractedData), reviewStatus: d.reviewStatus, reviewNote: d.reviewNote || null, reviewedAt: d.reviewedAt })) : [],
    academicYear: academicYear ? { id: academicYear.id, year: academicYear.year, startDate: academicYear.startDate || null, endDate: academicYear.endDate || null } : null,
    semester: semester ? { id: semester.id, name: semester.name, startDate: semester.startDate || null, endDate: semester.endDate || null } : null,
  };
}

// GET /api/admissions?status=&grade=&search=&sort=&page=&limit=&academicYearId=&semesterId=
export async function getAdmissions(req, res, next) {
  try {
    const { status, grade, levelGroup, search, sort, page, limit, academicYearId, semesterId, staleOnly, slaDays } = req.query;
    const pg = paginate(page ?? 1, limit ?? 50);

    const where = { deletedAt: null };
    if (status)        where.status = status;
    if (grade)         where.gradeLevel = grade;
    if (levelGroup)    where.levelGroup = levelGroup;
    if (academicYearId) where.academicYearId = Number(academicYearId);
    if (semesterId)    where.semesterId = Number(semesterId);
    if (staleOnly === 'true') {
      const thresholdDays = Number(slaDays) > 0 ? Number(slaDays) : 7;
      where.status = { in: ADMISSION_IN_PROGRESS };
      where.submittedAt = { lt: new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000) };
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { middleName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy = { submittedAt: 'desc' };
    if (sort === 'oldest') orderBy = { submittedAt: 'asc' };
    if (sort === 'name') orderBy = [{ lastName: 'asc' }, { firstName: 'asc' }];
    if (sort === 'status') orderBy = [{ status: 'asc' }, { submittedAt: 'desc' }];

    const [admissions, total] = await Promise.all([
      prisma.admission.findMany({
        where, ...(pg && { skip: pg.skip, take: pg.take }), orderBy,
        include: { documents: true, academicYear: true, semester: true },
      }),
      prisma.admission.count({ where }),
    ]);

    res.json(paginatedResponse(admissions.map(shapeAdmission), total, pg));
  } catch (err) { next(err); }
}

// GET /api/admissions/mine
export async function getMyAdmission(req, res, next) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { userId: req.user.id, deletedAt: null },
      include: { documents: true, academicYear: true, semester: true },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(shapeAdmission(admission));
  } catch (err) { next(err); }
}

// GET /api/admissions/:id
export async function getAdmission(req, res, next) {
  try {
    const admission = await prisma.admission.findUnique({
      where: { id: Number(req.params.id) },
      include: { documents: true, academicYear: true, semester: true },
    });
    if (!admission || admission.deletedAt) return res.status(404).json({ error: 'Admission not found', code: 'NOT_FOUND' });
    // Ownership: applicants can only view their own admission
    if (req.user.role === 'applicant' && admission.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
    }
    res.json(shapeAdmission(admission));
  } catch (err) { next(err); }
}

// GET /api/admissions/stats?grade=&from=&to=&academicYearId=&semesterId=
export async function getStats(req, res, next) {
  try {
    const { grade, from, to, academicYearId, semesterId } = req.query;
    const where = { deletedAt: null };
    if (grade)         where.gradeLevel = grade;
    if (academicYearId) where.academicYearId = Number(academicYearId);
    if (semesterId)    where.semesterId = Number(semesterId);
    if (from || to) {
      where.submittedAt = {};
      if (from) { const d = new Date(from); if (!isNaN(d.getTime())) where.submittedAt.gte = d; }
      if (to)   { const d = new Date(to);   if (!isNaN(d.getTime())) where.submittedAt.lte = d; }
    }

    const cacheKey = `admStats:${JSON.stringify(where)}`;
    const counts = await cached(cacheKey, async () => {
      const applicantWhere = { deletedAt: null, role: ROLES.APPLICANT };
      const [total, grouped, registeredApplicants, applicantsWithoutAdmissions, unverifiedApplicants, inactiveApplicants] = await Promise.all([
        prisma.admission.count({ where }),
        prisma.admission.groupBy({ by: ['status'], _count: { _all: true }, where }),
        prisma.user.count({ where: applicantWhere }),
        prisma.user.count({
          where: {
            ...applicantWhere,
            admissions: { none: { deletedAt: null } },
          },
        }),
        prisma.user.count({ where: { ...applicantWhere, emailVerified: false } }),
        prisma.user.count({ where: { ...applicantWhere, status: 'Inactive' } }),
      ]);
      const statusMap = Object.fromEntries(grouped.map(g => [g.status, g._count._all]));
      return {
        total,
        submitted:        statusMap['Submitted'] || 0,
        underScreening:   statusMap['Under Screening'] || 0,
        underEvaluation:  statusMap['Under Evaluation'] || 0,
        accepted:         statusMap['Accepted'] || 0,
        rejected:         statusMap['Rejected'] || 0,
        registeredApplicants,
        applicantsWithoutAdmissions,
        unverifiedApplicants,
        inactiveApplicants,
      };
    }, 15_000);

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

      if (includeAdmissions) {
        const now = Date.now();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
        const overdueThreshold = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const [total, grouped, overdue, thisWeekTotal, lastWeekTotal, thisWeekGrouped, lastWeekGrouped] = await Promise.all([
          prisma.admission.count({ where: { deletedAt: null } }),
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
          prisma.admission.count({ where: { deletedAt: null, submittedAt: { gte: weekAgo } } }),
          prisma.admission.count({ where: { deletedAt: null, submittedAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
          prisma.admission.groupBy({
            by: ['status'],
            _count: { _all: true },
            where: { deletedAt: null, submittedAt: { gte: weekAgo } },
          }),
          prisma.admission.groupBy({
            by: ['status'],
            _count: { _all: true },
            where: { deletedAt: null, submittedAt: { gte: twoWeeksAgo, lt: weekAgo } },
          }),
        ]);

        overdueCount = overdue;
        const statusMap = Object.fromEntries(grouped.map(g => [g.status, g._count._all]));
        stats = {
          total,
          submitted: statusMap['Submitted'] || 0,
          underScreening: statusMap['Under Screening'] || 0,
          underEvaluation: statusMap['Under Evaluation'] || 0,
          accepted: statusMap['Accepted'] || 0,
          rejected: statusMap['Rejected'] || 0,
        };

        const pct = (curr, prev) => (prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100));
        const statusCountMap = (rows) => Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
        const thisWeekStatusMap = statusCountMap(thisWeekGrouped);
        const lastWeekStatusMap = statusCountMap(lastWeekGrouped);
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
      let completed = 0;
      if (includeExams) {
        const [exams, registrationGrouped] = await Promise.all([
          prisma.exam.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              title: true,
              gradeLevel: true,
              isActive: true,
              _count: { select: { questions: true, schedules: true } },
            },
          }),
          prisma.examRegistration.groupBy({ by: ['status'], _count: { _all: true } }),
        ]);

        const scheduleIds = (await prisma.examSchedule.findMany({
          where: { examId: { in: exams.map(e => e.id) } },
          select: { id: true, examId: true },
        })).reduce((acc, s) => {
          if (!acc[s.examId]) acc[s.examId] = [];
          acc[s.examId].push(s.id);
          return acc;
        }, {});

        const allScheduleIds = Object.values(scheduleIds).flat();
        const regCounts = allScheduleIds.length
          ? await prisma.examRegistration.groupBy({
              by: ['scheduleId'],
              where: { scheduleId: { in: allScheduleIds } },
              _count: { _all: true },
            })
          : [];

        const regBySchedule = new Map(regCounts.map(r => [r.scheduleId, r._count._all]));
        examActivity = exams.map((exam) => {
          const ids = scheduleIds[exam.id] || [];
          const registrations = ids.reduce((sum, id) => sum + (regBySchedule.get(id) || 0), 0);
          return {
            id: exam.id,
            title: exam.title,
            gradeLevel: exam.gradeLevel,
            questionCount: exam._count.questions,
            scheduleCount: exam._count.schedules,
            isActive: exam.isActive,
            registrations,
          };
        });

        completed = (registrationGrouped.find(r => r.status === 'done')?._count._all) || 0;
      }

      const pendingEssays = includeResults
        ? await prisma.essayAnswer.count({ where: { scored: false } })
        : 0;

      return {
        stats,
        trends,
        admissions: [],
        overdue: overdueCount,
        exams: examActivity,
        completed,
        pendingEssays,
      };
    }, 30_000);

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
    } = req.query;

    const requestedLimit = Number(limit);
    const admissionLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), REPORTS_MAX_ADMISSIONS)
      : REPORTS_DEFAULT_ADMISSIONS;

    const admissionWhere = { deletedAt: null };
    if (status) admissionWhere.status = status;
    if (levelGroup) admissionWhere.levelGroup = levelGroup;
    if (grade) admissionWhere.gradeLevel = grade;
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

    const cacheKey = `reportsSummary:v2:${JSON.stringify({
      status: status || null,
      levelGroup: levelGroup || null,
      grade: grade || null,
      academicYearId: academicYearId ? Number(academicYearId) : null,
      semesterId: semesterId ? Number(semesterId) : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      limit: admissionLimit,
    })}`;
    const summary = await cached(cacheKey, async () => {
      const [totalAdmissions, admissions, academicYears, semesters] = await Promise.all([
        prisma.admission.count({ where: admissionWhere }),
        prisma.admission.findMany({
          where: admissionWhere,
          orderBy: { submittedAt: 'desc' },
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
          essays: [],
          users: [],
          academicYears,
          semesters,
          meta,
        };
      }

      const admissionUserIds = Array.from(new Set(admissions.map(a => a.userId).filter((id) => typeof id === 'number')));
      const admissionEmails = Array.from(new Set(admissions.map(a => a.email).filter(Boolean)));

      const regOr = [];
      if (admissionUserIds.length) regOr.push({ userId: { in: admissionUserIds } });
      if (admissionEmails.length) regOr.push({ userEmail: { in: admissionEmails } });

      const regs = regOr.length
        ? await prisma.examRegistration.findMany({
            where: { OR: regOr },
            select: {
              id: true,
              scheduleId: true,
              userEmail: true,
              userId: true,
              status: true,
            },
          })
        : [];

      if (!regs.length) {
        const users = await prisma.user.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(admissionUserIds.length ? [{ id: { in: admissionUserIds } }] : []),
              ...(admissionEmails.length ? [{ email: { in: admissionEmails } }] : []),
            ],
          },
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            applicantProfile: { select: { gradeLevel: true } },
          },
        });
        return {
          admissions,
          results: [],
          exams: [],
          schedules: [],
          regs: [],
          essays: [],
          users,
          academicYears,
          semesters,
          meta,
        };
      }

      const registrationIds = regs.map(r => r.id);
      const scheduleIds = Array.from(new Set(regs.map(r => r.scheduleId)));

      const [results, essays, schedules, users] = await Promise.all([
        prisma.examResult.findMany({
          where: { registrationId: { in: registrationIds } },
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
        prisma.essayAnswer.findMany({
          where: { registrationId: { in: registrationIds } },
          select: {
            id: true,
            registrationId: true,
            scored: true,
          },
        }),
        prisma.examSchedule.findMany({
          where: { id: { in: scheduleIds } },
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
          },
        }),
        prisma.user.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(admissionUserIds.length ? [{ id: { in: admissionUserIds } }] : []),
              ...(admissionEmails.length ? [{ email: { in: admissionEmails } }] : []),
            ],
          },
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            applicantProfile: { select: { gradeLevel: true } },
          },
        }),
      ]);

      const examIds = Array.from(new Set(schedules.map(s => s.examId)));
      const exams = examIds.length
        ? await prisma.exam.findMany({
            where: { id: { in: examIds }, deletedAt: null },
            select: {
              id: true,
              title: true,
              gradeLevel: true,
            },
          })
        : [];

      return { admissions, results, exams, schedules, regs, essays, users, academicYears, semesters, meta };
    }, 15_000);

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
      return res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
    }
    if (guardianName && !guardianRel) {
      return res.status(400).json({
        error: 'Guardian relationship is required when guardian name is provided',
        code: 'VALIDATION_ERROR',
      });
    }

    const trackingId = await generateTrackingId('ADM');

    // Auto-link to active academic year/semester when not provided by client.
    // Also enforce that admissions can only be submitted during the active period window.
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!activeYear) {
      return res.status(400).json({ error: 'No active academic year. Admissions are currently closed.', code: 'VALIDATION_ERROR' });
    }

    const activeSemester = await prisma.semester.findFirst({
      where: { academicYearId: activeYear.id, isActive: true },
      orderBy: { id: 'asc' },
    });
    if (!activeSemester) {
      return res.status(400).json({ error: 'No active application period. Admissions are currently closed.', code: 'VALIDATION_ERROR' });
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

    invalidatePrefix('admStats:');

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
    if (!admission) return res.status(404).json({ error: 'Admission not found', code: 'NOT_FOUND' });
    if (req.user.role === ROLES.APPLICANT && admission.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
    }
    const files = req.files;
    if (!files?.length) {
      return res.status(400).json({ error: 'No files uploaded', code: 'VALIDATION_ERROR' });
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
    if (!admission || admission.deletedAt) return res.status(404).json({ error: 'Admission not found', code: 'NOT_FOUND' });

    // Validate transition
    const allowed = VALID_TRANSITIONS[admission.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from "${admission.status}" to "${status}"`,
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

    invalidatePrefix('admStats:');

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

// PATCH /api/admissions/bulk-status
export async function bulkUpdateStatus(req, res, next) {
  try {
    const { ids, status } = req.body;
    if (!ids?.length || !status) {
      return res.status(400).json({ error: 'ids and status are required', code: 'VALIDATION_ERROR' });
    }
    if (ids.length > MAX_BULK_OPERATIONS) {
      return res.status(400).json({ error: `Cannot process more than ${MAX_BULK_OPERATIONS} records at once`, code: 'VALIDATION_ERROR' });
    }

    // Validate each admission's transition
    const admissions = await prisma.admission.findMany({ where: { id: { in: ids } } });
    for (const adm of admissions) {
      const allowed = VALID_TRANSITIONS[adm.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Admission #${adm.id} cannot transition from "${adm.status}" to "${status}"`,
          code: 'VALIDATION_ERROR',
        });
      }
    }

    const result = await prisma.admission.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    logAudit({ userId: req.user.id, action: 'admission.bulk_status_update', entity: 'admission', entityId: null, details: { ids, to: status, count: result.count }, ipAddress: req.ip });

    invalidatePrefix('admStats:');

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
      return res.status(400).json({ error: 'Tracking ID is required', code: 'VALIDATION_ERROR' });
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
          return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
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
          return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
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
      return res.status(404).json({ error: 'No application or exam found with this tracking ID', code: 'NOT_FOUND' });
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

    invalidatePrefix('admStats:');

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
      return res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
    }

    // Ownership check
    if (req.user.role === ROLES.APPLICANT) {
      const admission = await prisma.admission.findUnique({ where: { id: admissionId } });
      if (!admission || admission.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
      }
    }

    if (!doc.filePath) {
      return res.status(404).json({ error: 'File not available', code: 'NOT_FOUND' });
    }

    const filePath = path.resolve(env.UPLOAD_DIR, doc.filePath);
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
      return res.status(400).json({ error: 'reviewStatus must be "accepted" or "rejected"', code: 'VALIDATION_ERROR' });
    }

    const doc = await prisma.admissionDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.admissionId !== admissionId) {
      return res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
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
