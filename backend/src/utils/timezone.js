export const MANILA_TIME_ZONE = 'Asia/Manila';

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getManilaDateParts(value = new Date()) {
  const date = toDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return null;

  return { year, month, day };
}

export function toManilaIsoDay(value = new Date()) {
  const parts = getManilaDateParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : null;
}

export function getManilaDateTimeParts(value = new Date()) {
  const date = toDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  if (!year || !month || !day || !hour || !minute) return null;

  return { year, month, day, hour, minute };
}

export function startOfManilaDay(value) {
  const parts = getManilaDateParts(value);
  if (!parts) return null;
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+08:00`);
}

export function endOfManilaDay(value) {
  const parts = getManilaDateParts(value);
  if (!parts) return null;
  return new Date(`${parts.year}-${parts.month}-${parts.day}T23:59:59.999+08:00`);
}

export function getManilaYear(value = new Date()) {
  const parts = getManilaDateParts(value);
  return parts ? Number(parts.year) : NaN;
}

export function formatManilaDate(value, options = {}) {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    ...options,
  }).format(date);
}

export function formatManilaDateTime(value) {
  const parts = getManilaDateTimeParts(value);
  if (!parts) return '';
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
