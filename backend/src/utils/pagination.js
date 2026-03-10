// ─── Pagination helper ────────────────────────────────
// When no page/limit params are provided, returns null → controllers fetch all records.
export function paginate(page, limit) {
  if (page == null && limit == null) return null;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

export function paginatedResponse(data, total, pg) {
  if (!pg) return data; // no pagination → return raw array
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
