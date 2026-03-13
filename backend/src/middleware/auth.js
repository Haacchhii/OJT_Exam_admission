import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import prisma from '../config/db.js';
import { ROLES } from '../utils/constants.js';

const userCache = new Map();

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
    if (req.method === 'GET' || req.method === 'HEAD') {
      user = getCachedUser(cacheKey);
    }

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: payload.sub },
        ...(includeProfiles && { include: { applicantProfile: true, staffProfile: true } }),
      });
      if (user && (req.method === 'GET' || req.method === 'HEAD')) {
        setCachedUser(cacheKey, user);
      }
    }

    if (!user || user.status !== 'Active') {
      return res.status(401).json({ error: 'User not found or inactive', code: 'UNAUTHORIZED' });
    }

    // Applicants must verify their email before accessing protected routes
    // Allow /auth/me and /auth/profile so the frontend can check verification status
    if (env.EMAIL_VERIFICATION_REQUIRED && user.role === ROLES.APPLICANT && !user.emailVerified) {
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
