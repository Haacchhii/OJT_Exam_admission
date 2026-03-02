import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getAdmissions, getStats } from '../../api/admissions.js';
import { getExams, getExamRegistrations } from '../../api/exams.js';
import { getExamResults, getEssayAnswers } from '../../api/results.js';
import { StatCard, PageHeader, Badge, Pagination, usePaginationSlice, SkeletonPage } from '../../components/UI.jsx';
import { formatDate, badgeClass } from '../../utils/helpers.js';

const PER_PAGE = 5;

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dataTick, setDataTick] = useState(0);

  useEffect(() => { setLoading(false); }, []);

  const data = useMemo(() => {
    const stats = getStats();
    const admissions = getAdmissions();
    const exams = getExams();
    const regs = getExamRegistrations();
    const results = getExamResults();
    const pendingEssays = getEssayAnswers().filter(e => !e.scored).length;
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
      inProgress: pct(thisWeek.filter(a => ['Submitted','Under Screening','Under Evaluation'].includes(a.status)).length, lastWeek.filter(a => ['Submitted','Under Screening','Under Evaluation'].includes(a.status)).length),
      rejected: pct(thisWeek.filter(a => a.status === 'Rejected').length, lastWeek.filter(a => a.status === 'Rejected').length),
    };

    return { stats, admissions, exams, regs, results, pendingEssays, completed, avgScore, grades, trends };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataTick]);

  const filtered = useMemo(() => {
    let list = data.admissions;
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (gradeFilter !== 'all') list = list.filter(a => a.gradeLevel === gradeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(q));
    }
    return list;
  }, [data.admissions, statusFilter, gradeFilter, search]);

  const { paginated, totalPages, safePage, totalItems } = usePaginationSlice(filtered, page, PER_PAGE);

  // Reset page when filters change
  const handleSearch = (v) => { setSearch(v); setPage(1); };
  const handleStatus = (v) => { setStatusFilter(v); setPage(1); };
  const handleGrade = (v) => { setGradeFilter(v); setPage(1); };

  if (loading) return <SkeletonPage />;

  return (
    <div>
      <PageHeader title="Dashboard Overview" subtitle="Monitor admission applications and exam activity." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link to="/employee/admissions"><StatCard icon="🎓" value={data.stats.total} label="Total Applicants" color="blue" trend={data.trends.total} trendLabel="vs last week" /></Link>
        <Link to="/employee/admissions?status=Accepted"><StatCard icon="✅" value={data.stats.accepted} label="Accepted" color="emerald" trend={data.trends.accepted} trendLabel="vs last week" /></Link>
        <Link to="/employee/admissions"><StatCard icon="⏳" value={(data.stats.submitted || 0) + (data.stats.underScreening || 0) + (data.stats.underEvaluation || 0)} label="In Progress" color="amber" trend={data.trends.inProgress} trendLabel="vs last week" /></Link>
        <Link to="/employee/admissions?status=Rejected"><StatCard icon="❌" value={data.stats.rejected} label="Rejected" color="red" trend={data.trends.rejected} trendLabel="vs last week" /></Link>
        <Link to="/employee/exams"><StatCard icon="📖" value={data.exams.length} label="Total Exams" color="blue" /></Link>
        <Link to="/employee/exams"><StatCard icon="📊" value={data.completed} label="Exams Taken" color="amber" /></Link>
        <Link to="/employee/reports"><StatCard icon="📈" value={`${data.avgScore}%`} label="Avg Score" color="emerald" /></Link>
        <Link to="/employee/results"><StatCard icon="📝" value={data.pendingEssays} label="Pending Essays" color={data.pendingEssays > 0 ? 'amber' : 'emerald'} /></Link>
      </div>

      <div className="lpu-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Recent Admission Submissions</h3>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#166534]/20 outline-none"
          />
          <select value={statusFilter} onChange={e => handleStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white">
            <option value="all">All Status</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Screening">Under Screening</option>
            <option value="Under Evaluation">Under Evaluation</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select value={gradeFilter} onChange={e => handleGrade(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white">
            <option value="all">All Grades</option>
            {data.grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs">
                <th scope="col" className="py-3 px-2">#</th>
                <th scope="col" className="py-3 px-2">Student Name</th>
                <th scope="col" className="py-3 px-2">Grade Level</th>
                <th scope="col" className="py-3 px-2">Status</th>
                <th scope="col" className="py-3 px-2">Date Submitted</th>
                <th scope="col" className="py-3 px-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((a, i) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-2 text-gray-400">{(safePage - 1) * PER_PAGE + i + 1}</td>
                  <td className="py-3 px-2 font-medium text-forest-500">{a.firstName} {a.lastName}</td>
                  <td className="py-3 px-2">{a.gradeLevel}</td>
                  <td className="py-3 px-2"><Badge className={badgeClass(a.status)}>{a.status}</Badge></td>
                  <td className="py-3 px-2 text-gray-500">{formatDate(a.submittedAt)}</td>
                  <td className="py-3 px-2"><Link to={`/employee/admissions?id=${a.id}`} className="text-[#166534] hover:underline text-xs font-medium">View</Link></td>
                </tr>
              ))}
              {paginated.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No admissions match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={PER_PAGE} />
      </div>
    </div>
  );
}
