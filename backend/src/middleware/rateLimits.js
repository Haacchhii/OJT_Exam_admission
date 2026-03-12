import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '../utils/constants.js';

/**
 * Write rate limiter — for creation/mutation endpoints that lack
 * a dedicated limiter (admissions create, users CRUD, notifications).
 */
export const writeLimiter = rateLimit({
  windowMs: RATE_LIMITS.WRITE.windowMs,
  max: RATE_LIMITS.WRITE.max,
  message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});
