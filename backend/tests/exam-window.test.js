import { describe, it, expect } from 'vitest';
import {
  computeExamWindowStatus,
  evaluateExamStartAvailability,
  computeScheduleSubmissionDeadline,
  isSubmissionWithinScheduleWindow,
} from '../src/utils/examWindow.js';

describe('exam window status', () => {
  it('returns open when now is inside explicit datetime window', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      examWindowStartAt: '2026-04-20T13:00:00.000Z',
      examWindowEndAt: '2026-04-20T14:00:00.000Z',
    };

    const result = computeExamWindowStatus(schedule, new Date('2026-04-20T13:30:00.000Z'));
    expect(result.status).toBe('open');
  });

  it('returns upcoming before explicit datetime window start', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      examWindowStartAt: '2026-04-20T13:00:00.000Z',
      examWindowEndAt: '2026-04-20T14:00:00.000Z',
    };

    const result = computeExamWindowStatus(schedule, new Date('2026-04-20T12:59:59.000Z'));
    expect(result.status).toBe('upcoming');
  });

  it('returns closed after explicit datetime window end', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      examWindowStartAt: '2026-04-20T13:00:00.000Z',
      examWindowEndAt: '2026-04-20T14:00:00.000Z',
    };

    const result = computeExamWindowStatus(schedule, new Date('2026-04-20T14:00:01.000Z'));
    expect(result.status).toBe('closed');
  });
});

describe('evaluateExamStartAvailability', () => {
  it('allows rolling window exam starts anytime while window is open', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      registrationOpenDate: '2026-04-10',
      registrationCloseDate: '2026-04-20',
    };

    const result = evaluateExamStartAvailability(schedule, new Date('2026-04-15T03:30:00.000Z'));
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

    const result = evaluateExamStartAvailability(schedule, new Date('2026-04-11T12:00:00.000Z'));
    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/opens on/i);
  });

  it('blocks starts after rolling window closes', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      registrationOpenDate: '2026-04-12',
      registrationCloseDate: '2026-04-20',
    };

    const result = evaluateExamStartAvailability(schedule, new Date('2026-04-21T12:00:00.000Z'));
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

    expect(evaluateExamStartAvailability(schedule, new Date('2026-04-20T08:59:00')).allowed).toBe(false);
    expect(evaluateExamStartAvailability(schedule, new Date('2026-04-20T09:30:00')).allowed).toBe(true);
    expect(evaluateExamStartAvailability(schedule, new Date('2026-04-20T10:01:00')).allowed).toBe(false);
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

  it('enforces boundary behavior for explicit datetime close', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      examWindowStartAt: '2026-04-20T13:00:00.000Z',
      examWindowEndAt: '2026-04-20T14:00:00.000Z',
    };

    const beforeClose = new Date('2026-04-20T13:59:59.000Z');
    const atClose = new Date('2026-04-20T14:00:00.000Z');
    const afterClose = new Date('2026-04-20T14:00:01.000Z');

    expect(isSubmissionWithinScheduleWindow(schedule, beforeClose, 0)).toBe(true);
    expect(isSubmissionWithinScheduleWindow(schedule, atClose, 0)).toBe(true);
    expect(isSubmissionWithinScheduleWindow(schedule, afterClose, 0)).toBe(false);
  });

  it('rejects submission after close even when started before close', () => {
    const schedule = {
      scheduledDate: '2026-04-20',
      startTime: '09:00',
      endTime: '10:00',
      examWindowStartAt: '2026-04-20T13:00:00.000Z',
      examWindowEndAt: '2026-04-20T14:00:00.000Z',
    };

    const startedAt = new Date('2026-04-20T13:20:00.000Z');
    const submitAfterClose = new Date('2026-04-20T14:05:00.000Z');

    expect(startedAt.getTime()).toBeLessThan(new Date('2026-04-20T14:00:00.000Z').getTime());
    expect(isSubmissionWithinScheduleWindow(schedule, submitAfterClose, 0)).toBe(false);
  });
});
