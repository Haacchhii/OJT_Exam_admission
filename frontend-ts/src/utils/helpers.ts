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
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
