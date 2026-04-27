import { Suspense, useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { getReportsSummary } from '../../api/admissions';
import { useAuth } from '../../context/AuthContext';
import { formatPersonName, formatDate } from '../../utils/helpers';
import { showToast } from '../../components/Toast';
import { PageHeader, SkeletonPage, ErrorAlert, ActionButton } from '../../components/UI';
import Icon from '../../components/Icons';
import { lazyWithRetry, LazyLoadingFallback } from '../../components/lazyWithRetry';
import { ADMISSION_STATUSES, GRADE_OPTIONS, ALL_GRADE_LEVELS } from '../../utils/constants';
import type { Admission, ExamResult, Exam, ExamSchedule, ExamRegistration, AcademicYear, Semester } from '../../types';

const PassRateMonthlyCharts = lazyWithRetry(() => import('./reports/charts/PassRateMonthlyCharts'));
const ResultsBreakdownCharts = lazyWithRetry(() => import('./reports/charts/ResultsBreakdownCharts'));
const ScheduleUtilizationChart = lazyWithRetry(() => import('./reports/charts/ScheduleUtilizationChart'));
const PreviousSchoolChart = lazyWithRetry(() => import('./reports/charts/PreviousSchoolChart'));
const GradeLevelDistributionChart = lazyWithRetry(() => import('./reports/charts/GradeLevelDistributionChart'));

const STATUS_COLORS: Record<string, string> = {
  Submitted: '#8b5cf6',
  'Under Screening': '#f59e0b',
  'Under Evaluation': '#0ea5e9',
  Accepted: '#16a34a',
  Rejected: '#ef4444',
};

const CHART_FALLBACK_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];
const REPORTS_DEFAULT_LIMIT = 30;
const UNSPECIFIED_SCHOOL_KEY = '__unspecified_school__';
const MAX_SCHOOL_BARS = 12;

type ReportSortOption = 'newest' | 'oldest' | 'alphabetical' | 'school';

interface ExportChartOption {
  id: string;
  label: string;
}

interface ReportPreset {
  key: 'overview' | 'current-month' | 'accepted' | 'under-screening' | 'school-insights' | 'latest-cycle';
  label: string;
  description: string;
}

const REPORT_PRESETS: ReportPreset[] = [
  { key: 'overview', label: 'Overview', description: 'Clear all filters and show full snapshot' },
  { key: 'current-month', label: 'Current Month', description: 'Newest applicants from this month' },
  { key: 'accepted', label: 'Accepted Focus', description: 'Accepted admissions and recent outcomes' },
  { key: 'under-screening', label: 'Under Screening', description: 'Applicants currently under screening' },
  { key: 'school-insights', label: 'School Insights', description: 'Sort by previous school for school trends' },
  { key: 'latest-cycle', label: 'Latest Academic Cycle', description: 'Auto-pick latest year and semester' },
];

const APPLICANT_CHART_OPTIONS: ExportChartOption[] = [
  { id: 'chart-grade-level-distribution', label: 'Grade-Level Distribution' },
  { id: 'chart-previous-school-distribution', label: 'Previous School Distribution' },
  { id: 'chart-admission-status-mix', label: 'Admission Status Mix' },
  { id: 'chart-applicant-volume', label: 'Applicant Volume (Monthly)' },
];

const RESULTS_CHART_OPTIONS: ExportChartOption[] = [
  { id: 'chart-pass-rate-by-exam', label: 'Pass Rate by Exam' },
  { id: 'chart-results-breakdown-pass-fail', label: 'Pass vs Fail Breakdown' },
  { id: 'chart-results-breakdown-score-bands', label: 'Score Bands' },
];

