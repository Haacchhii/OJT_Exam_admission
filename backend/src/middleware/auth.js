import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import prisma from '../config/db.js';
import { ROLES } from '../utils/constants.js';
import { syncApplicantUserStatusById } from '../utils/applicantStatusSync.js';

const userCache = new Map();
const applicantSyncCache = new Map();
const applicantSyncInflight = new Map();

function getCachedUser(cacheKey) {
  const cached = userCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    userCache.delete(cacheKey);
    return null;
  }
  return cached.user;
}

function setCachedUser(cacheKey, user) {
  if (env.AUTH_USER_CACHE_TTL_MS <= 0) return;
  if (userCache.size > 1000) userCache.clear();
  userCache.set(cacheKey, {
    user,
    expiresAt: Date.now() + env.AUTH_USER_CACHE_TTL_MS,
  });
}

function getCachedApplicantSyncStatus(userId) {
  if (env.APPLICANT_STATUS_SYNC_TTL_MS <= 0) return null;
  const cached = applicantSyncCache.get(userId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    applicantSyncCache.delete(userId);
    return null;
  }
  return cached.status;
}

function setCachedApplicantSyncStatus(userId, status) {
  if (env.APPLICANT_STATUS_SYNC_TTL_MS <= 0 || !status) return;
  if (applicantSyncCache.size > 2000) applicantSyncCache.clear();
  applicantSyncCache.set(userId, {
    status,
    expiresAt: Date.now() + env.APPLICANT_STATUS_SYNC_TTL_MS,
  });
}

async function getSyncedApplicantStatus(user) {
  const cachedStatus = getCachedApplicantSyncStatus(user.id);
  if (cachedStatus) return cachedStatus;

  const pending = applicantSyncInflight.get(user.id);
  if (pending) return pending;

  const syncPromise = (async () => {
    const syncResult = await syncApplicantUserStatusById(user.id);
    const nextStatus = syncResult.status || user.status;
    setCachedApplicantSyncStatus(user.id, nextStatus);
    return nextStatus;
  })();

  applicantSyncInflight.set(user.id, syncPromise);
  try {
    return await syncPromise;
  } finally {
    applicantSyncInflight.delete(user.id);
  }
}

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
    const cacheKey = `${payload.sub}:${includeProfiles ? 'full' : 'base'}`;

    let user = null;
    if (!includeProfiles && payload.role && payload.status) {
      // For non-/auth/me routes, trust JWT claims to avoid DB round-trips on every request.
      user = {
        id: payload.sub,
        role: payload.role,
        status: payload.status,
        emailVerified: payload.emailVerified ?? true,
      };
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      user = getCachedUser(cacheKey);
    }

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: payload.sub },
        ...(includeProfiles
          ? { include: { applicantProfile: true, staffProfile: true } }
          : { select: { id: true, role: true, status: true, emailVerified: true, deletedAt: true } }),
      });
      if (user && (req.method === 'GET' || req.method === 'HEAD')) {
        setCachedUser(cacheKey, user);
      }
    }

    if (user?.role === ROLES.APPLICANT) {
      const cachedStatus = getCachedApplicantSyncStatus(user.id);
      if (cachedStatus) {
        user.status = cachedStatus;
      } else {
        // Run sync in the background so auth/me is not blocked by sequential DB queries.
        getSyncedApplicantStatus(user)
          .then((status) => {
            if (status) user.status = status;
          })
          .catch((err) => {
            console.error('[Auth] Background status sync failed:', err.message);
          });
      }
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
