/**
 * Global error handler — must be the last middleware.
 */
export function errorHandler(err, _req, res, _next) {
  console.error('[ERROR]', err.message || err);

  // Multer file-size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large', code: 'VALIDATION_ERROR' });
  }

  // Multer file-type error
  if (err.message?.includes('not allowed')) {
    return res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' });
  }

  // Prisma unique constraint
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field';
    return res.status(409).json({ error: `Duplicate value for ${field}`, code: 'CONFLICT' });
  }

  // Prisma not-found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });
  }

  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(status).json({
    error: isProduction && status === 500 ? 'Internal server error' : (err.message || 'Internal server error'),
    code: err.code || 'INTERNAL_ERROR',
  });
}
