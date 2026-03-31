import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants.js';

// ─── Pagination helper ────────────────────────────────
export function paginate(page, limit) {
  const hasPage = page !== undefined && page !== null && page !== '';
  const hasLimit = limit !== undefined && limit !== null && limit !== '';

  // Backward compatibility: if pagination params are omitted,
  // callers get the full dataset and can still receive an envelope.
  if (!hasPage && !hasLimit) return null;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

export function paginatedResponse(data, total, pg) {
  const effective = pg || {
    page: 1,
    limit: total,
  };

  return {
    data,
    pagination: {
      page: effective.page,
      limit: effective.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / Math.max(1, effective.limit))),
    },
  };
}
