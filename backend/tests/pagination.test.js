import { describe, it, expect } from 'vitest';
import { paginate, paginatedResponse } from '../src/utils/pagination.js';

describe('paginate()', () => {
  it('returns null when no page or limit', () => {
    expect(paginate(undefined, undefined)).toBeNull();
    expect(paginate(null, null)).toBeNull();
  });

  it('returns correct skip/take for page 1', () => {
    const result = paginate('1', '10');
    expect(result).toEqual({ skip: 0, take: 10, page: 1, limit: 10 });
  });

  it('returns correct skip/take for page 3', () => {
    const result = paginate('3', '20');
    expect(result).toEqual({ skip: 40, take: 20, page: 3, limit: 20 });
  });

  it('clamps limit to max 100', () => {
    const result = paginate('1', '500');
    expect(result.limit).toBe(100);
    expect(result.take).toBe(100);
  });

  it('clamps page to min 1', () => {
    const result = paginate('-5', '10');
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('defaults to page 1, limit 10 for bad input', () => {
    const result = paginate('abc', 'xyz');
    expect(result).toEqual({ skip: 0, take: 10, page: 1, limit: 10 });
  });
});

describe('paginatedResponse()', () => {
  it('wraps data with pagination envelope when pg is provided', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const pg = { skip: 0, take: 10, page: 1, limit: 10 };
    const result = paginatedResponse(data, 25, pg);
    expect(result).toEqual({
      data,
      pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
    });
  });

  it('wraps data with envelope even when pg is null', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = paginatedResponse(data, 2, null);
    expect(result).toEqual({
      data,
      pagination: { page: 1, limit: 2, total: 2, totalPages: 1 },
    });
  });
});
