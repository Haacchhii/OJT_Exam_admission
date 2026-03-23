import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { logAudit } from '../utils/auditLog.js';
import { ROLES, BCRYPT_ROUNDS } from '../utils/constants.js';

function safifyUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

// GET /api/users?search=&role=&status=&page=&limit=
export async function getUsers(req, res, next) {
  try {
    const { search, role, status, page, limit } = req.query;
    const pg = paginate(page, limit);

    const where = { deletedAt: null };
    if (role)   where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { middleName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, ...(pg && { skip: pg.skip, take: pg.take }), orderBy: { createdAt: 'desc' }, include: { applicantProfile: { select: { gradeLevel: true } } } }),
      prisma.user.count({ where }),
    ]);

    res.json(paginatedResponse(users.map(safifyUser), total, pg));
  } catch (err) { next(err); }
}

// GET /api/users/:id
export async function getUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
    if (!user || user.deletedAt) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    res.json(safifyUser(user));
  } catch (err) { next(err); }
}

// GET /api/users/by-email/:email
export async function getUserByEmail(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.params.email } });
    if (!user || user.deletedAt) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    res.json(safifyUser(user));
  } catch (err) { next(err); }
}

// POST /api/users
export async function createUser(req, res, next) {
  try {
    const { firstName, middleName, lastName, email, role, status, password } = req.body;
    if (!firstName || !middleName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'firstName, middleName, lastName, email, and password are required', code: 'VALIDATION_ERROR' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { firstName, middleName, lastName, email, passwordHash, role: role || ROLES.APPLICANT, status: status || 'Active' },
    });

    res.status(201).json(safifyUser(user));

    logAudit({ userId: req.user.id, action: 'user.create', entity: 'user', entityId: user.id, details: { email, role: role || ROLES.APPLICANT }, ipAddress: req.ip });
  } catch (err) { next(err); }
}

// PUT /api/users/:id
export async function updateUser(req, res, next) {
  try {
    const { firstName, middleName, lastName, email, role, status, password } = req.body;
    const id = Number(req.params.id);

    // Only administrators can assign the administrator role
    if (role === ROLES.ADMIN && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Only administrators can assign the administrator role', code: 'FORBIDDEN' });
    }

    const data = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (middleName !== undefined) data.middleName = middleName;
    if (lastName  !== undefined) data.lastName  = lastName;
    if (email     !== undefined) data.email     = email;
    if (role      !== undefined) data.role      = role;
    if (status    !== undefined) data.status    = status;
    if (password) data.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // If email is changing, also update ExamRegistration.userEmail to keep the link intact
    if (email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { id }, select: { email: true } });
      if (existing && existing.email !== email) {
        const [, user] = await prisma.$transaction([
          prisma.examRegistration.updateMany({
            where: { userEmail: existing.email },
            data: { userEmail: email },
          }),
          prisma.user.update({ where: { id }, data }),
        ]);
        return res.json(safifyUser(user));
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    logAudit({ userId: req.user.id, action: 'user.update', entity: 'user', entityId: id, details: { fields: Object.keys(data) }, ipAddress: req.ip });

    res.json(safifyUser(user));
  } catch (err) { next(err); }
}

// DELETE /api/users/:id  — soft delete
export async function deleteUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

    await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });

    logAudit({ userId: req.user.id, action: 'user.delete', entity: 'user', entityId: id, details: { email: user.email, role: user.role }, ipAddress: req.ip });

    res.status(204).end();
  } catch (err) { next(err); }
}

// POST /api/users/bulk-delete
export async function bulkDeleteUsers(req, res, next) {
  try {
    const { ids } = req.body;
    // Prevent self-deletion
    const safeIds = ids.filter(id => id !== req.user.id);
    if (safeIds.length === 0) {
      return res.status(400).json({ error: 'No valid users to delete (you cannot delete yourself).', code: 'VALIDATION_ERROR' });
    }

    const users = await prisma.user.findMany({ where: { id: { in: safeIds }, deletedAt: null } });
    const foundIds = users.map(u => u.id);

    await prisma.user.updateMany({ where: { id: { in: foundIds } }, data: { deletedAt: new Date() } });

    logAudit({ userId: req.user.id, action: 'user.bulkDelete', entity: 'user', details: { count: users.length, ids: foundIds }, ipAddress: req.ip });

    res.json({ deleted: users.length });
  } catch (err) { next(err); }
}
