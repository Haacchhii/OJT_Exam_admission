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
    const cacheKey = `user:${payload.sub}:${includeProfiles ? 'full' : 'base'}`;

    let user = null;
    if (!includeProfiles && payload.role && payload.status) {
      // For non-/auth/me routes, trust JWT claims to avoid DB round-trips on every request.
      user = {
        id: payload.sub,
        role: payload.role,
        status: payload.status,
        emailVerified: payload.emailVerified ?? true,
      };
    } else {
      user = await cached(cacheKey, async () => {
        return prisma.user.findUnique({
          where: { id: payload.sub },
          ...(includeProfiles
            ? { include: { applicantProfile: true, staffProfile: true } }
            : { select: { id: true, role: true, status: true, emailVerified: true, deletedAt: true } }),
        });
      }, env.AUTH_USER_CACHE_TTL_MS);
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
