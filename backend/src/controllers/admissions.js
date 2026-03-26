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
    academicYear: academicYear ? { id: academicYear.id, year: academicYear.year } : null,
    semester: semester ? { id: semester.id, name: semester.name } : null,
  };
}

// GET /api/admissions?status=&grade=&search=&sort=&page=&limit=&academicYearId=&semesterId=
export async function getAdmissions(req, res, next) {
  try {
    const { status, grade, search, sort, page, limit, academicYearId, semesterId } = req.query;
    const pg = paginate(page, limit);

    const where = { deletedAt: null };
    if (status)        where.status = status;
    if (grade)         where.gradeLevel = grade;
    if (academicYearId) where.academicYearId = Number(academicYearId);
    if (semesterId)    where.semesterId = Number(semesterId);
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { middleName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = sort === 'oldest' ? { submittedAt: 'asc' } : { submittedAt: 'desc' };

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
      include: { documents: true },
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
      const [total, grouped] = await Promise.all([
        prisma.admission.count({ where }),
        prisma.admission.groupBy({ by: ['status'], _count: { _all: true }, where }),
      ]);
      const statusMap = Object.fromEntries(grouped.map(g => [g.status, g._count._all]));
      return {
        total,
        submitted:        statusMap['Submitted'] || 0,
        underScreening:   statusMap['Under Screening'] || 0,
        underEvaluation:  statusMap['Under Evaluation'] || 0,
        accepted:         statusMap['Accepted'] || 0,
        rejected:         statusMap['Rejected'] || 0,
      };
    }, 15_000);

    res.json(counts);
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

    // Validate required fields
    if (!firstName || !lastName || !email || !dob || !gender || !address || !gradeLevel || !schoolYear || !guardian || !guardianRelation) {
      return res.status(400).json({ error: 'Missing required fields', code: 'VALIDATION_ERROR' });
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
        guardian, guardianRelation,
        guardianPhone: guardianPhone || null,
        guardianEmail: guardianEmail || null,
        ...(resolvedYearId && { academicYearId: resolvedYearId }),
        ...(resolvedSemesterId && { semesterId: resolvedSemesterId }),
        status: 'Submitted',
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

    const admission = await prisma.admission.findUnique({ where: { id }, include: { documents: true } });
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
      include: { documents: true },
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
        include: { documents: true },
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
        include: { documents: true },
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

    await logAudit(req.user.id, 'document.review', 'AdmissionDocument', docId, {
      admissionId, reviewStatus, reviewNote,
    });

    res.json({ id: updated.id, reviewStatus: updated.reviewStatus, reviewNote: updated.reviewNote, reviewedAt: updated.reviewedAt });
  } catch (err) { next(err); }
}
