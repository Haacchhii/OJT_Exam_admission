import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { getExamResults, getEssayAnswers, scoreEssay, getQuestionAnalytics } from '../../api/results';
import { getExamRegistrations, getExamSchedules, getExams } from '../../api/exams';
import { getAcademicYears, getSemesters } from '../../api/academicYears';
import { getUsers } from '../../api/users';
import { SCHOOL_NAME, SCHOOL_BRAND, SCHOOL_SUBTITLE, SCHOOL_ADDRESS, SCHOOL_PHONE } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { PageHeader, StatCard, Badge, Pagination, usePaginationSlice, SkeletonPage, ErrorAlert } from '../../components/UI';
import Icon from '../../components/Icons';
import { formatDate, asArray } from '../../utils/helpers';
import type { ExamResult, EssayAnswer, ExamRegistration, ExamSchedule, Exam, User, AcademicYear, Semester } from '../../types';

const RESULTS_PER_PAGE = 10;

interface RawData {
  results: ExamResult[];
  regs: ExamRegistration[];
  users: User[];
  schedules: ExamSchedule[];
  exams: Exam[];
  essays: EssayAnswer[];
}

interface EnrichedResult extends ExamResult {
  student: User | null | undefined;
  exam: Exam | null | undefined;
}

interface EssayCardProps {
  essay: EssayAnswer;
  student: string;
  question: string;
  status: 'pending' | 'scored';
  onScore?: () => void;
}

