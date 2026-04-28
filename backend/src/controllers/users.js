import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/db.js';
import env from '../config/env.js';
import { paginate, paginatedResponse } from '../utils/pagination.js';
import { logAudit } from '../utils/auditLog.js';
import { ROLES, BCRYPT_ROUNDS, EMAIL_VERIFY_EXPIRY_MS } from '../utils/constants.js';
import { cached, invalidatePrefix } from '../utils/cache.js';
import { sendVerificationEmail } from '../utils/email.js';

const userListSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  address: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  applicantProfile: { select: { gradeLevel: true } },
};

const userDetailSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  address: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
};

async function invalidateUserCaches() {
  await invalidatePrefix('users:list:');
  await invalidatePrefix('users:stats');
  await invalidatePrefix('users:id:');
  await invalidatePrefix('users:email:');
}

function safifyUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

async function issueVerificationEmail(user) {
  if (!env.EMAIL_VERIFICATION_REQUIRED) {
    return { emailVerificationRequired: false, verificationEmailSent: false };
  }

  const verifyToken = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS),
    },
  });

  const verificationDispatch = await sendVerificationEmail({ to: user.email, firstName: user.firstName, verifyToken });
  return {
    emailVerificationRequired: true,
    verificationEmailSent: verificationDispatch.ok,
  };
}

// GET /api/users?search=&role=&status=&page=&limit=
export async function getUsers(req, res, next) {
  try {
    const { search, role, status, gradeLevel, sortBy, page, limit } = req.query;
    const pg = paginate(page ?? 1, limit ?? 50);

    const where = { deletedAt: null };
    if (role)   where.role = role;
    if (status) where.status = status;
    if (gradeLevel) {
      where.applicantProfile = {
        is: {
          gradeLevel,
        },
      };
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { middleName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'name') {
      orderBy = [{ lastName: 'asc' }, { firstName: 'asc' }, { createdAt: 'desc' }];
    } else if (sortBy === 'gradeLevelAsc') {
      orderBy = [{ applicantProfile: { gradeLevel: 'asc' } }, { lastName: 'asc' }, { firstName: 'asc' }];
    } else if (sortBy === 'gradeLevelDesc') {
      orderBy = [{ applicantProfile: { gradeLevel: 'desc' } }, { lastName: 'asc' }, { firstName: 'asc' }];
    }

    const cacheKey = `users:list:${JSON.stringify({
      search: search || null,
      role: role || null,
      status: status || null,
      gradeLevel: gradeLevel || null,
      sortBy: sortBy || 'newest',
      page: pg?.page || 1,
      limit: pg?.limit || null,
    })}`;

    const { users, total } = await cached(cacheKey, async () => {
      const [rows, count] = await Promise.all([
        prisma.user.findMany({
          where,
          ...(pg && { skip: pg.skip, take: pg.take }),
          orderBy,
          select: userListSelect,
        }),
        prisma.user.count({ where }),
      ]);
      return { users: rows, total: count };
    }, 120_000);

    res.json(paginatedResponse(users.map(safifyUser), total, pg));
  } catch (err) { next(err); }
}

// GET /api/users/stats
export async function getUserStats(req, res, next) {
  try {
    const stats = await cached('users:stats', async () => {
      const where = { deletedAt: null };
      const [total, grouped] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.groupBy({
          by: ['role'],
          _count: { _all: true },
          where,
        }),
      ]);

      const byRole = Object.fromEntries(grouped.map((row) => [row.role, row._count._all]));
      return {
        total,
        admins: byRole['administrator'] || 0,
        registrars: byRole['registrar'] || 0,
        teachers: byRole['teacher'] || 0,
        applicants: byRole['applicant'] || 0,
      };
    }, 120_000);

    res.json(stats);
  } catch (err) { next(err); }
}

// GET /api/users/:id
export async function getUser(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const user = await cached(`users:id:${userId}`, async () => {
      return prisma.user.findUnique({ where: { id: userId }, select: userDetailSelect });
    }, 120_000);

    if (!user || user.deletedAt) return res.status(404).json({ error: 'We could not find this user.', code: 'NOT_FOUND' });
    res.json(safifyUser(user));
  } catch (err) { next(err); }
}

// GET /api/users/by-email/:email
export async function getUserByEmail(req, res, next) {
  try {
    const rawEmail = String(req.params.email || '').trim();
    const cacheKeyEmail = rawEmail.toLowerCase();
    const user = await cached(`users:email:${cacheKeyEmail}`, async () => {
      return prisma.user.findFirst({ where: { email: { equals: rawEmail, mode: 'insensitive' } }, select: userDetailSelect });
    }, 120_000);

    if (!user || user.deletedAt) return res.status(404).json({ error: 'We could not find this user.', code: 'NOT_FOUND' });
    res.json(safifyUser(user));
  } catch (err) { next(err); }
}

