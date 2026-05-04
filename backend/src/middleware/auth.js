import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import prisma from '../config/db.js';
import { ROLES } from '../utils/constants.js';
import { syncApplicantUserStatusById } from '../utils/applicantStatusSync.js';
import { cached } from '../utils/cache.js';

/**
 * Verify JWT and attach req.user
 */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  }

  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, env.JWT_SECRET);
    const includeProfiles = req.originalUrl.startsWith('/api/auth/me');
    const needsFreshUser = includeProfiles || payload.mustChangePassword !== false;
    const cacheKey = `user:${payload.sub}:${needsFreshUser ? 'full' : 'base'}`;

    let user = null;
    if (!needsFreshUser && payload.role && payload.status && payload.tokenVersion !== undefined) {
      // For non-/auth/me routes, trust JWT claims to avoid DB round-trips on every request.
      // However, we still need to verify tokenVersion from DB on some requests.
      user = {
        id: payload.sub,
        role: payload.role,
        status: payload.status,
        emailVerified: payload.emailVerified ?? true,
        mustChangePassword: payload.mustChangePassword ?? false,
        tokenVersion: payload.tokenVersion,
      };
    } else {
      user = await cached(cacheKey, async () => {
        return prisma.user.findUnique({
          where: { id: payload.sub },
          ...(includeProfiles
            ? { include: { applicantProfile: true, staffProfile: true } }
            : { select: { id: true, role: true, status: true, emailVerified: true, mustChangePassword: true, tokenVersion: true, deletedAt: true } }),
        });
      }, 300_000);
    }

    // Verify tokenVersion matches (ensures tokens are revoked when role/status changes)
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ error: 'Token has been revoked - please login again', code: 'TOKEN_REVOKED' });
    }

    if (user?.role === ROLES.APPLICANT) {
      void cached(`applicant-status:${user.id}`, async () => {
        const syncResult = await syncApplicantUserStatusById(user.id);
        return syncResult.status || user.status;
      }, env.APPLICANT_STATUS_SYNC_TTL_MS)
        .then((syncedStatus) => {
          if (syncedStatus) user.status = syncedStatus;
        })
        .catch((err) => {
          console.error('[Auth] Background status sync failed:', err.message);
        });
    }

    if (!user || user.deletedAt || user.status !== 'Active') {
      return res.status(401).json({ error: 'User not found or inactive', code: 'UNAUTHORIZED' });
    }

    if (user.mustChangePassword) {
      const allowedPaths = ['/api/auth/me', '/api/auth/profile'];
      if (!allowedPaths.some(p => req.originalUrl.startsWith(p))) {
        return res.status(403).json({ error: 'You must change your temporary password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
      }
    }

    // Any unverified account must verify before accessing protected routes.
    // Allow /auth/me and /auth/profile so the frontend can check verification status.
    if (env.EMAIL_VERIFICATION_REQUIRED && !user.emailVerified) {
      const allowedPaths = ['/api/auth/me', '/api/auth/profile'];
      if (!allowedPaths.some(p => req.originalUrl.startsWith(p))) {
        return res.status(403).json({ error: 'Please verify your email address before continuing.', code: 'EMAIL_NOT_VERIFIED' });
      }
    }

    // Attach user (without password) to request
    const { passwordHash, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
}
