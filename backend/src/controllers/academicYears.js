import prisma from '../config/db.js';
import { logAudit } from '../utils/auditLog.js';

// ──────────────────────────────────────────────────────
// ACADEMIC YEARS
// ──────────────────────────────────────────────────────

// GET /api/academic-years
export async function getAcademicYears(_req, res, next) {
  try {
    const years = await prisma.academicYear.findMany({
      orderBy: { year: 'desc' },
      include: {
        semesters: { orderBy: { id: 'asc' } },
        _count: { select: { admissions: true, exams: true } },
      },
    });
    res.json(years);
  } catch (err) { next(err); }
}

// GET /api/academic-years/active
export async function getActiveAcademicYear(_req, res, next) {
  try {
    const year = await prisma.academicYear.findFirst({
      where: { isActive: true },
      include: { semesters: { orderBy: { id: 'asc' } } },
    });
    res.json(year || null);
  } catch (err) { next(err); }
}

// POST /api/academic-years
export async function createAcademicYear(req, res, next) {
  try {
    const { year, isActive, startDate, endDate } = req.body;
    if (!year) return res.status(400).json({ error: 'Year is required (e.g. 2026-2027)', code: 'VALIDATION_ERROR' });

    // Validate year format
    if (!/^\d{4}-\d{4}$/.test(year)) {
      return res.status(400).json({ error: 'Year must be in format YYYY-YYYY (e.g. 2026-2027)', code: 'VALIDATION_ERROR' });
    }

    // If setting as active, deactivate others
    if (isActive) await prisma.academicYear.updateMany({ data: { isActive: false } });

    const created = await prisma.academicYear.create({
      data: {
        year,
        isActive: isActive ?? false,
        startDate: startDate ? new Date(startDate) : null,
        endDate:   endDate   ? new Date(endDate)   : null,
      },
      include: { semesters: true },
    });

    await logAudit(req, 'academic_year.create', 'academic_year', created.id, { year });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A school year with that name already exists', code: 'CONFLICT' });
    next(err);
  }
}

// PUT /api/academic-years/:id
export async function updateAcademicYear(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { year, isActive, startDate, endDate } = req.body;

    if (year && !/^\d{4}-\d{4}$/.test(year)) {
      return res.status(400).json({ error: 'Year must be in format YYYY-YYYY', code: 'VALIDATION_ERROR' });
    }

    // If activating, deactivate others first
    if (isActive) await prisma.academicYear.updateMany({ where: { id: { not: id } }, data: { isActive: false } });

    const updated = await prisma.academicYear.update({
      where: { id },
      data: {
        ...(year      !== undefined && { year }),
        ...(isActive  !== undefined && { isActive }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate   !== undefined && { endDate:   endDate   ? new Date(endDate)   : null }),
      },
      include: { semesters: true },
    });

    await logAudit(req, 'academic_year.update', 'academic_year', id, { year });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Academic year not found', code: 'NOT_FOUND' });
    next(err);
  }
}

// DELETE /api/academic-years/:id
export async function deleteAcademicYear(req, res, next) {
  try {
    const id = Number(req.params.id);
    await prisma.academicYear.delete({ where: { id } });
    await logAudit(req, 'academic_year.delete', 'academic_year', id);
    res.json({ message: 'Academic year deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Academic year not found', code: 'NOT_FOUND' });
    next(err);
  }
}

// ──────────────────────────────────────────────────────
// SEMESTERS / PERIODS
// ──────────────────────────────────────────────────────

// GET /api/academic-years/semesters  (all semesters, optionally filtered by yearId)
export async function getSemesters(req, res, next) {
  try {
    const { yearId } = req.query;
    const semesters = await prisma.semester.findMany({
      where: yearId ? { academicYearId: Number(yearId) } : undefined,
      orderBy: [{ academicYearId: 'desc' }, { id: 'asc' }],
      include: { academicYear: { select: { year: true } } },
    });
    res.json(semesters);
  } catch (err) { next(err); }
}

// POST /api/academic-years/semesters
export async function createSemester(req, res, next) {
  try {
    const { name, academicYearId, isActive, startDate, endDate } = req.body;
    if (!name || !academicYearId) {
      return res.status(400).json({ error: 'name and academicYearId are required', code: 'VALIDATION_ERROR' });
    }

    // If setting as active, deactivate other semesters in the same year
    if (isActive) {
      await prisma.semester.updateMany({ where: { academicYearId: Number(academicYearId) }, data: { isActive: false } });
    }

    const created = await prisma.semester.create({
      data: {
        name,
        academicYearId: Number(academicYearId),
        isActive: isActive ?? false,
        startDate: startDate ? new Date(startDate) : null,
        endDate:   endDate   ? new Date(endDate)   : null,
      },
      include: { academicYear: { select: { year: true } } },
    });

    await logAudit(req, 'semester.create', 'semester', created.id, { name, academicYearId });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A semester with that name already exists for this school year', code: 'CONFLICT' });
    next(err);
  }
}

// PUT /api/academic-years/semesters/:id
export async function updateSemester(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { name, isActive, startDate, endDate } = req.body;

    // If activating, deactivate siblings first
    if (isActive) {
      const sem = await prisma.semester.findUnique({ where: { id } });
      if (sem) await prisma.semester.updateMany({ where: { academicYearId: sem.academicYearId, id: { not: id } }, data: { isActive: false } });
    }

    const updated = await prisma.semester.update({
      where: { id },
      data: {
        ...(name      !== undefined && { name }),
        ...(isActive  !== undefined && { isActive }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate   !== undefined && { endDate:   endDate   ? new Date(endDate)   : null }),
      },
      include: { academicYear: { select: { year: true } } },
    });

    await logAudit(req, 'semester.update', 'semester', id, { name });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Semester not found', code: 'NOT_FOUND' });
    next(err);
  }
}

// DELETE /api/academic-years/semesters/:id
export async function deleteSemester(req, res, next) {
  try {
    const id = Number(req.params.id);
    await prisma.semester.delete({ where: { id } });
    await logAudit(req, 'semester.delete', 'semester', id);
    res.json({ message: 'Semester deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Semester not found', code: 'NOT_FOUND' });
    next(err);
  }
}
