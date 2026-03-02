import { useState, useMemo } from 'react';
import { getAdmissions } from '../../api/admissions.js';
import { getExams, getExamSchedules, getExamRegistrations } from '../../api/exams.js';
import { getExamResults, getEssayAnswers } from '../../api/results.js';
import { getUsers } from '../../api/users.js';
import { showToast } from '../../components/Toast.jsx';
import { PageHeader } from '../../components/UI.jsx';

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function EmployeeReports() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dataTick, setDataTick] = useState(0);

  const rawData = useMemo(() => ({
    admissions: getAdmissions(), results: getExamResults(), exams: getExams(),
    schedules: getExamSchedules(), regs: getExamRegistrations(), essays: getEssayAnswers(),
    users: getUsers(),
  }), [dataTick]);

  const grades = useMemo(() => [...new Set(rawData.admissions.map(a => a.gradeLevel).filter(Boolean))].sort(), [rawData.admissions]);

  // Apply filters to admissions and cascade to results
  const { admissions, results, exams, schedules, regs, essays, users } = useMemo(() => {
    let adm = rawData.admissions;
    if (statusFilter !== 'all') adm = adm.filter(a => a.status === statusFilter);
    if (gradeFilter !== 'all') adm = adm.filter(a => a.gradeLevel === gradeFilter);
    if (dateFrom) adm = adm.filter(a => new Date(a.submittedAt) >= new Date(dateFrom));
    if (dateTo) adm = adm.filter(a => new Date(a.submittedAt) <= new Date(dateTo + 'T23:59:59'));

    // Cascade: filter results to only include registrations whose user has an admission passing filters
    const admEmails = new Set(adm.map(a => a.email));
    const filteredRegs = rawData.regs.filter(r => admEmails.has(r.userEmail));
    const regIds = new Set(filteredRegs.map(r => r.id));
    const filteredResults = rawData.results.filter(r => regIds.has(r.registrationId));

    return {
      admissions: adm, results: filteredResults, exams: rawData.exams,
      schedules: rawData.schedules, regs: filteredRegs, essays: rawData.essays,
      users: rawData.users,
    };
  }, [rawData, statusFilter, gradeFilter, dateFrom, dateTo]);

  const totalApplicants = admissions.length;
  const accepted = admissions.filter(a => a.status === 'Accepted').length;
  const passed = results.filter(r => r.passed).length;
  const avg = results.length > 0 ? (results.reduce((s, r) => s + r.percentage, 0) / results.length).toFixed(1) : '0.0';
  const pendingEssays = essays.filter(e => !e.scored).length;

  const now = new Date();
  const thisMonth = admissions.filter(a => { const d = new Date(a.submittedAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;

  const exportApplicants = () => {
    const rows = [['ID', 'First Name', 'Last Name', 'Email', 'Grade Level', 'Status', 'Submitted']];
    admissions.forEach(a => rows.push([a.id, a.firstName, a.lastName, a.email, a.gradeLevel, a.status, a.submittedAt]));
    downloadCSV('applicants.csv', rows);
    showToast('Applicant list downloaded!', 'success');
  };

  const exportResults = () => {
    const rows = [['Student', 'Exam', 'Score', 'Max', 'Percentage', 'Passed', 'Essay Reviewed', 'Date']];
    results.forEach(r => {
      const reg = regs.find(rg => rg.id === r.registrationId);
      const student = reg ? users.find(u => u.email === reg.userEmail) : null;
      const sched = reg ? schedules.find(s => s.id === reg.scheduleId) : null;
      const exam = sched ? exams.find(e => e.id === sched.examId) : null;
      rows.push([student ? `${student.firstName} ${student.lastName}` : 'Unknown', exam?.title || 'N/A', r.totalScore, r.maxPossible, r.percentage.toFixed(1) + '%', r.passed ? 'Yes' : 'No', r.essayReviewed ? 'Yes' : 'No', r.createdAt]);
    });
    downloadCSV('exam_results.csv', rows);
    showToast('Results downloaded!', 'success');
  };

  const exportSchedules = () => {
    const rows = [['Exam', 'Date', 'Start Time', 'End Time', 'Max Slots', 'Booked']];
    schedules.forEach(s => { const exam = exams.find(e => e.id === s.examId); rows.push([exam?.title || 'N/A', s.scheduledDate, s.startTime, s.endTime, s.maxSlots, s.slotsTaken]); });
    downloadCSV('exam_schedules.csv', rows);
    showToast('Schedules downloaded!', 'success');
  };

  /* Pass rate chart data */
  const examStats = exams.map(exam => {
    const eScheds = schedules.filter(s => s.examId === exam.id);
    const eRegs = regs.filter(r => eScheds.some(s => s.id === r.scheduleId));
    const eResults = results.filter(r => eRegs.some(rg => rg.id === r.registrationId));
    const p = eResults.filter(r => r.passed).length;
    const t = eResults.length;
    return { name: exam.title.replace('Entrance Examination ', ''), passed: p, total: t, rate: t > 0 ? Math.round((p / t) * 100) : 0 };
  });

  /* Monthly volume */
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const count = admissions.filter(a => { const ad = new Date(a.submittedAt); return `${ad.getFullYear()}-${String(ad.getMonth()).padStart(2, '0')}` === key; }).length;
    monthData.push({ label: monthNames[d.getMonth()], count });
  }
  const maxMonth = Math.max(...monthData.map(m => m.count), 1);

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

      {/* Refresh button */}
      <div className="flex justify-end mb-4">
        <button onClick={() => setDataTick(t => t + 1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">🔄 Refresh Data</button>
      </div>

      {/* Filters */}
      <div className="lpu-card p-4 mb-6">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Filter Report Data</h4>
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white text-sm">
            <option value="all">All Status</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Screening">Under Screening</option>
            <option value="Under Evaluation">Under Evaluation</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white text-sm">
            <option value="all">All Grades</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none text-sm" />
          </div>
          {(statusFilter !== 'all' || gradeFilter !== 'all' || dateFrom || dateTo) && (
            <button onClick={() => { setStatusFilter('all'); setGradeFilter('all'); setDateFrom(''); setDateTo(''); }} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { icon: '📋', title: 'Applicant List', desc: 'Download a full list of all applicants with their admission status.', onClick: exportApplicants },
          { icon: '🧮', title: 'Exam Results', desc: 'Download exam scores and pass/fail data for all applicants.', onClick: exportResults },
          { icon: '📅', title: 'Exam Schedules', desc: 'Download all exam schedule data and slot availability.', onClick: exportSchedules },
        ].map((c, i) => (
          <div key={i} className="lpu-card p-6 text-center">
            <div className="text-4xl mb-3">{c.icon}</div>
            <h3 className="font-bold text-forest-500 mb-1">{c.title}</h3>
            <p className="text-gray-500 text-sm mb-4">{c.desc}</p>
            <button onClick={c.onClick} className="bg-[#166534] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#14532d]">📥 Download CSV</button>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pass Rate */}
        <div className="lpu-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-4">📊 Pass Rate by Exam</h3>
          {examStats.length > 0 && examStats.some(e => e.total > 0) ? (
            <div className="space-y-3">
              {examStats.map((e, i) => (
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

        {/* Volume Chart */}
        <div className="lpu-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-4">📈 Applicant Volume (Monthly)</h3>
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
      <div className="lpu-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">📋 Summary Statistics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs">
              <th scope="col" className="py-3 px-2">Metric</th><th scope="col" className="py-3 px-2">Value</th><th scope="col" className="py-3 px-2">Change</th>
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
