import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../../hooks/useAsync';
import { getAdmissionsPage, getStats, bulkUpdateStatus, bulkDeleteAdmissions, VALID_TRANSITIONS } from '../../../api/admissions';
import { invalidateResourceCache } from '../../../api/client';
import { getAcademicYears, getSemesters } from '../../../api/academicYears';
import { showToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { PageHeader, Badge, EmptyState, Pagination, SkeletonPage, ErrorAlert, ActionButton, SearchInput } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { formatDate, badgeClass, exportToCSV, formatPersonName } from '../../../utils/helpers';
import { ADMISSION_STATUSES, ADMISSION_IN_PROGRESS, GRADE_OPTIONS, ALL_GRADE_LEVELS } from '../../../utils/constants';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import type { Admission, AdmissionStats, AcademicYear, Semester } from '../../../types';

const PER_PAGE = 10;
const SLA_DAYS = 7;

function semesterLabel(s: Semester) {
  const start = s.startDate ? formatDate(String(s.startDate)) : null;
  const end = s.endDate ? formatDate(String(s.endDate)) : null;
  if (start || end) return `${s.name} (${start || 'open'} - ${end || 'open'})`;
  return s.name;
}

function daysPending(submittedAt: string) {
  return Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86400000);
}

interface RawData {
  stats: AdmissionStats;
  admissionsPage: {
    data: Admission[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface Props {
  onShowDetail: (id: number) => void;
  directStatus: string | null;
}

export default function AdmissionList({ onShowDetail, directStatus }: Props) {
  const { user } = useAuth();
  const canManage = user?.role === 'administrator' || user?.role === 'registrar';
  const confirm = useConfirm();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(directStatus || 'all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [levelGroupFilter, setLevelGroupFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [yearFilter, setYearFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [staleOnly, setStaleOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>('Submitted');
  const [saving, setSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: rawData, loading, error, refetch } = useAsync<RawData>(async () => {
    const statsParams: Record<string, unknown> = {};
    if (gradeFilter !== 'all') statsParams.grade = gradeFilter;
    if (levelGroupFilter !== 'all') statsParams.levelGroup = levelGroupFilter;
    if (yearFilter !== 'all') statsParams.academicYearId = Number(yearFilter);
    if (semesterFilter !== 'all') statsParams.semesterId = Number(semesterFilter);

    const admissionParams: Record<string, unknown> = {
      page,
      limit: PER_PAGE,
      sort: sortBy,
      staleOnly,
      slaDays: SLA_DAYS,
    };
    if (filter !== 'all') admissionParams.status = filter;
    if (gradeFilter !== 'all') admissionParams.grade = gradeFilter;
    if (levelGroupFilter !== 'all') admissionParams.levelGroup = levelGroupFilter;
    if (yearFilter !== 'all') admissionParams.academicYearId = Number(yearFilter);
    if (semesterFilter !== 'all') admissionParams.semesterId = Number(semesterFilter);
    if (search.trim()) admissionParams.search = search.trim();

    const [stats, admissionsPage] = await Promise.all([
      getStats(statsParams),
      getAdmissionsPage(admissionParams),
    ]);
    return { stats, admissionsPage };
  }, [filter, levelGroupFilter, gradeFilter, yearFilter, semesterFilter, sortBy, search, staleOnly, page], 0, {
    setLoadingOnReload: true,
    autoRefreshOnDataChange: true,
    resourcePrefixes: ['/admissions'],
  });

  const { data: stalePreview, refetch: refetchStalePreview } = useAsync(async () => {
    if (!canManage) {
      return { data: [] as Admission[], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
    }
    return getAdmissionsPage({ staleOnly: true, slaDays: SLA_DAYS, page: 1, limit: 20 });
  }, [canManage], 0, { autoRefreshOnDataChange: true, resourcePrefixes: ['/admissions'] });


  useEffect(() => {
    if (!socket || !isConnected) return;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const handleStatusUpdate = () => {
      if (refetchTimer) return;
      refetchTimer = setTimeout(() => {
        refetchTimer = null;
        invalidateResourceCache(['/admissions']);
        refetch();
        refetchStalePreview();
      }, 350);
    };

    socket.on('admission_status_updated', handleStatusUpdate);
    socket.on('admission_bulk_status_updated', handleStatusUpdate);

    return () => {
      socket.off('admission_status_updated', handleStatusUpdate);
      socket.off('admission_bulk_status_updated', handleStatusUpdate);
      if (refetchTimer) clearTimeout(refetchTimer);
    };
  }, [socket, isConnected, refetch, refetchStalePreview]);

  const { data: academicYears } = useAsync<AcademicYear[]>(() => getAcademicYears());
  const { data: allSemesters } = useAsync<Semester[]>(() => getSemesters());

  const semesterOptions = useMemo(() => {
    const list = allSemesters || [];
    if (yearFilter === 'all') return list;
    return list.filter(s => s.academicYearId === Number(yearFilter));
  }, [allSemesters, yearFilter]);

  const admissions = rawData?.admissionsPage?.data || [];
  const pagination = rawData?.admissionsPage?.pagination || { page: 1, limit: PER_PAGE, total: 0, totalPages: 1 };

  const staleAdmissions = stalePreview?.data || [];
  const staleCount = stalePreview?.pagination?.total || 0;

  useEffect(() => {
    setSelected(new Set());
  }, [page, filter, levelGroupFilter, gradeFilter, yearFilter, semesterFilter, sortBy, search, staleOnly]);

  useEffect(() => {
    if (page > pagination.totalPages && pagination.totalPages > 0) {
      setPage(pagination.totalPages);
    }
  }, [page, pagination.totalPages]);

  const resetPage = () => setPage(1);

  const toggleSelect = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (admissions.every((a: Admission) => selected.has(a.id))) {
      setSelected(s => { const n = new Set(s); admissions.forEach((a: Admission) => n.delete(a.id)); return n; });
    } else {
      setSelected(s => { const n = new Set(s); admissions.forEach((a: Admission) => n.add(a.id)); return n; });
    }
  };

  const handleBulkAction = async () => {
    if (selected.size === 0 || saving) return;
    const validIds: number[] = [];
    const skippedIds: number[] = [];
    selected.forEach(id => {
      const adm = admissions.find(a => a.id === id);
      if (!adm) return;
      const allowed = VALID_TRANSITIONS[adm.status] || [];
      if (adm.status === bulkStatus || (allowed as string[]).includes(bulkStatus)) {
        validIds.push(id);
      } else {
        skippedIds.push(id);
      }
    });
    if (validIds.length === 0) {
      showToast(`None of the selected applications can transition to "${bulkStatus}".`, 'error');
      return;
    }
    const skipNote = skippedIds.length > 0 ? ` (${skippedIds.length} will be skipped due to invalid transitions)` : '';
    const ok = await confirm({
      title: `Bulk ${bulkStatus}`,
      message: `Are you sure you want to mark ${validIds.length} application(s) as "${bulkStatus}"?${skipNote}`,
      confirmLabel: `${bulkStatus} All`,
      variant: bulkStatus === 'Rejected' ? 'danger' : 'info',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await bulkUpdateStatus(validIds, bulkStatus);
      showToast(`${validIds.length} application(s) updated to ${bulkStatus}.${skippedIds.length ? ` ${skippedIds.length} skipped.` : ''}`, 'success');
      setSelected(new Set());
      refetch();
      refetchStalePreview();
    } catch (err: any) {
      showToast('Bulk update failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0 || bulkDeleting) return;
    const ids = [...selected];
    const ok = await confirm({
      title: 'Delete Selected Applications',
      message: `Are you sure you want to delete ${ids.length} application(s)? This action cannot be undone.`,
      variant: 'danger',
      confirmLabel: `Delete ${ids.length} Application(s)`,
    });
    if (!ok) return;
    setBulkDeleting(true);
    try {
      await bulkDeleteAdmissions(ids);
      showToast(`${ids.length} application(s) deleted.`, 'info');
      setSelected(new Set());
      refetch();
      refetchStalePreview();
    } catch {
      showToast('Failed to delete applications.', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const copyEscalationDraft = async () => {
    if (staleAdmissions.length === 0) return;
    const lines = [
      'Admissions Escalation Draft',
      `Date: ${new Date().toLocaleDateString()}`,
      `Over-SLA applications: ${staleCount}`,
      '',
      ...staleAdmissions.slice(0, 20).map(a => {
        const name = formatPersonName(a);
        return `#${a.id} | ${name} | ${a.status} | ${daysPending(a.submittedAt)}d pending`;
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('Escalation draft copied to clipboard.', 'success');
    } catch {
      showToast('Could not copy escalation draft. Please try again.', 'error');
    }
  };

  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  const tabs = [
    { key: 'all', label: 'All', count: rawData?.stats?.total || 0 },
    { key: 'Submitted', label: 'Submitted', count: rawData?.stats?.submitted || 0 },
    { key: 'Under Screening', label: 'Screening', count: rawData?.stats?.underScreening || 0 },
    { key: 'Under Evaluation', label: 'Evaluation', count: rawData?.stats?.underEvaluation || 0 },
    { key: 'Accepted', label: 'Accepted', count: rawData?.stats?.accepted || 0 },
    { key: 'Rejected', label: 'Rejected', count: rawData?.stats?.rejected || 0 },
  ];

  const registeredApplicants = rawData?.stats?.registeredApplicants || 0;
  const applicantsWithoutAdmissions = rawData?.stats?.applicantsWithoutAdmissions || 0;
  const unverifiedApplicants = rawData?.stats?.unverifiedApplicants || 0;
  const inactiveApplicants = rawData?.stats?.inactiveApplicants || 0;

  return (
    <div>
              <PageHeader title="All Admission Applications">
          <ActionButton
            variant="secondary"
            icon={<Icon name="download" className="w-4 h-4" />}
            onClick={() => exportToCSV(admissions.map(a => ({
              'System ID': a.id,
              'First Name': a.firstName,
              'Middle Name': a.middleName || '',
              'Last Name': a.lastName,
              'Email': a.email,
              'Grade Level': a.gradeLevel,
              'Status': a.status,
              'Submitted At': formatDate(a.submittedAt)
            })), 'Admissions_Export.csv')}
            title="Download full list as CSV"
          >
            Export
          </ActionButton>
        </PageHeader>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          className="flex-1"
          value={searchInput}
          onChange={(value) => { setSearchInput(value); resetPage(); }}
          placeholder="Search by name or email..."
          ariaLabel="Search applications"
        />
        <select value={filter} onChange={e => { setFilter(e.target.value); resetPage(); }} aria-label="Filter by status" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
          <option value="all">All Status</option>
          {ADMISSION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>          <select value={levelGroupFilter} onChange={e => { setLevelGroupFilter(e.target.value); setGradeFilter('all'); resetPage(); }} aria-label="Filter by level group" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
              <option value="all">All Level Groups</option>
              {GRADE_OPTIONS.map(g => <option key={g.group} value={g.group}>{g.group}</option>)}
            </select>        <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); resetPage(); }} aria-label="Filter by grade" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
            <option value="all">All Grades</option>
            {(levelGroupFilter === 'all' ? ALL_GRADE_LEVELS : GRADE_OPTIONS.find(g => g.group === levelGroupFilter)?.items || []).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setSemesterFilter('all'); resetPage(); }} aria-label="Filter by school year" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
          <option value="all">All Years</option>
          {(academicYears || []).map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
        </select>
        <select value={semesterFilter} onChange={e => { setSemesterFilter(e.target.value); resetPage(); }} aria-label="Filter by semester" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
          <option value="all">All Semesters</option>
          {semesterOptions.map(s => <option key={s.id} value={s.id}>{semesterLabel(s)}</option>)}
        </select>
        <select value={sortBy} onChange={e => { setSortBy(e.target.value); resetPage(); }} aria-label="Sort by" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name A-Z</option>
          <option value="status">Status</option>
        </select>
      </div>

      <div className="inline-flex gap-2 mb-4 flex-wrap p-1.5 rounded-2xl border border-gray-200 bg-white/80 shadow-sm" role="tablist" aria-label="Admission status tabs">
        {tabs.map(t => (
          <button key={t.key} role="tab" aria-selected={filter === t.key} onClick={() => { setFilter(t.key); resetPage(); }} className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${filter === t.key ? 'bg-gradient-to-r from-forest-600 to-forest-500 text-white border-forest-600 shadow-[0_8px_20px_rgba(21,128,61,0.28)]' : 'bg-white text-gray-600 border-gray-200 hover:border-forest-200 hover:text-forest-700 hover:bg-forest-50'}`}>
            {t.label} ({t.count})
            {filter === t.key && <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gold-300" />}
          </button>
        ))}
      </div>

      {canManage && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ActionButton
            size="sm"
            variant={staleOnly ? 'danger' : 'secondary'}
            onClick={() => { setStaleOnly(v => !v); resetPage(); }}
          >
            {staleOnly ? 'Showing Over-SLA Only' : `Show Over-SLA Only (${staleCount})`}
          </ActionButton>
          <ActionButton
            size="sm"
            variant="secondary"
            icon={<Icon name="clipboard" className="w-3.5 h-3.5" />}
            onClick={copyEscalationDraft}
            disabled={staleCount === 0}
          >
            Copy Escalation Draft
          </ActionButton>
        </div>
      )}

      {canManage && staleCount > 0 && !staleOnly && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center gap-2">
          <Icon name="exclamation" className="w-4 h-4" />
          <span>{staleCount} application(s) are over SLA ({SLA_DAYS}+ days in progress).</span>
          <button
            onClick={() => { setStaleOnly(true); resetPage(); }}
            className="ml-auto text-xs font-semibold underline hover:no-underline"
          >
            Review Now
          </button>
        </div>
      )}

      {canManage && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <p className="font-semibold">Applicant account visibility</p>
          <p className="mt-1 text-blue-700">
            Accounts created through registration do not appear in this table until they submit an admission application.
          </p>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border border-blue-100 bg-white px-2.5 py-2">
              <p className="text-blue-600">Registered applicants</p>
              <p className="font-bold text-blue-900">{registeredApplicants}</p>
            </div>
            <div className="rounded-md border border-blue-100 bg-white px-2.5 py-2">
              <p className="text-blue-600">No submission yet</p>
              <p className="font-bold text-blue-900">{applicantsWithoutAdmissions}</p>
            </div>
            <div className="rounded-md border border-blue-100 bg-white px-2.5 py-2">
              <p className="text-blue-600">Unverified emails</p>
              <p className="font-bold text-blue-900">{unverifiedApplicants}</p>
            </div>
            <div className="rounded-md border border-blue-100 bg-white px-2.5 py-2">
              <p className="text-blue-600">Inactive applicant accounts</p>
              <p className="font-bold text-blue-900">{inactiveApplicants}</p>
            </div>
          </div>
          <div className="mt-2">
            <Link to="/employee/users" className="text-xs font-semibold underline hover:no-underline">
              Open Users page to inspect registered applicant accounts
            </Link>
          </div>
        </div>
      )}

      <div className="gk-section-card p-4 mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Icon name="clock" className="w-4 h-4 text-forest-500" /> Queue Process Guide
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="font-semibold text-gray-700">Submitted</p>
            <p className="text-gray-500">Target: move to screening within 1-3 business days.</p>
            <p className="text-xs text-gray-400 mt-1">Action: verify required documents and applicant profile fields.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="font-semibold text-gray-700">Under Screening</p>
            <p className="text-gray-500">Target: resolve checks within 2-5 business days.</p>
            <p className="text-xs text-gray-400 mt-1">Action: request missing items and add clear notes for the next reviewer.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="font-semibold text-gray-700">Under Evaluation</p>
            <p className="text-gray-500">Target: finalize decision within 5-10 business days from submission.</p>
            <p className="text-xs text-gray-400 mt-1">Action: set Accepted/Rejected with concise decision rationale.</p>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {canManage && selected.size > 0 ? (
        <div className="flex items-center gap-3 mb-4 bg-forest-50 border border-forest-200 rounded-lg px-4 py-3 animate-[fadeInUp_0.2s_ease-out]">
          <span className="text-sm font-semibold text-forest-700">{selected.size} selected</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-forest-500/20 outline-none">
            {ADMISSION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ActionButton onClick={handleBulkAction} loading={saving} className="min-w-[120px]">{saving ? 'Applying...' : 'Apply Status'}</ActionButton>
          <ActionButton onClick={handleBulkDelete} loading={bulkDeleting} variant="danger" icon={!bulkDeleting ? <Icon name="trash" className="w-3.5 h-3.5" /> : undefined} className="min-w-[140px]">{bulkDeleting ? 'Deleting...' : 'Delete Selected'}</ActionButton>
          <ActionButton onClick={() => setSelected(new Set())} variant="ghost" className="ml-auto">Clear selection</ActionButton>
        </div>
      ) : canManage ? (
        <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
          <Icon name="info" className="w-3.5 h-3.5" />
          <span>Use checkboxes to select multiple applications for bulk status changes or deletion.</span>
        </div>
      ) : null}

      <div className="gk-section-card p-4">
        {admissions.length > 0 || loading ? (
          <>
            <div className="relative table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs">
                    {canManage && <th scope="col" className="py-3 px-2 w-8"><input type="checkbox" checked={admissions.length > 0 && admissions.every((a: Admission) => selected.has(a.id))} onChange={toggleAll} className="accent-forest-500 rounded" /></th>}
                    <th scope="col" className="py-3 px-2">ID</th><th scope="col" className="py-3 px-2">Student Name</th><th scope="col" className="py-3 px-2">Email</th>
                    <th scope="col" className="py-3 px-2">Grade Level</th><th scope="col" className="py-3 px-2">Type</th><th scope="col" className="py-3 px-2">Documents</th><th scope="col" className="py-3 px-2">Status</th>
                    <th scope="col" className="py-3 px-2">Submitted</th><th scope="col" className="py-3 px-2">Days</th><th scope="col" className="py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={canManage ? 11 : 10} className="py-8 px-4" />
                    </tr>
                  ) : admissions.map((a: Admission) => (
                    <tr key={a.id} onClick={() => onShowDetail(a.id)} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${selected.has(a.id) ? 'bg-gold-50/50' : ''}`}>
                      {canManage && <td className="py-3 px-2" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} className="accent-forest-500 rounded" /></td>}
                      <td className="py-3 px-2 text-gray-400">{a.id}</td>
                      <td className="py-3 px-2 font-medium text-forest-500">{formatPersonName(a)}</td>
                      <td className="py-3 px-2 text-gray-500">{a.email}</td>
                      <td className="py-3 px-2">{a.gradeLevel}</td>
                      <td className="py-3 px-2"><Badge variant="info">{a.applicantType || 'New'}</Badge></td>
                      <td className="py-3 px-2">{a.documents.length} file(s)</td>
                      <td className="py-3 px-2"><Badge className={badgeClass(a.status)}>{a.status}</Badge></td>
                      <td className="py-3 px-2 text-gray-500">{formatDate(a.submittedAt)}</td>
                      <td className="py-3 px-2">{(ADMISSION_IN_PROGRESS as readonly string[]).includes(a.status) ? (
                        <span className={`text-xs font-semibold ${daysPending(a.submittedAt) > SLA_DAYS ? 'text-red-600' : daysPending(a.submittedAt) > 5 ? 'text-amber-600' : 'text-gray-500'}`}>{daysPending(a.submittedAt)}d</span>
                      ) : <span className="text-gray-400">-</span>}</td>
                      <td className="py-3 px-2"><button onClick={(e) => { e.stopPropagation(); onShowDetail(a.id); }} className="text-forest-500 hover:underline text-xs font-medium">View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px] pointer-events-none">
                  <div className="inline-flex items-center gap-2 rounded-full border border-forest-100 bg-white px-3 py-1.5 text-xs font-semibold text-forest-600 shadow-sm">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-forest-200 border-t-forest-500 animate-spin" />
                    Loading applications...
                  </div>
                </div>
              )}
            </div>
            <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} totalItems={pagination.total} itemsPerPage={PER_PAGE} />
          </>
        ) : (
          <EmptyState icon="inbox" title="No applications found" text={search ? `No applications match "${search}"${filter !== 'all' ? ` with status "${filter}"` : ''}. Registered accounts with no submission: ${applicantsWithoutAdmissions}.` : filter !== 'all' ? `No applications with status "${filter}". Registered accounts with no submission: ${applicantsWithoutAdmissions}.` : `No admission applications match your current filters. Registered accounts with no submission: ${applicantsWithoutAdmissions}.`} />
        )}
      </div>
    </div>
  );
}