const SCHEDULE_CHART_OPTIONS: ExportChartOption[] = [
  { id: 'chart-schedule-utilization', label: 'Schedule Utilization' },
  { id: 'chart-pass-rate-by-exam', label: 'Pass Rate by Exam' },
  { id: 'chart-applicant-volume', label: 'Applicant Volume (Monthly)' },
];

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeSchoolLabel(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalSchoolKey(rawSchool: string) {
  const normalized = normalizeSchoolLabel(rawSchool);
  if (!normalized) return UNSPECIFIED_SCHOOL_KEY;

  const compact = normalized
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (['na', 'n/a', 'none', 'unknown', 'not provided'].includes(compact)) {
    return UNSPECIFIED_SCHOOL_KEY;
  }

  // Collapse common spelling variants to the same school bucket.
  if (/\blpu\b.*\bbatangas\b/.test(compact) || /\blyceum\b.*\bphilippines\b.*\bbatangas\b/.test(compact)) {
    return 'lyceum of the philippines university batangas';
  }

  return compact;
}

function sortLabel(sort: 'newest' | 'oldest' | 'alphabetical' | 'school') {
  if (sort === 'oldest') return 'Date: Oldest to Newest';
  if (sort === 'alphabetical') return 'Alphabetical: Last Name (A-Z)';
  if (sort === 'school') return 'Previous School (A-Z)';
  return 'Date: Newest to Oldest';
}

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
  if (start || end) return `${s.name} (${start || 'open'} - ${end || 'open'})`;
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
  return `${base}${base ? ' ' : ''}(${semStart || 'Open'} - ${semEnd || 'Open'})`;
}

interface ReportData {
  admissions: Admission[];
  results: ExamResult[];
  exams: Exam[];
  schedules: ExamSchedule[];
  regs: ExamRegistration[];
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
  academicYears: [],
  semesters: [],
  meta: {
    admissionCountTotal: 0,
    admissionCountReturned: 0,
    admissionLimit: REPORTS_DEFAULT_LIMIT,
    admissionsCapped: false,
  },
};

