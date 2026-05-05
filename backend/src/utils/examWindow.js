import { formatManilaDate, startOfManilaDay, endOfManilaDay } from './timezone.js';

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function asValidDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (!hasValue(value)) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMinutes(date, minutes) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + Math.max(0, Number(minutes) || 0) * 60 * 1000);
}

function startOfDay(dateIso) {
  return startOfManilaDay(dateIso);
}

function endOfDay(dateIso) {
  return endOfManilaDay(dateIso);
}

function formatDateTimeLabel(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return 'TBD';
  return formatManilaDate(value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getEffectiveExamWindow(schedule) {
  if (!schedule) {
    return { startAt: null, endAt: null, source: 'none' };
  }

  const explicitStart = asValidDate(schedule.examWindowStartAt);
  const explicitEnd = asValidDate(schedule.examWindowEndAt);
  const rollingStart = startOfDay(schedule.registrationOpenDate);
  const rollingEnd = endOfDay(schedule.registrationCloseDate);

  const scheduleDayStart = startOfDay(schedule.scheduledDate);
  const scheduleDayEnd = endOfDay(schedule.scheduledDate);
  const startAt = explicitStart ? startOfDay(explicitStart) : (rollingStart || scheduleDayStart);
  const endAt = explicitEnd ? endOfDay(explicitEnd) : (rollingEnd || scheduleDayEnd);

  const source = explicitStart || explicitEnd
    ? 'date-window'
    : (rollingStart || rollingEnd ? 'rolling-window' : 'scheduled-day');

  return { startAt, endAt, source };
}

export function computeExamWindowStatus(schedule, now = new Date()) {
  const { startAt, endAt } = getEffectiveExamWindow(schedule);
  const nowDate = asValidDate(now) || new Date();

  if (startAt && nowDate.getTime() < startAt.getTime()) {
    return {
      status: 'upcoming',
      label: `Opens on ${formatDateTimeLabel(startAt)}`,
      startAt,
      endAt,
    };
  }

  if (endAt && nowDate.getTime() > endAt.getTime()) {
    return {
      status: 'closed',
      label: 'Closed',
      startAt,
      endAt,
    };
  }

  return {
    status: 'open',
    label: 'Open now',
    startAt,
    endAt,
  };
}

export function attachExamWindowStatus(schedule, now = new Date()) {
  if (!schedule) return schedule;
  const status = computeExamWindowStatus(schedule, now);
  return {
    ...schedule,
    examWindowStatus: status.status,
    examWindowStatusLabel: status.label,
    effectiveExamWindowStartAt: status.startAt,
    effectiveExamWindowEndAt: status.endAt,
  };
}

export function isNowWithinExamWindow(schedule, now = new Date()) {
  const status = computeExamWindowStatus(schedule, now);
  return status.status === 'open';
}

export function evaluateExamStartAvailability(schedule, now = new Date()) {
  if (!schedule) {
    return {
      allowed: false,
      code: 'VALIDATION_ERROR',
      message: 'This exam schedule is unavailable.',
    };
  }

  const status = computeExamWindowStatus(schedule, now);
  if (status.status === 'upcoming') {
    return {
      allowed: false,
      code: 'VALIDATION_ERROR',
      message: status.label,
    };
  }

  if (status.status === 'closed') {
    return {
      allowed: false,
      code: 'VALIDATION_ERROR',
      message: 'This exam window has already closed.',
    };
  }

  return { allowed: true };
}

export function computeScheduleSubmissionDeadline(schedule, graceMinutes = 0) {
  if (!schedule) return null;
  const { endAt } = getEffectiveExamWindow(schedule);
  if (!endAt) return null;
  return addMinutes(endAt, graceMinutes);
}

export function isSubmissionWithinScheduleWindow(schedule, now = new Date(), graceMinutes = 0) {
  const deadline = computeScheduleSubmissionDeadline(schedule, graceMinutes);
  if (!deadline) return true;
  const nowDate = asValidDate(now) || new Date();
  return nowDate.getTime() <= deadline.getTime();
}
