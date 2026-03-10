import { useState, useCallback } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { auditApi } from '../../api/auditLog';
import { PageHeader, SkeletonPage, ErrorAlert } from '../../components/UI';
import Icon from '../../components/Icons';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import type { AuditLog as AuditLogType } from '../../types';
import type { PaginatedAuditResponse } from '../../api/auditLog';

const ENTITY_OPTIONS = ['', 'admission', 'user', 'exam', 'result'];
const ENTITY_LABELS: Record<string, string> = { admission: 'Admission', user: 'User', exam: 'Exam', result: 'Result' };

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  delete: 'bg-red-100 text-red-700 border-red-200',
  score:  'bg-blue-100 text-blue-700 border-blue-200',
  submit: 'bg-purple-100 text-purple-700 border-purple-200',
  status: 'bg-amber-100 text-amber-700 border-amber-200',
  update: 'bg-sky-100 text-sky-700 border-sky-200',
  bulk:   'bg-amber-100 text-amber-700 border-amber-200',
};

function getActionColor(action: string): string {
  for (const [key, cls] of Object.entries(ACTION_COLORS)) {
    if (action.toLowerCase().includes(key)) return cls;
  }
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function formatDateLocal(date: string): string {
  return new Date(date).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDetails(details: unknown): string {
  if (!details) return '—';
  if (typeof details === 'string') return details;
  return Object.entries(details as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' · ');
}

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    const params: Record<string, string | number> = { page, limit: DEFAULT_PAGE_SIZE };
    if (search)   params.search = search;
    if (entity)   params.entity = entity;
    if (dateFrom) params.from = dateFrom;
    if (dateTo)   params.to = dateTo + 'T23:59:59';
    return auditApi.list(params as any);
  }, [page, search, entity, dateFrom, dateTo]);

  const { data, loading, error, refetch } = useAsync<PaginatedAuditResponse>(fetchLogs, [fetchLogs]);

  const logs = data?.data || [];
  const totalPages = data?.pagination?.totalPages || data?.totalPages || 1;

  if (loading && !data) return <div className="p-6"><SkeletonPage /></div>;
  if (error) return <div className="p-6"><ErrorAlert error={error} onRetry={refetch} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Trail" subtitle="Track all system actions and changes">
        <button onClick={refetch} className="border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50" title="Refresh">
          <Icon name="refresh" className="w-4 h-4" />
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="gk-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search actions, entities, details..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="gk-input pl-10 w-full"
            />
          </div>
          <select
            value={entity}
            onChange={e => { setEntity(e.target.value); setPage(1); }}
            className="gk-input"
          >
            <option value="">All Entities</option>
            {ENTITY_OPTIONS.filter(Boolean).map(e => (
              <option key={e} value={e}>{ENTITY_LABELS[e] || e}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="gk-input"
            placeholder="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="gk-input"
            placeholder="To date"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="gk-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Timestamp</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Entity</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">ID</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">Details</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wider">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <Icon name="shieldCheck" className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                    <p className="font-medium">No audit logs found</p>
                    <p className="text-xs mt-1">Actions will appear here as users interact with the system</p>
                  </td>
                </tr>
              ) : logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {formatDateLocal(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {log.user ? (
                      <div>
                        <p className="text-gray-700 text-xs font-medium">{log.user.firstName} {log.user.lastName}</p>
                        <p className="text-gray-500 text-[10px]">{log.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-xs">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs capitalize">{log.entity}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.entityId ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[300px] truncate" title={formatDetails(log.details)}>
                    {formatDetails(log.details)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{log.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages} ({(data as any)?.total || 0} total)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-50 text-xs disabled:opacity-30"
              >
                <Icon name="chevronLeft" className="w-3 h-3" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-50 text-xs disabled:opacity-30"
              >
                <Icon name="chevronRight" className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