export default function EmployeeResults() {
  const { user: authUser } = useAuth();
  const canScoreEssays = authUser?.role === 'administrator' || authUser?.role === 'teacher';
  const [tab, setTab] = useState<'results' | 'essays' | 'analytics'>('results');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [examFilter, setExamFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [essayStatusFilter, setEssayStatusFilter] = useState('all');
  const [scoreModal, setScoreModal] = useState<EssayAnswer | null>(null);
  const [scoreVal, setScoreVal] = useState('');
  const [commentVal, setCommentVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [analyticsExamId, setAnalyticsExamId] = useState<number | null>(null);
  const [analyticsData, setAnalyticsData] = useState<Awaited<ReturnType<typeof getQuestionAnalytics>> | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [resultsPage, setResultsPage] = useState(1);

  const { data: rawData, loading, error, refetch } = useAsync<RawData>(async () => {
    const [rawRes, rawRegs, rawUsers, rawSched, rawExm, rawEssays] = await Promise.all([
      getExamResults(), getExamRegistrations(),
      getUsers(),
      getExamSchedules(),
      getExams(),
      getEssayAnswers(),
    ]);
    return { results: asArray<ExamResult>(rawRes), regs: asArray<ExamRegistration>(rawRegs), users: asArray<User>(rawUsers), schedules: asArray<ExamSchedule>(rawSched), exams: asArray<Exam>(rawExm), essays: asArray<EssayAnswer>(rawEssays) } as RawData;
  });

  const { data: academicYears } = useAsync<AcademicYear[]>(() => getAcademicYears());
  const { data: allSemesters } = useAsync<Semester[]>(() => getSemesters());

  const semesterOptions = (allSemesters || []).filter(s =>
    yearFilter === 'all' || s.academicYearId === Number(yearFilter)
  );

  const results = rawData?.results || [];
  const regs = rawData?.regs || [];
  const users = rawData?.users || [];
  const schedules = rawData?.schedules || [];
  const exams = rawData?.exams || [];
  const essays = rawData?.essays || [];

  const enriched: EnrichedResult[] = results.map(r => {
    const reg = regs.find(rg => rg.id === r.registrationId);
    const student = reg ? users.find(u => u.email === reg.userEmail) : null;
    const sched = reg ? schedules.find(s => s.id === reg.scheduleId) : null;
    const exam = sched ? exams.find(e => e.id === sched.examId) : null;
    return { ...r, student, exam: exam as EnrichedResult['exam'] };
  });

  let filtered = enriched;
  if (search) filtered = filtered.filter(r => {
    const name = r.student ? `${r.student.firstName} ${r.student.lastName}`.toLowerCase() : '';
    return name.includes(search.toLowerCase()) || (r.exam?.title || '').toLowerCase().includes(search.toLowerCase());
  });
  if (filter === 'passed') filtered = filtered.filter(r => r.passed);
  if (filter === 'failed') filtered = filtered.filter(r => !r.passed);
  if (examFilter !== 'all') filtered = filtered.filter(r => r.exam && String(r.exam.id) === examFilter);
  if (yearFilter !== 'all') filtered = filtered.filter(r => r.exam?.academicYear?.id === Number(yearFilter));
  if (semesterFilter !== 'all') filtered = filtered.filter(r => r.exam?.semester?.id === Number(semesterFilter));
  if (essayStatusFilter === 'reviewed') filtered = filtered.filter(r => r.essayReviewed);
  if (essayStatusFilter === 'pending') filtered = filtered.filter(r => !r.essayReviewed);

  const { paginated: paginatedResults, totalPages: resultsTotalPages, safePage: resultsSafePage, totalItems: resultsTotal } = usePaginationSlice(filtered, resultsPage, RESULTS_PER_PAGE);
  const resetResultsPage = () => setResultsPage(1);

  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const avg = results.length > 0 ? (results.reduce((s, r) => s + r.percentage, 0) / results.length).toFixed(1) : 0;
  const pending = essays.filter(e => !e.scored);
  const scored = essays.filter(e => e.scored);

  const getStudentName = (regId: number): string => {
    const reg = regs.find(r => r.id === regId);
    const student = reg ? users.find(u => u.email === reg.userEmail) : null;
    return student ? `${student.firstName} ${student.lastName}` : 'Unknown';
  };

  const getQuestionText = (qId: number): string => {
    for (const exam of exams) { const q = exam.questions?.find(q => q.id === qId); if (q) return q.questionText; }
    return 'Unknown question';
  };

  const handleScore = async () => {
    if (saving || !scoreModal) return;
    const s = Math.round(Number(scoreVal));
    if (isNaN(s) || s < 0) { showToast('Enter a valid score.', 'error'); return; }
    if (s > scoreModal.maxPoints) { showToast(`Score cannot exceed ${scoreModal.maxPoints} points.`, 'error'); return; }
    setSaving(true);
    try {
      await scoreEssay(scoreModal.id, s, commentVal.trim() || undefined);
      showToast('Essay scored!', 'success');
      setScoreModal(null);
      refetch();
    } catch {
      showToast('Failed to score essay.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintResult = (r: EnrichedResult) => {
    const esc = (s: unknown) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const studentName = r.student ? `${esc(r.student.firstName)} ${esc(r.student.lastName)}` : 'Unknown';
    const examTitle = r.exam ? esc(r.exam.title) : 'N/A';
    const printWin = window.open('', '_blank');
    if (!printWin || printWin.closed) {
      showToast('Popup blocked — please allow popups for this site and try again.', 'error');
      return;
    }
    printWin.document.write(`<!DOCTYPE html><html><head><title>Exam Result - ${studentName}</title>
      <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        h1 { color: #166534; font-size: 24px; margin-bottom: 4px; }
        h2 { color: #166534; font-size: 16px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #ffd700; }
        .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 2px; }
        .field span { font-size: 14px; font-weight: 500; }
        .result-badge { display: inline-block; padding: 6px 16px; border-radius: 99px; font-size: 14px; font-weight: 700; }
        .result-badge.passed { background: #dcfce7; color: #166534; }
        .result-badge.failed { background: #fee2e2; color: #991b1b; }
        .score-circle { text-align: center; margin: 20px 0; }
        .score-circle .pct { font-size: 48px; font-weight: 800; }
        .score-circle .pct.passed { color: #166534; }
        .score-circle .pct.failed { color: #991b1b; }
        .logo { text-align: center; margin-bottom: 20px; } .logo span { font-size: 32px; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>
      <div class="logo"><span>🔑</span><h1><span style="color:#fbbf24">${SCHOOL_BRAND}</span><br/><span style="color:#166534">${SCHOOL_SUBTITLE}</span></h1><p class="subtitle">${SCHOOL_ADDRESS} &bull; Tel: ${SCHOOL_PHONE}<br/>Entrance Examination Result</p></div>
      <h2>Student Information</h2>
      <div class="grid">
        <div class="field"><label>Student Name</label><span>${studentName}</span></div>
        <div class="field"><label>Email</label><span>${r.student ? esc(r.student.email) : 'N/A'}</span></div>
        <div class="field"><label>Grade Level</label><span>${r.student ? esc(r.student.applicantProfile?.gradeLevel || '') : 'N/A'}</span></div>
        <div class="field"><label>Exam</label><span>${examTitle}</span></div>
      </div>
      <h2>Exam Results</h2>
      <div class="score-circle"><div class="pct ${r.passed ? 'passed' : 'failed'}">${r.percentage.toFixed(1)}%</div><p style="color:#888;font-size:13px">Overall Score</p></div>
      <div class="grid">
        <div class="field"><label>Total Score</label><span>${r.totalScore} / ${r.maxPossible}</span></div>
        <div class="field"><label>Passing Score</label><span>${r.exam?.passingScore || '—'}%</span></div>
        <div class="field"><label>Result</label><span class="result-badge ${r.passed ? 'passed' : 'failed'}">${r.passed ? 'PASSED' : 'FAILED'}</span></div>
        <div class="field"><label>Essay Review</label><span>${r.essayReviewed ? 'Reviewed' : 'Pending'}</span></div>
        <div class="field"><label>Date Taken</label><span>${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</span></div>
      </div>
      <p style="margin-top:40px;font-size:11px;color:#aaa;text-align:center">Printed on ${new Date().toLocaleDateString()} — ${SCHOOL_NAME} &copy; ${new Date().getFullYear()}</p>
    </body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
  };

  const loadAnalytics = async (examId: number) => {
    setAnalyticsExamId(examId);
    setAnalyticsLoading(true);
    try {
      const data = await getQuestionAnalytics(examId);
      setAnalyticsData(data);
    } catch { showToast('Failed to load analytics', 'error'); }
    finally { setAnalyticsLoading(false); }
  };

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap" role="tablist">
        <button role="tab" aria-selected={tab === 'results'} onClick={() => setTab('results')} className={`px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5 ${tab === 'results' ? 'bg-forest-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Icon name="chartBar" className="w-4 h-4" /> All Results</button>
        {canScoreEssays && (
          <button role="tab" aria-selected={tab === 'essays'} onClick={() => setTab('essays')} className={`px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5 ${tab === 'essays' ? 'bg-forest-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Icon name="documentText" className="w-4 h-4" /> Essay Review ({pending.length})</button>
        )}
        <button role="tab" aria-selected={tab === 'analytics'} onClick={() => setTab('analytics')} className={`px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5 ${tab === 'analytics' ? 'bg-forest-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Icon name="arrowTrendUp" className="w-4 h-4" /> Analytics</button>
      </div>

      {tab === 'results' && (
        <div>
          <PageHeader title="Exam Results" subtitle="View all applicant exam scores and pass/fail status." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="chartBar" value={results.length} label="Total Results" color="blue" />
            <StatCard icon="checkCircle" value={passed} label="Passed" color="emerald" />
            <StatCard icon="xCircle" value={failed} label="Failed" color="red" />
            <StatCard icon="arrowTrendUp" value={`${avg}%`} label="Average Score" color="amber" />
          </div>

          <div className="gk-card p-4">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input value={search} onChange={e => { setSearch(e.target.value); resetResultsPage(); }} placeholder="Search by student or exam name…" aria-label="Search results" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
              <select value={filter} onChange={e => { setFilter(e.target.value); resetResultsPage(); }} aria-label="Filter by result" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
                <option value="all">All Results</option><option value="passed">Passed</option><option value="failed">Failed</option>
              </select>
              <select value={examFilter} onChange={e => { setExamFilter(e.target.value); resetResultsPage(); }} aria-label="Filter by exam" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
                <option value="all">All Exams</option>
                {exams.map(ex => <option key={ex.id} value={String(ex.id)}>{ex.title}</option>)}
              </select>
              <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setSemesterFilter('all'); resetResultsPage(); }} aria-label="Filter by school year" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
                <option value="all">All Years</option>
                {(academicYears || []).map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
              </select>
              <select value={semesterFilter} onChange={e => { setSemesterFilter(e.target.value); resetResultsPage(); }} aria-label="Filter by semester" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
                <option value="all">All Semesters</option>
                {semesterOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={essayStatusFilter} onChange={e => { setEssayStatusFilter(e.target.value); resetResultsPage(); }} aria-label="Filter by essay status" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
                <option value="all">All Essay Status</option>
                <option value="reviewed">Essay Reviewed</option>
                <option value="pending">Essay Pending</option>
              </select>
            </div>
            {paginatedResults.length > 0 ? (
              <>
                <div className="table-scroll">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs">
                      <th scope="col" className="py-3 px-2">Student</th><th scope="col" className="py-3 px-2">Exam</th><th scope="col" className="py-3 px-2">Score</th>
                      <th scope="col" className="py-3 px-2">Percentage</th><th scope="col" className="py-3 px-2">Result</th><th scope="col" className="py-3 px-2">Essay</th><th scope="col" className="py-3 px-2">Date</th><th scope="col" className="py-3 px-2 text-right">Actions</th>
                    </tr></thead>
                    <tbody>
                      {paginatedResults.map(r => (
                        <tr key={r.registrationId} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 px-2 font-medium text-forest-500">{r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Unknown'}</td>
                          <td className="py-3 px-2">{r.exam?.title || 'N/A'}</td>
                          <td className="py-3 px-2">{r.totalScore} / {r.maxPossible}</td>
                          <td className="py-3 px-2">{r.percentage.toFixed(1)}%</td>
                          <td className="py-3 px-2"><Badge className={r.passed ? 'gk-badge gk-badge-passed' : 'gk-badge gk-badge-failed'}>{r.passed ? 'Passed' : 'Failed'}</Badge></td>
                          <td className="py-3 px-2"><Badge className={r.essayReviewed ? 'gk-badge gk-badge-reviewed' : 'gk-badge gk-badge-pending'}>{r.essayReviewed ? 'Reviewed' : 'Pending'}</Badge></td>
                          <td className="py-3 px-2 text-gray-500">{formatDate(r.createdAt)}</td>
                          <td className="py-3 px-2 text-right"><button onClick={() => handlePrintResult(r)} className="text-forest-500 hover:bg-forest-50 px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1" aria-label="Print result"><Icon name="document" className="w-3.5 h-3.5" /> Print</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination currentPage={resultsSafePage} totalPages={resultsTotalPages} onPageChange={setResultsPage} totalItems={resultsTotal} itemsPerPage={RESULTS_PER_PAGE} />
              </>
            ) : (
              <p className="text-center text-gray-400 py-8">No results match your filters.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'essays' && canScoreEssays && (
        <div>
          <PageHeader title="Essay Review" subtitle="Score pending essay responses from applicants." />
          {pending.length === 0 && scored.length === 0 ? (
            <div className="gk-card p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-3"><Icon name="documentText" className="w-7 h-7 text-forest-500" /></div>
              <h3 className="font-bold text-forest-500 mb-1">No Essay Answers</h3>
              <p className="text-gray-500 text-sm">There are no essay answers to review at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.length > 0 && <h3 className="font-bold text-forest-500 text-lg flex items-center gap-1.5"><Icon name="clock" className="w-5 h-5" /> Pending Review ({pending.length})</h3>}
              {pending.map(e => (
                <EssayCard key={e.id} essay={e} student={getStudentName(e.registrationId)} question={getQuestionText(e.questionId)} status="pending" onScore={() => { setScoreModal(e); setScoreVal(''); setCommentVal(''); }} />
              ))}
              {scored.length > 0 && <h3 className="font-bold text-forest-500 text-lg mt-6 flex items-center gap-1.5"><Icon name="checkCircle" className="w-5 h-5" /> Scored ({scored.length})</h3>}
              {scored.map(e => (
                <EssayCard key={e.id} essay={e} student={getStudentName(e.registrationId)} question={getQuestionText(e.questionId)} status="scored" onScore={() => { setScoreModal(e); setScoreVal(String(e.pointsAwarded ?? '')); setCommentVal(e.comment || ''); }} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'analytics' && (
        <div>
          <PageHeader title="Per-Question Analytics" subtitle="See how applicants performed on each question." />
          <div className="gk-card p-4 mb-6">
            <label className="text-sm font-medium text-gray-700 mr-2">Select Exam</label>
            <select value={analyticsExamId ?? ''} onChange={e => { const v = Number(e.target.value); if (v) loadAnalytics(v); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
              <option value="">— Choose an exam —</option>
              {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
            </select>
          </div>
          {analyticsLoading && <SkeletonPage />}
          {!analyticsLoading && analyticsData && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <StatCard icon="users" value={analyticsData.totalTakers} label="Total Takers" color="blue" />
                <StatCard icon="chartBar" value={analyticsData.analytics.length} label="Questions" color="amber" />
                <StatCard icon="checkCircle" value={analyticsData.analytics.filter(q => q.questionType === 'multiple_choice' && (q.correctRate ?? 0) >= 0.7).length} label="Easy Questions (≥70%)" color="emerald" />
              </div>
              <div className="space-y-4">
                {analyticsData.analytics.map((q, idx) => (
                  <div key={q.questionId} className="gk-card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-gray-400">Q{idx + 1}</span>
                        <p className="font-medium text-forest-500">{q.questionText}</p>
                      </div>
                      <Badge className={`gk-badge ml-2 ${q.questionType === 'multiple_choice' ? 'gk-badge-reviewed' : 'gk-badge-pending'}`}>
                        {q.questionType === 'multiple_choice' ? 'Multiple Choice' : 'Essay'} · {q.points} pts
                      </Badge>
                    </div>
                    {q.questionType === 'multiple_choice' && (
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-sm text-gray-600">Correct rate:</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                            <div className={`h-full rounded-full ${(q.correctRate ?? 0) >= 0.7 ? 'bg-emerald-500' : (q.correctRate ?? 0) >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${((q.correctRate ?? 0) * 100).toFixed(0)}%` }} />
                          </div>
                          <span className="text-sm font-semibold">{((q.correctRate ?? 0) * 100).toFixed(0)}%</span>
                          <span className="text-xs text-gray-400">({q.correctCount}/{q.totalAnswered})</span>
                        </div>
                        {q.choiceDistribution && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.choiceDistribution.map(c => (
                              <div key={c.choiceId} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${c.isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
                                <span className="flex-1 truncate">{c.choiceText}</span>
                                <span className="font-semibold">{c.count}</span>
                                {c.isCorrect && <Icon name="checkCircle" className="w-4 h-4 text-emerald-500 shrink-0" />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {q.questionType === 'essay' && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">Avg score:</span>
                        <span className="font-semibold text-forest-500">{q.avgScore != null ? `${Number(q.avgScore).toFixed(1)} / ${q.points}` : 'Not yet scored'}</span>
                        <span className="text-xs text-gray-400">({q.scoredCount ?? 0} scored of {q.totalAnswered})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!analyticsLoading && !analyticsData && analyticsExamId && (
            <div className="gk-card p-8 text-center">
              <p className="text-gray-500">No analytics data available for this exam.</p>
            </div>
          )}
        </div>
      )}

      {/* Score Modal */}
      <Modal open={!!scoreModal} onClose={() => setScoreModal(null)}>
        <h3 className="text-lg font-bold text-forest-500 mb-4">Score Essay Answer</h3>
        {scoreModal && (
          <>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700 max-h-48 overflow-y-auto">{scoreModal.essayResponse}</div>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm font-medium text-gray-700">Points Awarded</label>
              <input type="number" value={scoreVal} onChange={e => setScoreVal(e.target.value)} min={0} max={scoreModal.maxPoints} className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none" />
              <span className="text-gray-500 text-sm">/ {scoreModal.maxPoints} pts</span>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">Feedback / Comment <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea value={commentVal} onChange={e => setCommentVal(e.target.value)} rows={3} placeholder="Add feedback for the student…" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleScore} disabled={saving} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">{saving ? <><Icon name="spinner" className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Score'}</button>
              <button onClick={() => setScoreModal(null)} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function EssayCard({ essay, student, question, status, onScore }: EssayCardProps) {
  return (
    <div className="gk-card p-5">
      <div className="flex justify-between items-start mb-3">
        <div>
          <strong className="text-forest-500">{student}</strong>
          <Badge className={status === 'pending' ? 'gk-badge gk-badge-pending ml-2' : 'gk-badge gk-badge-reviewed ml-2'}>{status === 'pending' ? 'Pending' : `${essay.pointsAwarded} / ${essay.maxPoints} pts`}</Badge>
        </div>
        {status === 'pending' && <span className="text-gray-400 text-xs">Max: {essay.maxPoints} pts</span>}
      </div>
      <div className="mb-3">
        <span className="text-xs text-gray-400 uppercase font-semibold">Question</span>
        <p className="text-forest-500 font-medium text-sm">{question}</p>
      </div>
      <div className="mb-3">
        <span className="text-xs text-gray-400 uppercase font-semibold">Response</span>
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 leading-relaxed mt-1">{essay.essayResponse}</div>
      </div>
      {status === 'pending' && onScore && (
        <button onClick={onScore} className="bg-forest-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-forest-600">Score This Answer</button>
      )}
      {status === 'scored' && (
        <div className="flex items-center gap-3 mt-2">
          {essay.comment && (
            <div className="flex-1">
              <span className="text-xs text-gray-400 uppercase font-semibold">Feedback</span>
              <div className="bg-gold-50 border border-gold-200 rounded-lg p-3 text-sm text-gray-700 leading-relaxed mt-1">{essay.comment}</div>
            </div>
          )}
          {onScore && (
            <button onClick={onScore} className="border border-forest-300 text-forest-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-forest-50 inline-flex items-center gap-1 shrink-0"><Icon name="edit" className="w-3.5 h-3.5" /> Edit Score</button>
          )}
        </div>
      )}
    </div>
  );
}
