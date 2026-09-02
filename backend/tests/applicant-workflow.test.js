import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    admission: { findUnique: vi.fn(), findFirst: vi.fn() },
    applicantProfile: { findUnique: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    semester: { findFirst: vi.fn() },
    examQuestion: { count: vi.fn() },
    examRegistration: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    exam: { findUnique: vi.fn() },
    submittedAnswer: { createMany: vi.fn() },
    essayAnswer: { createMany: vi.fn() },
    examResult: { create: vi.fn() },
    $transaction: vi.fn(),
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
import { saveDraftAnswers, startExam } from '../src/controllers/examRegistrations.js';
import { submitExam } from '../src/controllers/examSubmission.js';

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

describe('applicant exam start integrity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows only one concurrent request to establish the attempt start time', async () => {
    const registration = {
      id: 77,
      userId: 901,
      userEmail: 'applicant@example.com',
      status: 'scheduled',
      schedule: {
        examId: 12,
        startDateTime: new Date(Date.now() - 60_000),
        endDateTime: new Date(Date.now() + 3_600_000),
        exam: { academicYearId: 1 },
      },
    };
    mocks.prisma.examRegistration.findUnique.mockResolvedValue(registration);
    mocks.prisma.applicantProfile.findUnique.mockResolvedValue({ gradeLevel: 'Grade 7' });
    mocks.prisma.academicYear.findFirst.mockResolvedValue({ id: 1, isActive: true });
    mocks.prisma.semester.findFirst.mockResolvedValue({
      id: 3,
      academicYearId: 1,
      isActive: true,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    });
    mocks.prisma.examQuestion.count.mockResolvedValue(10);

    let claimed = false;
    mocks.prisma.examRegistration.updateMany.mockImplementation(async () => {
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    });

    const makeResponse = () => responseRecorder();
    const first = makeResponse();
    const second = makeResponse();
    const req = { params: { id: '77' }, user: { id: 901, email: 'applicant@example.com', role: 'applicant' } };
    const firstNext = vi.fn();
    const secondNext = vi.fn();

    await Promise.all([
      startExam(req, first, firstNext),
      startExam(req, second, secondNext),
    ]);

    expect(firstNext).not.toHaveBeenCalled();
    expect(secondNext).not.toHaveBeenCalled();
    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 409]);
  });
});

describe('applicant exam submission integrity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows only one concurrent final submission to create result records', async () => {
    const registration = {
      id: 77,
      userId: 901,
      userEmail: 'applicant@example.com',
      status: 'started',
      startedAt: new Date(),
      draftAnswers: null,
      schedule: {
        examId: 12,
        examWindowEndAt: new Date(Date.now() + 3_600_000),
      },
    };
    const exam = {
      id: 12,
      title: 'Entrance Exam',
      durationMinutes: 60,
      passingScore: 75,
      questions: [{
        id: 5,
        questionType: 'mc',
        points: 1,
        choices: [{ id: 21, isCorrect: true }],
      }],
    };
    mocks.prisma.examRegistration.findUnique.mockResolvedValue(registration);
    mocks.prisma.exam.findUnique.mockResolvedValue(exam);
    mocks.prisma.examRegistration.update.mockResolvedValue({ ...registration, status: 'done' });
    mocks.prisma.submittedAnswer.createMany.mockResolvedValue({ count: 1 });
    mocks.prisma.examResult.create.mockResolvedValue({ id: 88 });

    let claimed = false;
    mocks.prisma.examRegistration.updateMany.mockImplementation(async () => {
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    });
    mocks.prisma.$transaction.mockImplementation(async (work) => {
      if (typeof work === 'function') return work(mocks.prisma);
      return Promise.all(work);
    });

    const first = responseRecorder();
    const second = responseRecorder();
    const req = {
      body: { registrationId: 77, answers: { 5: 21 } },
      user: { id: 901, email: 'applicant@example.com', firstName: 'Applicant', role: 'applicant' },
      ip: '127.0.0.1',
    };

    await Promise.all([
      submitExam(req, first, vi.fn()),
      submitExam(req, second, vi.fn()),
    ]);

    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 409]);
    expect(mocks.prisma.submittedAnswer.createMany).toHaveBeenCalledOnce();
    expect(mocks.prisma.examResult.create).toHaveBeenCalledOnce();
  });
});

describe('applicant autosave ordering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not let a delayed older draft overwrite a newer draft', async () => {
    let stored = { revision: 0, answers: null };
    mocks.prisma.examRegistration.findUnique.mockImplementation(async () => ({
      id: 77,
      userId: 901,
      userEmail: 'applicant@example.com',
      status: 'started',
      startedAt: new Date(),
      draftRevision: stored.revision,
      draftAnswers: stored.answers,
      schedule: {
        examWindowEndAt: new Date(Date.now() + 3_600_000),
        exam: { durationMinutes: 60 },
      },
    }));
    mocks.prisma.examRegistration.update.mockImplementation(async ({ data }) => {
      stored = {
        revision: data.draftRevision ?? stored.revision,
        answers: data.draftAnswers,
      };
      return { id: 77 };
    });
    mocks.prisma.examRegistration.updateMany.mockImplementation(async ({ where, data }) => {
      if (stored.revision >= where.draftRevision.lt) return { count: 0 };
      stored = { revision: data.draftRevision, answers: data.draftAnswers };
      return { count: 1 };
    });

    const user = { id: 901, email: 'applicant@example.com', role: 'applicant' };
    await saveDraftAnswers({
      params: { id: '77' }, user, body: { answers: { 5: 21 }, revision: 2 },
    }, responseRecorder(), vi.fn());
    await saveDraftAnswers({
      params: { id: '77' }, user, body: { answers: { 5: 20 }, revision: 1 },
    }, responseRecorder(), vi.fn());

    expect(stored.revision).toBe(2);
    expect(JSON.parse(stored.answers)).toEqual({ 5: 21 });
  });
});
