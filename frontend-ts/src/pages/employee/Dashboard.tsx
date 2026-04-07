import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useAsync } from '../../hooks/useAsync';
import { getAdmissionsPage, getDashboardSummary, type EmployeeDashboardSummary } from '../../api/admissions';
import { StatCard, PageHeader, Badge, Pagination, usePaginationSlice, SkeletonPage, ErrorAlert } from '../../components/UI';
import { formatDate, badgeClass, formatPersonName } from '../../utils/helpers';
import { ADMISSION_IN_PROGRESS, GRADE_OPTIONS, ALL_GRADE_LEVELS } from '../../utils/constants';
import Icon from '../../components/Icons';
import type { Admission } from '../../types';

const PER_PAGE = 5;
const EXAMS_PER_PAGE = 8;
const SLA_DAYS = 7;

function daysPending(submittedAt: string) {
  return Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86400000);
}

export default function EmployeeDashboard() {
  const { user, canAccess, roleLabel } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelGroupFilter, setLevelGroupFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [examPage, setExamPage] = useState(1);

  const { socket, isConnected } = useSocket();

  const { data: rawData, loading, error, refetch } = useAsync<EmployeeDashboardSummary>(async () => {
    return getDashboardSummary();
  });

  const {
    data: admissionsPage,
    loading: admissionsLoading,
    error: admissionsError,
    refetch: refetchAdmissions,
  } = useAsync(async () => {
    const params: {
      page: number;
      limit: number;
      status?: string;
      levelGroup?: string;
      grade?: string;
      search?: string;
    } = { page, limit: PER_PAGE };

    if (statusFilter !== 'all') params.status = statusFilter;
    if (levelGroupFilter !== 'all') params.levelGroup = levelGroupFilter;
    if (gradeFilter !== 'all') params.grade = gradeFilter;
    if (search.trim()) params.search = search.trim();

    return getAdmissionsPage(params);
  }, [statusFilter, levelGroupFilter, gradeFilter, search, page], 0, { setLoadingOnReload: true });


  useEffect(() => {
    if (!socket || !isConnected) return;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const handleUpdate = () => {
      if (refetchTimer) return;
      refetchTimer = setTimeout(() => {
        refetchTimer = null;
        refetch();
        refetchAdmissions();
      }, 350);
    };
    socket.on('admission_status_updated', handleUpdate);
    return () => {
      socket.off('admission_status_updated', handleUpdate);
      if (refetchTimer) clearTimeout(refetchTimer);
    };
  }, [socket, isConnected, refetch, refetchAdmissions]);

  const admissions = admissionsPage?.data || [];
  const admissionsPagination = admissionsPage?.pagination || {
    page,
    limit: PER_PAGE,
    total: admissions.length,
    totalPages: 1,
  };

  const { paginated: paginatedExams, totalPages: examTotalPages, safePage: safeExamPage, totalItems: examTotalItems } = usePaginationSlice(rawData?.exams || [], examPage, EXAMS_PER_PAGE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: string) => { setStatusFilter(v); setPage(1); };
  const handleLevelGroup = (v: string) => { setLevelGroupFilter(v); setGradeFilter('all'); setPage(1); };
  const handleGrade = (v: string) => { setGradeFilter(v); setPage(1); };
  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;
  if (admissionsError && !admissionsPage) return <ErrorAlert error={admissionsError} onRetry={refetchAdmissions} />;

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <PageHeader title={`${roleLabel} Dashboard`} subtitle={
        user?.role === 'administrator' ? 'Full system overview — admissions, exams, and user management.' :
        user?.role === 'registrar' ? 'Monitor and manage admission applications.' :
        user?.role === 'teacher' ? 'Monitor exam registrations, scores, and essay reviews.' :
        'Monitor admission applications and exam activity.'
      } />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 animate-stagger">
        {canAccess('admissions') && <>
          <Link to="/employee/admissions"><StatCard icon="graduationCap" value={rawData?.stats?.total || 0} label="Total Applicants" color="blue" trend={rawData?.trends?.total} trendLabel="vs last week" /></Link>
          <Link to="/employee/admissions?status=Accepted"><StatCard icon="checkCircle" value={rawData?.stats?.accepted || 0} label="Accepted" color="emerald" trend={rawData?.trends?.accepted} trendLabel="vs last week" /></Link>
          <Link to="/employee/admissions"><StatCard icon="clock" value={(rawData?.stats?.submitted || 0) + (rawData?.stats?.underScreening || 0) + (rawData?.stats?.underEvaluation || 0)} label="In Progress" color="amber" trend={rawData?.trends?.inProgress} trendLabel="vs last week" /></Link>
          <Link to="/employee/admissions?status=Rejected"><StatCard icon="xCircle" value={rawData?.stats?.rejected || 0} label="Rejected" color="red" trend={rawData?.trends?.rejected} trendLabel="vs last week" /></Link>
          {(rawData?.overdue || 0) > 0 && <StatCard icon="exclamation" value={rawData?.overdue || 0} label={`Overdue (>${SLA_DAYS} days)`} color="red" />}
        </>}
        {canAccess('exams') && <>
          <Link to="/employee/exams"><StatCard icon="exam" value={rawData?.exams?.length || 0} label="Total Exams" color="blue" /></Link>
          <Link to="/employee/exams"><StatCard icon="chartBar" value={rawData?.completed || 0} label="Exams Taken" color="amber" /></Link>
        </>}
        {canAccess('results') && <>
          <Link to="/employee/results"><StatCard icon="documentText" value={rawData?.pendingEssays || 0} label="Pending Essays" color={(rawData?.pendingEssays || 0) > 0 ? 'amber' : 'emerald'} /></Link>
        </>}
      </div>

      {canAccess('admissions') && (
      <div className="gk-section-card mb-8">
        <h3 className="gk-heading-sm mb-5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center">
            <Icon name="admissions" className="w-4 h-4 text-forest-500" />
          </div>
          Recent Admission Submissions
        </h3>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex-1 relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <Icon name="search" className="w-4 h-4" />
            </div>
            <input
              value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="gk-input pl-10 w-full"
            />
          </div>
          <select value={statusFilter} onChange={e => handleStatus(e.target.value)} className="gk-input bg-white">
            <option value="all">All Status</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Screening">Under Screening</option>
            <option value="Under Evaluation">Under Evaluation</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select value={levelGroupFilter} onChange={e => handleLevelGroup(e.target.value)} className="gk-input bg-white">
            <option value="all">All Level Groups</option>
            {GRADE_OPTIONS.map(g => <option key={g.group} value={g.group}>{g.group}</option>)}
          </select>
          <select value={gradeFilter} onChange={e => handleGrade(e.target.value)} className="gk-input bg-white">
            <option value="all">All Grades</option>
              {(levelGroupFilter === 'all' ? ALL_GRADE_LEVELS : GRADE_OPTIONS.find(g => g.group === levelGroupFilter)?.items || []).map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="table-scroll">
          <table className="gk-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Student Name</th>
                <th scope="col">Grade Level</th>
                <th scope="col">Status</th>
                <th scope="col">Date Submitted</th>
                <th scope="col">Days Pending</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {admissionsLoading ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-8">Loading admissions...</td></tr>
              ) : admissions.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-8">No admissions match your filters.</td></tr>
              ) : admissions.map((a: Admission, i: number) => (
                <tr key={a.id}>
                  <td className="text-gray-400">{(admissionsPagination.page - 1) * PER_PAGE + i + 1}</td>
                  <td className="font-medium text-gray-800">{formatPersonName(a)}</td>
                  <td>{a.gradeLevel}</td>
                  <td><Badge className={badgeClass(a.status)}>{a.status}</Badge></td>
                  <td className="text-gray-500">{formatDate(a.submittedAt)}</td>
                  <td>{(ADMISSION_IN_PROGRESS as readonly string[]).includes(a.status) ? (
                    <span className={`text-sm font-semibold ${daysPending(a.submittedAt) > SLA_DAYS ? 'text-red-600' : daysPending(a.submittedAt) > 5 ? 'text-amber-600' : 'text-gray-500'}`}>{daysPending(a.submittedAt)}d</span>
                  ) : <span className="text-gray-400">—</span>}</td>
                  <td><Link to={`/employee/admissions?id=${a.id}`} className="text-forest-500 hover:text-forest-600 text-xs font-semibold transition-colors">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={admissionsPagination.page} totalPages={admissionsPagination.totalPages} onPageChange={setPage} totalItems={admissionsPagination.total} itemsPerPage={PER_PAGE} />
      </div>
      )}

      {canAccess('exams') && (
      <div className="gk-section-card">
        <h3 className="gk-heading-sm mb-5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-forest-50 flex items-center justify-center">
            <Icon name="exam" className="w-4 h-4 text-forest-500" />
          </div>
          Exam Activity Overview
        </h3>
        <div className="table-scroll">
          <table className="gk-table">
            <thead>
              <tr>
                <th scope="col">Exam</th>
                <th scope="col">Grade Level</th>
                <th scope="col">Questions</th>
                <th scope="col">Registrations</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedExams.map(exam => {
                return (
                  <tr key={exam.id}>
                    <td className="font-medium text-gray-800">{exam.title}</td>
                    <td>{exam.gradeLevel}</td>
                    <td>{exam.questionCount ?? 0}</td>
                    <td>{exam.registrations}</td>
                    <td><Badge className={exam.isActive ? 'gk-badge gk-badge-active' : 'gk-badge gk-badge-inactive'}>{exam.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td><Link to="/employee/exams" className="text-forest-500 hover:text-forest-600 text-xs font-semibold transition-colors">Manage</Link></td>
                  </tr>
                );
              })}
              {paginatedExams.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No exams created yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={safeExamPage} totalPages={examTotalPages} onPageChange={setExamPage} totalItems={examTotalItems} itemsPerPage={EXAMS_PER_PAGE} />
      </div>
      )}
    </div>
  );
}
