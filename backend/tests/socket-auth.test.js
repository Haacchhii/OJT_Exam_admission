import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('../src/config/db.js', () => ({ default: mocks.prisma }));

import { authenticateSocketToken } from '../src/utils/socket.js';

describe('realtime session authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the current database role instead of a stale JWT role claim', async () => {
    const token = jwt.sign(
      { sub: 7, role: 'administrator', tokenVersion: 3 },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' },
    );
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 7,
      role: 'teacher',
      status: 'Active',
      emailVerified: true,
      mustChangePassword: false,
      tokenVersion: 3,
      deletedAt: null,
    });

    await expect(authenticateSocketToken(token)).resolves.toMatchObject({ id: 7, role: 'teacher' });
  });

  it.each([
    ['revoked token', { tokenVersion: 4 }],
    ['inactive account', { status: 'Inactive' }],
    ['deleted account', { deletedAt: new Date('2026-01-01') }],
    ['password-change gate', { mustChangePassword: true }],
    ['unverified account', { emailVerified: false }],
  ])('rejects a %s before joining any realtime room', async (_label, override) => {
    const token = jwt.sign(
      { sub: 7, role: 'administrator', tokenVersion: 3 },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' },
    );
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 7,
      role: 'administrator',
      status: 'Active',
      emailVerified: true,
      mustChangePassword: false,
      tokenVersion: 3,
      deletedAt: null,
      ...override,
    });

    await expect(authenticateSocketToken(token)).rejects.toThrow('Authentication error');
  });
});
