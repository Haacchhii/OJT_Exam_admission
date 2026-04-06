import { Suspense, useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { getReportsSummary } from '../../api/admissions';
import { formatPersonName, formatDate } from '../../utils/helpers';
import { showToast } from '../../components/Toast';
import { PageHeader, SkeletonPage, ErrorAlert } from '../../components/UI';
import Icon from '../../components/Icons';
import { lazyWithRetry, LazyLoadingFallback } from '../../components/lazyWithRetry';
import { ADMISSION_STATUSES, GRADE_OPTIONS, ALL_GRADE_LEVELS } from '../../utils/constants';
import type { Admission, ExamResult, Exam, ExamSchedule, ExamRegistration, EssayAnswer, User, AcademicYear, Semester } from '../../types';

const PassRateMonthlyCharts = lazyWithRetry(() => import('./reports/charts/PassRateMonthlyCharts'));
const ResultsBreakdownCharts = lazyWithRetry(() => import('./reports/charts/ResultsBreakdownCharts'));
const ScheduleUtilizationChart = lazyWithRetry(() => import('./reports/charts/ScheduleUtilizationChart'));

const STATUS_COLORS: Record<string, string> = {
  Submitted: '#8b5cf6',
  'Under Screening': '#f59e0b',
  'Under Evaluation': '#0ea5e9',
  Accepted: '#16a34a',
  Rejected: '#ef4444',
};

const CHART_FALLBACK_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

function DeferredChartSection({ children, minHeight = 320 }: { children: ReactNode; minHeight?: number }) {
  const [isReady, setIsReady] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isReady || !hostRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [isReady]);

  return (
    <div ref={hostRef} style={{ minHeight }}>
      {isReady ? children : <div className="gk-section-card p-6 mb-6 text-sm text-gray-400">Loading chart section...</div>}
    </div>
  );
}

function getRegUserId(reg: ExamRegistration): number | null {
  const maybe = (reg as ExamRegistration & { userId?: unknown }).userId;
  return typeof maybe === 'number' ? maybe : null;
}

function semesterLabel(s: Semester) {
  const start = s.startDate ? formatDate(String(s.startDate)) : null;
  const end = s.endDate ? formatDate(String(s.endDate)) : null;
  if (start || end) return `${s.name} (${start || 'open'} to ${end || 'open'})`;
  return s.name;
}

