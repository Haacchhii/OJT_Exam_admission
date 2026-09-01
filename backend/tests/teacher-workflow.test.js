import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    exam: { findUnique: vi.fn(), update: vi.fn() },
    examSchedule: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    essayAnswer: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    examResult: { findUnique: vi.fn(), update: vi.fn() },
    examRegistration: { findUnique: vi.fn(), count: vi.fn() },
    submittedAnswer: { findMany: vi.fn() },
    user: { findFirst: vi.fn() },
  },
  logAudit: vi.fn(),
  sendExamResultEmail: vi.fn(),
  invalidatePrefix: vi.fn(),
}));

vi.mock('../src/config/db.js', () => ({ default: mocks.prisma }));
vi.mock('../src/utils/auditLog.js', () => ({ logAudit: mocks.logAudit }));
vi.mock('../src/utils/email.js', () => ({
  sendExamResultEmail: mocks.sendExamResultEmail,
  sendExamBookingEmail: vi.fn(),
}));
vi.mock('../src/services/emailService.js', () => ({ sendScheduleClosedEmail: vi.fn() }));
vi.mock('../src/utils/cache.js', () => ({
  cached: vi.fn((_key, loader) => loader()),
  invalidatePrefix: mocks.invalidatePrefix,
}));
vi.mock('../src/utils/socket.js', () => ({
  getIo: vi.fn(() => ({ to: vi.fn().mockReturnThis(), emit: vi.fn() })),
}));

import { createExam, publishExam, updateExam } from '../src/controllers/exams.js';
import { createSchedule, deleteSchedule, updateSchedule } from '../src/controllers/examSchedules.js';
import { scoreEssay } from '../src/controllers/essayScoring.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

const teacher = { id: 17, role: 'teacher' };

describe('teacher exam lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(callback => callback(mocks.prisma));
  });

  it('creates exams as drafts unless activation is explicitly requested', async () => {
    mocks.prisma.exam.create = vi.fn().mockResolvedValue({ id: 9 });
    mocks.prisma.examQuestion = { createMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() };
    mocks.prisma.questionChoice = { createMany: vi.fn() };
    mocks.prisma.exam.findUnique.mockResolvedValue({ id: 9, title: 'Draft', questions: [] });
    const req = {
      user: teacher,
      ip: '127.0.0.1',
      body: { title: 'Draft', gradeLevel: 'Grade 10', durationMinutes: 60, passingScore: 75 },
    };
    const res = responseRecorder();

    await createExam(req, res, vi.fn());

    expect(mocks.prisma.exam.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isActive: false }),
    });
  });

  it('rejects publishing an exam with no questions', async () => {
    mocks.prisma.exam.findUnique.mockResolvedValue({ id: 9, title: 'Empty', deletedAt: null, _count: { questions: 0 } });
    const res = responseRecorder();

    await publishExam({ params: { id: '9' }, user: teacher, ip: '127.0.0.1' }, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(res.body?.code).toBe('EXAM_HAS_NO_QUESTIONS');
    expect(mocks.prisma.exam.update).not.toHaveBeenCalled();
  });

  it('protects question content once an exam is published', async () => {
    mocks.prisma.exam.findUnique.mockResolvedValue({
      id: 9,
      deletedAt: null,
      isActive: true,
      _count: { schedules: 0 },
    });
    const res = responseRecorder();

    await updateExam({ params: { id: '9' }, user: teacher, body: { questions: [] } }, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(res.body?.code).toBe('EXAM_CONTENT_LOCKED');
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not allow the generic update endpoint to activate an empty exam', async () => {
    mocks.prisma.exam.findUnique.mockResolvedValue({
      id: 9,
      deletedAt: null,
      isActive: false,
      _count: { questions: 0, schedules: 0 },
    });
    const res = responseRecorder();

    await updateExam({ params: { id: '9' }, user: teacher, body: { isActive: true } }, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(res.body?.code).toBe('EXAM_HAS_NO_QUESTIONS');
    expect(mocks.prisma.exam.update).not.toHaveBeenCalled();
  });

  it('records exam metadata edits', async () => {
    mocks.prisma.exam.findUnique.mockResolvedValue({ id: 9, deletedAt: null, isActive: false, _count: { schedules: 0 } });
    mocks.prisma.exam.update.mockResolvedValue({ id: 9, title: 'Revised', questions: [] });
    const res = responseRecorder();

    await updateExam({ params: { id: '9' }, user: teacher, ip: '127.0.0.1', body: { title: 'Revised' } }, res, vi.fn());

    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'exam.update', entityId: 9 }));
  });
});

