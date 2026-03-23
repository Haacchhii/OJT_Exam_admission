import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useAsync } from '../../hooks/useAsync';
import { getAdmissions, getStats } from '../../api/admissions';
import { getExams, getExamSchedules, getExamRegistrations } from '../../api/exams';
import { getExamResults, getEssayAnswers } from '../../api/results';
import { StatCard, PageHeader, Badge, Pagination, usePaginationSlice, SkeletonPage, ErrorAlert } from '../../components/UI';
import { formatDate, badgeClass, asArray, formatPersonName } from '../../utils/helpers';
import { ADMISSION_IN_PROGRESS, GRADE_OPTIONS, ALL_GRADE_LEVELS } from '../../utils/constants';
import Icon from '../../components/Icons';
import type { Admission, AdmissionStats, Exam, ExamSchedule, ExamRegistration, ExamResult as ExamResultType, EssayAnswer } from '../../types';

const PER_PAGE = 5;
const SLA_DAYS = 7;

function daysPending(submittedAt: string) {
  return Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86400000);
}

interface DashboardData {
  stats: AdmissionStats;
  admissions: Admission[];
  exams: Exam[];
  schedules: ExamSchedule[];
  regs: ExamRegistration[];
  results: ExamResultType[];
  pendingEssays: number;
  completed: number;
  grades: string[];
  trends: { total: number; accepted: number; inProgress: number; rejected: number };
  overdue: number;
}

export default function EmployeeDashboard() {
  const { user, canAccess, roleLabel } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelGroupFilter, setLevelGroupFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { socket, isConnected } = useSocket();

  const { data: rawData, loading, error, refetch } = useAsync<DashboardData>(async () => {
    const canAdm = canAccess('admissions');
    const canExm = canAccess('exams');
    const canRes = canAccess('results');

    const [stats, rawAdm, rawExm, rawSched, rawRegs, rawRes, rawEssay] = await Promise.all([
      canAdm ? getStats() : Promise.resolve({ total: 0, submitted: 0, underScreening: 0, underEvaluation: 0, accepted: 0, rejected: 0 } as AdmissionStats),
      canAdm ? getAdmissions() : Promise.resolve([] as Admission[]),
      canExm ? getExams() : Promise.resolve([] as Exam[]),
      canExm ? getExamSchedules() : Promise.resolve([] as ExamSchedule[]),
      canExm ? getExamRegistrations() : Promise.resolve([] as ExamRegistration[]),
      canRes ? getExamResults() : Promise.resolve([] as ExamResultType[]),
      canRes ? getEssayAnswers().catch(() => [] as EssayAnswer[]) : Promise.resolve([] as EssayAnswer[]),
    ]);
    const admissions = asArray<Admission>(rawAdm);
    const exams = asArray<Exam>(rawExm);
    const schedules = asArray<ExamSchedule>(rawSched);
    const regs = asArray<ExamRegistration>(rawRegs);
    const results = asArray<ExamResultType>(rawRes);
    const essayAnswers = asArray<EssayAnswer>(rawEssay);
    const pendingEssays = essayAnswers.filter((e: EssayAnswer) => !e.scored).length;
    const completed = regs.filter((r: ExamRegistration) => r.status === 'done').length;
    const grades = [...new Set(admissions.map((a: Admission) => a.gradeLevel).filter(Boolean))].sort();

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const thisWeek = admissions.filter((a: Admission) => new Date(a.submittedAt) >= weekAgo);
    const lastWeek = admissions.filter((a: Admission) => { const d = new Date(a.submittedAt); return d >= twoWeeksAgo && d < weekAgo; });
    const pct = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
    const trends = {
      total: pct(thisWeek.length, lastWeek.length),
      accepted: pct(thisWeek.filter((a: Admission) => a.status === 'Accepted').length, lastWeek.filter((a: Admission) => a.status === 'Accepted').length),
      inProgress: pct(thisWeek.filter((a: Admission) => (ADMISSION_IN_PROGRESS as readonly string[]).includes(a.status)).length, lastWeek.filter((a: Admission) => (ADMISSION_IN_PROGRESS as readonly string[]).includes(a.status)).length),
      rejected: pct(thisWeek.filter((a: Admission) => a.status === 'Rejected').length, lastWeek.filter((a: Admission) => a.status === 'Rejected').length),
    };

    const overdue = admissions.filter((a: Admission) => (ADMISSION_IN_PROGRESS as readonly string[]).includes(a.status) && daysPending(a.submittedAt) > SLA_DAYS).length;

    return { stats, admissions, exams, schedules, regs, results, pendingEssays, completed, grades, trends, overdue };
  });


  useEffect(() => {
    if (!socket || !isConnected) return;
    const handleUpdate = () => {
      refetch();
    };
    socket.on('admission_status_updated', handleUpdate);
    return () => {
      socket.off('admission_status_updated', handleUpdate);
    };
  }, [socket, isConnected, refetch]);

  const filtered = useMemo(() => {
    let list = rawData?.admissions || [];
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (levelGroupFilter !== 'all') list = list.filter(a => a.levelGroup === levelGroupFilter);
    if (gradeFilter !== 'all') list = list.filter(a => a.gradeLevel === gradeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => `${formatPersonName(a)} ${a.email}`.toLowerCase().includes(q));
    }
    return list;
  }, [rawData, statusFilter, levelGroupFilter, gradeFilter, search]);

  const { paginated, totalPages, safePage, totalItems } = usePaginationSlice(filtered, page, PER_PAGE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: string) => { setStatusFilter(v); setPage(1); };
  const handleLevelGroup = (v: string) => { setLevelGroupFilter(v); setGradeFilter('all'); setPage(1); };
  const handleGrade = (v: string) => { setGradeFilter(v); setPage(1); };
  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

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
              {paginated.map((a, i) => (
                <tr key={a.id}>
                  <td className="text-gray-400">{(safePage - 1) * PER_PAGE + i + 1}</td>
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
              {paginated.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No admissions match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={PER_PAGE} />
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
              {(rawData?.exams || []).map(exam => {
                const schedIds = (rawData?.schedules || []).filter(s => s.examId === exam.id).map(s => s.id);
                const regCount = (rawData?.regs || []).filter(r => schedIds.includes(r.scheduleId)).length;
                return (
                  <tr key={exam.id}>
                    <td className="font-medium text-gray-800">{exam.title}</td>
                    <td>{exam.gradeLevel}</td>
                    <td>{exam.questionCount ?? exam.questions?.length ?? 0}</td>
                    <td>{regCount}</td>
                    <td><Badge className={exam.isActive ? 'gk-badge gk-badge-active' : 'gk-badge gk-badge-inactive'}>{exam.isActive ? 'Active' : 'Inactive'}</Badge></td>
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
