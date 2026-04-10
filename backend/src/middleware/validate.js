import { ZodError } from 'zod';

function humanizeField(path) {
  const raw = Array.isArray(path) ? path.filter(Boolean).join(' ') : String(path || 'field');
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sanitizeMessage(message) {
  if (!message) return '';
  return String(message)
    .replace(/<=\s*(\d+(?:\.\d+)?)/g, 'at most $1')
    .replace(/>=\s*(\d+(?:\.\d+)?)/g, 'at least $1')
    .replace(/<\s*(\d+(?:\.\d+)?)/g, 'less than $1')
    .replace(/>\s*(\d+(?:\.\d+)?)/g, 'greater than $1');
}

function issueToMessage(issue) {
  const field = humanizeField(issue.path);

  if (issue.code === 'invalid_type') {
    if (issue.received === 'undefined' || issue.received === undefined) {
      return `Please provide ${field}.`;
    }
    return `Please enter a valid value for ${field}.`;
  }

  if (issue.code === 'too_small' && typeof issue.minimum !== 'undefined') {
    if (issue.type === 'string') {
      return `Please enter at least ${issue.minimum} characters for ${field}.`;
    }
    return `Please enter ${issue.minimum} or higher for ${field}.`;
  }

  if (issue.code === 'too_big' && typeof issue.maximum !== 'undefined') {
    if (issue.type === 'string') {
      return `Please keep ${field} within ${issue.maximum} characters.`;
    }
    return `Please enter ${issue.maximum} or less for ${field}.`;
  }

  if (issue.code === 'invalid_string' && issue.validation === 'email') {
    return 'Please enter a valid email address.';
  }

  const fallback = sanitizeMessage(issue.message || 'Invalid input');
  if (field && fallback) return `${field}: ${fallback}`;
  return fallback || 'Please review your input and try again.';
}

function formatZodIssues(issues) {
  return issues.map(issueToMessage).filter(Boolean).join('; ');
}

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
        const message = formatZodIssues(err.issues);
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
        const message = formatZodIssues(err.issues);
        const error = new Error(message);
        error.status = 400;
        error.code = 'VALIDATION_ERROR';
        return next(error);
      }
      next(err);
    }
  };
}
