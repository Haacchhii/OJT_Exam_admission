import { describe, it, expect, vi } from 'vitest';
import { validate } from '../src/middleware/validate.js';
import { z } from 'zod';

function mockReqResNext(body) {
  const req = { body };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  return { req, res, next };
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  it('passes valid body and calls next()', () => {
    const { req, res, next } = mockReqResNext({ name: 'John', age: 30 });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'John', age: 30 });
  });

  it('calls next with error for invalid body', () => {
    const { req, res, next } = mockReqResNext({ name: '', age: -1 });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      code: 'VALIDATION_ERROR',
    }));
  });

  it('error message includes field path', () => {
    const { req, res, next } = mockReqResNext({ age: 5 });
    validate(schema)(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.message).toContain('name');
  });

  it('strips unknown fields from body', () => {
    const { req, res, next } = mockReqResNext({ name: 'Jane', age: 25, extra: 'foo' });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).not.toHaveProperty('extra');
  });
});
