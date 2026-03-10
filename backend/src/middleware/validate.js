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