export default function EmployeeReports() {
  const { user } = useAuth();
  const isTeacherView = user?.role === 'teacher';
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelGroupFilter, setLevelGroupFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState<ReportSortOption>('newest');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [applicantChartSelection, setApplicantChartSelection] = useState(APPLICANT_CHART_OPTIONS[0].id);
  const [resultsChartSelection, setResultsChartSelection] = useState(RESULTS_CHART_OPTIONS[0].id);
  const [scheduleChartSelection, setScheduleChartSelection] = useState(SCHEDULE_CHART_OPTIONS[0].id);

  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const visibleReportPresets = isTeacherView
    ? REPORT_PRESETS.filter((preset) => preset.key === 'overview' || preset.key === 'latest-cycle')
    : REPORT_PRESETS;

  const reportsParams = useMemo(() => {
    const params: {
      status?: string;
      levelGroup?: string;
      grade?: string;
      sort: 'newest' | 'oldest' | 'alphabetical' | 'school';
      school?: string;
      academicYearId?: number;
      semesterId?: number;
      dateFrom?: string;
      dateTo?: string;
      limit: number;
    } = {
      limit: REPORTS_DEFAULT_LIMIT,
      sort: sortFilter,
    };

    if (!isTeacherView) {
      if (statusFilter !== 'all') params.status = statusFilter;
      if (levelGroupFilter !== 'all') params.levelGroup = levelGroupFilter;
      if (gradeFilter !== 'all') params.grade = gradeFilter;
      if (schoolFilter.trim()) params.school = schoolFilter.trim();
    }
    if (yearFilter !== 'all') params.academicYearId = Number(yearFilter);
    if (semesterFilter !== 'all') params.semesterId = Number(semesterFilter);
    if (!hasInvalidDateRange) {
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
    }

    return params;
  }, [statusFilter, levelGroupFilter, gradeFilter, sortFilter, schoolFilter, yearFilter, semesterFilter, dateFrom, dateTo, hasInvalidDateRange, isTeacherView]);

  const { data: rawData, loading, error, refetch } = useAsync<ReportData>(async () => {
    try {
      const summary = await getReportsSummary(reportsParams);
      return {
        admissions: summary.admissions as Admission[],
        results: summary.results as ExamResult[],
        exams: summary.exams as Exam[],
        schedules: summary.schedules as ExamSchedule[],
        regs: summary.regs as ExamRegistration[],
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
    admissionsByUserId,
    admissionsByEmail,
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

    const scheduleIds = new Set(filteredRegs.map(r => r.scheduleId));
    const filteredSchedules = source.schedules.filter(s => scheduleIds.has(s.id));
    const examIds = new Set(filteredSchedules.map(s => s.examId));
    const filteredExams = source.exams.filter(e => examIds.has(e.id));

    const admissionByUserId = new Map<number, Admission>();
    const admissionByEmail = new Map<string, Admission>();
    for (const admission of filteredAdmissions) {
      if (typeof admission.userId === 'number' && !admissionByUserId.has(admission.userId)) {
        admissionByUserId.set(admission.userId, admission);
      }
      const cleanEmail = String(admission.email || '').trim().toLowerCase();
      if (cleanEmail && !admissionByEmail.has(cleanEmail)) {
        admissionByEmail.set(cleanEmail, admission);
      }
    }

    return {
      admissions: filteredAdmissions,
      results: filteredResults,
      exams: filteredExams,
      schedules: filteredSchedules,
      regs: filteredRegs,
      academicYears: source.academicYears,
      allSemesters: source.semesters,
      admissionsByUserId: admissionByUserId,
      admissionsByEmail: admissionByEmail,
      regsById: new Map(filteredRegs.map(r => [r.id, r])),
      schedulesById: new Map(filteredSchedules.map(s => [s.id, s])),
      examsById: new Map(filteredExams.map(e => [e.id, e])),
      meta: source.meta,
    };
  }, [rawData]);

  const semesterOptions = allSemesters.filter(s =>
    yearFilter === 'all' || s.academicYearId === Number(yearFilter)
  );

  const clearAllFilters = () => {
    setStatusFilter('all');
    setLevelGroupFilter('all');
    setGradeFilter('all');
    setSortFilter('newest');
    setSchoolFilter('');
    setYearFilter('all');
    setSemesterFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const applyReportPreset = (presetKey: ReportPreset['key']) => {
    const nowDate = new Date();
    const todayIso = toLocalIsoDate(nowDate);
    const firstDayOfMonthIso = toLocalIsoDate(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1));

    clearAllFilters();

    if (presetKey === 'current-month') {
      setDateFrom(firstDayOfMonthIso);
      setDateTo(todayIso);
      setSortFilter('newest');
      showToast('Applied preset: Current Month', 'success');
      return;
    }

    if (presetKey === 'accepted') {
      setStatusFilter('Accepted');
      setSortFilter('newest');
      setDateFrom(firstDayOfMonthIso);
      setDateTo(todayIso);
      showToast('Applied preset: Accepted Focus', 'success');
      return;
    }

    if (presetKey === 'under-screening') {
      setStatusFilter('Under Screening');
      setSortFilter('oldest');
      showToast('Applied preset: Under Screening', 'success');
      return;
    }

    if (presetKey === 'school-insights') {
      setSortFilter('school');
      setDateFrom(firstDayOfMonthIso);
      setDateTo(todayIso);
      showToast('Applied preset: School Insights', 'success');
      return;
    }

    if (presetKey === 'latest-cycle') {
      const latestYear = [...academicYears].sort((a, b) => b.id - a.id)[0] || null;
      if (latestYear) {
        setYearFilter(String(latestYear.id));
        const latestSemester = [...allSemesters]
          .filter((semester) => semester.academicYearId === latestYear.id)
          .sort((a, b) => b.id - a.id)[0] || null;
        setSemesterFilter(latestSemester ? String(latestSemester.id) : 'all');
      }
      setSortFilter('newest');
      showToast('Applied preset: Latest Academic Cycle', 'success');
      return;
    }

    showToast('Applied preset: Overview', 'success');
  };

  const pickExportChartSvg = (
    getChartSvgMarkup: (containerId: string) => string,
    preferredChartId: string,
    fallbackChartIds: string[] = []
  ) => {
    for (const chartId of [preferredChartId, ...fallbackChartIds]) {
      const chartSvg = getChartSvgMarkup(chartId);
      if (chartSvg) return chartSvg;
    }
    return '';
  };

  const hasActiveFilters =
    statusFilter !== 'all' ||
    levelGroupFilter !== 'all' ||
    gradeFilter !== 'all' ||
    sortFilter !== 'newest' ||
    schoolFilter.trim().length > 0 ||
    yearFilter !== 'all' ||
    semesterFilter !== 'all' ||
    dateFrom.length > 0 ||
    dateTo.length > 0;

  const exportFilterSummary = useMemo(() => {
    const filters: string[] = [];
    if (!isTeacherView) {
      if (statusFilter !== 'all') filters.push(`Status: ${statusFilter}`);
      if (levelGroupFilter !== 'all') filters.push(`Level Group: ${levelGroupFilter}`);
      if (gradeFilter !== 'all') filters.push(`Grade: ${gradeFilter}`);
      if (sortFilter !== 'newest') filters.push(`Sort: ${sortLabel(sortFilter)}`);
      if (schoolFilter.trim()) filters.push(`Previous School: ${schoolFilter.trim()}`);
    }

    if (yearFilter !== 'all') {
      const year = academicYears.find((item) => item.id === Number(yearFilter));
      filters.push(`School Year: ${year?.year || yearFilter}`);
    }

    if (semesterFilter !== 'all') {
      const semester = allSemesters.find((item) => item.id === Number(semesterFilter));
      filters.push(`Semester: ${semester ? semesterLabel(semester) : semesterFilter}`);
    }

    if (dateFrom || dateTo) {
      filters.push(`Submitted Date: ${dateFrom || 'Any'} to ${dateTo || 'Any'}`);
    }

    if (filters.length === 0) return isTeacherView
      ? 'No filters are active. Exports include the loaded exam results and schedules.'
      : 'No filters are active. Exports include all currently loaded records.';
    return filters.join(' | ');
  }, [statusFilter, levelGroupFilter, gradeFilter, sortFilter, schoolFilter, yearFilter, semesterFilter, dateFrom, dateTo, academicYears, allSemesters, isTeacherView]);

  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  const totalApplicants = admissions.length;
  const accepted = admissions.filter(a => a.status === 'Accepted').length;
  const passed = results.filter(r => r.passed).length;
  const avg = results.length > 0 ? (results.reduce((s, r) => s + r.percentage, 0) / results.length).toFixed(1) : '0.0';
  const selectedYearLabel = yearFilter !== 'all'
    ? (academicYears.find((item) => item.id === Number(yearFilter))?.year || yearFilter)
    : '';
  const selectedSemesterLabel = semesterFilter !== 'all'
    ? (() => {
      const selected = allSemesters.find((item) => item.id === Number(semesterFilter));
      return selected ? semesterLabel(selected) : semesterFilter;
    })()
    : '';

  const now = new Date();

  const exportApplicants = async (format: 'csv' | 'pdf' = 'csv') => {
    showToast(hasActiveFilters ? 'Exporting applicant list with the active filters.' : 'Exporting applicant list with all loaded records.', 'info');
    const { buildActiveFilters, downloadCSV, getChartSvgMarkup, printPdfReport } = await import('./reports/reportExport');
    const headers = ['ID', 'First Name', 'Middle Name', 'Last Name', 'Email', 'Grade Level', 'Previous School', 'Application Period', 'Status', 'Submitted'];
    const rows: (string | number)[][] = admissions.map(a => [
      a.id,
      a.firstName,
      a.middleName || '',
      a.lastName,
      a.email,
      a.gradeLevel,
      a.prevSchool || '-',
      compactPeriod(a),
      a.status,
      compactDate(a.submittedAt),
    ]);
    const activeFilters = buildActiveFilters({
      statusFilter,
      levelGroupFilter,
      gradeFilter,
      sortFilter,
      schoolFilter,
      yearFilter,
      yearLabel: selectedYearLabel,
      semesterFilter,
      semesterLabel: selectedSemesterLabel,
      dateFrom,
      dateTo,
    });

    if (format === 'pdf') {
      printPdfReport('Applicant List', [
        {
          subtitle: 'Admission Status Mix and Applicant Table',
          chartSvg: pickExportChartSvg(getChartSvgMarkup, applicantChartSelection, ['chart-grade-level-distribution', 'chart-previous-school-distribution', 'chart-admission-status-mix', 'chart-applicant-volume']),
          headers,
          rows,
        },
      ], activeFilters, () => showToast('Please allow popups to export PDF', 'error'));
    }
    else { downloadCSV('applicants.csv', [headers, ...rows]); }
    showToast(`Applicant list ${format === 'pdf' ? 'exported' : 'downloaded'}!`, 'success');
  };

  const exportResults = async (format: 'csv' | 'pdf' = 'csv') => {
    showToast(hasActiveFilters ? 'Exporting exam results with the active filters.' : 'Exporting exam results with all loaded records.', 'info');
    const { buildActiveFilters, downloadCSV, getChartSvgMarkup, printPdfReport } = await import('./reports/reportExport');
    const headers = ['Student', 'Exam', 'Score', 'Max', 'Percentage', 'Passed', 'Essay Reviewed', 'Date'];
    const rows: (string | number)[][] = results.map(r => {
      const reg = regsById.get(r.registrationId);
      const regUserId = reg ? getRegUserId(reg) : null;
      const student = reg
        ? (regUserId !== null
            ? admissionsByUserId.get(regUserId)
            : admissionsByEmail.get(String(reg.userEmail || '').trim().toLowerCase()))
        : null;
      const sched = reg ? schedulesById.get(reg.scheduleId) : null;
      const exam = sched ? examsById.get(sched.examId) : null;
      return [student ? formatPersonName(student) : 'Unknown', exam?.title || 'N/A', r.totalScore, r.maxPossible, r.percentage.toFixed(1) + '%', r.passed ? 'Yes' : 'No', r.essayReviewed ? 'Yes' : 'No', compactDate(r.createdAt) || ''];
    });
    const activeFilters = buildActiveFilters({
      statusFilter,
      levelGroupFilter,
      gradeFilter,
      sortFilter,
      schoolFilter,
      yearFilter,
      yearLabel: selectedYearLabel,
      semesterFilter,
      semesterLabel: selectedSemesterLabel,
      dateFrom,
      dateTo,
    });

    if (format === 'pdf') {
      printPdfReport('Exam Results', [
        {
          subtitle: 'Pass Rate by Exam and Detailed Results Table',
          chartSvg: pickExportChartSvg(getChartSvgMarkup, resultsChartSelection, ['chart-pass-rate-by-exam', 'chart-results-breakdown-pass-fail', 'chart-results-breakdown-score-bands']),
          headers,
          rows,
        },
      ], activeFilters, () => showToast('Please allow popups to export PDF', 'error'));
    }
    else { downloadCSV('exam_results.csv', [headers, ...rows]); }
    showToast(`Results ${format === 'pdf' ? 'exported' : 'downloaded'}!`, 'success');
  };

  const exportSchedules = async (format: 'csv' | 'pdf' = 'csv') => {
    showToast(hasActiveFilters ? 'Exporting exam schedules with the active filters.' : 'Exporting exam schedules with all loaded records.', 'info');
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
      sortFilter,
      schoolFilter,
      yearFilter,
      yearLabel: selectedYearLabel,
      semesterFilter,
      semesterLabel: selectedSemesterLabel,
      dateFrom,
      dateTo,
    });

    if (format === 'pdf') {
      printPdfReport('Exam Schedules', [
        {
          subtitle: 'Schedule Utilization and Schedules Table',
          chartSvg: pickExportChartSvg(getChartSvgMarkup, scheduleChartSelection, ['chart-schedule-utilization']),
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

  const previousSchoolBuckets = new Map<string, { count: number; labels: Map<string, number> }>();
  for (const admission of admissions) {
    const cleaned = normalizeSchoolLabel(admission.prevSchool);
    const key = canonicalSchoolKey(cleaned);
    const label = cleaned || 'Unspecified / Not Provided';
    const current = previousSchoolBuckets.get(key) || { count: 0, labels: new Map<string, number>() };
    current.count += 1;
    current.labels.set(label, (current.labels.get(label) || 0) + 1);
    previousSchoolBuckets.set(key, current);
  }

  const previousSchoolExpanded = Array.from(previousSchoolBuckets.entries())
    .map(([key, value]) => {
      const bestLabel = Array.from(value.labels.entries()).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0]
        || (key === UNSPECIFIED_SCHOOL_KEY ? 'Unspecified / Not Provided' : key);
      return { key, name: bestLabel, count: value.count };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const previousSchoolTotal = previousSchoolExpanded.reduce((sum, item) => sum + item.count, 0);
  const previousSchoolDistinct = previousSchoolExpanded.filter((item) => item.key !== UNSPECIFIED_SCHOOL_KEY).length;

  const previousSchoolData = previousSchoolExpanded.length > MAX_SCHOOL_BARS
    ? [
      ...previousSchoolExpanded.slice(0, MAX_SCHOOL_BARS - 1),
      {
        key: '__other_schools__',
        name: 'Other Schools',
        count: previousSchoolExpanded.slice(MAX_SCHOOL_BARS - 1).reduce((sum, item) => sum + item.count, 0),
      },
    ]
    : previousSchoolExpanded;

  const knownGradeOrder = new Map(ALL_GRADE_LEVELS.map((grade, index) => [grade, index]));
  const gradeLevelCounts = new Map<string, number>();
  for (const admission of admissions) {
    const grade = String(admission.gradeLevel || '').trim() || 'Unspecified';
    gradeLevelCounts.set(grade, (gradeLevelCounts.get(grade) || 0) + 1);
  }

  const gradeLevelDistributionData = Array.from(gradeLevelCounts.entries())
    .map(([gradeLevel, count]) => ({ gradeLevel, count }))
    .sort((a, b) => {
      const idxA = knownGradeOrder.has(a.gradeLevel) ? knownGradeOrder.get(a.gradeLevel)! : Number.MAX_SAFE_INTEGER;
      const idxB = knownGradeOrder.has(b.gradeLevel) ? knownGradeOrder.get(b.gradeLevel)! : Number.MAX_SAFE_INTEGER;
      if (idxA !== idxB) return idxA - idxB;
      return a.gradeLevel.localeCompare(b.gradeLevel);
    });

  const gradeLevelApplicantsTotal = gradeLevelDistributionData.reduce((sum, item) => sum + item.count, 0);

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
      <PageHeader title="Reports & Exports" subtitle={isTeacherView ? 'Generate and download exam results, schedules, and performance summaries.' : 'Generate and download reports for admissions and exam results.'} />

      <div className="flex justify-end mb-4">
        <ActionButton variant="secondary" icon={<Icon name="refresh" className="w-4 h-4" />} onClick={refetch}>Refresh Data</ActionButton>
      </div>

      {/* Filters */}
      <div className="gk-section-card p-4 mb-6">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Filter Report Data</h4>
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Presets</p>
          <div className="flex flex-wrap gap-2">
            {visibleReportPresets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyReportPreset(preset.key)}
                title={preset.description}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:border-forest-300 hover:text-forest-700 hover:bg-forest-50 transition"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {!isTeacherView && (
            <>
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
            <label className="block text-xs font-semibold text-gray-500 mb-1">Sort By</label>
            <select value={sortFilter} onChange={e => setSortFilter(e.target.value as 'newest' | 'oldest' | 'alphabetical' | 'school')} aria-label="Sort reports" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
              <option value="newest">Date: Newest to Oldest</option>
              <option value="oldest">Date: Oldest to Newest</option>
              <option value="alphabetical">Alphabetical: Last Name (A-Z)</option>
              <option value="school">Previous School (A-Z)</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Previous School</label>
            <input
              value={schoolFilter}
              onChange={e => setSchoolFilter(e.target.value)}
              placeholder="Search previous school..."
              aria-label="Filter by previous school"
              className="w-full min-w-[170px] px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm bg-white"
            />
          </div>
            </>
          )}

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

          {(statusFilter !== 'all' || levelGroupFilter !== 'all' || gradeFilter !== 'all' || sortFilter !== 'newest' || schoolFilter.trim() || yearFilter !== 'all' || semesterFilter !== 'all' || dateFrom || dateTo) && (
            <div className="flex items-end">
              <ActionButton variant="secondary" className="w-full xl:w-auto" onClick={clearAllFilters}>
                Clear Filters
              </ActionButton>
            </div>
          )}
        </div>
        {hasInvalidDateRange && (
          <p className="mt-2 text-xs text-red-600">Invalid date range: "From" must be before or equal to "To".</p>
        )}
        {!isTeacherView && !hasInvalidDateRange && meta?.admissionsCapped && (
          <p className="mt-2 text-xs text-amber-700">
            Showing the newest {meta.admissionCountReturned} of {meta.admissionCountTotal} matching admissions for performance. Apply narrower filters or date range for targeted reporting.
          </p>
        )}
      </div>

      {/* Export Cards */}
      <div className="gk-section-card border border-sky-200 bg-sky-50 p-3 mb-4">
        <p className="text-xs font-semibold text-sky-800">Export scope uses current filters</p>
        <p className="text-xs text-sky-700 mt-1">{exportFilterSummary}</p>
      </div>

      <div className={`grid grid-cols-1 ${isTeacherView ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 mb-6`}>
        {(
          isTeacherView
            ? [
                {
                  icon: 'chartBar',
                  title: 'Exam Results',
                  desc: 'Download exam scores, pass/fail data, and performance summaries.',
                  onCSV: () => exportResults('csv'),
                  onPDF: () => exportResults('pdf'),
                  color: 'gold',
                  chartOptions: RESULTS_CHART_OPTIONS,
                  selectedChart: resultsChartSelection,
                  onChartChange: setResultsChartSelection,
                },
                {
                  icon: 'calendar',
                  title: 'Exam Schedules',
                  desc: 'Download schedule data and slot utilization for exams you manage.',
                  onCSV: () => exportSchedules('csv'),
                  onPDF: () => exportSchedules('pdf'),
                  color: 'emerald',
                  chartOptions: SCHEDULE_CHART_OPTIONS,
                  selectedChart: scheduleChartSelection,
                  onChartChange: setScheduleChartSelection,
                },
              ]
            : [
                {
                  icon: 'clipboard',
                  title: 'Applicant List',
                  desc: 'Download a full list of all applicants with their admission status.',
                  onCSV: () => exportApplicants('csv'),
                  onPDF: () => exportApplicants('pdf'),
                  color: 'forest',
                  chartOptions: APPLICANT_CHART_OPTIONS,
                  selectedChart: applicantChartSelection,
                  onChartChange: setApplicantChartSelection,
                },
                {
                  icon: 'chartBar',
                  title: 'Exam Results',
                  desc: 'Download exam scores and pass/fail data for all applicants.',
                  onCSV: () => exportResults('csv'),
                  onPDF: () => exportResults('pdf'),
                  color: 'gold',
                  chartOptions: RESULTS_CHART_OPTIONS,
                  selectedChart: resultsChartSelection,
                  onChartChange: setResultsChartSelection,
                },
                {
                  icon: 'calendar',
                  title: 'Exam Schedules',
                  desc: 'Download all exam schedule data and slot availability.',
                  onCSV: () => exportSchedules('csv'),
                  onPDF: () => exportSchedules('pdf'),
                  color: 'emerald',
                  chartOptions: SCHEDULE_CHART_OPTIONS,
                  selectedChart: scheduleChartSelection,
                  onChartChange: setScheduleChartSelection,
                },
              ]
        ).map((c, i) => {
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
              <div className="mb-3 text-left">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Chart for PDF</label>
                <select
                  value={c.selectedChart}
                  onChange={(event) => c.onChartChange(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-forest-500/20 outline-none"
                >
                  {c.chartOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <ActionButton variant="primary" className={`${btn1Color} font-bold shadow-md`} icon={<Icon name="document" className="w-4 h-4" />} onClick={c.onCSV}>CSV</ActionButton>
                <ActionButton variant="primary" className={`${btn2Color} font-bold shadow-md`} icon={<Icon name="document" className="w-4 h-4" />} onClick={c.onPDF}>PDF</ActionButton>
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
          showApplicantInsights={!isTeacherView}
        />
      </Suspense>

      {!isTeacherView && (
        <DeferredChartSection minHeight={380}>
          <Suspense fallback={<LazyLoadingFallback />}>
            <GradeLevelDistributionChart
              data={gradeLevelDistributionData}
              totalApplicants={gradeLevelApplicantsTotal}
            />
          </Suspense>
        </DeferredChartSection>
      )}

      {!isTeacherView && (
        <DeferredChartSection minHeight={380}>
          <Suspense fallback={<LazyLoadingFallback />}>
            <PreviousSchoolChart
              data={previousSchoolData}
              totalApplicants={previousSchoolTotal}
              distinctSchools={previousSchoolDistinct}
            />
          </Suspense>
        </DeferredChartSection>
      )}

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
        {isTeacherView ? (
          <>
            <div className="gk-section-card p-4 text-center border-l-4 border-forest-500 hover:shadow-md transition-shadow">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total Exams</p>
              <p className="text-2xl font-bold text-forest-700">{exams.length}</p>
              <p className="text-xs text-gray-400 mt-2">Published and draft exams</p>
            </div>
            <div className="gk-section-card p-4 text-center border-l-4 border-emerald-500 hover:shadow-md transition-shadow">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Exam Schedules</p>
              <p className="text-2xl font-bold text-emerald-700">{schedules.length}</p>
              <p className="text-xs text-gray-400 mt-2">Active and upcoming slots</p>
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
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
