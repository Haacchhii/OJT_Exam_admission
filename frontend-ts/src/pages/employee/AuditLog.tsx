import { useState, useCallback, useEffect } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { auditApi } from '../../api/auditLog';
import { PageHeader, SkeletonPage, ErrorAlert, ActionButton, SearchInput } from '../../components/UI';
import Icon from '../../components/Icons';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import type { AuditLog as AuditLogType } from '../../types';
import type { PaginatedAuditResponse } from '../../api/auditLog';
import { formatPersonName } from '../../utils/helpers';

type ViewMode = 'table' | 'timeline';

const ENTITY_OPTIONS = ['', 'admission', 'user', 'exam', 'result'];
const ENTITY_LABELS: Record<string, string> = { admission: 'Admission', user: 'User', exam: 'Exam', result: 'Result' };

const ACTION_BADGE: Record<string, string> = {
  create: 'gk-badge gk-badge-create',
  delete: 'gk-badge gk-badge-delete',
  score:  'gk-badge gk-badge-score',
  submit: 'gk-badge gk-badge-submit',
  status: 'gk-badge gk-badge-status',
  update: 'gk-badge gk-badge-update',
  bulk:   'gk-badge gk-badge-status',
};

function getActionBadge(action: string): string {
  for (const [key, cls] of Object.entries(ACTION_BADGE)) {
    if (action.toLowerCase().includes(key)) return cls;
  }
  return 'gk-badge gk-badge-neutral';
}

