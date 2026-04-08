/** Generate a unique ID string, safe for high-frequency calls (CSV import). */
let _uidCounter = 0;
export function uid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${++_uidCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Safely normalise an API result that may be a raw array OR a paginated wrapper `{ data: T[] }`. */
export function asArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object' && 'data' in val && Array.isArray((val as any).data)) return (val as any).data;
  return [];
}

export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const dateOnlyMatch = String(isoString).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

interface FormatDateRangeOptions {
  openStartLabel?: string;
  openEndLabel?: string;
  separator?: string;
}

export function formatDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  options: FormatDateRangeOptions = {},
): string | null {
  if (!startDate && !endDate) return null;
  const {
    openStartLabel = 'Open',
    openEndLabel = 'Open',
    separator = ' - ',
  } = options;

  const startText = startDate ? formatDate(startDate) : openStartLabel;
  const endText = endDate ? formatDate(endDate) : openEndLabel;
  return `${startText}${separator}${endText}`;
}

export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return '—';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  if (isNaN(hour)) return '—';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function badgeClass(status: string): string {
  const map: Record<string, string> = {
    Submitted: 'gk-badge gk-badge-submitted',
    'Under Screening': 'gk-badge gk-badge-screening',
    'Under Evaluation': 'gk-badge gk-badge-evaluation',
    Accepted: 'gk-badge gk-badge-accepted',
    Rejected: 'gk-badge gk-badge-rejected',
    Passed: 'gk-badge gk-badge-passed',
    Failed: 'gk-badge gk-badge-failed',
    scheduled: 'gk-badge gk-badge-scheduled',
    started: 'gk-badge gk-badge-started',
    done: 'gk-badge gk-badge-done',
    Active: 'gk-badge gk-badge-active',
    Inactive: 'gk-badge gk-badge-inactive',
  };
  return map[status] || 'gk-badge gk-badge-inactive';
}

export function exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h] ?? '';
      return '"' + String(val).replace(/"/g, '""') + '"';
    }).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function formatPersonName(person: { firstName?: string | null; middleName?: string | null; lastName?: string | null }): string {
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ').trim();
}

export function personInitials(person: { firstName?: string | null; lastName?: string | null }): string {
  return `${(person.firstName || '')[0] || ''}${(person.lastName || '')[0] || ''}`.toUpperCase();
}
