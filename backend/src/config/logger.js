import pino from 'pino';
import env from './env.js';

const isProduction = env.NODE_ENV === 'production';

// Structured JSON logger with request context support
const logger = pino({
  level: env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  // In production, output compact JSON; in development, output human-readable format
  transport: isProduction
    ? undefined // Default to JSON in production
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
});

// Error tracking store — memory-only for basic monitoring
// In production, consider integrating with Datadog, New Relic, or CloudWatch
export const errorMetrics = {
  count: 0,
  byCode: {},
  byStatus: {},
  lastError: null,
  reset() {
    this.count = 0;
    this.byCode = {};
    this.byStatus = {};
    this.lastError = null;
  },
  record(err, status) {
    this.count++;
    const code = err.code || 'UNKNOWN';
    const statusKey = String(status || 'unknown');
    this.byCode[code] = (this.byCode[code] || 0) + 1;
    this.byStatus[statusKey] = (this.byStatus[statusKey] || 0) + 1;
    this.lastError = { code, status, message: err.message, timestamp: new Date().toISOString() };
  },
  getMetrics() {
    return {
      totalErrors: this.count,
      byErrorCode: this.byCode,
      byHttpStatus: this.byStatus,
      lastError: this.lastError,
    };
  },
};

export default logger;
