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
app.use(cors({
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

// ─── Global rate limit (all routes) ──────────────────
const globalLimiter = rateLimit({
  windowMs: RATE_LIMITS.GLOBAL.windowMs,
  max: RATE_LIMITS.GLOBAL.max,
  standardHeaders: true,
  legacyHeaders: false,
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
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admissions',    admissionsRoutes);
app.use('/api/exams',         examsRoutes);
app.use('/api/results',       resultsRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/audit-logs',    auditLogRoutes);
app.use('/api/academic-years', academicYearsRoutes);

// Apply specific rate limiters to sensitive operations
app.use('/api/admissions/bulk-status', bulkOpLimiter);
app.use('/api/admissions/:id/documents', uploadLimiter);
app.use('/api/exams/registrations', examSubmitLimiter);

// Health check (includes DB connectivity)
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', uptime: process.uptime(), db: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', uptime: process.uptime(), db: 'disconnected' });
  }
});

// ─── Serve frontend in production ─────────────────────
// Only serve static frontend if the dist folder exists (monolith deploy).
// When frontend is deployed separately (e.g. Railway), this is skipped.
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── Error handler (must be last) ────────────────────
app.use(errorHandler);

export default app;
