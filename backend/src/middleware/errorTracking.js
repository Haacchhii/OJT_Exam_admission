import logger from '../config/logger.js';

/**
 * Error tracking middleware — records all response statuses and errors.
 * Logs 4xx and 5xx responses for monitoring and alerting.
 */
export function trackErrors(req, res, next) {
  const originalSend = res.send;

  res.send = function send(data) {
    // Determine status
    const status = res.statusCode || 200;

    // Log 4xx and 5xx responses
    if (status >= 400) {
      // Attempt to parse JSON responses
      let errorData;
      try {
        errorData = typeof data === 'string' ? JSON.parse(data) : data;
      } catch {
        errorData = { raw: data };
      }

      const logLevel = status >= 500 ? 'error' : 'warn';
      logger[logLevel](
        {
          method: req.method,
          path: req.originalUrl,
          status,
          errorCode: errorData?.code,
          errorMessage: errorData?.error,
          userAgent: req.get('user-agent'),
          ip: req.ip,
        },
        `[${status}] ${req.method} ${req.originalUrl}`
      );
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Request logging middleware — logs all incoming requests in debug level.
 * Use in development for request tracing.
 */
export function logRequests(req, res, next) {
  logger.debug(
    {
      method: req.method,
      path: req.originalUrl,
      query: req.query,
      ip: req.ip,
    },
    `${req.method} ${req.originalUrl}`
  );
  next();
}
