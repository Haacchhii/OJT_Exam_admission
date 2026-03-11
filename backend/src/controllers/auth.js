import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import env from '../config/env.js';
import { sendWelcomeEmail } from '../utils/email.js';
import { passwordSchema } from '../utils/schemas.js';

// ─── Password complexity (single source of truth: passwordSchema in schemas.js) ──
function validatePassword(password) {
  const result = passwordSchema.safeParse(password);
  if (!result.success) return result.error.issues[0].message;
  return null;
}


function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

function signResetToken(email) {
  return jwt.sign({ email, purpose: 'password-reset' }, env.JWT_SECRET, { expiresIn: '15m' });
}

function verifyResetToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (payload.purpose !== 'password-reset') return null;
    return payload;
  } catch { return null; }
}

function safeUser(user) {
  const { passwordHash, ...rest } = user;
  // Flatten applicantProfile into the user object for frontend convenience
  if (rest.applicantProfile) {
    rest.applicantProfile = { ...rest.applicantProfile };
    delete rest.applicantProfile.id;
    delete rest.applicantProfile.userId;
  }
  return rest;
}

// GET /api/auth/me — return authenticated user's profile
export async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { applicantProfile: true, staffProfile: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    res.json(safeUser(user));
  } catch (err) { next(err); }
}

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required', code: 'VALIDATION_ERROR' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { applicantProfile: true, staffProfile: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password', code: 'UNAUTHORIZED' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password', code: 'UNAUTHORIZED' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Account is inactive', code: 'FORBIDDEN' });
    }

    const token = signToken(user);
    res.json({ user: safeUser(user), token });
  } catch (err) { next(err); }
}

// POST /api/auth/register
export async function register(req, res, next) {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required', code: 'VALIDATION_ERROR' });
    }
    // Email format validation
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format', code: 'VALIDATION_ERROR' });
    }
    // Password strength
    const pwErr = validatePassword(password);
    if (pwErr) {
      return res.status(400).json({ error: pwErr, code: 'VALIDATION_ERROR' });
    }

    // Check duplicate
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { firstName, lastName, email, passwordHash, role: 'applicant', status: 'Active' },
    });

    // Auto-create an empty applicant profile so it exists for later updates
    await prisma.applicantProfile.create({ data: { userId: user.id } });

    // Re-fetch with profile included for the response
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { applicantProfile: true },
    });

    // Fire-and-forget welcome email
    sendWelcomeEmail({ to: user.email, firstName: user.firstName });

    const token = signToken(user);
    res.status(201).json({ user: safeUser(fullUser), token });
  } catch (err) { next(err); }
}

// POST /api/auth/forgot-password
// Generates a signed reset token. In production, this would be emailed.
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required', code: 'VALIDATION_ERROR' });
    }
    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return same response shape even if user doesn't exist
      return res.json({ ok: true, message: 'If an account exists with this email, a reset link has been sent.' });
    }
    // Generate a signed JWT reset token (15 min expiry)
    const resetToken = signResetToken(email);
    // In production: send this token via email. For now return it directly.
    res.json({ ok: true, resetToken, message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (err) { next(err); }
}

// POST /api/auth/reset-password
// Accepts { resetToken, password } and updates the user's password after verifying the token.
export async function resetPassword(req, res, next) {
  try {
    const { resetToken, password } = req.body;
    if (!resetToken || !password) {
      return res.status(400).json({ error: 'Reset token and new password are required', code: 'VALIDATION_ERROR' });
    }
    const pwErr = validatePassword(password);
    if (pwErr) {
      return res.status(400).json({ error: pwErr, code: 'VALIDATION_ERROR' });
    }
    // Verify the signed reset token
    const payload = verifyResetToken(resetToken);
    if (!payload) {
      return res.status(400).json({ error: 'Invalid or expired reset token', code: 'VALIDATION_ERROR' });
    }
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) { next(err); }
}

// PATCH /api/auth/profile — update authenticated user's profile
export async function updateProfile(req, res, next) {
  try {
    const { firstName, lastName, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

    const data = {};
    if (firstName !== undefined) data.firstName = firstName.trim();
    if (lastName !== undefined) data.lastName = lastName.trim();

    // Password change requires current password verification
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password', code: 'VALIDATION_ERROR' });
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(400).json({ error: 'Current password is incorrect', code: 'VALIDATION_ERROR' });
      }
      const pwErr = validatePassword(newPassword);
      if (pwErr) {
        return res.status(400).json({ error: pwErr, code: 'VALIDATION_ERROR' });
      }
      data.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update', code: 'VALIDATION_ERROR' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      include: { applicantProfile: true, staffProfile: true },
    });

    res.json(safeUser(updated));
  } catch (err) { next(err); }
}
