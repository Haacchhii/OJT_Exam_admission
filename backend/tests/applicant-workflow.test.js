import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    admission: { findUnique: vi.fn() },
  },
}));

vi.mock('../src/config/db.js', () => ({ default: mocks.prisma }));
vi.mock('../src/utils/cache.js', () => ({
  cached: vi.fn((_key, loader) => loader()),
  invalidate: vi.fn(),
  invalidatePrefix: vi.fn(),
}));
vi.mock('../src/utils/auditLog.js', () => ({ logAudit: vi.fn() }));
vi.mock('../src/utils/email.js', () => ({
  sendAdmissionSubmittedEmail: vi.fn(),
  sendExamBookingEmail: vi.fn(),
  sendStatusUpdateEmail: vi.fn(),
}));
vi.mock('../src/utils/socket.js', () => ({
  getIo: vi.fn(() => ({ to: vi.fn().mockReturnThis(), emit: vi.fn() })),
}));

import { authorizeAdmissionDocumentUpload } from '../src/controllers/admissions.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('applicant document upload authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects another applicant before multipart files are processed', async () => {
    mocks.prisma.admission.findUnique.mockResolvedValue({ id: 41, userId: 900, deletedAt: null });
    const req = { params: { id: '41' }, user: { id: 901, role: 'applicant' } };
    const res = responseRecorder();
    const next = vi.fn();

    await authorizeAdmissionDocumentUpload(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('treats soft-deleted admissions as unavailable', async () => {
    mocks.prisma.admission.findUnique.mockResolvedValue({ id: 41, userId: 901, deletedAt: new Date() });
    const req = { params: { id: '41' }, user: { id: 901, role: 'applicant' } };
    const res = responseRecorder();
    const next = vi.fn();

    await authorizeAdmissionDocumentUpload(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(next).not.toHaveBeenCalled();
  });

  it('passes an owned active admission to the upload handler', async () => {
    const admission = { id: 41, userId: 901, deletedAt: null };
    mocks.prisma.admission.findUnique.mockResolvedValue(admission);
    const req = { params: { id: '41' }, user: { id: 901, role: 'applicant' } };
    const res = responseRecorder();
    const next = vi.fn();

    await authorizeAdmissionDocumentUpload(req, res, next);

    expect(req.admissionForDocumentUpload).toBe(admission);
    expect(next).toHaveBeenCalledOnce();
  });
});
