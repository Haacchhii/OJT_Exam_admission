import 'dotenv/config';

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function isLocalUrl(url) {
  return /localhost|127\.0\.0\.1/i.test(String(url || ''));
}

function deriveAppUrl() {
  const explicit = normalizeUrl(process.env.APP_URL);
  if (explicit) return explicit;

  const corsOrigins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => normalizeUrl(origin))
    .filter(Boolean);

  const nonLocalOrigin = corsOrigins.find((origin) => !isLocalUrl(origin));
  if (nonLocalOrigin) return nonLocalOrigin;

  return 'http://localhost:5173';
}

const env = {
  PORT:             parseInt(process.env.PORT, 10) || 3000,
  DATABASE_URL:     process.env.DATABASE_URL,
  DIRECT_URL:       process.env.DIRECT_URL,
  JWT_SECRET:       process.env.JWT_SECRET || 'dev-secret',
  JWT_EXPIRES_IN:   process.env.JWT_EXPIRES_IN || '60m',
  CORS_ORIGIN:      process.env.CORS_ORIGIN || 'http://localhost:5173',
  UPLOAD_DIR:       process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,
  NODE_ENV:         process.env.NODE_ENV || 'development',
  // Email (SMTP) — optional; if not set, emails are logged to console in dev
  SMTP_HOST:        process.env.SMTP_HOST || '',
  SMTP_PORT:        parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER:        process.env.SMTP_USER || '',
  SMTP_PASS:        process.env.SMTP_PASS || '',
  SMTP_FROM:        process.env.SMTP_FROM || '',
  // Public URL of the frontend (used in email links)
  APP_URL:          deriveAppUrl(),
  // Toggle whether applicants must verify email before accessing protected routes
  EMAIL_VERIFICATION_REQUIRED: (process.env.EMAIL_VERIFICATION_REQUIRED || 'true').toLowerCase() === 'true',
  CORS_MAX_AGE_SECONDS: parseInt(process.env.CORS_MAX_AGE_SECONDS, 10) || 86400,
  PERF_LOG_THRESHOLD_MS: parseInt(process.env.PERF_LOG_THRESHOLD_MS, 10) || 200,
  AUTH_USER_CACHE_TTL_MS: parseInt(process.env.AUTH_USER_CACHE_TTL_MS, 10) || 5000,
  DB_SLOW_QUERY_MS: parseInt(process.env.DB_SLOW_QUERY_MS, 10) || 200,
  PRISMA_LOG_QUERIES: (process.env.PRISMA_LOG_QUERIES || 'false').toLowerCase() === 'true',
  PERF_INGEST_ENABLED: (process.env.PERF_INGEST_ENABLED || 'true').toLowerCase() === 'true',
  PERF_MONITOR_KEY: String(process.env.PERF_MONITOR_KEY || '').trim(),
  ENABLE_REDIS_CACHE: (process.env.ENABLE_REDIS_CACHE || 'false').toLowerCase() === 'true',
  REDIS_URL: String(process.env.REDIS_URL || '').trim(),
  REDIS_CONNECT_TIMEOUT_MS: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS, 10) || 1500,
  DASHBOARD_ROLE_AWARE_QUERIES: (process.env.DASHBOARD_ROLE_AWARE_QUERIES || 'true').toLowerCase() === 'true',
  EXAM_GRACE_MINUTES: Math.max(0, parseInt(process.env.EXAM_GRACE_MINUTES, 10) || 1),
};

// ─── Validate critical env vars ───────────────────────
if (!env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set');
  process.exit(1);
}
if (env.NODE_ENV === 'production') {
  if (!env.DIRECT_URL) {
    console.error('FATAL: DIRECT_URL is required in production');
    process.exit(1);
  }
  if (env.JWT_SECRET === 'dev-secret') {
    console.error('FATAL: JWT_SECRET must be set in production');
    process.exit(1);
  }
  if (env.JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
  if (env.CORS_ORIGIN.includes('localhost')) {
    console.warn('WARNING: CORS_ORIGIN contains "localhost" in production — set it to your deployed URL');
  }
  if (isLocalUrl(env.APP_URL)) {
    console.warn('WARNING: APP_URL resolves to localhost in production — email links will be invalid. Set APP_URL to your deployed frontend URL.');
  }
  if (env.ENABLE_REDIS_CACHE && !env.REDIS_URL) {
    console.warn('WARNING: ENABLE_REDIS_CACHE is true but REDIS_URL is empty. Falling back to in-memory cache.');
  }
} else {
  if (env.JWT_SECRET === 'dev-secret') {
    console.warn('WARNING: Using default JWT_SECRET — set a strong secret via JWT_SECRET env var');
  }
}

export default env;
