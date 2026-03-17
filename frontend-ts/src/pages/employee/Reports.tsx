import { useState, useMemo } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { getAdmissions } from '../../api/admissions';
import { getExams, getExamSchedules, getExamRegistrations } from '../../api/exams';
import { getExamResults, getEssayAnswers } from '../../api/results';
import { asArray } from '../../utils/helpers';
import { getUsers } from '../../api/users';
import { getAcademicYears, getSemesters } from '../../api/academicYears';
import { showToast } from '../../components/Toast';
import { PageHeader, SkeletonPage, ErrorAlert, Pagination, usePaginationSlice } from '../../components/UI';
import Icon from '../../components/Icons';
import { ADMISSION_STATUSES, SCHOOL_NAME, GRADE_OPTIONS, ALL_GRADE_LEVELS } from '../../utils/constants';
import type { Admission, ExamResult, Exam, ExamSchedule, ExamRegistration, EssayAnswer, User, AcademicYear, Semester } from '../../types';

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
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>@page{size:landscape;margin:1cm}body{font-family:system-ui,sans-serif;padding:20px}h1{font-size:18px;color:#1a3c2a}table{width:100%;border-collapse:collapse;margin-top:12px}p.meta{color:#888;font-size:11px}</style></head><body><h1>🔑 ${SCHOOL_NAME} — ${title}</h1><p class="meta">Generated on ${new Date().toLocaleString()} &bull; ${rows.length} records</p><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`);
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
  const [statusFilter, setStatusFilter] = useState('all');    const [levelGroupFilter, setLevelGroupFilter] = useState('all');  const [gradeFilter, setGradeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [examStatsPage, setExamStatsPage] = useState(1);

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

  const grades = useMemo(() => [...new Set((rawData?.admissions || []).map(a => a.gradeLevel).filter(Boolean))].sort(), [rawData?.admissions]);

  const { admissions, results, exams, schedules, regs, essays, users } = useMemo(() => {
    let adm = rawData?.admissions || [];
    if (statusFilter !== 'all') adm = adm.filter(a => a.status === statusFilter);      if (levelGroupFilter !== 'all') adm = adm.filter(a => a.levelGroup === levelGroupFilter);    if (gradeFilter !== 'all') adm = adm.filter(a => a.gradeLevel === gradeFilter);
    if (yearFilter !== 'all') adm = adm.filter(a => a.academicYear?.id === Number(yearFilter));
    if (semesterFilter !== 'all') adm = adm.filter(a => a.semester?.id === Number(semesterFilter));
    if (dateFrom) adm = adm.filter(a => new Date(a.submittedAt) >= new Date(dateFrom));
    if (dateTo) adm = adm.filter(a => new Date(a.submittedAt) <= new Date(dateTo + 'T23:59:59'));

    const admEmails = new Set(adm.map(a => a.email));
    const filteredRegs = (rawData?.regs || []).filter(r => admEmails.has(r.userEmail));
    const regIds = new Set(filteredRegs.map(r => r.id));
    const filteredResults = (rawData?.results || []).filter(r => regIds.has(r.registrationId));

    return {
      admissions: adm, results: filteredResults, exams: rawData?.exams || [],
      schedules: rawData?.schedules || [], regs: filteredRegs, essays: rawData?.essays || [],
      users: rawData?.users || [],
    };
  }, [rawData, statusFilter, levelGroupFilter, gradeFilter, yearFilter, semesterFilter, dateFrom, dateTo]);

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
      const reg = regs.find(rg => rg.id === r.registrationId);
      const student = reg ? users.find(u => u.email === reg.userEmail) : null;
      const sched = reg ? schedules.find(s => s.id === reg.scheduleId) : null;
      const exam = sched ? exams.find(e => e.id === sched.examId) : null;
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
  

  const maxMonth = Math.max(...monthData.map(m => m.count), 1);

    const sortedStats = [...examStats].sort((a, b) => b.rate - a.rate);
    const startIndexObject = (examStatsPage - 1) * 5;
    const paginatedStats = sortedStats.slice(startIndexObject, startIndexObject + 5);
    const statTotalPages = Math.ceil(sortedStats.length / 5);

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
      <div className="gk-card p-4 mb-6">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Filter Report Data</h4>
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
            <option value="all">All Status</option>
            {ADMISSION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>            <select value={levelGroupFilter} onChange={e => { setLevelGroupFilter(e.target.value); setGradeFilter('all'); } } aria-label="Filter by level group" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
              <option value="all">All Level Groups</option>
              {GRADE_OPTIONS.map(g => <option key={g.group} value={g.group}>{g.group}</option>)}
            </select>          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
            <option value="all">All Grades</option>
            {(levelGroupFilter === 'all' ? ALL_GRADE_LEVELS : GRADE_OPTIONS.find(g => g.group === levelGroupFilter)?.items || []).map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setSemesterFilter('all'); }} aria-label="Filter by school year" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
            <option value="all">All Years</option>
            {(academicYears || []).map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
          </select>
          <select value={semesterFilter} onChange={e => setSemesterFilter(e.target.value)} aria-label="Filter by semester" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
            <option value="all">All Semesters</option>
            {semesterOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
          </div>
            {(statusFilter !== 'all' || levelGroupFilter !== 'all' || gradeFilter !== 'all' || yearFilter !== 'all' || semesterFilter !== 'all' || dateFrom || dateTo) && (
              <button onClick={() => { setStatusFilter('all'); setLevelGroupFilter('all'); setGradeFilter('all'); setYearFilter('all'); setSemesterFilter('all'); setDateFrom(''); setDateTo(''); }} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { icon: 'clipboard', title: 'Applicant List', desc: 'Download a full list of all applicants with their admission status.', onCSV: () => exportApplicants('csv'), onPDF: () => exportApplicants('pdf') },
          { icon: 'chartBar', title: 'Exam Results', desc: 'Download exam scores and pass/fail data for all applicants.', onCSV: () => exportResults('csv'), onPDF: () => exportResults('pdf') },
          { icon: 'calendar', title: 'Exam Schedules', desc: 'Download all exam schedule data and slot availability.', onCSV: () => exportSchedules('csv'), onPDF: () => exportSchedules('pdf') },
        ].map((c, i) => (
          <div key={i} className="gk-card p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-3"><Icon name={c.icon} className="w-7 h-7 text-forest-500" /></div>
            <h3 className="font-bold text-forest-500 mb-1">{c.title}</h3>
            <p className="text-gray-500 text-sm mb-4">{c.desc}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={c.onCSV} className="bg-forest-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-forest-600 inline-flex items-center gap-1.5 text-sm"><Icon name="document" className="w-4 h-4" /> CSV</button>
              <button onClick={c.onPDF} className="bg-gold-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gold-600 inline-flex items-center gap-1.5 text-sm"><Icon name="document" className="w-4 h-4" /> PDF</button>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
        <div className="gk-card p-6">
          <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="chartBar" className="w-5 h-5" /></span> Pass Rate by Exam</h3>
          {examStats.length > 0 && examStats.some(e => e.total > 0) ? (
            <div className="space-y-3">
              {paginatedStats.map((e, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 truncate">{e.name}</span>
                    <span className="text-gray-400">{e.passed}/{e.total} passed</span>
                  </div>
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full flex items-center justify-end pr-2 text-white text-xs font-bold ${e.rate >= 70 ? 'bg-forest-500' : e.rate >= 50 ? 'bg-gold-400' : 'bg-red-500'}`} style={{ width: `${Math.max(e.rate, 8)}%` }}>
                      {e.rate}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No exam result data available.</p>
          )}
        </div>

        <div className="gk-card p-6">
          <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="arrowTrendUp" className="w-5 h-5" /></span> Applicant Volume (Monthly)</h3>
          <div className="flex items-end gap-3 h-48">
            {monthData.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs text-forest-500 font-bold mb-1">{m.count}</span>
                <div className="w-full bg-gradient-to-t from-gold-400 to-gold-300 rounded-t-md transition-all" style={{ height: `${(m.count / maxMonth) * 100}%`, minHeight: m.count > 0 ? '8px' : '2px' }} />
                <span className="text-xs text-gray-400 mt-2">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="gk-card p-6">
        <h3 className="gk-heading-sm text-forest-500 mb-4 flex items-center gap-1.5"><span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="clipboard" className="w-5 h-5" /></span> Summary Statistics</h3>
        <div className="table-scroll">
          <table className="gk-table">
            <thead><tr>
              <th>Metric</th><th>Value</th><th>Change</th>
            </tr></thead>
            <tbody>
              {metrics.map((m, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-3 px-2 font-medium text-forest-500">{m.label}</td>
                  <td className="py-3 px-2">{m.value}</td>
                  <td className="py-3 px-2 text-gray-500 text-xs">{m.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
