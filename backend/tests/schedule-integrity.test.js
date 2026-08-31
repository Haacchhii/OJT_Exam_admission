import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    academicYear: { findFirst: vi.fn() },
    semester: { findFirst: vi.fn() },
    applicantProfile: { findUnique: vi.fn() },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    examSchedule: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    examRegistration: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../src/config/db.js', () => ({ default: mocks.prisma }));
vi.mock('../src/utils/cache.js', () => ({
  cached: vi.fn(),
  invalidatePrefix: vi.fn(),
}));
vi.mock('../src/utils/auditLog.js', () => ({ logAudit: vi.fn() }));
vi.mock('../src/utils/socket.js', () => ({
  getIo: vi.fn(() => ({ to: vi.fn().mockReturnThis(), emit: vi.fn() })),
}));
vi.mock('../src/services/emailService.js', () => ({ sendScheduleClosedEmail: vi.fn() }));
vi.mock('../src/utils/email.js', () => ({ sendExamBookingEmail: vi.fn() }));
vi.mock('../src/utils/tracking.js', () => ({ generateTrackingId: vi.fn().mockResolvedValue('GK-EXM-TEST') }));

import { deleteSchedule, getScheduleNotices, notifyNoSchedule, updateSchedule } from '../src/controllers/examSchedules.js';
import { createRegistration } from '../src/controllers/examRegistrations.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

describe('schedule data integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses to delete a schedule that has applicant registrations', async () => {
    mocks.prisma.examSchedule.findUnique.mockResolvedValue({ id: 41 });
    mocks.prisma.examRegistration.count.mockResolvedValue(2);
    const req = { params: { id: '41' } };
    const res = responseRecorder();

    await deleteSchedule(req, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(res.body?.code).toBe('SCHEDULE_HAS_REGISTRATIONS');
    expect(mocks.prisma.examRegistration.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.examSchedule.delete).not.toHaveBeenCalled();
  });

  it('allows deletion when a schedule has never been booked', async () => {
    mocks.prisma.examSchedule.findUnique.mockResolvedValue({ id: 42 });
    mocks.prisma.examRegistration.count.mockResolvedValue(0);
    const req = { params: { id: '42' } };
    const res = responseRecorder();

    await deleteSchedule(req, res, vi.fn());

    expect(res.statusCode).toBe(204);
    expect(mocks.prisma.examSchedule.delete).toHaveBeenCalledWith({ where: { id: 42 } });
    expect(mocks.prisma.examRegistration.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses to reduce capacity below the number already booked', async () => {
    mocks.prisma.examSchedule.findUnique.mockResolvedValue({
      id: 43,
      scheduledDate: '2026-09-15',
      startTime: '09:00',
      endTime: '10:00',
      visibilityStartDate: '2026-09-01',
      visibilityEndDate: '2026-09-15',
      registrationOpenDate: '2026-09-01',
      registrationCloseDate: '2026-09-15',
      examWindowStartAt: null,
      examWindowEndAt: null,
      slotsTaken: 7,
    });
    const req = { params: { id: '43' }, body: { maxSlots: 6 } };
    const res = responseRecorder();

    await updateSchedule(req, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(res.body?.code).toBe('CAPACITY_BELOW_BOOKINGS');
    expect(mocks.prisma.examSchedule.update).not.toHaveBeenCalled();
  });

  it('rechecks for an active registration after locking the schedule', async () => {
    const now = Date.now();
    mocks.prisma.applicantProfile.findUnique.mockResolvedValue({ gradeLevel: 'Grade 10' });
    mocks.prisma.examRegistration.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.prisma.examSchedule.findUnique.mockResolvedValue({
      id: 44,
      examId: 9,
      examWindowStartAt: new Date(now - 60_000),
      examWindowEndAt: new Date(now + 3_600_000),
      maxSlots: 10,
      slotsTaken: 1,
      exam: { id: 9, academicYear: { id: 3, isActive: true } },
    });
    mocks.prisma.academicYear.findFirst.mockResolvedValue({ id: 3, isActive: true });
    mocks.prisma.semester.findFirst.mockResolvedValue({
      id: 2,
      isActive: true,
      startDate: new Date(now - 86_400_000),
      endDate: new Date(now + 86_400_000),
    });

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 44, max_slots: 10, slots_taken: 1 }]),
      examRegistration: {
        findFirst: vi.fn().mockResolvedValue({ id: 100, status: 'scheduled' }),
        create: vi.fn(),
      },
      examSchedule: { update: vi.fn() },
    };
    mocks.prisma.$transaction.mockImplementation(callback => callback(tx));

    const req = {
      body: { scheduleId: 44 },
      user: { id: 7, email: 'student@example.test', role: 'applicant', status: 'Active' },
    };
    const res = responseRecorder();
    const next = vi.fn();

    await createRegistration(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONFLICT' }));
    expect(tx.examRegistration.create).not.toHaveBeenCalled();
    expect(tx.examSchedule.update).not.toHaveBeenCalled();
  });

  it('persists an applicant schedule request before reporting success', async () => {
    mocks.prisma.applicantProfile.findUnique.mockResolvedValue({ gradeLevel: 'Grade 10' });
    mocks.prisma.auditLog.create.mockResolvedValue({ id: 501 });
    const req = {
      body: { message: 'Please add a weekend schedule.' },
      user: {
        id: 7,
        email: 'student@example.test',
        role: 'applicant',
        firstName: 'Test',
        lastName: 'Student',
      },
      ip: '127.0.0.1',
    };
    const res = responseRecorder();

    await notifyNoSchedule(req, res, vi.fn());

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 7,
        action: 'exam.schedule_notice',
        entity: 'exam_schedule',
      }),
    });
    expect(res.body).toEqual(expect.objectContaining({ ok: true, noticeId: 501 }));
  });

  it('returns persisted schedule requests to staff', async () => {
    mocks.prisma.auditLog.findMany.mockResolvedValue([{
      id: 501,
      userId: 7,
      details: JSON.stringify({ gradeLevel: 'Grade 10', message: 'Weekend please' }),
      createdAt: new Date('2026-08-30T01:00:00.000Z'),
      user: { firstName: 'Test', middleName: null, lastName: 'Student', email: 'student@example.test' },
    }]);
    mocks.prisma.auditLog.count.mockResolvedValue(1);
    const req = { query: { page: '1', limit: '20' } };
    const res = responseRecorder();

    await getScheduleNotices(req, res, vi.fn());

    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: 501,
        studentName: 'Test Student',
        email: 'student@example.test',
        gradeLevel: 'Grade 10',
        message: 'Weekend please',
      }),
    ]);
    expect(res.body.pagination).toEqual(expect.objectContaining({ total: 1, page: 1 }));
  });
});
