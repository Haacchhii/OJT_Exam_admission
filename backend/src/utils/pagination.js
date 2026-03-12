import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants.js';

// ─── Pagination helper ────────────────────────────────
// When no page/limit params are provided, returns null → controllers fetch all records.
export function paginate(page, limit) {
  if (page == null && limit == null) return null;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

export function paginatedResponse(data, total, pg) {
  if (!pg) {
    // No pagination requested → return envelope with all records
    return {
      data,
      pagination: {
        page: 1,
        limit: total,
        total,
        totalPages: 1,
      },
    };
  }
  return {
    data,
    pagination: {
      page: pg.page,
      limit: pg.limit,
      total,
      totalPages: Math.ceil(total / pg.limit),
    },
  };
}