// POST /api/users
export async function createUser(req, res, next) {
  try {
    const { firstName, middleName, lastName, email, role, status, password } = req.body;
    if (!firstName || !middleName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Please provide first name, middle name, last name, email, and password.', code: 'VALIDATION_ERROR' });
    }

    const normalizedEmail = String(email).trim();
    const existingByEmail = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true, deletedAt: true },
    });

    if (existingByEmail && !existingByEmail.deletedAt) {
      return res.status(409).json({ error: 'Email already in use', code: 'CONFLICT' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = existingByEmail?.deletedAt
      ? await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            firstName,
            middleName,
            lastName,
            email: normalizedEmail,
            passwordHash,
            role: role || ROLES.APPLICANT,
            status: status || 'Active',
            deletedAt: null,
          },
        })
      : await prisma.user.create({
          data: { firstName, middleName, lastName, email: normalizedEmail, passwordHash, role: role || ROLES.APPLICANT, status: status || 'Active' },
        });

    const verification = await issueVerificationEmail(user);
    const responseUser = verification.emailVerificationRequired
      ? await prisma.user.findUnique({ where: { id: user.id }, select: userDetailSelect })
      : user;

    await invalidateUserCaches();

    res.status(201).json({
      ...safifyUser(responseUser),
      ...verification,
      message: verification.emailVerificationRequired
        ? (verification.verificationEmailSent
          ? (existingByEmail?.deletedAt ? 'User account restored and verification email sent.' : 'User created and verification email sent.')
          : (existingByEmail?.deletedAt ? 'User account restored, but the verification email could not be sent right now.' : 'User created, but the verification email could not be sent right now.'))
        : undefined,
    });

    logAudit({ userId: req.user.id, action: existingByEmail?.deletedAt ? 'user.restore' : 'user.create', entity: 'user', entityId: user.id, details: { email: normalizedEmail, role: role || ROLES.APPLICANT }, ipAddress: req.ip });
  } catch (err) { next(err); }
}

// PUT /api/users/:id
export async function updateUser(req, res, next) {
  try {
    const { firstName, middleName, lastName, email, role, status, password } = req.body;
    const id = Number(req.params.id);

    // Only administrators can assign the administrator role
    if (role === ROLES.ADMIN && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Only administrators can assign the administrator role.', code: 'FORBIDDEN' });
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
        const verifyToken = env.EMAIL_VERIFICATION_REQUIRED ? crypto.randomBytes(32).toString('hex') : null;
        if (env.EMAIL_VERIFICATION_REQUIRED) {
          data.emailVerified = false;
          data.emailVerifyToken = verifyToken;
          data.emailVerifyExpires = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS);
        }

        const [, user] = await prisma.$transaction([
          prisma.examRegistration.updateMany({
            where: { userEmail: existing.email },
            data: { userEmail: email },
          }),
          prisma.user.update({ where: { id }, data }),
        ]);

        let verification = { emailVerificationRequired: false, verificationEmailSent: false };
        if (env.EMAIL_VERIFICATION_REQUIRED && verifyToken) {
          const dispatch = await sendVerificationEmail({ to: user.email, firstName: user.firstName, verifyToken });
          verification = { emailVerificationRequired: true, verificationEmailSent: dispatch.ok };
        }

        await invalidateUserCaches();
        return res.json({
          ...safifyUser(user),
          ...verification,
          message: verification.emailVerificationRequired
            ? (verification.verificationEmailSent
              ? 'User updated and verification email sent.'
              : 'User updated, but the verification email could not be sent right now.')
            : undefined,
        });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    await invalidateUserCaches();

    logAudit({ userId: req.user.id, action: 'user.update', entity: 'user', entityId: id, details: { fields: Object.keys(data) }, ipAddress: req.ip });

    res.json(safifyUser(user));
  } catch (err) { next(err); }
}

// DELETE /api/users/:id  — soft delete
export async function deleteUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.', code: 'VALIDATION_ERROR' });
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) return res.status(404).json({ error: 'We could not find this user.', code: 'NOT_FOUND' });

    await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });

    await invalidateUserCaches();

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
      return res.status(400).json({ error: 'No eligible users were selected. You cannot delete your own account.', code: 'VALIDATION_ERROR' });
    }

    const users = await prisma.user.findMany({ where: { id: { in: safeIds }, deletedAt: null } });
    const foundIds = users.map(u => u.id);

    await prisma.user.updateMany({ where: { id: { in: foundIds } }, data: { deletedAt: new Date() } });

    await invalidateUserCaches();

    logAudit({ userId: req.user.id, action: 'user.bulkDelete', entity: 'user', details: { count: users.length, ids: foundIds }, ipAddress: req.ip });

    res.json({ deleted: users.length });
  } catch (err) { next(err); }
}
