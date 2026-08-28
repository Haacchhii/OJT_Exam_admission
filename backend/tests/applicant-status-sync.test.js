import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/db.js', () => ({
  default: {
    $queryRaw: vi.fn(),
  },
}));

import prisma from '../src/config/db.js';
import { isApplicantPeriodOpen } from '../src/utils/applicantStatusSync.js';

describe('applicant period status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses database-cast ISO dates so restored DateTime values do not close applicant access', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { startDate: '2026-06-01', endDate: '2026-10-31' },
    ]);

    const isOpen = await isApplicantPeriodOpen(new Date('2026-08-28T00:00:00.000Z'));

    expect(isOpen).toBe(true);
  });

  it('keeps applicant access closed outside the active semester window', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { startDate: '2026-06-01', endDate: '2026-10-31' },
    ]);

    const isOpen = await isApplicantPeriodOpen(new Date('2026-11-01T00:00:00.000Z'));

    expect(isOpen).toBe(false);
  });
});
