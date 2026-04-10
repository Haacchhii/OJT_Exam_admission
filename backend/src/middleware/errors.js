/**
 * Global error handler — must be the last middleware.
 */
export function errorHandler(err, _req, res, _next) {
  console.error('[ERROR]', err.message || err);

  const supportHint = 'If this keeps happening, please contact the developers or support team.';

  // Zod / validation errors (thrown via validate middleware)
  if (err.code === 'VALIDATION_ERROR' && err.status === 400) {
    return res.status(400).json({
      error: err.message || 'Please review the highlighted details and try again.',
      code: 'VALIDATION_ERROR',
    });
  }

  // Multer file-size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'This file is too large. Please upload a smaller file and try again.',
      code: 'VALIDATION_ERROR',
    });
  }

  // Multer file-type error
  if (err.message?.includes('not allowed')) {
    return res.status(400).json({
      error: err.message || 'This file type is not supported. Please upload a valid file format.',
      code: 'VALIDATION_ERROR',
    });
  }

  // Prisma unique constraint
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field';
    return res.status(409).json({
      error: `This ${field} is already in use. Please use a different value.`,
      code: 'CONFLICT',
    });
  }

  // Prisma not-found
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'The requested record could not be found. It may have been moved or deleted.',
      code: 'NOT_FOUND',
    });
  }

  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const baseMessage = isProduction && status === 500
    ? 'Something went wrong on our side. Please try again in a moment.'
    : (err.message || 'Internal server error');
  const message = status >= 500 ? `${baseMessage} ${supportHint}` : baseMessage;

  res.status(status).json({
    error: message,
    code: err.code || 'INTERNAL_ERROR',
  });
}
