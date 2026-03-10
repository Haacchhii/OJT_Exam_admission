import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getAdmissions, getStats } from '../../api/admissions.js';
import { getExams, getExamSchedules, getExamRegistrations } from '../../api/exams.js';
import { getExamResults, getEssayAnswers } from '../../api/results.js';
import { StatCard, PageHeader, Badge, Pagination, usePaginationSlice, SkeletonPage, ErrorAlert } from '../../components/UI.jsx';
import { formatDate, badgeClass } from '../../utils/helpers.js';
import { ADMISSION_IN_PROGRESS } from '../../utils/constants.js';
import Icon from '../../components/Icons.jsx';

const PER_PAGE = 5;

export default function EmployeeDashboard() {
  const { user, canAccess, roleLabel } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data: rawData, loading, error, refetch } = useAsync(async () => {
    // Only fetch data the user's role is authorized to see
    const canAdm = canAccess('admissions');
    const canExm = canAccess('exams');
    const canRes = canAccess('results');

    const [stats, admissions, exams, schedules, regs, results, essayAnswers] = await Promise.all([
      canAdm ? getStats() : Promise.resolve({ total:0, submitted:0, underScreening:0, underEvaluation:0, accepted:0, rejected:0 }),
      canAdm ? getAdmissions() : Promise.resolve([]),
      canExm ? getExams() : Promise.resolve([]),
      canExm ? getExamSchedules() : Promise.resolve([]),
      canExm ? getExamRegistrations() : Promise.resolve([]),
      canRes ? getExamResults() : Promise.resolve([]),
      canRes ? getEssayAnswers().catch(() => []) : Promise.resolve([]),
    ]);
    const pendingEssays = essayAnswers.filter(e => !e.scored).length;
    const completed = regs.filter(r => r.status === 'done').length;
    const avgScore = results.length > 0 ? (results.reduce((s, r) => s + r.percentage, 0) / results.length).toFixed(0) : 0;
    const grades = [...new Set(admissions.map(a => a.gradeLevel).filter(Boolean))].sort();

    // Compute weekly trends (this week vs last week)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const thisWeek = admissions.filter(a => new Date(a.submittedAt) >= weekAgo);
    const lastWeek = admissions.filter(a => { const d = new Date(a.submittedAt); return d >= twoWeeksAgo && d < weekAgo; });
    const pct = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
    const trends = {
      total: pct(thisWeek.length, lastWeek.length),
      accepted: pct(thisWeek.filter(a => a.status === 'Accepted').length, lastWeek.filter(a => a.status === 'Accepted').length),
      inProgress: pct(thisWeek.filter(a => ADMISSION_IN_PROGRESS.includes(a.status)).length, lastWeek.filter(a => ADMISSION_IN_PROGRESS.includes(a.status)).length),
      rejected: pct(thisWeek.filter(a => a.status === 'Rejected').length, lastWeek.filter(a => a.status === 'Rejected').length),
    };

    return { stats, admissions, exams, schedules, regs, results, pendingEssays, completed, avgScore, grades, trends };
  });

  const filtered = useMemo(() => {
    let list = rawData?.admissions || [];
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (gradeFilter !== 'all') list = list.filter(a => a.gradeLevel === gradeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(q));
    }
    return list;
  }, [rawData, statusFilter, gradeFilter, search]);

  const { paginated, totalPages, safePage, totalItems } = usePaginationSlice(filtered, page, PER_PAGE);

  // Reset page when filters change
  const handleSearch = (v) => { setSearch(v); setPage(1); };
  const handleStatus = (v) => { setStatusFilter(v); setPage(1); };
  const handleGrade = (v) => { setGradeFilter(v); setPage(1); };

  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <PageHeader title={`${roleLabel} Dashboard`} subtitle={
        user.role === 'administrator' ? 'Full system overview — admissions, exams, and user management.' :
        user.role === 'registrar' ? 'Monitor and manage admission applications.' :
        user.role === 'teacher' ? 'Monitor exam registrations, scores, and essay reviews.' :
        'Monitor admission applications and exam activity.'
      } />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-stagger">
        {/* Admission stats — visible to administrator and registrar */}
        {canAccess('admissions') && <>
          <Link to="/employee/admissions"><StatCard icon="graduationCap" value={rawData?.stats?.total || 0} label="Total Applicants" color="blue" trend={rawData?.trends?.total} trendLabel="vs last week" /></Link>
          <Link to="/employee/admissions?status=Accepted"><StatCard icon="checkCircle" value={rawData?.stats?.accepted || 0} label="Accepted" color="emerald" trend={rawData?.trends?.accepted} trendLabel="vs last week" /></Link>
          <Link to="/employee/admissions"><StatCard icon="clock" value={(rawData?.stats?.submitted || 0) + (rawData?.stats?.underScreening || 0) + (rawData?.stats?.underEvaluation || 0)} label="In Progress" color="amber" trend={rawData?.trends?.inProgress} trendLabel="vs last week" /></Link>
          <Link to="/employee/admissions?status=Rejected"><StatCard icon="xCircle" value={rawData?.stats?.rejected || 0} label="Rejected" color="red" trend={rawData?.trends?.rejected} trendLabel="vs last week" /></Link>
        </>}
        {/* Exam stats — visible to administrator and teacher */}
        {canAccess('exams') && <>
          <Link to="/employee/exams"><StatCard icon="exam" value={rawData?.exams?.length || 0} label="Total Exams" color="blue" /></Link>
          <Link to="/employee/exams"><StatCard icon="chartBar" value={rawData?.completed || 0} label="Exams Taken" color="amber" /></Link>
        </>}
        {/* Results stats — visible to all employee roles */}
        {canAccess('results') && <>
          <Link to="/employee/reports"><StatCard icon="arrowTrendUp" value={`${rawData?.avgScore || 0}%`} label="Avg Score" color="emerald" /></Link>
          <Link to="/employee/results"><StatCard icon="documentText" value={rawData?.pendingEssays || 0} label="Pending Essays" color={(rawData?.pendingEssays || 0) > 0 ? 'amber' : 'emerald'} /></Link>
        </>}
      </div>

      {/* Recent Admissions — for admin & registrar */}
      {canAccess('admissions') && (
      <div className="gk-card p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
          <Icon name="admissions" className="w-5 h-5 text-forest-500" />
          Recent Admission Submissions
        </h3>

        {/* Filter bar */}
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
          <select value={gradeFilter} onChange={e => handleGrade(e.target.value)} className="gk-input bg-white">
            <option value="all">All Grades</option>
            {(rawData?.grades || []).map(g => <option key={g} value={g}>{g}</option>)}
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
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((a, i) => (
                <tr key={a.id}>
                  <td className="text-gray-400">{(safePage - 1) * PER_PAGE + i + 1}</td>
                  <td className="font-medium text-gray-800">{a.firstName} {a.lastName}</td>
                  <td>{a.gradeLevel}</td>
                  <td><Badge className={badgeClass(a.status)}>{a.status}</Badge></td>
                  <td className="text-gray-500">{formatDate(a.submittedAt)}</td>
                  <td><Link to={`/employee/admissions?id=${a.id}`} className="text-forest-500 hover:text-forest-600 text-xs font-semibold transition-colors">View</Link></td>
                </tr>
              ))}
              {paginated.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No admissions match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={PER_PAGE} />
      </div>
      )}

      {/* Exam Activity — for admin & teacher */}
      {canAccess('exams') && (
      <div className="gk-card p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
          <Icon name="exam" className="w-5 h-5 text-forest-500" />
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
              {(rawData?.exams || []).map(exam => {
                const schedIds = (rawData?.schedules || []).filter(s => s.examId === exam.id).map(s => s.id);
                const regCount = (rawData?.regs || []).filter(r => schedIds.includes(r.scheduleId)).length;
                return (
                  <tr key={exam.id}>
                    <td className="font-medium text-gray-800">{exam.title}</td>
                    <td>{exam.gradeLevel}</td>
                    <td>{exam.questions.length}</td>
                    <td>{regCount}</td>
                    <td><Badge className={exam.isActive ? 'bg-forest-50 text-forest-700 ring-1 ring-forest-200/60' : 'bg-gray-50 text-gray-500 ring-1 ring-gray-200/60'}>{exam.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td><Link to="/employee/exams" className="text-forest-500 hover:text-forest-600 text-xs font-semibold transition-colors">Manage</Link></td>
                  </tr>
                );
              })}
              {(rawData?.exams || []).length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No exams created yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
