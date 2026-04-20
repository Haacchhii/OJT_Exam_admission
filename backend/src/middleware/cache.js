/**
 * HTTP Cache-Control middleware.
 * @param {string} directive — e.g. 'public, max-age=60' or 'private, no-cache'
 */
export function cacheControl(directive) {
  return (_req, res, next) => {
    res.set('Cache-Control', directive);
    next();
  };
}

/**
 * Smart private caching for authenticated APIs.
 * - Cache GET/HEAD briefly to reduce repeat load latency.
 * - Never cache mutations.
 */
export function cachePrivateSmart(getDirective = 'private, max-age=60, stale-while-revalidate=300') {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.set('Cache-Control', getDirective);
    } else {
      res.set('Cache-Control', 'no-store');
    }
    next();
  };
}

/** Shorthand: cacheable for 60s, revalidate up to 5min */
export const cachePublic  = cacheControl('public, max-age=60, stale-while-revalidate=300');

/** Shorthand: private user-specific data with short-lived cache for reads */
export const cachePrivate = cachePrivateSmart();

/** Shorthand: never cache (mutations, auth) */
export const noStore      = cacheControl('no-store');
