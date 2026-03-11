import { ZodError } from 'zod';

/**
 * Express middleware factory: validates req.body against a Zod schema.
 * Usage: router.post('/', validate(mySchema), controller)
 */
export function validate(schema) {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        const error = new Error(message);
        error.status = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }
      next(err);
    }
  };
}

/**
 * Express middleware factory: validates req.query against a Zod schema.
 * Invalid/unknown params are stripped; valid ones are coerced to proper types.
 * In Express 5 req.query is a read-only getter on the prototype, so we shadow
 * it on the instance with Object.defineProperty.
 * Usage: router.get('/', validateQuery(myQuerySchema), controller)
 */
export function validateQuery(schema) {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse(req.query);
      Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        const error = new Error(message);
        error.status = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }
      next(err);
    }
  };
}
