import { describe, it, expect } from 'vitest';
import {
  evaluateExamStartAvailability,
  computeScheduleSubmissionDeadline,
  isSubmissionWithinScheduleWindow,
} from '../src/utils/examWindow.js';

describe('evaluateExamStartAvailability', () => {
  it('allows rolling window exam starts anytime while window is open', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      registrationOpenDate: '2026-04-10',
      registrationCloseDate: '2026-04-20',
    };

    const result = evaluateExamStartAvailability(schedule, '2026-04-15', '03:30');
    expect(result.allowed).toBe(true);
  });

  it('blocks starts before rolling window opens', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      registrationOpenDate: '2026-04-12',
      registrationCloseDate: '2026-04-20',
    };

    const result = evaluateExamStartAvailability(schedule, '2026-04-11', '12:00');
    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/not open yet/i);
  });

  it('blocks starts after rolling window closes', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      registrationOpenDate: '2026-04-12',
      registrationCloseDate: '2026-04-20',
    };

    const result = evaluateExamStartAvailability(schedule, '2026-04-21', '12:00');
    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/closed/i);
  });

  it('keeps strict schedule behavior when no rolling window is configured', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      registrationOpenDate: null,
      registrationCloseDate: null,
    };

    expect(evaluateExamStartAvailability(schedule, '2026-04-20', '08:59').allowed).toBe(false);
    expect(evaluateExamStartAvailability(schedule, '2026-04-20', '09:30').allowed).toBe(true);
    expect(evaluateExamStartAvailability(schedule, '2026-04-20', '10:01').allowed).toBe(false);
  });
});

describe('submission schedule deadline policy', () => {
  it('uses end-of-day close for rolling window schedules', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      endTime: '10:00',
      registrationOpenDate: '2026-04-10',
      registrationCloseDate: '2026-04-20',
    };

    const deadline = computeScheduleSubmissionDeadline(schedule, 1);
    expect(deadline).toBeTruthy();
    expect(deadline.getFullYear()).toBe(2026);
    expect(deadline.getMonth()).toBe(3);
    expect(deadline.getDate()).toBe(21);
    expect(deadline.getHours()).toBe(0);
    expect(deadline.getMinutes()).toBe(0);
  });

  it('uses scheduled end time for strict schedules', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      endTime: '10:00',
      registrationOpenDate: null,
      registrationCloseDate: null,
    };

    const deadline = computeScheduleSubmissionDeadline(schedule, 2);
    expect(deadline).toBeTruthy();
    expect(deadline.getFullYear()).toBe(2026);
    expect(deadline.getMonth()).toBe(3);
    expect(deadline.getDate()).toBe(20);
    expect(deadline.getHours()).toBe(10);
    expect(deadline.getMinutes()).toBe(2);
  });

  it('validates submission against the computed schedule deadline', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      endTime: '10:00',
      registrationOpenDate: null,
      registrationCloseDate: null,
    };

    const beforeDeadline = new Date('2026-04-20T10:00:30');
    const afterDeadline = new Date('2026-04-20T10:01:01');

    expect(isSubmissionWithinScheduleWindow(schedule, beforeDeadline, 1)).toBe(true);
    expect(isSubmissionWithinScheduleWindow(schedule, afterDeadline, 1)).toBe(false);
  });
});
