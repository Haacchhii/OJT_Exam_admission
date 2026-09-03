import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    applicantProfile: { deleteMany: vi.fn(), upsert: vi.fn() },
    examRegistration: { updateMany: vi.fn() },
    academicYear: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    semester: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
  logAudit: vi.fn(),
  invalidatePrefix: vi.fn(),
  sendVerificationEmail: vi.fn().mockResolvedValue({ ok: true }),
  syncApplicantUserStatusById: vi.fn().mockResolvedValue({ status: 'Active' }),
}));

vi.mock('../src/config/db.js', () => ({ default: mocks.prisma }));
vi.mock('../src/utils/auditLog.js', () => ({ logAudit: mocks.logAudit }));
vi.mock('../src/utils/cache.js', () => ({
  cached: vi.fn((_key, loader) => loader()),
  invalidatePrefix: mocks.invalidatePrefix,
}));
vi.mock('../src/utils/applicantStatusSync.js', () => ({
  syncAllApplicantStatuses: vi.fn().mockResolvedValue({ changedCount: 0 }),
  syncApplicantUserStatusById: mocks.syncApplicantUserStatusById,
}));
vi.mock('../src/utils/email.js', () => ({
  sendTemporaryPasswordEmail: vi.fn(),
  sendVerificationEmail: mocks.sendVerificationEmail,
}));

import { createUser, forcePasswordReset, setUserRole, updateUser } from '../src/controllers/users.js';
import { createAcademicYear, updateSemester } from '../src/controllers/academicYears.js';
import { authenticate } from '../src/middleware/auth.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const admin = { id: 1, role: 'administrator' };

describe('administrator account controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(callback => callback(mocks.prisma));
  });

  it('revokes existing sessions when forcing a password reset', async () => {
    mocks.prisma.user.update.mockResolvedValue({ id: 2, mustChangePassword: true, tokenVersion: 4 });
    const res = responseRecorder();

    await forcePasswordReset({ params: { id: '2' }, user: admin, ip: '127.0.0.1' }, res, vi.fn());

    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { mustChangePassword: true, tokenVersion: { increment: 1 } },
    });
  });

  it('revokes old tokens when restoring a previously deleted account', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({ id: 2, deletedAt: new Date('2026-01-01') });
    mocks.prisma.user.update.mockResolvedValue({ id: 2, email: 'restored@example.com', firstName: 'Restored' });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 2, email: 'restored@example.com', role: 'teacher', status: 'Active' });
    const res = responseRecorder();
    await createUser({
      body: { email: 'restored@example.com', role: 'teacher', password: 'ValidPass_123' },
      user: admin,
      ip: '127.0.0.1',
    }, res, vi.fn());
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tokenVersion: { increment: 1 }, deletedAt: null }),
    }));
  });

  it('prevents an administrator from demoting their own account', async () => {
    const res = responseRecorder();
    await setUserRole({ params: { id: '1' }, body: { role: 'teacher' }, user: admin }, res, vi.fn());
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('ADMIN_SELF_ROLE_CHANGE');
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it('prevents removal of the last active administrator', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ role: 'administrator', status: 'Active', deletedAt: null });
    mocks.prisma.user.count.mockResolvedValue(1);
    const res = responseRecorder();
    await setUserRole({ params: { id: '2' }, body: { role: 'teacher' }, user: admin }, res, vi.fn());
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('LAST_ADMIN_REQUIRED');
  });

  it('records before and after values and revokes sessions on security-sensitive updates', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 2, email: 'old@example.com', role: 'teacher', status: 'Active' });
    mocks.prisma.user.update.mockResolvedValue({ id: 2, email: 'old@example.com', role: 'registrar', status: 'Inactive' });
    const res = responseRecorder();

    await updateUser({ params: { id: '2' }, body: { role: 'registrar', status: 'Inactive' }, user: admin, ip: '127.0.0.1' }, res, vi.fn());

    expect(mocks.prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'registrar', status: 'Inactive', tokenVersion: { increment: 1 } }),
    }));
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.update',
      details: expect.objectContaining({
        before: expect.objectContaining({ role: 'teacher', status: 'Active' }),
        after: expect.objectContaining({ role: 'registrar', status: 'Inactive' }),
      }),
    }));
  });
});

describe('administrator session revocation', () => {
  it('checks current database state and rejects a revoked token', async () => {
    const token = jwt.sign(
      { sub: 2, role: 'administrator', status: 'Active', tokenVersion: 3, mustChangePassword: false },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' },
    );
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 2,
      role: 'teacher',
      status: 'Active',
      tokenVersion: 4,
      deletedAt: null,
    });
    const res = responseRecorder();
    await authenticate({ headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/users' }, res, vi.fn());
    expect(mocks.prisma.user.findUnique).toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('TOKEN_REVOKED');
  });
});

describe('applicant session authentication', () => {
  it('accepts a current active applicant token while scheduling status synchronization', async () => {
    const token = jwt.sign(
      { sub: 9, role: 'applicant', status: 'Active', tokenVersion: 2, mustChangePassword: false },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' },
    );
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 9,
      email: 'applicant@example.test',
      role: 'applicant',
      status: 'Active',
      emailVerified: true,
      mustChangePassword: false,
      tokenVersion: 2,
      deletedAt: null,
    });
    const res = responseRecorder();
    const next = vi.fn();

    await authenticate({ headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/admissions/mine' }, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(mocks.syncApplicantUserStatusById).toHaveBeenCalledWith(9);
  });
});

describe('academic period governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(callback => callback(mocks.prisma));
  });

  it('writes academic-year audits using the structured logger contract', async () => {
    mocks.prisma.academicYear.create.mockResolvedValue({ id: 8, year: '2027-2028', semesters: [] });
    const res = responseRecorder();
    await createAcademicYear({ body: { year: '2027-2028' }, user: admin, ip: '127.0.0.1' }, res, vi.fn());
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      action: 'academic_year.create',
      entity: 'academic_year',
      entityId: 8,
    }));
  });

  it('validates a partial semester update against stored dates and its academic year', async () => {
    mocks.prisma.semester.findUnique.mockResolvedValue({
      id: 4,
      academicYearId: 8,
      startDate: new Date('2027-08-01'),
      endDate: new Date('2027-12-15'),
      academicYear: { startDate: new Date('2027-06-01'), endDate: new Date('2028-03-31') },
    });
    const res = responseRecorder();
    await updateSemester({ params: { id: '4' }, body: { startDate: '2028-01-01' }, user: admin }, res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.semester.update).not.toHaveBeenCalled();
  });
});
