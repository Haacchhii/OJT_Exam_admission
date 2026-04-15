function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function hasRollingWindow(schedule) {
  return Boolean(hasValue(schedule?.registrationOpenDate) || hasValue(schedule?.registrationCloseDate));
}

function addMinutes(date, minutes) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + Math.max(0, Number(minutes) || 0) * 60 * 1000);
}

function combineDateTime(dateIso, hhmm) {
  if (!hasValue(dateIso) || !hasValue(hhmm)) return null;
  const parsed = new Date(`${String(dateIso)}T${String(hhmm)}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function endOfDay(dateIso) {
  if (!hasValue(dateIso)) return null;
  const parsed = new Date(`${String(dateIso)}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function evaluateExamStartAvailability(schedule, todayIso, nowTime) {
  if (!schedule) {
    return {
      allowed: false,
      code: 'VALIDATION_ERROR',
      message: 'This exam schedule is unavailable.',
    };
  }

  if (hasRollingWindow(schedule)) {
    if (schedule.registrationOpenDate && todayIso < schedule.registrationOpenDate) {
      return {
        allowed: false,
        code: 'VALIDATION_ERROR',
        message: 'This exam window is not open yet.',
      };
    }
    if (schedule.registrationCloseDate && todayIso > schedule.registrationCloseDate) {
      return {
        allowed: false,
        code: 'VALIDATION_ERROR',
        message: 'This exam window has already closed.',
      };
    }
    return { allowed: true };
  }

  if (todayIso < schedule.scheduledDate) {
    return {
      allowed: false,
      code: 'VALIDATION_ERROR',
      message: 'This exam is not available yet.',
    };
  }
  if (todayIso > schedule.scheduledDate || nowTime > schedule.endTime) {
    return {
      allowed: false,
      code: 'VALIDATION_ERROR',
      message: 'This exam schedule has already ended.',
    };
  }
  if (nowTime < schedule.startTime) {
    return {
      allowed: false,
      code: 'VALIDATION_ERROR',
      message: 'This exam has not started yet.',
    };
  }

  return { allowed: true };
}

export function computeScheduleSubmissionDeadline(schedule, graceMinutes = 0) {
  if (!schedule) return null;

  if (hasRollingWindow(schedule) && hasValue(schedule.registrationCloseDate)) {
    const close = endOfDay(schedule.registrationCloseDate);
    return addMinutes(close, graceMinutes);
  }

  if (hasValue(schedule.scheduledDate) && hasValue(schedule.endTime)) {
    const close = combineDateTime(schedule.scheduledDate, schedule.endTime);
    return addMinutes(close, graceMinutes);
  }

  return null;
}

export function isSubmissionWithinScheduleWindow(schedule, now = new Date(), graceMinutes = 0) {
  const deadline = computeScheduleSubmissionDeadline(schedule, graceMinutes);
  if (!deadline) return true;
  return now.getTime() <= deadline.getTime();
}