describe('teacher schedule audit trail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records schedule creation and updates', async () => {
    mocks.prisma.exam.findUnique.mockResolvedValue({ id: 9, deletedAt: null, _count: { questions: 2 } });
    mocks.prisma.examSchedule.create.mockResolvedValue({ id: 31, examId: 9, scheduledDate: '2099-09-10', startTime: '09:00', endTime: '10:00' });
    await createSchedule({
      user: teacher, ip: '127.0.0.1',
      body: { examId: 9, scheduledDate: '2099-09-10', startTime: '09:00', endTime: '10:00', maxSlots: 20 },
    }, responseRecorder(), vi.fn());
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'schedule.create', entityId: 31 }));

    mocks.prisma.examSchedule.findUnique.mockResolvedValue({
      id: 31, examId: 9, scheduledDate: '2099-09-10', startTime: '09:00', endTime: '10:00',
      visibilityStartDate: null, visibilityEndDate: null, registrationOpenDate: null,
      registrationCloseDate: null, examWindowStartAt: null, examWindowEndAt: null,
      slotsTaken: 0,
    });
    mocks.prisma.examSchedule.update.mockResolvedValue({ id: 31, examId: 9, scheduledDate: '2099-09-10', startTime: '09:00', endTime: '10:00', venue: 'Lab' });
    await updateSchedule({ params: { id: '31' }, user: teacher, ip: '127.0.0.1', body: { venue: 'Lab' } }, responseRecorder(), vi.fn());
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'schedule.update', entityId: 31 }));
  });

  it('records deletion of an unused schedule', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 31 }]),
      examRegistration: { count: vi.fn().mockResolvedValue(0) },
      examSchedule: { delete: vi.fn().mockResolvedValue({ id: 31, examId: 9 }) },
    };
    mocks.prisma.$transaction.mockImplementation(callback => callback(tx));

    await deleteSchedule({ params: { id: '31' }, user: teacher, ip: '127.0.0.1' }, responseRecorder(), vi.fn());

    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'schedule.delete', entityId: 31 }));
  });
});

describe('teacher essay finalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recalculates inside one transaction and does not resend the final email on regrade', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 41 }]),
      essayAnswer: {
        findUnique: vi.fn().mockResolvedValue({ id: 5, registrationId: 41, maxPoints: 5 }),
        update: vi.fn().mockResolvedValue({ id: 5, registrationId: 41, pointsAwarded: 4, scored: true }),
        findMany: vi.fn().mockResolvedValue([{ id: 5, scored: true, pointsAwarded: 4 }]),
      },
      examResult: {
        findUnique: vi.fn().mockResolvedValue({ id: 12, maxPossible: 10, essayReviewed: true }),
        update: vi.fn().mockResolvedValue({ id: 12 }),
      },
      examRegistration: {
        findUnique: vi.fn().mockResolvedValue({ userEmail: 'student@example.test', schedule: { examId: 9 } }),
      },
      exam: {
        findUnique: vi.fn().mockResolvedValue({ title: 'Entrance Exam', passingScore: 75, questions: [] }),
      },
      submittedAnswer: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 2, email: 'student@example.test', firstName: 'Student' }) },
    };
    mocks.prisma.$transaction.mockImplementation(callback => callback(tx));
    const res = responseRecorder();

    await scoreEssay({ params: { id: '5' }, body: { points: 4, comment: 'Regraded' }, user: teacher, ip: '127.0.0.1' }, res, vi.fn());

    expect(mocks.prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.examResult.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 12 } }));
    expect(mocks.sendExamResultEmail).not.toHaveBeenCalled();
  });
});
