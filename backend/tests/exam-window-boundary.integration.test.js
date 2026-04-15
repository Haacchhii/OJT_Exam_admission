import { describe, it, expect } from 'vitest';
import { isSubmissionWithinScheduleWindow } from '../src/utils/examWindow.js';

describe('exam window boundary integration', () => {
  it('handles submit boundaries around exact close time and started-before-close edge case', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      examWindowStartAt: '2026-04-20T13:00:00.000Z',
      examWindowEndAt: '2026-04-20T14:00:00.000Z',
    };

    const startedAt = new Date('2026-04-20T13:10:00.000Z');
    const justBeforeClose = new Date('2026-04-20T13:59:59.999Z');
    const exactlyAtClose = new Date('2026-04-20T14:00:00.000Z');
    const justAfterClose = new Date('2026-04-20T14:00:00.001Z');

    expect(startedAt.getTime()).toBeLessThan(exactlyAtClose.getTime());
    expect(isSubmissionWithinScheduleWindow(schedule, justBeforeClose, 0)).toBe(true);
    expect(isSubmissionWithinScheduleWindow(schedule, exactlyAtClose, 0)).toBe(true);
    expect(isSubmissionWithinScheduleWindow(schedule, justAfterClose, 0)).toBe(false);
  });
});
