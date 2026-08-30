import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    examSchedule: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    examRegistration: {
      count: vi.fn(),
      deleteMany: vi.fn(),
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

import { deleteSchedule, updateSchedule } from '../src/controllers/examSchedules.js';

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
});
