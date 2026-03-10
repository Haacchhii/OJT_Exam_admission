import 'dotenv/config';

const env = {
  PORT:             parseInt(process.env.PORT, 10) || 3000,
  DATABASE_URL:     process.env.DATABASE_URL,
  JWT_SECRET:       process.env.JWT_SECRET || 'dev-secret',
  JWT_EXPIRES_IN:   process.env.JWT_EXPIRES_IN || '7d',
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
  APP_URL:          process.env.APP_URL || 'http://localhost:5173',
};

// ─── Validate critical env vars ───────────────────────
if (!env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set');
  process.exit(1);
}
if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET === 'dev-secret') {
    console.error('FATAL: JWT_SECRET must be set in production');
    process.exit(1);
  }
  if (env.CORS_ORIGIN.includes('localhost')) {
    console.warn('WARNING: CORS_ORIGIN contains "localhost" in production — set it to your deployed URL');
  }
}

export default env;
