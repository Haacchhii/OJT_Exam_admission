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

/** Shorthand: cacheable for 60s, revalidate up to 5min */
export const cachePublic  = cacheControl('public, max-age=60, stale-while-revalidate=300');

/** Shorthand: private user-specific data, must revalidate every time */
export const cachePrivate = cacheControl('private, no-cache');

/** Shorthand: never cache (mutations, auth) */
export const noStore      = cacheControl('no-store');
