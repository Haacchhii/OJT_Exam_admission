import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import prisma from './config/db.js';
import { errorHandler } from './middleware/errors.js';
import { authenticate } from './middleware/auth.js';
import { RATE_LIMITS, BODY_SIZE_LIMIT } from './utils/constants.js';
import { clientCount } from './utils/sse.js';
import { cachePublic, cachePrivate, noStore } from './middleware/cache.js';

// Route imports
import authRoutes          from './routes/auth.js';
import admissionsRoutes    from './routes/admissions.js';
import examsRoutes         from './routes/exams.js';
import resultsRoutes       from './routes/results.js';
import usersRoutes         from './routes/users.js';
import notificationsRoutes from './routes/notifications.js';
import auditLogRoutes      from './routes/auditLog.js';
import academicYearsRoutes from './routes/academicYears.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Trust proxy when behind a reverse proxy (Render, Railway, Nginx, etc.)
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ─── Security middleware ──────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ─── Compression ─────────────────────────────────────
app.use(compression());

// ─── Global middleware ────────────────────────────────
// Support comma-separated CORS origins (e.g. "https://frontend.up.railway.app,http://localhost:5174")
const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
const corsConfig = {
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: env.CORS_MAX_AGE_SECONDS,
  optionsSuccessStatus: 204,
};
app.use(cors(corsConfig));
app.options('/{*path}', cors(corsConfig));

app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

// Lightweight API timing log to track endpoint p95 improvements.
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    if (!req.originalUrl.startsWith('/api/')) return;
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (elapsedMs >= env.PERF_LOG_THRESHOLD_MS) {
      console.log(`[perf] ${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(1)}ms`);
    }
  });
  next();
});

// ─── Global rate limit (all routes) ──────────────────
const globalLimiter = rateLimit({
  windowMs: RATE_LIMITS.GLOBAL.windowMs,
  max: RATE_LIMITS.GLOBAL.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMIT' },
});
app.use(globalLimiter);

// ─── Stricter rate limiting on auth routes ────────────
const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs,
  max: RATE_LIMITS.AUTH.max,
  message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Rate limiters for sensitive operations ───────────
const uploadLimiter = rateLimit({
  windowMs: RATE_LIMITS.UPLOAD.windowMs,
  max: RATE_LIMITS.UPLOAD.max,
  message: { error: 'Too many uploads, please try again later.', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});

const examSubmitLimiter = rateLimit({
  windowMs: RATE_LIMITS.EXAM_SUBMIT.windowMs,
  max: RATE_LIMITS.EXAM_SUBMIT.max,
  message: { error: 'Too many exam submissions, please try again later.', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});

const bulkOpLimiter = rateLimit({
  windowMs: RATE_LIMITS.BULK.windowMs,
  max: RATE_LIMITS.BULK.max,
  message: { error: 'Too many bulk operations, please try again later.', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve uploaded files — require authentication
app.use('/uploads', authenticate, express.static(path.resolve(env.UPLOAD_DIR)));

// ─── API routes ───────────────────────────────────────
app.use('/api/auth', authLimiter, noStore, authRoutes);
app.use('/api/admissions',    cachePrivate, admissionsRoutes);
app.use('/api/exams',         cachePrivate, examsRoutes);
app.use('/api/results',       cachePrivate, resultsRoutes);
app.use('/api/users',         cachePrivate, usersRoutes);
app.use('/api/notifications', cachePrivate, notificationsRoutes);
app.use('/api/audit-logs',    cachePrivate, auditLogRoutes);
app.use('/api/academic-years', cachePublic, academicYearsRoutes);

// Apply specific rate limiters to sensitive operations
app.use('/api/admissions/bulk-status', bulkOpLimiter);
app.use('/api/admissions/:id/documents', uploadLimiter);
app.use('/api/exams/registrations', examSubmitLimiter);

// Health check (includes DB connectivity)
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', uptime: process.uptime(), db: 'connected', sseClients: clientCount() });
  } catch {
    res.status(503).json({ status: 'degraded', uptime: process.uptime(), db: 'disconnected' });
  }
});

// ─── Serve frontend in production ─────────────────────
// Only serve static frontend if the dist folder exists (monolith deploy).
// When frontend is deployed separately (e.g. Railway), this is skipped.
// Uses frontend-ts (TypeScript) — frontend/ is deprecated.
const frontendDist = path.resolve(__dirname, '../../frontend-ts/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── Error handler (must be last) ────────────────────
app.use(errorHandler);

export default app;