function compactDate(value?: string | null) {
  if (!value) return '';
  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function compactPeriod(a?: Admission) {
  const semStart = compactDate(String(a?.semester?.startDate || ''));
  const semEnd = compactDate(String(a?.semester?.endDate || ''));
  const yearName = a?.academicYear?.year || '';
  const semName = a?.semester?.name || '';
  const base = [yearName, semName].filter(Boolean).join(' - ');
  if (!semStart && !semEnd) return base;
  return `${base}${base ? ' ' : ''}(${semStart || 'Open'} to ${semEnd || 'Open'})`;
}

interface ReportData {
  admissions: Admission[];
  results: ExamResult[];
  exams: Exam[];
  schedules: ExamSchedule[];
  regs: ExamRegistration[];
  essays: EssayAnswer[];
  users: User[];
  academicYears: AcademicYear[];
  semesters: Semester[];
  meta?: {
    admissionCountTotal: number;
    admissionCountReturned: number;
    admissionLimit: number;
    admissionsCapped: boolean;
  };
}

const EMPTY_REPORT_DATA: ReportData = {
  admissions: [],
  results: [],
  exams: [],
  schedules: [],
  regs: [],
  essays: [],
  users: [],
  academicYears: [],
  semesters: [],
  meta: {
    admissionCountTotal: 0,
    admissionCountReturned: 0,
    admissionLimit: 1200,
    admissionsCapped: false,
  },
};

export default function EmployeeReports() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelGroupFilter, setLevelGroupFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const reportsParams = useMemo(() => {
    const params: {
      status?: string;
      levelGroup?: string;
      grade?: string;
      academicYearId?: number;
      semesterId?: number;
      dateFrom?: string;
      dateTo?: string;
      limit: number;
    } = {
      limit: 1200,
    };

    if (statusFilter !== 'all') params.status = statusFilter;
    if (levelGroupFilter !== 'all') params.levelGroup = levelGroupFilter;
    if (gradeFilter !== 'all') params.grade = gradeFilter;
    if (yearFilter !== 'all') params.academicYearId = Number(yearFilter);
    if (semesterFilter !== 'all') params.semesterId = Number(semesterFilter);
    if (!hasInvalidDateRange) {
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
    }

    return params;
  }, [statusFilter, levelGroupFilter, gradeFilter, yearFilter, semesterFilter, dateFrom, dateTo, hasInvalidDateRange]);

  const { data: rawData, loading, error, refetch } = useAsync<ReportData>(async () => {
    try {
      const summary = await getReportsSummary(reportsParams);
      return {
        admissions: summary.admissions as Admission[],
        results: summary.results as ExamResult[],
        exams: summary.exams as Exam[],
        schedules: summary.schedules as ExamSchedule[],
        regs: summary.regs as ExamRegistration[],
        essays: summary.essays as EssayAnswer[],
        users: summary.users as User[],
        academicYears: summary.academicYears as AcademicYear[],
        semesters: summary.semesters as Semester[],
        meta: summary.meta,
      };
    } catch {
      showToast('Failed to load report data.', 'error');
      return EMPTY_REPORT_DATA;
    }
  }, [reportsParams]);

  const {
    admissions,
    results,
    exams,
    schedules,
    regs,
    academicYears,
    allSemesters,
    usersById,
    usersByEmail,
    regsById,
    schedulesById,
    examsById,
    meta,
  } = useMemo(() => {
    const source = rawData || EMPTY_REPORT_DATA;
    const filteredAdmissions = source.admissions;

    const admissionUserIds = new Set(filteredAdmissions.map(a => a.userId).filter((id): id is number => typeof id === 'number'));
    const admissionEmails = new Set(filteredAdmissions.map(a => a.email));

    const filteredRegs = source.regs.filter((r) => {
      const regUserId = getRegUserId(r);
      if (regUserId !== null && admissionUserIds.has(regUserId)) return true;
      return admissionEmails.has(r.userEmail);
    });

    const registrationIds = new Set(filteredRegs.map(r => r.id));
    const filteredResults = source.results.filter(r => registrationIds.has(r.registrationId));
    const filteredEssays = source.essays.filter(e => registrationIds.has(e.registrationId));

    const scheduleIds = new Set(filteredRegs.map(r => r.scheduleId));
    const filteredSchedules = source.schedules.filter(s => scheduleIds.has(s.id));
    const examIds = new Set(filteredSchedules.map(s => s.examId));
    const filteredExams = source.exams.filter(e => examIds.has(e.id));

    return {
      admissions: filteredAdmissions,
      results: filteredResults,
      exams: filteredExams,
      schedules: filteredSchedules,
      regs: filteredRegs,
      essays: filteredEssays,
      users: source.users,
      academicYears: source.academicYears,
      allSemesters: source.semesters,
      usersById: new Map(source.users.map(u => [u.id, u])),
      usersByEmail: new Map(source.users.map(u => [u.email, u])),
      regsById: new Map(filteredRegs.map(r => [r.id, r])),
      schedulesById: new Map(filteredSchedules.map(s => [s.id, s])),
      examsById: new Map(filteredExams.map(e => [e.id, e])),
      meta: source.meta,
    };
  }, [rawData]);

  const semesterOptions = allSemesters.filter(s =>
    yearFilter === 'all' || s.academicYearId === Number(yearFilter)
  );

  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  const totalApplicants = admissions.length;
  const accepted = admissions.filter(a => a.status === 'Accepted').length;
  const passed = results.filter(r => r.passed).length;
  const avg = results.length > 0 ? (results.reduce((s, r) => s + r.percentage, 0) / results.length).toFixed(1) : '0.0';

  const now = new Date();

  const exportApplicants = async (format: 'csv' | 'pdf' = 'csv') => {
    const { buildActiveFilters, downloadCSV, getChartSvgMarkup, printPdfReport } = await import('./reports/reportExport');
    const headers = ['ID', 'First Name', 'Middle Name', 'Last Name', 'Email', 'Grade Level', 'Application Period', 'Status', 'Submitted'];
    const rows: (string | number)[][] = admissions.map(a => [
      a.id,
      a.firstName,
      a.middleName || '',
      a.lastName,
      a.email,
      a.gradeLevel,
      compactPeriod(a),
      a.status,
      compactDate(a.submittedAt),
    ]);
    const activeFilters = buildActiveFilters({
      statusFilter,
      levelGroupFilter,
      gradeFilter,
      yearFilter,
      semesterFilter,
      dateFrom,
      dateTo,
    });

    if (format === 'pdf') {
      printPdfReport('Applicant List', [
        {
          subtitle: 'Admission Status Mix and Applicant Table',
          chartSvg: getChartSvgMarkup('chart-admission-status-mix') || getChartSvgMarkup('chart-applicant-volume'),
          headers,
          rows,
        },
      ], activeFilters, () => showToast('Please allow popups to export PDF', 'error'));
    }
    else { downloadCSV('applicants.csv', [headers, ...rows]); }
    showToast(`Applicant list ${format === 'pdf' ? 'exported' : 'downloaded'}!`, 'success');
  };

  const exportResults = async (format: 'csv' | 'pdf' = 'csv') => {
    const { buildActiveFilters, downloadCSV, getChartSvgMarkup, printPdfReport } = await import('./reports/reportExport');
    const headers = ['Student', 'Exam', 'Score', 'Max', 'Percentage', 'Passed', 'Essay Reviewed', 'Date'];
    const rows: (string | number)[][] = results.map(r => {
      const reg = regsById.get(r.registrationId);
      const regUserId = reg ? getRegUserId(reg) : null;
      const student = reg ? (regUserId !== null ? usersById.get(regUserId) : usersByEmail.get(reg.userEmail)) : null;
      const sched = reg ? schedulesById.get(reg.scheduleId) : null;
      const exam = sched ? examsById.get(sched.examId) : null;
      return [student ? formatPersonName(student) : 'Unknown', exam?.title || 'N/A', r.totalScore, r.maxPossible, r.percentage.toFixed(1) + '%', r.passed ? 'Yes' : 'No', r.essayReviewed ? 'Yes' : 'No', compactDate(r.createdAt) || ''];
    });
    const activeFilters = buildActiveFilters({
      statusFilter,
      levelGroupFilter,
      gradeFilter,
      yearFilter,
      semesterFilter,
      dateFrom,
      dateTo,
    });

    if (format === 'pdf') {
      printPdfReport('Exam Results', [
        {
          subtitle: 'Pass Rate by Exam and Detailed Results Table',
          chartSvg: getChartSvgMarkup('chart-pass-rate-by-exam') || getChartSvgMarkup('chart-results-breakdown-pass-fail'),
          headers,
          rows,
        },
      ], activeFilters, () => showToast('Please allow popups to export PDF', 'error'));
    }
    else { downloadCSV('exam_results.csv', [headers, ...rows]); }
    showToast(`Results ${format === 'pdf' ? 'exported' : 'downloaded'}!`, 'success');
  };

  const exportSchedules = async (format: 'csv' | 'pdf' = 'csv') => {
    const { buildActiveFilters, downloadCSV, getChartSvgMarkup, printPdfReport } = await import('./reports/reportExport');
    const headers = ['Exam', 'Date', 'Start Time', 'End Time', 'Registration Open', 'Registration Close', 'Max Slots', 'Booked'];
    const rows: (string | number)[][] = schedules.map(s => {
      const exam = examsById.get(s.examId);
      return [
        exam?.title || 'N/A',
        compactDate(s.scheduledDate),
        s.startTime,
        s.endTime,
        compactDate(s.registrationOpenDate),
        compactDate(s.registrationCloseDate),
        s.maxSlots,
        s.slotsTaken,
      ];
    });
    const activeFilters = buildActiveFilters({
      statusFilter,
      levelGroupFilter,
      gradeFilter,
      yearFilter,
      semesterFilter,
      dateFrom,
      dateTo,
    });

    if (format === 'pdf') {
      printPdfReport('Exam Schedules', [
        {
          subtitle: 'Schedule Utilization and Schedules Table',
          chartSvg: getChartSvgMarkup('chart-schedule-utilization'),
          headers,
          rows,
        },
      ], activeFilters, () => showToast('Please allow popups to export PDF', 'error'));
    }
    else { downloadCSV('exam_schedules.csv', [headers, ...rows]); }
    showToast(`Schedules ${format === 'pdf' ? 'exported' : 'downloaded'}!`, 'success');
  };

  const scheduleExamMap = new Map(schedules.map(s => [s.id, s.examId]));
  const regExamMap = new Map<number, number>();
  for (const reg of regs) {
    const examId = scheduleExamMap.get(reg.scheduleId);
    if (typeof examId === 'number') regExamMap.set(reg.id, examId);
  }

  const examScoreMap = new Map<number, { passed: number; total: number }>();
  for (const result of results) {
    const examId = regExamMap.get(result.registrationId);
    if (typeof examId !== 'number') continue;
    const current = examScoreMap.get(examId) || { passed: 0, total: 0 };
    current.total += 1;
    if (result.passed) current.passed += 1;
    examScoreMap.set(examId, current);
  }

  const examStats = exams.map(exam => {
    const score = examScoreMap.get(exam.id) || { passed: 0, total: 0 };
    return {
      name: exam.title.replace('Entrance Examination ', ''),
      passed: score.passed,
      total: score.total,
      rate: score.total > 0 ? Math.round((score.passed / score.total) * 100) : 0,
    };
  });

  const monthKeyCounts = new Map<string, number>();
  for (const admission of admissions) {
    const d = new Date(admission.submittedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    monthKeyCounts.set(key, (monthKeyCounts.get(key) || 0) + 1);
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthData: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const count = monthKeyCounts.get(key) || 0;
    monthData.push({ label: monthNames[d.getMonth()], count });
  }

  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  const thisMonth = monthKeyCounts.get(thisMonthKey) || 0;

  const admissionStatusCounts = new Map<string, number>();
  for (const admission of admissions) {
    admissionStatusCounts.set(admission.status, (admissionStatusCounts.get(admission.status) || 0) + 1);
  }

  const admissionStatusData = ADMISSION_STATUSES.map(status => ({
    name: status,
    value: admissionStatusCounts.get(status) || 0,
    color: STATUS_COLORS[status] || CHART_FALLBACK_COLORS[0],
  })).filter(d => d.value > 0);
  const admissionStatusTotal = admissionStatusData.reduce((sum, item) => sum + item.value, 0);

  let passedCount = 0;
  let failedCount = 0;
  const scoreBandCounts = [0, 0, 0, 0, 0];
  for (const result of results) {
    if (result.passed) passedCount += 1;
    else failedCount += 1;

    if (result.percentage >= 90) scoreBandCounts[0] += 1;
    else if (result.percentage >= 80) scoreBandCounts[1] += 1;
    else if (result.percentage >= 70) scoreBandCounts[2] += 1;
    else if (result.percentage >= 60) scoreBandCounts[3] += 1;
    else scoreBandCounts[4] += 1;
  }

  const passFailData = [
    { name: 'Passed', value: passedCount, color: '#16a34a' },
    { name: 'Failed', value: failedCount, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const scoreBands = [
    { name: '90-100', min: 90, max: 100 },
    { name: '80-89', min: 80, max: 89.99 },
    { name: '70-79', min: 70, max: 79.99 },
    { name: '60-69', min: 60, max: 69.99 },
    { name: '< 60', min: -Infinity, max: 59.99 },
  ];

  const scoreBandData = scoreBands.map((b, index) => ({
    band: b.name,
    count: scoreBandCounts[index],
  }));

  const scheduleUtilizationData = schedules
    .map(s => {
      const exam = examsById.get(s.examId);
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
              {semesterOptions.map(s => <option key={s.id} value={s.id}>{semesterLabel(s)}</option>)}
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
        {!hasInvalidDateRange && meta?.admissionsCapped && (
          <p className="mt-2 text-xs text-amber-700">
            Showing the newest {meta.admissionCountReturned} of {meta.admissionCountTotal} matching admissions for performance. Apply narrower filters or date range for targeted reporting.
          </p>
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

      <Suspense fallback={<LazyLoadingFallback />}>
        <PassRateMonthlyCharts
          sortedStats={sortedStats}
          monthData={monthData}
          admissionStatusData={admissionStatusData}
          admissionStatusTotal={admissionStatusTotal}
        />
      </Suspense>

      <DeferredChartSection minHeight={430}>
        <Suspense fallback={<LazyLoadingFallback />}>
          <ResultsBreakdownCharts
          resultsCount={results.length}
          passFailData={passFailData}
          scoreBandData={scoreBandData}
        />
        </Suspense>
      </DeferredChartSection>

      <DeferredChartSection minHeight={360}>
        <Suspense fallback={<LazyLoadingFallback />}>
          <ScheduleUtilizationChart scheduleUtilizationData={scheduleUtilizationData} />
        </Suspense>
      </DeferredChartSection>
      
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
