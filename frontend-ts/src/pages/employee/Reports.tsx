import { useState, useMemo } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { getAdmissions } from '../../api/admissions';
import { getExams, getExamSchedules, getExamRegistrations } from '../../api/exams';
import { getExamResults, getEssayAnswers } from '../../api/results';
import { asArray } from '../../utils/helpers';
import { getUsers } from '../../api/users';
import { getAcademicYears, getSemesters } from '../../api/academicYears';
import { showToast } from '../../components/Toast';
import { PageHeader, SkeletonPage, ErrorAlert } from '../../components/UI';
import Icon from '../../components/Icons';
import { ADMISSION_STATUSES, SCHOOL_NAME, GRADE_OPTIONS, ALL_GRADE_LEVELS } from '../../utils/constants';
import type { Admission, ExamResult, Exam, ExamSchedule, ExamRegistration, EssayAnswer, User, AcademicYear, Semester } from '../../types';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  Submitted: '#8b5cf6',
  'Under Screening': '#f59e0b',
  'Under Evaluation': '#0ea5e9',
  Accepted: '#16a34a',
  Rejected: '#ef4444',
};

const CHART_FALLBACK_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

function toLocalDateIso(value: string | Date) {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRegUserId(reg: ExamRegistration): number | null {
  const maybe = (reg as ExamRegistration & { userId?: unknown }).userId;
  return typeof maybe === 'number' ? maybe : null;
}

const renderPieLabelInside = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + r * Math.sin(-midAngle * (Math.PI / 180));
  return (
    <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {value}
    </text>
  );
};

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function printPDF(title: string, headers: string[], rows: (string | number)[][]) {
  const w = window.open('', '_blank');
  if (!w) { showToast('Please allow popups to export PDF', 'error'); return; }
  const ths = headers.map(h => `<th style="border:1px solid #ccc;padding:6px 10px;background:#f5f5f0;font-size:12px;text-align:left">${h}</th>`).join('');
  const trs = rows.map(r => `<tr>${r.map(c => `<td style="border:1px solid #ddd;padding:5px 10px;font-size:11px">${c}</td>`).join('')}</tr>`).join('');
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>@page{size:landscape;margin:1cm}body{font-family:system-ui,sans-serif;padding:20px}h1{font-size:18px;color:#1a3c2a}table{width:100%;border-collapse:collapse;margin-top:12px}p.meta{color:#888;font-size:11px}</style></head><body><h1>${SCHOOL_NAME} - ${title}</h1><p class="meta">Generated on ${new Date().toLocaleString()} | ${rows.length} records</p><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`);
  w.document.close();
  w.onafterprint = () => w.close();
  setTimeout(() => w.print(), 400);
}

interface ReportData {
  admissions: Admission[];
  results: ExamResult[];
  exams: Exam[];
  schedules: ExamSchedule[];
  regs: ExamRegistration[];
  essays: EssayAnswer[];
  users: User[];
}

export default function EmployeeReports() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelGroupFilter, setLevelGroupFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: rawData, loading, error, refetch } = useAsync<ReportData>(async () => {
    const settled = await Promise.allSettled([
      getAdmissions(),
      getExamResults(),
      getExams(),
      getExamSchedules(),
      getExamRegistrations(),
      getEssayAnswers(),
      getUsers(),
    ]);
    const extract = (r: PromiseSettledResult<unknown>): unknown => r.status === 'fulfilled' ? r.value : [];
    const failures = settled.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      showToast(`${failures.length} data source(s) failed to load. Some report data may be incomplete.`, 'error');
    }
    return {
      admissions: asArray<Admission>(extract(settled[0])),
      results: asArray<ExamResult>(extract(settled[1])),
      exams: asArray<Exam>(extract(settled[2])),
      schedules: asArray<ExamSchedule>(extract(settled[3])),
      regs: asArray<ExamRegistration>(extract(settled[4])),
      essays: asArray<EssayAnswer>(extract(settled[5])),
      users: asArray<User>(extract(settled[6])),
    };
  });

  const { data: academicYears } = useAsync<AcademicYear[]>(() => getAcademicYears());
  const { data: allSemesters } = useAsync<Semester[]>(() => getSemesters());

  const semesterOptions = (allSemesters || []).filter(s =>
    yearFilter === 'all' || s.academicYearId === Number(yearFilter)
  );

  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const { admissions, results, exams, schedules, regs, essays, users } = useMemo(() => {
    let adm = rawData?.admissions || [];
    if (statusFilter !== 'all') adm = adm.filter(a => a.status === statusFilter);
    if (levelGroupFilter !== 'all') adm = adm.filter(a => a.levelGroup === levelGroupFilter);
    if (gradeFilter !== 'all') adm = adm.filter(a => a.gradeLevel === gradeFilter);
    if (yearFilter !== 'all') adm = adm.filter(a => a.academicYear?.id === Number(yearFilter));
    if (semesterFilter !== 'all') adm = adm.filter(a => a.semester?.id === Number(semesterFilter));
    if (!hasInvalidDateRange) {
      if (dateFrom) adm = adm.filter(a => toLocalDateIso(a.submittedAt) >= dateFrom);
      if (dateTo) adm = adm.filter(a => toLocalDateIso(a.submittedAt) <= dateTo);
    }

    const admUserIds = new Set(adm.map(a => a.userId).filter((id): id is number => typeof id === 'number'));
    const admEmails = new Set(adm.map(a => a.email));
    const filteredRegs = (rawData?.regs || []).filter(r => {
      const regUserId = getRegUserId(r);
      if (regUserId !== null && admUserIds.has(regUserId)) return true;
      return admEmails.has(r.userEmail);
    });
    const regIds = new Set(filteredRegs.map(r => r.id));
    const filteredResults = (rawData?.results || []).filter(r => regIds.has(r.registrationId));

    return {
      admissions: adm, results: filteredResults, exams: rawData?.exams || [],
      schedules: rawData?.schedules || [], regs: filteredRegs, essays: rawData?.essays || [],
      users: rawData?.users || [],
    };
  }, [rawData, statusFilter, levelGroupFilter, gradeFilter, yearFilter, semesterFilter, dateFrom, dateTo, hasInvalidDateRange]);

  const usersById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const usersByEmail = useMemo(() => new Map(users.map(u => [u.email, u])), [users]);
  const regsById = useMemo(() => new Map(regs.map(r => [r.id, r])), [regs]);
  const schedulesById = useMemo(() => new Map(schedules.map(s => [s.id, s])), [schedules]);
  const examsById = useMemo(() => new Map(exams.map(e => [e.id, e])), [exams]);

  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  const totalApplicants = admissions.length;
  const accepted = admissions.filter(a => a.status === 'Accepted').length;
  const passed = results.filter(r => r.passed).length;
  const avg = results.length > 0 ? (results.reduce((s, r) => s + r.percentage, 0) / results.length).toFixed(1) : '0.0';
  const pendingEssays = essays.filter(e => !e.scored).length;

  const now = new Date();
  const thisMonth = admissions.filter(a => { const d = new Date(a.submittedAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;

  const exportApplicants = (format: 'csv' | 'pdf' = 'csv') => {
    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Grade Level', 'Status', 'Submitted'];
    const rows: (string | number)[][] = admissions.map(a => [a.id, a.firstName, a.lastName, a.email, a.gradeLevel, a.status, a.submittedAt]);
    if (format === 'pdf') { printPDF('Applicant List', headers, rows); }
    else { downloadCSV('applicants.csv', [headers, ...rows]); }
    showToast(`Applicant list ${format === 'pdf' ? 'exported' : 'downloaded'}!`, 'success');
  };

  const exportResults = (format: 'csv' | 'pdf' = 'csv') => {
    const headers = ['Student', 'Exam', 'Score', 'Max', 'Percentage', 'Passed', 'Essay Reviewed', 'Date'];
    const rows: (string | number)[][] = results.map(r => {
      const reg = regsById.get(r.registrationId);
      const regUserId = reg ? getRegUserId(reg) : null;
      const student = reg ? (regUserId !== null ? usersById.get(regUserId) : usersByEmail.get(reg.userEmail)) : null;
      const sched = reg ? schedulesById.get(reg.scheduleId) : null;
      const exam = sched ? examsById.get(sched.examId) : null;
      return [student ? `${student.firstName} ${student.lastName}` : 'Unknown', exam?.title || 'N/A', r.totalScore, r.maxPossible, r.percentage.toFixed(1) + '%', r.passed ? 'Yes' : 'No', r.essayReviewed ? 'Yes' : 'No', r.createdAt || ''];
    });
    if (format === 'pdf') { printPDF('Exam Results', headers, rows); }
    else { downloadCSV('exam_results.csv', [headers, ...rows]); }
    showToast(`Results ${format === 'pdf' ? 'exported' : 'downloaded'}!`, 'success');
  };

  const exportSchedules = (format: 'csv' | 'pdf' = 'csv') => {
    const headers = ['Exam', 'Date', 'Start Time', 'End Time', 'Max Slots', 'Booked'];
    const rows: (string | number)[][] = schedules.map(s => { const exam = exams.find(e => e.id === s.examId); return [exam?.title || 'N/A', s.scheduledDate, s.startTime, s.endTime, s.maxSlots, s.slotsTaken]; });
    if (format === 'pdf') { printPDF('Exam Schedules', headers, rows); }
    else { downloadCSV('exam_schedules.csv', [headers, ...rows]); }
    showToast(`Schedules ${format === 'pdf' ? 'exported' : 'downloaded'}!`, 'success');
  };

  const examStats = exams.map(exam => {
    const eScheds = schedules.filter(s => s.examId === exam.id);
    const eRegs = regs.filter(r => eScheds.some(s => s.id === r.scheduleId));
    const eResults = results.filter(r => eRegs.some(rg => rg.id === r.registrationId));
    const p = eResults.filter(r => r.passed).length;
    const t = eResults.length;
    return { name: exam.title.replace('Entrance Examination ', ''), passed: p, total: t, rate: t > 0 ? Math.round((p / t) * 100) : 0 };
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthData: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const count = admissions.filter(a => { const ad = new Date(a.submittedAt); return `${ad.getFullYear()}-${String(ad.getMonth()).padStart(2, '0')}` === key; }).length;
    monthData.push({ label: monthNames[d.getMonth()], count });
  }

  const admissionStatusData = ADMISSION_STATUSES.map(status => ({
    name: status,
    value: admissions.filter(a => a.status === status).length,
    color: STATUS_COLORS[status] || CHART_FALLBACK_COLORS[0],
  })).filter(d => d.value > 0);
  const admissionStatusTotal = admissionStatusData.reduce((sum, item) => sum + item.value, 0);

  const passFailData = [
    { name: 'Passed', value: results.filter(r => r.passed).length, color: '#16a34a' },
    { name: 'Failed', value: results.filter(r => !r.passed).length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const scoreBands = [
    { name: '90-100', min: 90, max: 100 },
    { name: '80-89', min: 80, max: 89.99 },
    { name: '70-79', min: 70, max: 79.99 },
    { name: '60-69', min: 60, max: 69.99 },
    { name: '< 60', min: -Infinity, max: 59.99 },
  ];

  const scoreBandData = scoreBands.map(b => ({
    band: b.name,
    count: results.filter(r => r.percentage >= b.min && r.percentage <= b.max).length,
  }));

  const scheduleUtilizationData = schedules
    .map(s => {
      const exam = exams.find(e => e.id === s.examId);
      const used = Number(s.slotsTaken || 0);
      const total = Number(s.maxSlots || 0);
      const utilization = total > 0 ? Math.round((used / total) * 100) : 0;
      return {
        schedule: exam?.title ? exam.title.slice(0, 20) : `Schedule #${s.id}`,
        utilization,
        used,
        total,
      };
    })
    .sort((a, b) => b.utilization - a.utilization)
    .slice(0, 6);

    const sortedStats = [...examStats].sort((a, b) => b.rate - a.rate);

  const metrics = [
    { label: 'Total Applicants', value: totalApplicants, change: `+${thisMonth} this month` },
    { label: 'Accepted', value: accepted, change: `${totalApplicants > 0 ? Math.round((accepted / totalApplicants) * 100) : 0}% acceptance rate` },
    { label: 'Exams Taken', value: results.length, change: `${exams.length} exams available` },
    { label: 'Overall Pass Rate', value: `${results.length > 0 ? Math.round((passed / results.length) * 100) : 0}%`, change: `${passed} of ${results.length} passed` },
    { label: 'Average Score', value: `${avg}%`, change: 'Across all exams' },
    { label: 'Pending Essay Reviews', value: pendingEssays, change: pendingEssays > 0 ? 'Action needed' : 'All reviewed' },
    { label: 'Open Exam Slots', value: schedules.reduce((s, sc) => s + sc.maxSlots, 0), change: `${schedules.length} schedules` },
  ];

  return (
    <div>
      <PageHeader title="Reports & Exports" subtitle="Generate and download reports for admissions and exam results." />

      <div className="flex justify-end mb-4">
        <button onClick={refetch} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"><Icon name="refresh" className="w-4 h-4" /> Refresh Data</button>
      </div>

      {/* Filters */}
      <div className="gk-section-card p-4 mb-6">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Filter Report Data</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
              <option value="all">All Status</option>
              {ADMISSION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Level Group</label>
            <select value={levelGroupFilter} onChange={e => { setLevelGroupFilter(e.target.value); setGradeFilter('all'); }} aria-label="Filter by level group" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
              <option value="all">All Level Groups</option>
              {GRADE_OPTIONS.map(g => <option key={g.group} value={g.group}>{g.group}</option>)}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Grade</label>
            <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} aria-label="Filter by grade" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
              <option value="all">All Grades</option>
              {(levelGroupFilter === 'all' ? ALL_GRADE_LEVELS : GRADE_OPTIONS.find(g => g.group === levelGroupFilter)?.items || []).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1">School Year</label>
            <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setSemesterFilter('all'); }} aria-label="Filter by school year" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
              <option value="all">All Years</option>
              {(academicYears || []).map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Semester</label>
            <select value={semesterFilter} onChange={e => setSemesterFilter(e.target.value)} aria-label="Filter by semester" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
              <option value="all">All Semesters</option>
              {semesterOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} className="w-full min-w-[170px] px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm bg-white" />
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="w-full min-w-[170px] px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm bg-white" />
          </div>

          {(statusFilter !== 'all' || levelGroupFilter !== 'all' || gradeFilter !== 'all' || yearFilter !== 'all' || semesterFilter !== 'all' || dateFrom || dateTo) && (
            <div className="flex items-end">
              <button onClick={() => { setStatusFilter('all'); setLevelGroupFilter('all'); setGradeFilter('all'); setYearFilter('all'); setSemesterFilter('all'); setDateFrom(''); setDateTo(''); }} className="w-full xl:w-auto px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Clear Filters
              </button>
            </div>
          )}
        </div>
        {hasInvalidDateRange && (
          <p className="mt-2 text-xs text-red-600">Invalid date range: "From" must be before or equal to "To".</p>
        )}
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { icon: 'clipboard', title: 'Applicant List', desc: 'Download a full list of all applicants with their admission status.', onCSV: () => exportApplicants('csv'), onPDF: () => exportApplicants('pdf'), color: 'forest' },
          { icon: 'chartBar', title: 'Exam Results', desc: 'Download exam scores and pass/fail data for all applicants.', onCSV: () => exportResults('csv'), onPDF: () => exportResults('pdf'), color: 'gold' },
          { icon: 'calendar', title: 'Exam Schedules', desc: 'Download all exam schedule data and slot availability.', onCSV: () => exportSchedules('csv'), onPDF: () => exportSchedules('pdf'), color: 'emerald' },
        ].map((c, i) => {
          const bgGradient = c.color === 'gold' ? 'from-gold-50 to-gold-100' : c.color === 'emerald' ? 'from-emerald-50 to-teal-100' : 'from-forest-50 to-forest-100';
          const borderColor = c.color === 'gold' ? 'border-gold-200' : c.color === 'emerald' ? 'border-emerald-200' : 'border-forest-200';
          const iconBg = c.color === 'gold' ? 'bg-gold-100' : c.color === 'emerald' ? 'bg-emerald-100' : 'bg-forest-100';
          const iconColor = c.color === 'gold' ? 'text-gold-600' : c.color === 'emerald' ? 'text-emerald-600' : 'text-forest-600';
          const btn1Color = c.color === 'gold' ? 'bg-gold-500 hover:bg-gold-600' : c.color === 'emerald' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-forest-500 hover:bg-forest-600';
          const btn2Color = c.color === 'gold' ? 'bg-gold-600 hover:bg-gold-700' : c.color === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-forest-600 hover:bg-forest-700';
          const titleColor = c.color === 'gold' ? '#b45309' : c.color === 'emerald' ? '#059669' : '#1a3c2a';
          return (
          <div key={i} className={`gk-section-card p-6 text-center bg-gradient-to-br ${bgGradient} border-2 ${borderColor} shadow-md hover:shadow-lg transition-all transform hover:scale-105`}>
            <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center mx-auto mb-3`}><Icon name={c.icon} className={`w-8 h-8 ${iconColor}`} /></div>
            <h3 className="font-bold text-lg mb-1" style={{ color: titleColor }}>{c.title}</h3>
            <p className="text-gray-600 text-sm mb-4 font-medium">{c.desc}</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button onClick={c.onCSV} className={`${btn1Color} text-white px-4 py-2.5 rounded-lg font-bold inline-flex items-center gap-1.5 text-sm shadow-md transition-all`}><Icon name="document" className="w-4 h-4" /> CSV</button>
              <button onClick={c.onPDF} className={`${btn2Color} text-white px-4 py-2.5 rounded-lg font-bold inline-flex items-center gap-1.5 text-sm shadow-md transition-all`}><Icon name="document" className="w-4 h-4" /> PDF</button>
            </div>
          </div>
        );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 mb-6 items-start">
        <div className="gk-section-card p-6">
          <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="chartBar" className="w-5 h-5" /></span> Pass Rate by Exam</h3>
          {examStats.length > 0 && examStats.some(e => e.total > 0) ? (
            <div className="h-96 overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%" minWidth={Math.max(800, sortedStats.length * 80)}>
                <BarChart data={sortedStats} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${Number(value ?? 0)}%`, 'Pass Rate']} />
                  <Bar dataKey="rate" fill="#16a34a" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="rate" position="insideTop" fill="#ffffff" fontSize={11} fontWeight={700} formatter={(value) => `${Number(value ?? 0)}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No exam result data available.</p>
          )}
        </div>

        <div className="gk-section-card p-6">
          <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="arrowTrendUp" className="w-5 h-5" /></span> Applicant Volume (Monthly)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [Number(value ?? 0), 'Applicants']} />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="count" position="insideTop" fill="#ffffff" fontSize={11} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="gk-section-card p-6">
          <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="users" className="w-5 h-5" /></span> Admission Status Mix</h3>
          {admissionStatusData.length > 0 ? (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={admissionStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} label={{ position: 'outside', fill: '#374151', fontSize: 11, fontWeight: 600, formatter: (v) => `${v}` }}>
                      {admissionStatusData.map((entry, idx) => (
                        <Cell key={`status-${idx}`} fill={entry.color || CHART_FALLBACK_COLORS[idx % CHART_FALLBACK_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [Number(value ?? 0), 'Applicants']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
                {admissionStatusData
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .map((item) => (
                    <div key={item.name} className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 bg-gray-50">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-600 font-medium">{item.name}</span>
                      <span className="text-xs font-bold text-gray-800">{item.value}</span>
                      <span className="text-[11px] text-gray-500">({admissionStatusTotal > 0 ? Math.round((item.value / admissionStatusTotal) * 100) : 0}%)</span>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-center py-8">No admissions data available.</p>
          )}
        </div>

        <div className="gk-section-card p-6">
          <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="chartPie" className="w-5 h-5" /></span> Results Breakdown</h3>
          {results.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-100 rounded-xl p-3">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">Pass vs Fail</h4>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={passFailData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={95}
                        label={renderPieLabelInside}
                        labelLine={false}
                      >
                        {passFailData.map((entry, idx) => (
                          <Cell key={`pf-${idx}`} fill={entry.color || CHART_FALLBACK_COLORS[idx % CHART_FALLBACK_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [Number(value ?? 0), 'Results']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
                  {passFailData.map((item) => (
                    <div key={item.name} className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 bg-gray-50">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-600 font-medium">{item.name}</span>
                      <span className="text-xs font-bold text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-3">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">Score Bands</h4>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreBandData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [Number(value ?? 0), 'Students']} />
                      <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="count" position="insideTop" fill="#ffffff" fontSize={11} fontWeight={700} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No result data available.</p>
          )}
        </div>
      </div>

      <div className="gk-section-card p-6 mb-6">
        <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="calendar" className="w-5 h-5" /></span> Top Schedule Utilization</h3>
        {scheduleUtilizationData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scheduleUtilizationData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="schedule" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, _name, item: any) => [`${Number(value ?? 0)}% (${item?.payload?.used ?? 0}/${item?.payload?.total ?? 0})`, 'Utilization']} />
                <Bar dataKey="utilization" fill="#8b5cf6" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="utilization" position="insideTop" fill="#ffffff" fontSize={11} fontWeight={700} formatter={(value) => `${Number(value ?? 0)}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">No schedule data available.</p>
        )}
      </div>
      
      {/* Key Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="gk-section-card p-4 text-center border-l-4 border-forest-500 hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Applicants</p>
          <p className="text-2xl font-bold text-forest-700">{totalApplicants}</p>
          <p className="text-xs text-gray-400 mt-2">+{thisMonth} this month</p>
        </div>
        <div className="gk-section-card p-4 text-center border-l-4 border-emerald-500 hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Acceptance Rate</p>
          <p className="text-2xl font-bold text-emerald-700">{totalApplicants > 0 ? Math.round((accepted / totalApplicants) * 100) : 0}%</p>
          <p className="text-xs text-gray-400 mt-2">{accepted} accepted</p>
        </div>
        <div className="gk-section-card p-4 text-center border-l-4 border-blue-500 hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Overall Pass Rate</p>
          <p className="text-2xl font-bold text-blue-700">{results.length > 0 ? Math.round((passed / results.length) * 100) : 0}%</p>
          <p className="text-xs text-gray-400 mt-2">{passed} of {results.length} passed</p>
        </div>
        <div className="gk-section-card p-4 text-center border-l-4 border-gold-500 hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Average Score</p>
          <p className="text-2xl font-bold text-gold-700">{avg}%</p>
          <p className="text-xs text-gray-400 mt-2">Across all exams</p>
        </div>
      </div>
    </div>
  );
}
