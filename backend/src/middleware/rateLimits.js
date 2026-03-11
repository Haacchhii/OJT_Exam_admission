import rateLimit from 'express-rate-limit';

/**
 * Write rate limiter — for creation/mutation endpoints that lack
 * a dedicated limiter (admissions create, users CRUD, notifications).
 * 30 requests per 15 minutes per IP.
 */
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});
