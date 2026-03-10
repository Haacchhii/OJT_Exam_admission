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
    Submitted: 'bg-gold-100 text-gold-700',
    'Under Screening': 'bg-blue-100 text-blue-700',
    'Under Evaluation': 'bg-purple-100 text-purple-700',
    Accepted: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Passed: 'bg-emerald-100 text-emerald-700',
    Failed: 'bg-red-100 text-red-700',
    scheduled: 'bg-blue-100 text-blue-700',
    started: 'bg-gold-100 text-gold-700',
    done: 'bg-emerald-100 text-emerald-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}
