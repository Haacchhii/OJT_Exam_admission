import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import env from '../config/env.js';
import { sendWelcomeEmail, sendVerificationEmail } from '../utils/email.js';
import { passwordSchema } from '../utils/schemas.js';
import { logAudit } from '../utils/auditLog.js';
import { ROLES, BCRYPT_ROUNDS, RESET_TOKEN_EXPIRY, EMAIL_VERIFY_EXPIRY_MS, getLevelGroup } from '../utils/constants.js';
import { isApplicantPeriodOpen, syncApplicantUserStatusById } from '../utils/applicantStatusSync.js';

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
  return jwt.sign({ email, purpose: 'password-reset' }, env.JWT_SECRET, { expiresIn: RESET_TOKEN_EXPIRY });
}

function verifyResetToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (payload.purpose !== 'password-reset') return null;
    return payload;
  } catch { return null; }
}

function safeUser(user) {
  const { passwordHash, emailVerifyToken, emailVerifyExpires, ...rest } = user;
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
    if (req.user && (req.user.applicantProfile !== undefined || req.user.staffProfile !== undefined)) {
      return res.json(req.user);
    }

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
    if (!user || user.deletedAt) {
      logAudit({ action: 'auth.login_failed', entity: 'user', details: { email, reason: 'user_not_found' }, ipAddress: req.ip });
      return res.status(401).json({ error: 'Invalid email or password', code: 'UNAUTHORIZED' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logAudit({ userId: user.id, action: 'auth.login_failed', entity: 'user', entityId: user.id, details: { reason: 'wrong_password' }, ipAddress: req.ip });
      return res.status(401).json({ error: 'Invalid email or password', code: 'UNAUTHORIZED' });
    }

    if (user.role === ROLES.APPLICANT) {
      const syncResult = await syncApplicantUserStatusById(user.id);
      user.status = syncResult.status || user.status;
    }

    if (user.status !== 'Active') {
      logAudit({ userId: user.id, action: 'auth.login_failed', entity: 'user', entityId: user.id, details: { reason: 'inactive_account' }, ipAddress: req.ip });
      return res.status(403).json({ error: 'Account is inactive', code: 'FORBIDDEN' });
    }

    const token = signToken(user);
    logAudit({ userId: user.id, action: 'auth.login', entity: 'user', entityId: user.id, ipAddress: req.ip });
    const response = { user: safeUser(user), token };
    if (user.role === ROLES.APPLICANT && !user.emailVerified) {
      response.emailVerificationRequired = true;
    }
    res.json(response);
  } catch (err) { next(err); }
}

// POST /api/auth/register
export async function register(req, res, next) {
  try {
    const { firstName, middleName, lastName, email, password, gradeLevel } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!firstName || !middleName || !lastName || !email || !password || !gradeLevel) {
      return res.status(400).json({ error: 'All fields are required', code: 'VALIDATION_ERROR' });
    }
    // Email format validation
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format', code: 'VALIDATION_ERROR' });
    }
    // Password strength
    const pwErr = validatePassword(password);
    if (pwErr) {
      return res.status(400).json({ error: pwErr, code: 'VALIDATION_ERROR' });
    }

    // Check duplicate
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      if (!existing.deletedAt && !existing.emailVerified) {
        const verifyToken = crypto.randomBytes(32).toString('hex');
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            emailVerifyToken: verifyToken,
            emailVerifyExpires: new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS),
          },
        });
        sendVerificationEmail({ to: existing.email, firstName: existing.firstName, verifyToken });
        return res.status(200).json({
          ok: true,
          emailVerificationRequired: true,
          msg: 'This email is already registered but not verified. A new verification email has been sent.',
        });
      }
      return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const applicantPeriodOpen = await isApplicantPeriodOpen();
    const user = await prisma.user.create({
      data: {
        firstName, middleName, lastName, email: normalizedEmail, passwordHash,
        role: ROLES.APPLICANT,
        status: applicantPeriodOpen ? 'Active' : 'Inactive',
        emailVerified: false,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS),
      },
    });

    // Auto-create applicant profile with the chosen grade level
    await prisma.applicantProfile.create({ data: { userId: user.id, gradeLevel: gradeLevel || null, levelGroup: gradeLevel ? getLevelGroup(gradeLevel) : null } });

    // Re-fetch with profile included for the response
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { applicantProfile: true },
    });

    // Send verification email
    sendVerificationEmail({ to: user.email, firstName: user.firstName, verifyToken });

    const token = signToken(user);
    logAudit({ userId: user.id, action: 'auth.register', entity: 'user', entityId: user.id, ipAddress: req.ip });
    res.status(201).json({ user: safeUser(fullUser), token, emailVerificationRequired: true });
  } catch (err) { next(err); }
}

// POST /api/auth/verify-email
export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required', code: 'VALIDATION_ERROR' });
    }

    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token, deletedAt: null },
    });
    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token', code: 'VALIDATION_ERROR' });
    }
    if (user.emailVerified) {
      return res.json({ ok: true, message: 'Email is already verified.' });
    }
    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired. Please request a new one.', code: 'TOKEN_EXPIRED' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
    });

    // Send the welcome email now that the email is verified
    sendWelcomeEmail({ to: user.email, firstName: user.firstName });

    logAudit({ userId: user.id, action: 'auth.email_verified', entity: 'user', entityId: user.id });
    res.json({ ok: true, message: 'Email verified successfully!' });
  } catch (err) { next(err); }
}

// POST /api/auth/resend-verification
export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email is required', code: 'VALIDATION_ERROR' });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    // Always return success to prevent email enumeration
    if (!user || user.deletedAt || user.emailVerified) {
      return res.json({ ok: true, message: 'If an unverified account exists with this email, a verification link has been sent.' });
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: verifyToken,
        emailVerifyExpires: new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS),
      },
    });

    sendVerificationEmail({ to: user.email, firstName: user.firstName, verifyToken });

    res.json({ ok: true, message: 'If an unverified account exists with this email, a verification link has been sent.' });
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
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    logAudit({ userId: user.id, action: 'auth.password_reset', entity: 'user', entityId: user.id, ipAddress: req.ip });
    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) { next(err); }
}

// PATCH /api/auth/profile — update authenticated user's profile
export async function updateProfile(req, res, next) {
  try {
    const { firstName, middleName, lastName, currentPassword, newPassword, phone, address } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

    const data = {};
    if (firstName !== undefined) data.firstName = firstName.trim();
    if (middleName !== undefined) data.middleName = middleName.trim();
    if (lastName !== undefined) data.lastName = lastName.trim();
    if (phone !== undefined) data.phone = phone.trim();
    if (address !== undefined) data.address = address.trim();

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
      data.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update', code: 'VALIDATION_ERROR' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      include: { applicantProfile: true, staffProfile: true },
    });

    const changedFields = Object.keys(data).filter(k => k !== 'passwordHash');
    if (data.passwordHash) changedFields.push('password');
    logAudit({ userId, action: 'auth.profile_update', entity: 'user', entityId: userId, details: { fields: changedFields }, ipAddress: req.ip });

    res.json(safeUser(updated));
  } catch (err) { next(err); }
}