function formatDateLocal(date: string): string {
  return new Date(date).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDetails(details: unknown): string {
  if (!details) return '-';
  if (typeof details === 'string') return details;
  return Object.entries(details as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' | ');
}

function downloadCSV(logs: any[], filters: { search?: string; entity?: string; dateFrom?: string; dateTo?: string }) {
  const headers = ['Timestamp', 'User', 'Email', 'Action', 'Entity', 'Entity ID', 'Details', 'IP Address'];
  const rows = logs.map(log => [
    new Date(log.createdAt).toLocaleString('en-PH'),
    log.user ? formatPersonName(log.user) : 'System',
    log.user?.email || '-',
    log.action,
    log.entity,
    log.entityId ?? '-',
    formatDetails(log.details),
    log.ipAddress || '-',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().split('T')[0];
  const filterDesc = [
    filters.entity ? `entity=${filters.entity}` : '',
    filters.dateFrom ? `from=${filters.dateFrom}` : '',
    filters.dateTo ? `to=${filters.dateTo}` : '',
  ].filter(Boolean).join('_');
  
  link.setAttribute('href', URL.createObjectURL(blob));
  link.setAttribute('download', `audit-logs_${timestamp}${filterDesc ? '_' + filterDesc : ''}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function TimelineView({ logs }: { logs: any[] }) {
  return (
    <div className="gk-section-card overflow-hidden">
      <div className="relative py-6 px-4 sm:px-8">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Icon name="shieldCheck" className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p className="font-medium">No audit logs found</p>
            <p className="text-xs mt-1">Actions will appear here as users interact with the system</p>
          </div>
        ) : (
          <div className="space-y-6">
            {logs.map((log, idx) => (
              <div key={log.id} className="flex gap-4 relative">
                {/* Timeline dot and line */}
                <div className="flex flex-col items-center">
                  <div className={`w-4 h-4 rounded-full border-2 ${getActionBadge(log.action).includes('create') ? 'bg-green-100 border-green-500' : getActionBadge(log.action).includes('delete') ? 'bg-red-100 border-red-500' : getActionBadge(log.action).includes('status') ? 'bg-blue-100 border-blue-500' : 'bg-gray-100 border-gray-400'}`} />
                  {idx < logs.length - 1 && <div className="w-0.5 h-16 bg-gray-200 mt-2" />}
                </div>

                {/* Timeline content */}
                <div className="flex-1 pb-4">
                  <div className="gk-section-card bg-gray-50 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs font-mono text-gray-500">{formatDateLocal(log.createdAt)}</p>
                        <p className="text-sm font-medium text-gray-800 mt-1">
                          {log.user ? formatPersonName(log.user) : 'System'}
                          {log.user?.email && <span className="text-xs text-gray-500 ml-2">({log.user.email})</span>}
                        </p>
                      </div>
                      <span className={`${getActionBadge(log.action)} !text-xs uppercase`}>
                        {log.action}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-gray-600">
                      <p><span className="font-semibold">Entity:</span> {log.entity} {log.entityId ? `#${log.entityId}` : ''}</p>
                      {formatDetails(log.details) !== '-' && <p><span className="font-semibold">Details:</span> {formatDetails(log.details)}</p>}
                      {log.ipAddress && <p><span className="font-semibold">From:</span> {log.ipAddress}</p>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const [userRole, setUserRole] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchLogs = useCallback(async () => {
    const params: Record<string, string | number> = { page, limit: DEFAULT_PAGE_SIZE };
    if (search)   params.search = search;
    if (entity)   params.entity = entity;
    if (dateFrom) params.from = dateFrom;
    if (dateTo)   params.to = dateTo + 'T23:59:59';
    return auditApi.list(params as any);
  }, [page, search, entity, dateFrom, dateTo]);

  const { data, loading, error, refetch } = useAsync<PaginatedAuditResponse>(
    fetchLogs,
    [fetchLogs],
    0,
    { setLoadingOnReload: true }
  );

  const logs = data?.data || [];
  const filteredLogs = userRole
    ? logs.filter(log => log.user?.role?.toLowerCase() === userRole.toLowerCase())
    : logs;
  const totalPages = data?.pagination?.totalPages || data?.totalPages || 1;

  if (loading && !data) return <div className="p-6"><SkeletonPage /></div>;
  if (error) return <div className="p-6"><ErrorAlert error={error} onRetry={refetch} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Trail" subtitle="Track all system actions and changes">
        <div className="flex gap-2 flex-wrap">
          <ActionButton
            variant={viewMode === 'table' ? 'primary' : 'secondary'}
            icon={<Icon name="table" className="w-4 h-4" />}
            onClick={() => setViewMode('table')}
            title="Table view"
            aria-label="Switch to table view"
          >
            Table
          </ActionButton>
          <ActionButton
            variant={viewMode === 'timeline' ? 'primary' : 'secondary'}
            icon={<Icon name="clock" className="w-4 h-4" />}
            onClick={() => setViewMode('timeline')}
            title="Timeline view"
            aria-label="Switch to timeline view"
          >
            Timeline
          </ActionButton>
          <ActionButton
            variant="secondary"
            icon={<Icon name="download" className="w-4 h-4" />}
            onClick={() => downloadCSV(filteredLogs, { search, entity, dateFrom, dateTo })}
            disabled={filteredLogs.length === 0}
            title="Download as CSV"
            aria-label="Export audit logs to CSV"
          >
            Export
          </ActionButton>
          <ActionButton
            variant="secondary"
            icon={<Icon name="refresh" className="w-4 h-4" />}
            onClick={refetch}
            title="Refresh"
            aria-label="Refresh audit log"
          >
            Refresh
          </ActionButton>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="gk-section-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <SearchInput
            value={searchInput}
            onChange={(value) => { setSearchInput(value); setPage(1); }}
            placeholder="Search actions, entities, details..."
            ariaLabel="Search audit logs"
          />
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
          <select
            value={userRole}
            onChange={e => { setUserRole(e.target.value); setPage(1); }}
            className="gk-input"
          >
            <option value="">All Users</option>
            <option value="administrator">Administrator</option>
            <option value="registrar">Registrar</option>
            <option value="teacher">Teacher</option>
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

      {/* View Content */}
      {viewMode === 'table' ? (
        <div className="gk-section-card overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="gk-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>ID</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10" />
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <Icon name="shieldCheck" className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                      <p className="font-medium">No audit logs found</p>
                      <p className="text-xs mt-1">Actions will appear here as users interact with the system</p>
                    </td>
                  </tr>
                ) : filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {formatDateLocal(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <div>
                          <p className="text-gray-700 text-xs font-medium">{formatPersonName(log.user)}</p>
                          <p className="text-gray-500 text-xs">{log.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`${getActionBadge(log.action)} !text-xs uppercase`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs capitalize">{log.entity}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.entityId ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[300px] truncate" title={formatDetails(log.details)}>
                      {formatDetails(log.details)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{log.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px] pointer-events-none">
                <div className="inline-flex items-center gap-2 rounded-full border border-forest-100 bg-white px-3 py-1.5 text-xs font-semibold text-forest-600 shadow-sm">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-forest-200 border-t-forest-500 animate-spin" />
                  Loading audit logs...
                </div>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages} ({(data as any)?.total || 0} total)
              </p>
              <div className="flex gap-1">
                <ActionButton
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  variant="secondary"
                  size="sm"
                >
                  <Icon name="chevronLeft" className="w-3 h-3" />
                </ActionButton>
                <ActionButton
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  variant="secondary"
                  size="sm"
                >
                  <Icon name="chevronRight" className="w-3 h-3" />
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      ) : (
        <TimelineView logs={filteredLogs} />
      )}
    </div>
  );
}
