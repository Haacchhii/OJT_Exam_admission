import { useState, useMemo, type ChangeEvent, type FormEvent, type DragEvent } from 'react';
import * as XLSX from 'xlsx';
import { useAsync } from '../../hooks/useAsync';
import { getExams, addExam, updateExam, deleteExam, bulkDeleteExams, getExamSchedules, addExamSchedule, updateExamSchedule, deleteExamSchedule, getExamRegistrations } from '../../api/exams';
import { getAcademicYears, getSemesters } from '../../api/academicYears';
import { getExamResults } from '../../api/results';
import { getUsers } from '../../api/users';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { useConfirm } from '../../components/ConfirmDialog';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useSelection } from '../../hooks/useSelection';
import BulkActionBar from '../../components/BulkActionBar';
import { EXAM_GRADE_LEVELS } from '../../utils/constants';
import { PageHeader, StatCard, Badge, EmptyState, Pagination, usePaginationSlice, SkeletonPage, ErrorAlert } from '../../components/UI';
import Icon from '../../components/Icons';
import { formatTime, badgeClass, uid, asArray } from '../../utils/helpers';
import type { Exam, ExamSchedule, ExamRegistration, ExamResult, ExamQuestion, QuestionChoice, User, AcademicYear, Semester } from '../../types';

const EXAMS_PER_PAGE = 10;
const READINESS_PER_PAGE = 10;
const SCHED_PER_PAGE = 8;

interface ParsedQuestion {
  id: string;
  questionText: string;
  questionType: 'mc' | 'essay';
  points: number;
  orderNum: number;
  choices: { id: string; choiceText: string; isCorrect: boolean }[];
}

interface UploadPreview {
  parsed: ParsedQuestion[];
  errs: number;
  fileName: string;
}

interface ChoiceState {
  text: string;
  correct?: boolean;
}

export default function EmployeeExams() {
  const [tab, setTab] = useState('exams');
  const [editExamData, setEditExamData] = useState<Exam | null>(null);

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap" role="tablist">
        {([['exams','Exams'],['builder','Create Exam'],['schedules','Schedules']] as const).map(([k,l]) => {
          const tabIcon = k === 'exams' ? 'documentText' : k === 'builder' ? 'plus' : 'calendar';
          return (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { if (k !== 'builder') setEditExamData(null); setTab(k); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5 ${tab === k ? 'bg-forest-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Icon name={tabIcon} className="w-4 h-4" />{l}</button>
        )})}
      </div>
      {tab === 'exams' && <ExamsList onEdit={(exam: Exam) => { setEditExamData(exam); setTab('builder'); }} />}
      {tab === 'builder' && <ExamBuilder editExam={editExamData} onDone={() => { setEditExamData(null); setTab('exams'); }} />}
      {tab === 'schedules' && <ScheduleManager />}
    </div>
  );
}

/* ===== EXAMS LIST ===== */
function ExamsList({ onEdit }: { onEdit: (exam: Exam) => void }) {
  const confirm = useConfirm();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [searchExam, setSearchExam] = useState('');
  const [gradeFilterExam, setGradeFilterExam] = useState('all');
  const [statusFilterExam, setStatusFilterExam] = useState('all');
  const [yearFilterExam, setYearFilterExam] = useState('all');
  const [semesterFilterExam, setSemesterFilterExam] = useState('all');
  const [examPage, setExamPage] = useState(1);
  const [readSearch, setReadSearch] = useState('');
  const [readStatusFilter, setReadStatusFilter] = useState('all');
  const [readPage, setReadPage] = useState(1);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const { selected, toggle, togglePage, clear: clearSelection, isAllSelected, count: selectedCount } = useSelection();

  const { data, loading, error, refetch } = useAsync(async () => {
    const [rawExm, rawSched, rawRegs, rawUsers, rawRes] = await Promise.all([
      getExams(), getExamSchedules(), getExamRegistrations(),
      getUsers(),
      getExamResults(),
    ]);
    return { exams: asArray<Exam>(rawExm), schedules: asArray<ExamSchedule>(rawSched), regs: asArray<ExamRegistration>(rawRegs), allUsers: asArray<User>(rawUsers), allResults: asArray<ExamResult>(rawRes) };
  });

  const { data: academicYears } = useAsync<AcademicYear[]>(() => getAcademicYears());
  const { data: allSemesters } = useAsync<Semester[]>(() => getSemesters());

  const semesterOptionsExam = useMemo(() => {
    const list = allSemesters || [];
    if (yearFilterExam === 'all') return list;
    return list.filter(s => s.academicYearId === Number(yearFilterExam));
  }, [allSemesters, yearFilterExam]);

  const exams: Exam[] = data?.exams || [];
  const schedules: ExamSchedule[] = data?.schedules || [];
  const regs: ExamRegistration[] = data?.regs || [];
  const allUsers: User[] = data?.allUsers || [];
  const allResults: ExamResult[] = data?.allResults || [];

  const filteredExams = useMemo(() => {
    let list = exams;
    if (searchExam.trim()) {
      const q = searchExam.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q));
    }
    if (gradeFilterExam !== 'all') list = list.filter(e => e.gradeLevel === gradeFilterExam);
    if (statusFilterExam !== 'all') list = list.filter(e => (statusFilterExam === 'active') === e.isActive);
    if (yearFilterExam !== 'all') list = list.filter(e => (e as any).academicYear?.id === Number(yearFilterExam));
    if (semesterFilterExam !== 'all') list = list.filter(e => (e as any).semester?.id === Number(semesterFilterExam));
    return list;
  }, [exams, searchExam, gradeFilterExam, statusFilterExam, yearFilterExam, semesterFilterExam]);

  const examGrades = useMemo(() => [...new Set(exams.map(e => e.gradeLevel).filter(Boolean))].sort(), [exams]);

  const { paginated: paginatedExams, totalPages: examTotalPages, safePage: examSafePage, totalItems: examTotal } = usePaginationSlice(filteredExams, examPage, EXAMS_PER_PAGE);
  const resetExamPage = () => setExamPage(1);

  const handleBulkDelete = async () => {
    if (selectedCount === 0 || bulkDeleting) return;
    const ids = [...selected];
    const ok = await confirm({
      title: 'Delete Selected Exams',
      message: `Are you sure you want to delete ${ids.length} exam(s)? All related schedules, registrations, and results will also be deleted. This cannot be undone.`,
      variant: 'danger',
      confirmLabel: `Delete ${ids.length} Exam(s)`,
    });
    if (!ok) return;
    setBulkDeleting(true);
    try {
      await bulkDeleteExams(ids);
      showToast(`${ids.length} exam(s) deleted.`, 'info');
      clearSelection();
      refetch();
    } catch {
      showToast('Failed to delete exams.', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const readinessRows = useMemo(() => {
    return regs.map(r => {
      const user = allUsers.find(u => u.email === r.userEmail);
      const sched = schedules.find(s => s.id === r.scheduleId);
      const exam = sched ? exams.find(e => e.id === sched.examId) : null;
      const result = allResults.find(res => res.registrationId === r.id);
      return { ...r, user, exam, schedule: sched, result };
    });
  }, [regs, allUsers, schedules, exams, allResults]);

  const filteredReadiness = useMemo(() => {
    let list = readinessRows;
    if (readSearch.trim()) {
      const q = readSearch.toLowerCase();
      list = list.filter(r => r.user && `${r.user.firstName} ${r.user.lastName}`.toLowerCase().includes(q));
    }
    if (readStatusFilter !== 'all') {
      if (readStatusFilter === 'passed') list = list.filter(r => r.result?.passed === true);
      else if (readStatusFilter === 'failed') list = list.filter(r => r.result && !r.result.passed);
      else if (readStatusFilter === 'pending') list = list.filter(r => r.status !== 'done');
      else if (readStatusFilter === 'done') list = list.filter(r => r.status === 'done');
    }
    return list;
  }, [readinessRows, readSearch, readStatusFilter]);

  const { paginated: paginatedReadiness, totalPages: readTotalPages, safePage: readSafePage, totalItems: readTotal } = usePaginationSlice(filteredReadiness, readPage, READINESS_PER_PAGE);
  const resetReadPage = () => setReadPage(1);

  if (loading && !data) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  if (detailId) {
    const exam = exams.find(e => e.id === detailId);
    if (!exam) return null;
    const eSched = schedules.filter(s => s.examId === exam.id);
    const eRegs = regs.filter(r => eSched.some(s => s.id === r.scheduleId));
    const completed = eRegs.filter(r => r.status === 'done').length;

    return (
      <div>
        <button onClick={() => setDetailId(null)} className="mb-4 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">← Back to Exam List</button>
        <div className="gk-card p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-forest-500">{exam.title}</h2>
              <Badge className={exam.isActive ? 'gk-badge gk-badge-active' : 'gk-badge gk-badge-inactive'}>{exam.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreviewExam(exam)} className="border border-forest-300 text-forest-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-forest-50 inline-flex items-center gap-1"><Icon name="eye" className="w-3.5 h-3.5" /> Preview</button>
              <button onClick={() => onEdit(exam)} className="bg-forest-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-forest-600 inline-flex items-center gap-1"><Icon name="edit" className="w-3.5 h-3.5" /> Edit</button>
              <button onClick={async () => { const action = exam.isActive ? 'Deactivate' : 'Activate'; const ok = await confirm({ title: `${action} Exam`, message: `Are you sure you want to ${action.toLowerCase()} "${exam.title}"?`, confirmLabel: action, variant: exam.isActive ? 'danger' : 'info' }); if (!ok) return; try { await updateExam(exam.id, { isActive: !exam.isActive }); showToast(`Exam ${action.toLowerCase()}d!`, 'success'); refetch(); } catch { showToast('Failed to update exam.', 'error'); } }} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">{exam.isActive ? 'Deactivate' : 'Activate'}</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DetailField label="Grade Level" v={exam.gradeLevel} /><DetailField label="Duration" v={`${exam.durationMinutes} minutes`} />
            <DetailField label="Passing Score" v={`${exam.passingScore}%`} /><DetailField label="Questions" v={exam.questions.length} />
            <DetailField label="Schedules" v={eSched.length} /><DetailField label="Registrations" v={`${eRegs.length} (${completed} completed)`} />
          </div>
        </div>
        <div className="gk-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-4">Questions ({exam.questions.length})</h3>
          <div className="space-y-3">
            {exam.questions.map((q, i) => (
              <QuestionCard key={q.id} q={q} i={i} />
            ))}
            {exam.questions.length === 0 && <p className="text-gray-400 text-center py-6">No questions in this exam.</p>}
          </div>
        </div>

        <div className="gk-card p-6 mt-4">
          <h3 className="text-lg font-bold text-forest-500 mb-4">Registered Students ({eRegs.length})</h3>
          {eRegs.length > 0 ? (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs">
                  <th scope="col" className="py-3 px-2">Student</th><th scope="col" className="py-3 px-2">Email</th><th scope="col" className="py-3 px-2">Status</th><th scope="col" className="py-3 px-2">Schedule</th>
                </tr></thead>
                <tbody>
                  {eRegs.map(r => {
                    const student = allUsers.find(u => u.email === r.userEmail);
                    const sc = eSched.find(s => s.id === r.scheduleId);
                    return (
                      <tr key={r.id} className="border-b border-gray-50">
                        <td className="py-3 px-2 font-medium">{student ? `${student.firstName} ${student.lastName}` : 'Unknown'}</td>
                        <td className="py-3 px-2 text-gray-500">{r.userEmail}</td>
                        <td className="py-3 px-2"><Badge className={badgeClass(r.status)}>{r.status}</Badge></td>
                        <td className="py-3 px-2 text-gray-500">{sc ? `${sc.scheduledDate} ${formatTime(sc.startTime)}` : 'N/A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-6">No students registered for this exam yet.</p>
          )}
        </div>
        <ExamPreviewModal exam={previewExam} onClose={() => setPreviewExam(null)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="All Exams" subtitle="View and manage created exams." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="exam" value={exams.length} label="Total Exams" color="blue" />
        <StatCard icon="calendar" value={schedules.length} label="Schedules" color="emerald" />
        <StatCard icon="users" value={regs.length} label="Registrations" color="amber" />
        <StatCard icon="checkCircle" value={regs.filter(r => r.status === 'done').length} label="Completed" color="amber" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input value={searchExam} onChange={e => { setSearchExam(e.target.value); resetExamPage(); }} placeholder="Search exams…" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
        <select value={gradeFilterExam} onChange={e => { setGradeFilterExam(e.target.value); resetExamPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
          <option value="all">All Grades</option>
          {examGrades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={statusFilterExam} onChange={e => { setStatusFilterExam(e.target.value); resetExamPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={yearFilterExam} onChange={e => { setYearFilterExam(e.target.value); setSemesterFilterExam('all'); resetExamPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
          <option value="all">All Years</option>
          {(academicYears || []).map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
        </select>
        <select value={semesterFilterExam} onChange={e => { setSemesterFilterExam(e.target.value); resetExamPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
          <option value="all">All Semesters</option>
          {semesterOptionsExam.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <BulkActionBar count={selectedCount} onDelete={handleBulkDelete} onClear={clearSelection} deleting={bulkDeleting} />

      <div className="gk-card p-4 mb-6">
        {paginatedExams.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs">
                  <th scope="col" className="py-3 px-2 w-8"><input type="checkbox" checked={isAllSelected(paginatedExams)} onChange={() => togglePage(paginatedExams)} className="accent-forest-500 rounded" aria-label="Select all exams" /></th>
                  <th scope="col" className="py-3 px-2">ID</th><th scope="col" className="py-3 px-2">Title</th><th scope="col" className="py-3 px-2">Grade</th>
                  <th scope="col" className="py-3 px-2">Duration</th><th scope="col" className="py-3 px-2">Questions</th><th scope="col" className="py-3 px-2">Passing</th>
                  <th scope="col" className="py-3 px-2">Status</th><th scope="col" className="py-3 px-2">Actions</th>
                </tr></thead>
                <tbody>
                  {paginatedExams.map(e => (
                    <tr key={e.id} className={`border-b border-gray-50 hover:bg-gray-50 ${selected.has(e.id) ? 'bg-gold-50/50' : ''}`}>
                      <td className="py-3 px-2"><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="accent-forest-500 rounded" aria-label={`Select ${e.title}`} /></td>
                      <td className="py-3 px-2 text-gray-400">{e.id}</td>
                      <td className="py-3 px-2 font-medium text-forest-500">{e.title}</td>
                      <td className="py-3 px-2">{e.gradeLevel}</td>
                      <td className="py-3 px-2">{e.durationMinutes} min</td>
                      <td className="py-3 px-2">{e.questions.length}</td>
                      <td className="py-3 px-2">{e.passingScore}%</td>
                      <td className="py-3 px-2"><Badge className={e.isActive ? 'gk-badge gk-badge-active' : 'gk-badge gk-badge-inactive'}>{e.isActive ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          <button onClick={() => setDetailId(e.id)} className="text-forest-500 hover:underline text-xs">View</button>
                          <button onClick={async () => { const action = e.isActive ? 'Deactivate' : 'Activate'; const ok = await confirm({ title: `${action} Exam`, message: `Are you sure you want to ${action.toLowerCase()} "${e.title}"?`, confirmLabel: action, variant: e.isActive ? 'danger' : 'info' }); if (!ok) return; try { await updateExam(e.id, { isActive: !e.isActive }); showToast(`Exam ${action.toLowerCase()}d!`, 'success'); refetch(); } catch { showToast('Failed to update exam.', 'error'); } }} className="text-gray-500 hover:underline text-xs">{e.isActive ? 'Deactivate' : 'Activate'}</button>
                          <button onClick={async () => { if (await confirm({ title: 'Delete Exam', message: 'Are you sure you want to delete this exam? This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' })) { try { await deleteExam(e.id); refetch(); } catch { showToast('Failed to delete exam.', 'error'); } } }} className="text-red-500 hover:underline text-xs">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={examSafePage} totalPages={examTotalPages} onPageChange={setExamPage} totalItems={examTotal} itemsPerPage={EXAMS_PER_PAGE} />
          </>
        ) : (
          <EmptyState icon="documentText" title="No exams found" text={searchExam ? `No exams match "${searchExam}"${gradeFilterExam !== 'all' || statusFilterExam !== 'all' ? ' with the selected filters' : ''}.` : 'No exams match your current filters.'} />
        )}
      </div>

      <div className="gk-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Exam Registrations & Results</h3>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input value={readSearch} onChange={e => { setReadSearch(e.target.value); resetReadPage(); }} placeholder="Search student…" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
          <select value={readStatusFilter} onChange={e => { setReadStatusFilter(e.target.value); resetReadPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
            <option value="all">All</option>
            <option value="pending">Scheduled / In Progress</option>
            <option value="done">Completed</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        {paginatedReadiness.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs">
                  <th scope="col" className="py-3 px-2">Student</th><th scope="col" className="py-3 px-2">Exam</th><th scope="col" className="py-3 px-2">Registration Status</th><th scope="col" className="py-3 px-2">Score</th><th scope="col" className="py-3 px-2">Result</th>
                </tr></thead>
                <tbody>
                  {paginatedReadiness.map(r => (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="py-3 px-2 font-medium">{r.user ? `${r.user.firstName} ${r.user.lastName}` : r.userEmail}</td>
                      <td className="py-3 px-2">{r.exam?.title || 'N/A'}</td>
                      <td className="py-3 px-2"><Badge className={badgeClass(r.status)}>{r.status}</Badge></td>
                      <td className="py-3 px-2">{r.result ? `${r.result.totalScore}/${r.result.maxPossible} (${r.result.percentage.toFixed(1)}%)` : '—'}</td>
                      <td className="py-3 px-2">{r.result ? <Badge className={r.result.passed ? 'gk-badge gk-badge-passed' : 'gk-badge gk-badge-failed'}>{r.result.passed ? 'Passed' : (r.result.essayReviewed ? 'Failed' : 'Pending Review')}</Badge> : <Badge className="gk-badge gk-badge-neutral">Awaiting</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={readSafePage} totalPages={readTotalPages} onPageChange={setReadPage} totalItems={readTotal} itemsPerPage={READINESS_PER_PAGE} />
          </>
        ) : (
          <EmptyState icon="clipboard" title="No registrations found" text={readSearch ? `No registrations match "${readSearch}"${readStatusFilter !== 'all' ? ` with status "${readStatusFilter}"` : ''}.` : readStatusFilter !== 'all' ? `No registrations with status "${readStatusFilter}".` : 'No exam registrations match your current filters.'} />
        )}
      </div>
    </div>
  );
}

/* ===== Exam Preview Modal ===== */
function ExamPreviewModal({ exam, onClose }: { exam: Exam | null; onClose: () => void }) {
  return (
    <Modal open={!!exam} onClose={onClose}>
      {exam && (
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-forest-500">{exam.title}</h3>
              <p className="text-sm text-gray-500">Grade {exam.gradeLevel} • {exam.durationMinutes} minutes • {exam.questions.length} questions</p>
            </div>
            <Badge className="gk-badge gk-badge-preview">Preview Mode</Badge>
          </div>
          <div className="space-y-4">
            {exam.questions
              .slice()
              .sort((a: ExamQuestion, b: ExamQuestion) => a.orderNum - b.orderNum)
              .map((q: ExamQuestion, i: number) => (
              <div key={q.id} className={`rounded-lg p-4 border ${q.questionType === 'essay' ? 'border-gold-200 bg-gold-50/30' : 'border-gray-200 bg-gray-50/30'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-gray-400">Question {i + 1}</span>
                  <span className="text-xs text-gray-400">{q.points} pts • {q.questionType === 'mc' ? 'Multiple Choice' : 'Essay'}</span>
                </div>
                <p className="text-sm font-medium text-gray-800 mb-3">{q.questionText}</p>
                {q.questionType === 'mc' && q.choices && (
                  <div className="space-y-2">
                    {q.choices
                      .slice()
                      .sort((a: QuestionChoice, b: QuestionChoice) => a.orderNum - b.orderNum)
                      .map((c: QuestionChoice, ci: number) => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm">
                        <span className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        <span>{String.fromCharCode(65 + ci)}. {c.choiceText}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.questionType === 'essay' && (
                  <div className="border border-dashed border-gray-300 rounded-lg p-3 text-sm text-gray-400 italic bg-white">
                    Student will type their answer here…
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ===== Upload Questionnaire Parsers ===== */
function parseCSVQuestions(text: string): { parsed: ParsedQuestion[]; errs: number } {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.toLowerCase().startsWith('type'));
  const parsed: ParsedQuestion[] = [];
  let errs = 0;
  for (const line of lines) {
    const cols: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());

    const type = (cols[0] || '').toLowerCase();
    const qText = cols[1] || '';
    const pts = parseInt(cols[2]) || 1;

    if (!qText) { errs++; continue; }

    if (type === 'essay') {
      parsed.push({ id: uid(), questionText: qText, questionType: 'essay', points: pts, orderNum: parsed.length + 1, choices: [] });
    } else if (type === 'mc' || type === 'multiple choice' || type === 'multiple_choice') {
      const choiceTexts = [cols[3], cols[4], cols[5], cols[6]].filter(Boolean);
      const correctRaw = (cols[7] || '').toUpperCase();
      const correctIdx = correctRaw === 'A' ? 0 : correctRaw === 'B' ? 1 : correctRaw === 'C' ? 2 : correctRaw === 'D' ? 3 : correctRaw === '1' ? 0 : correctRaw === '2' ? 1 : correctRaw === '3' ? 2 : correctRaw === '4' ? 3 : 0;
      if (choiceTexts.length < 2) { errs++; continue; }
      parsed.push({
        id: uid(),
        questionText: qText,
        questionType: 'mc',
        points: pts,
        orderNum: parsed.length + 1,
        choices: choiceTexts.map((t, i) => ({ id: uid(), choiceText: t, isCorrect: i === correctIdx })),
      });
    } else { errs++; }
  }
  return { parsed, errs };
}

function parseJSONQuestions(text: string): { parsed: ParsedQuestion[]; errs: number } {
  const raw = JSON.parse(text);
  const items: any[] = Array.isArray(raw) ? raw : raw.questions || [];
  const parsed: ParsedQuestion[] = [];
  let errs = 0;
  for (const item of items) {
    const type = (item.type || item.questionType || '').toLowerCase();
    const qText = item.question || item.questionText || '';
    const pts = parseInt(item.points) || 1;
    if (!qText) { errs++; continue; }
    if (type === 'essay') {
      parsed.push({ id: uid(), questionText: qText, questionType: 'essay', points: pts, orderNum: parsed.length + 1, choices: [] });
    } else if (type === 'mc' || type === 'multiple choice' || type === 'multiple_choice') {
      const rawChoices: any[] = item.choices || item.options || [];
      if (rawChoices.length < 2) { errs++; continue; }
      const correctVal = item.correct ?? item.answer ?? 0;
      const choices = rawChoices.map((c: any, i: number) => {
        const text = typeof c === 'string' ? c : (c.text || c.choiceText || '');
        const isCorrect = typeof c === 'object' ? !!c.isCorrect : (typeof correctVal === 'number' ? i === correctVal : String(correctVal).toUpperCase() === String.fromCharCode(65 + i));
        return { id: uid(), choiceText: text, isCorrect };
      });
      parsed.push({ id: uid(), questionText: qText, questionType: 'mc', points: pts, orderNum: parsed.length + 1, choices });
    } else { errs++; }
  }
  return { parsed, errs };
}

function parseExcelQuestions(arrayBuffer: ArrayBuffer): { parsed: ParsedQuestion[]; errs: number } {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  const dataRows = rows.slice(1).filter((r: any[]) => r.some((c: any) => String(c).trim()));
  const parsed: ParsedQuestion[] = [];
  let errs = 0;
  for (const cols of dataRows) {
    const type = String(cols[0] || '').trim().toLowerCase();
    const qText = String(cols[1] || '').trim();
    const pts = parseInt(cols[2]) || 1;
    if (!qText) { errs++; continue; }
    if (type === 'essay') {
      parsed.push({ id: uid(), questionText: qText, questionType: 'essay', points: pts, orderNum: parsed.length + 1, choices: [] });
    } else if (type === 'mc' || type === 'multiple choice' || type === 'multiple_choice') {
      const choiceTexts = [cols[3], cols[4], cols[5], cols[6]].map((c: any) => String(c || '').trim()).filter(Boolean);
      const correctRaw = String(cols[7] || '').trim().toUpperCase();
      const correctIdx = correctRaw === 'A' ? 0 : correctRaw === 'B' ? 1 : correctRaw === 'C' ? 2 : correctRaw === 'D' ? 3 :
                         correctRaw === '1' ? 0 : correctRaw === '2' ? 1 : correctRaw === '3' ? 2 : correctRaw === '4' ? 3 : 0;
      if (choiceTexts.length < 2) { errs++; continue; }
      parsed.push({
        id: uid(),
        questionText: qText,
        questionType: 'mc',
        points: pts,
        orderNum: parsed.length + 1,
        choices: choiceTexts.map((t, i) => ({ id: uid(), choiceText: t, isCorrect: i === correctIdx })),
      });
    } else { errs++; }
  }
  return { parsed, errs };
}

function downloadTemplate(format: 'csv' | 'json' | 'excel') {
  if (format === 'csv') {
    const content = [
      'type,question,points,choiceA,choiceB,choiceC,choiceD,correct',
      'mc,What is the capital of the Philippines?,2,Cebu,Manila,Davao,Quezon City,B',
      'mc,"Which planet is known as the Red Planet?",3,Venus,Jupiter,Mars,Saturn,C',
      'mc,What is 15 × 8?,2,110,120,132,140,C',
      'essay,Explain why education is important in society.,5,,,,, ',
      'essay,"Describe the three branches of government and their roles.",10,,,,,',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'exam_template.csv'; a.click();
    URL.revokeObjectURL(url);
  } else if (format === 'json') {
    const content = JSON.stringify([
      { type: 'mc', question: 'What is the capital of the Philippines?', points: 2, choices: ['Cebu', 'Manila', 'Davao', 'Quezon City'], correct: 1 },
      { type: 'mc', question: 'Which planet is known as the Red Planet?', points: 3, choices: [{ text: 'Venus', isCorrect: false }, { text: 'Jupiter', isCorrect: false }, { text: 'Mars', isCorrect: true }, { text: 'Saturn', isCorrect: false }] },
      { type: 'mc', question: 'What is 15 × 8?', points: 2, choices: ['110', '120', '132', '140'], correct: 2 },
      { type: 'essay', question: 'Explain why education is important in society.', points: 5 },
      { type: 'essay', question: 'Describe the three branches of government and their roles.', points: 10 },
    ], null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'exam_template.json'; a.click();
    URL.revokeObjectURL(url);
  } else if (format === 'excel') {
    const rows = [
      ['type', 'question', 'points', 'choiceA', 'choiceB', 'choiceC', 'choiceD', 'correct'],
      ['mc', 'What is the capital of the Philippines?', 2, 'Cebu', 'Manila', 'Davao', 'Quezon City', 'B'],
      ['mc', 'Which planet is known as the Red Planet?', 3, 'Venus', 'Jupiter', 'Mars', 'Saturn', 'C'],
      ['mc', 'What is 15 × 8?', 2, '110', '120', '132', '140', 'C'],
      ['essay', 'Explain why education is important in society.', 5, '', '', '', '', ''],
      ['essay', 'Describe the three branches of government and their roles.', 10, '', '', '', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 55 }, { wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 10 }];
    const noteRows = [
      ['INSTRUCTIONS'],
      ['Column', 'Description'],
      ['type', 'mc = Multiple Choice  |  essay = Essay'],
      ['question', 'The full question text'],
      ['points', 'Point value (number)'],
      ['choiceA–D', 'Answer options (MC only; leave blank for essay)'],
      ['correct', 'Correct answer: A, B, C, or D (MC only; leave blank for essay)'],
      [''],
      ['NOTES'],
      ['- You may add or remove rows freely.'],
      ['- Do NOT change column headers in row 1 of the Questions sheet.'],
      ['- For essay questions, leave choiceA–D and correct columns blank.'],
      ['- The "correct" column accepts A/B/C/D or 1/2/3/4 (1-indexed).'],
    ];
    const wsNotes = XLSX.utils.aoa_to_sheet(noteRows);
    wsNotes['!cols'] = [{ wch: 18 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Instructions');
    XLSX.writeFile(wb, 'exam_template.xlsx');
  }
}

/* ===== EXAM BUILDER ===== */
function ExamBuilder({ editExam, onDone }: { editExam: Exam | null; onDone: () => void }) {
  const [title, setTitle] = useState(editExam?.title || '');
  const [grade, setGrade] = useState(editExam?.gradeLevel || '');
  const [duration, setDuration] = useState<string | number>(editExam?.durationMinutes || '');
  const [passing, setPassing] = useState<string | number>(editExam?.passingScore || '');
  const [yearId, setYearId] = useState<string | number>((editExam as any)?.academicYear?.id || '');
  const [semId, setSemId] = useState<string | number>((editExam as any)?.semester?.id || '');
  const [questions, setQuestions] = useState<ParsedQuestion[]>(editExam ? JSON.parse(JSON.stringify(editExam.questions)) : []);
  const [qModal, setQModal] = useState<'mc' | 'essay' | null>(null);
  const [qText, setQText] = useState('');
  const [qPts, setQPts] = useState('');
  const [choices, setChoices] = useState<ChoiceState[]>([{ text: '', correct: true }, { text: '' }, { text: '' }, { text: '' }]);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: years } = useAsync<AcademicYear[]>(() => getAcademicYears());
  const { data: allSems } = useAsync<Semester[]>(() => getSemesters());
  const semesterOptions = (allSems || []).filter(s => !yearId || s.academicYearId === Number(yearId));

  const isDirty = !!(title || questions.length > 0);
  const { clear } = useUnsavedChanges(isDirty);

  const moveQuestion = (fromIdx: number, toIdx: number) => {
    setQuestions(qs => {
      const arr = [...qs];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr.map((q, i) => ({ ...q, orderNum: i + 1 }));
    });
  };

  const openQ = (type: 'mc' | 'essay') => {
    setQModal(type);
    setQText('');
    setQPts('');
    setChoices([{ text: '', correct: true }, { text: '' }, { text: '' }, { text: '' }]);
  };

  const addQuestion = () => {
    if (!qText.trim()) { showToast('Question text is required.', 'error'); return; }
    const pts = parseInt(qPts);
    if (!pts || pts <= 0) { showToast('Points must be greater than 0.', 'error'); return; }
    if (qModal === 'mc') {
      const filledChoices = choices.filter(c => c.text.trim());
      if (filledChoices.length < 2) { showToast('At least 2 choices are required.', 'error'); return; }
      if (!filledChoices.some(c => c.correct)) { showToast('Mark at least one correct answer.', 'error'); return; }
    }
    const q: ParsedQuestion = { id: uid(), questionText: qText, questionType: qModal!, points: pts, orderNum: questions.length + 1, choices: [] };
    if (qModal === 'mc') {
      q.choices = choices.filter(c => c.text.trim()).map(c => ({ id: uid(), choiceText: c.text, isCorrect: !!c.correct }));
    }
    setQuestions([...questions, q]);
    setQModal(null);
    showToast('Question added!', 'success');
  };

  const handleUploadFile = (file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['json', 'csv', 'xlsx', 'xls'].includes(ext)) {
      showToast('Unsupported file type. Please upload a .csv, .xlsx, or .json file.', 'error');
      return;
    }
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { parsed, errs } = parseExcelQuestions(e.target?.result as ArrayBuffer);
          if (parsed.length === 0) { showToast('No valid questions found in file. Check the format.', 'error'); return; }
          setUploadPreview({ parsed, errs, fileName: file.name });
        } catch (err: any) {
          showToast(`Failed to parse Excel file: ${err.message}`, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { parsed, errs } = ext === 'json' ? parseJSONQuestions(text) : parseCSVQuestions(text);
        if (parsed.length === 0) {
          showToast('No valid questions found in file. Check the format.', 'error');
          return;
        }
        setUploadPreview({ parsed, errs, fileName: file.name });
      } catch (err: any) {
        showToast(`Failed to parse file: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const confirmUpload = (mode: 'replace' | 'append') => {
    if (!uploadPreview) return;
    if (mode === 'replace') {
      setQuestions(uploadPreview.parsed);
    } else {
      setQuestions(prev => {
        const merged = [...prev, ...uploadPreview.parsed.map((q, i) => ({ ...q, id: uid(), orderNum: prev.length + i + 1 }))];
        return merged;
      });
    }
    showToast(`${uploadPreview.parsed.length} question(s) imported successfully!`, 'success');
    setUploadPreview(null);
  };

  const saveExam = async () => {
    if (!title.trim() || !grade || !duration || !passing) { showToast('Fill in all required exam details (title, grade, duration, passing score).', 'error'); return; }
    const dur = parseInt(String(duration));
    const pass = parseFloat(String(passing));
    if (isNaN(dur) || dur <= 0) { showToast('Duration must be a positive number of minutes.', 'error'); return; }
    if (isNaN(pass) || pass < 0 || pass > 100) { showToast('Passing score must be between 0 and 100.', 'error'); return; }
    if (questions.length === 0) { showToast('Add at least one question before saving.', 'error'); return; }
    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        gradeLevel: grade,
        durationMinutes: dur,
        passingScore: pass,
        ...(yearId && { academicYearId: Number(yearId) }),
        ...(semId  && { semesterId:     Number(semId) }),
        questions,
      };
      if (editExam) {
        await updateExam(editExam.id, payload);
        showToast('Exam updated successfully!', 'success');
      } else {
        await addExam(payload);
        showToast('Exam created successfully!', 'success');
      }
      clear();
      onDone();
    } catch (err: any) {
      showToast('Failed to save exam: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);
  const mcCount = questions.filter(q => q.questionType === 'mc').length;
  const essayCount = questions.filter(q => q.questionType === 'essay').length;

  return (
    <div>
      <PageHeader title={editExam ? 'Edit Exam' : 'Create New Exam'} subtitle="Set up exam details and add questions manually or upload a file." />
      <div className="gk-card p-6 mb-4">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Exam Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput label="Exam Title" value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="e.g. Entrance Exam - Grade 7" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
              <option value="">Select grade level</option>
              {EXAM_GRADE_LEVELS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <FormInput label="Duration (minutes)" type="number" value={duration} onChange={(e: ChangeEvent<HTMLInputElement>) => setDuration(e.target.value)} placeholder="60" />
          <FormInput label="Passing Score (%)" type="number" value={passing} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassing(e.target.value)} placeholder="60" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year <span className="text-gray-400 font-normal">(optional)</span></label>
            <select value={yearId} onChange={e => { setYearId(e.target.value); setSemId(''); }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
              <option value="">Select academic year</option>
              {(years || []).map(y => <option key={y.id} value={y.id}>{y.year}{y.isActive ? ' (Active)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester / Period <span className="text-gray-400 font-normal">(optional)</span></label>
            <select value={semId} onChange={e => setSemId(e.target.value)} disabled={!yearId} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">{yearId ? 'Select semester' : 'Select a year first'}</option>
              {semesterOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Upload Questionnaire Section */}
      <div className="gk-card p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-forest-500 flex items-center gap-1.5"><Icon name="upload" className="w-5 h-5" /> Upload Questionnaire</h3>
            <p className="text-gray-500 text-sm mt-0.5">Import questions from a CSV, Excel, or JSON file to quickly build your exam.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => downloadTemplate('csv')} className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1"><Icon name="document" className="w-3.5 h-3.5" /> CSV</button>
            <button onClick={() => downloadTemplate('excel')} className="text-xs border border-forest-300 text-forest-700 bg-forest-50 px-2.5 py-1.5 rounded-lg hover:bg-forest-100 flex items-center gap-1"><Icon name="document" className="w-3.5 h-3.5" /> Excel</button>
            <button onClick={() => downloadTemplate('json')} className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1"><Icon name="document" className="w-3.5 h-3.5" /> JSON</button>
          </div>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-gold-400 bg-gold-50' : 'border-gray-300 hover:border-gold-300 hover:bg-gray-50'}`}
          onClick={() => document.getElementById('questionnaire-upload')?.click()}
          onDragOver={(e: DragEvent) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e: DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]); }}
        >
          <div className="text-3xl mb-2"><Icon name="upload" className="w-8 h-8 text-gray-400 mx-auto" /></div>
          <p className="text-gray-600 font-medium">Drag & drop your questionnaire file here</p>
          <p className="text-gray-400 text-sm mt-1">or <span className="text-forest-500 font-medium underline">click to browse</span></p>
          <p className="text-xs text-gray-400 mt-2">Supported: .xlsx (Excel) · .csv · .json</p>
        </div>
        <input id="questionnaire-upload" type="file" accept=".csv,.json,.xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUploadFile(e.target.files[0]); e.target.value = ''; }} />

        <details className="mt-4 group">
          <summary className="text-sm text-forest-500 font-medium cursor-pointer hover:underline select-none flex items-center gap-1"><Icon name="info" className="w-4 h-4" /> How to format your file</summary>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-forest-500 text-sm mb-1 flex items-center gap-1"><Icon name="document" className="w-4 h-4" /> CSV / Excel Format</h4>
              <p className="text-xs text-gray-500 mb-2">8 columns — same structure for both .csv and .xlsx</p>
              <div className="text-xs font-mono bg-white rounded p-2 border border-gray-200 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-forest-50">
                    <th className="border border-gray-200 px-1.5 py-1">type</th>
                    <th className="border border-gray-200 px-1.5 py-1">question</th>
                    <th className="border border-gray-200 px-1.5 py-1">points</th>
                    <th className="border border-gray-200 px-1.5 py-1">choiceA</th>
                    <th className="border border-gray-200 px-1.5 py-1">choiceB</th>
                    <th className="border border-gray-200 px-1.5 py-1">choiceC</th>
                    <th className="border border-gray-200 px-1.5 py-1">choiceD</th>
                    <th className="border border-gray-200 px-1.5 py-1">correct</th>
                  </tr></thead>
                  <tbody>
                    <tr><td className="border border-gray-200 px-1.5 py-1 text-blue-600">mc</td><td className="border border-gray-200 px-1.5 py-1">What is 2+2?</td><td className="border border-gray-200 px-1.5 py-1">2</td><td className="border border-gray-200 px-1.5 py-1">3</td><td className="border border-gray-200 px-1.5 py-1">4</td><td className="border border-gray-200 px-1.5 py-1">5</td><td className="border border-gray-200 px-1.5 py-1">6</td><td className="border border-gray-200 px-1.5 py-1 text-green-600">B</td></tr>
                    <tr><td className="border border-gray-200 px-1.5 py-1 text-purple-600">essay</td><td className="border border-gray-200 px-1.5 py-1">Explain photosynthesis.</td><td className="border border-gray-200 px-1.5 py-1">5</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">—</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">—</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">—</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">—</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">—</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">• <strong>type:</strong> <code>mc</code> or <code>essay</code></p>
              <p className="text-xs text-gray-400">• <strong>correct:</strong> A / B / C / D (or 1 / 2 / 3 / 4)</p>
              <p className="text-xs text-gray-400">• Leave choiceA–D & correct blank for essay rows</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-forest-500 text-sm mb-1 flex items-center gap-1"><Icon name="document" className="w-4 h-4" /> JSON Format</h4>
              <p className="text-xs text-gray-500 mb-2">Array of question objects</p>
              <pre className="text-xs bg-white rounded p-2 border border-gray-200 overflow-x-auto whitespace-pre-wrap text-gray-600">{`[
  {
    "type": "mc",
    "question": "What is 2+2?",
    "points": 2,
    "choices": ["3","4","5","6"],
    "correct": 1
  },
  {
    "type": "essay",
    "question": "Explain...",
    "points": 5
  }
]`}</pre>
              <p className="text-xs text-gray-400 mt-2">• <strong>correct:</strong> 0-based index <em>or</em> letter A–D</p>
              <p className="text-xs text-gray-400">• choices can be strings or <code>{'{text, isCorrect}'}</code> objects</p>
            </div>
            <div className="bg-gold-50 rounded-lg p-4 border border-gold-200">
              <h4 className="font-bold text-gold-700 text-sm mb-1">Download Templates</h4>
              <p className="text-xs text-gray-500 mb-3">Pre-filled sample files ready to edit</p>
              <div className="space-y-2">
                <button onClick={() => downloadTemplate('excel')} className="w-full flex items-center gap-2 text-sm text-forest-700 bg-white border border-forest-200 rounded-lg px-3 py-2 hover:bg-forest-50 transition-colors">
                  <Icon name="document" className="w-4 h-4 text-green-600" />
                  <span>Excel Template <span className="text-xs text-gray-400 font-normal">(.xlsx)</span></span>
                </button>
                <button onClick={() => downloadTemplate('csv')} className="w-full flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
                  <Icon name="document" className="w-4 h-4 text-blue-500" />
                  <span>CSV Template <span className="text-xs text-gray-400 font-normal">(.csv)</span></span>
                </button>
                <button onClick={() => downloadTemplate('json')} className="w-full flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
                  <Icon name="document" className="w-4 h-4 text-yellow-500" />
                  <span>JSON Template <span className="text-xs text-gray-400 font-normal">(.json)</span></span>
                </button>
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Upload Preview Modal */}
      <Modal open={!!uploadPreview} onClose={() => setUploadPreview(null)}>
        {uploadPreview && (
          <div>
            <h3 className="text-lg font-bold text-forest-500 mb-2 flex items-center gap-1.5"><Icon name="clipboard" className="w-5 h-5" /> Import Preview</h3>
            <p className="text-gray-500 text-sm mb-4">File: <span className="font-medium text-forest-500">{uploadPreview.fileName}</span></p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-forest-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-forest-700">{uploadPreview.parsed.length}</div>
                <div className="text-xs text-gray-500">Questions</div>
              </div>
              <div className="bg-forest-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-forest-700">{uploadPreview.parsed.filter(q => q.questionType === 'mc').length}</div>
                <div className="text-xs text-gray-500">Multiple Choice</div>
              </div>
              <div className="bg-gold-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-gold-700">{uploadPreview.parsed.filter(q => q.questionType === 'essay').length}</div>
                <div className="text-xs text-gray-500">Essay</div>
              </div>
            </div>
            <div className="text-sm text-gray-500 mb-2">Total points: <strong>{uploadPreview.parsed.reduce((s, q) => s + q.points, 0)}</strong></div>
            {uploadPreview.errs > 0 && (
              <p className="text-sm text-red-500 mb-3">⚠️ {uploadPreview.errs} row(s) were skipped due to formatting errors.</p>
            )}

            <div className="max-h-60 overflow-y-auto space-y-2 mb-4 border border-gray-100 rounded-lg p-3 bg-gray-50">
              {uploadPreview.parsed.map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="bg-forest-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 mt-0.5">Q{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={q.questionType === 'mc' ? 'gk-badge gk-badge-mc' : 'gk-badge gk-badge-essay'}>{q.questionType === 'mc' ? 'MC' : 'Essay'}</Badge>
                      <span className="text-gray-400 text-xs">{q.points} pts</span>
                    </div>
                    <p className="text-gray-700 truncate">{q.questionText}</p>
                    {q.questionType === 'mc' && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {q.choices.map((c, j) => (
                          <span key={j} className={`text-xs px-1.5 py-0.5 rounded ${c.isCorrect ? 'bg-forest-50 text-forest-700 font-medium' : 'bg-gray-100 text-gray-500'}`}>
                            {String.fromCharCode(65 + j)}. {c.choiceText}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {questions.length > 0 ? (
              <div>
                <p className="text-sm text-gray-500 mb-3">You already have <strong>{questions.length}</strong> question(s). How would you like to import?</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => confirmUpload('append')} className="bg-forest-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-forest-600 inline-flex items-center gap-1"><Icon name="plus" className="w-4 h-4" /> Add to Existing</button>
                  <button onClick={() => confirmUpload('replace')} className="bg-forest-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-forest-600 inline-flex items-center gap-1"><Icon name="refresh" className="w-4 h-4" /> Replace All</button>
                  <button onClick={() => setUploadPreview(null)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => confirmUpload('replace')} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600 inline-flex items-center gap-1.5"><Icon name="check" className="w-4 h-4" /> Import Questions</button>
                <button onClick={() => setUploadPreview(null)} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Questions Section */}
      <div className="gk-card p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-forest-500">Questions ({questions.length})</h3>
            {questions.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{mcCount} MC · {essayCount} Essay · {totalPoints} total pts</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => openQ('mc')} className="bg-forest-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-forest-600">+ Multiple Choice</button>
            <button onClick={() => openQ('essay')} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">+ Essay</button>
          </div>
        </div>
        {questions.length > 0 ? (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className={`relative flex items-start gap-2 ${dragIdx === i ? 'opacity-50' : ''}`}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragEnd={() => setDragIdx(null)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) moveQuestion(dragIdx, i); setDragIdx(null); }}
              >
                <div className="flex flex-col items-center gap-0.5 pt-3">
                  <button onClick={() => { if (i > 0) moveQuestion(i, i - 1); }} disabled={i === 0} className="text-gray-400 hover:text-forest-500 disabled:opacity-30 text-xs px-1" aria-label={`Move question ${i + 1} up`}>▲</button>
                  <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-forest-500 px-1 select-none text-lg" title="Drag to reorder">⠗</div>
                  <button onClick={() => { if (i < questions.length - 1) moveQuestion(i, i + 1); }} disabled={i === questions.length - 1} className="text-gray-400 hover:text-forest-500 disabled:opacity-30 text-xs px-1" aria-label={`Move question ${i + 1} down`}>▼</button>
                </div>
                <div className="flex-1">
                  <QuestionCard q={q} i={i} />
                </div>
                <button onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs bg-white rounded px-2 py-1 border border-red-200">Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="documentText" title="No Questions Added" text="Upload a questionnaire file above, or click the buttons to add questions manually." />
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={saveExam} disabled={isSaving} className="bg-forest-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-forest-600 shadow-md inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed">
          {isSaving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : <><Icon name="check" className="w-4 h-4" /> Save Exam</>}
        </button>
        <button onClick={onDone} disabled={isSaving} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
      </div>

      {/* Question Modal */}
      <Modal open={!!qModal} onClose={() => setQModal(null)}>
        <h3 className="text-lg font-bold text-forest-500 mb-4">{qModal === 'mc' ? 'Add Multiple Choice Question' : 'Add Essay Question'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
            <textarea value={qText} onChange={e => setQText(e.target.value)} placeholder="Enter your question..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none min-h-[80px]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
            <input type="number" value={qPts} onChange={e => setQPts(e.target.value)} placeholder="5" className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none" />
          </div>
          {qModal === 'mc' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Choices (select correct)</label>
              <div className="space-y-2">
                {choices.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correctChoice" checked={!!c.correct} onChange={() => setChoices(cs => cs.map((cc, j) => ({ ...cc, correct: j === i })))} className="accent-forest-500" />
                    <input type="text" value={c.text} onChange={e => setChoices(cs => cs.map((cc, j) => j === i ? { ...cc, text: e.target.value } : cc))} placeholder={`Choice ${i + 1}`} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
                    {choices.length > 2 && <button onClick={() => setChoices(cs => cs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">✕</button>}
                  </div>
                ))}
              </div>
              {choices.length < 6 && <button onClick={() => setChoices(cs => [...cs, { text: '' }])} className="mt-2 text-gold-500 text-sm font-medium">+ Add Choice</button>}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={addQuestion} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600">Add Question</button>
            <button onClick={() => setQModal(null)} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ===== SCHEDULE MANAGER ===== */
function ScheduleManager() {
  const confirm = useConfirm();
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ examId: '', date: '', start: '', end: '', slots: '' });
  const [schedSearch, setSchedSearch] = useState('');
  const [schedExamFilter, setSchedExamFilter] = useState('all');
  const [schedPage, setSchedPage] = useState(1);
  const [isSavingSched, setIsSavingSched] = useState(false);
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const { data: schedData, loading: schedLoading, error: schedError, refetch: schedRefetch } = useAsync(async () => {
    const [rawExm, rawSched] = await Promise.all([getExams(), getExamSchedules()]);
    return { exams: asArray<Exam>(rawExm), allSchedules: asArray<ExamSchedule>(rawSched) };
  });

  const exams: Exam[] = schedData?.exams || [];
  const allSchedules: ExamSchedule[] = schedData?.allSchedules || [];

  const filteredScheds = useMemo(() => {
    let list = allSchedules;
    if (schedExamFilter !== 'all') list = list.filter(s => String(s.examId) === schedExamFilter);
    if (schedSearch.trim()) {
      const q = schedSearch.toLowerCase();
      list = list.filter(s => {
        const exam = exams.find(e => e.id === s.examId);
        return (exam?.title || '').toLowerCase().includes(q) || s.scheduledDate.includes(q);
      });
    }
    return list;
  }, [allSchedules, schedExamFilter, schedSearch, exams]);

  const { paginated: paginatedScheds, totalPages: schedTotalPages, safePage: schedSafePage, totalItems: schedTotal } = usePaginationSlice(filteredScheds, schedPage, SCHED_PER_PAGE);
  const resetSchedPage = () => setSchedPage(1);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.examId) {
      const selectedExam = exams.find(ex => String(ex.id) === String(form.examId));
      if (selectedExam && (!selectedExam.questions || selectedExam.questions.length === 0)) {
        showToast('Cannot schedule an exam with zero questions. Add questions first.', 'error');
        return;
      }
    }
    if (form.start && form.end && form.start >= form.end) {
      showToast('End time must be after start time.', 'error');
      return;
    }
    if (form.date) {
      const today = new Date().toISOString().split('T')[0];
      if (form.date < today) {
        showToast('Schedule date cannot be in the past.', 'error');
        return;
      }
    }
    const data = { examId: parseInt(form.examId), scheduledDate: form.date, startTime: form.start, endTime: form.end, maxSlots: parseInt(form.slots) };
    setIsSavingSched(true);
    try {
      if (editId) { await updateExamSchedule(editId, data); showToast('Schedule updated!', 'success'); setEditId(null); }
      else { await addExamSchedule(data); showToast('Schedule added!', 'success'); }
    } catch (err: any) {
      showToast('Failed to save schedule: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSavingSched(false);
    }
    setForm({ examId: '', date: '', start: '', end: '', slots: '' });
    schedRefetch();
  };

  const editSched = (s: ExamSchedule) => { setEditId(s.id); setForm({ examId: String(s.examId), date: s.scheduledDate, start: s.startTime, end: s.endTime, slots: String(s.maxSlots) }); };

  if (schedLoading) return <SkeletonPage />;
  if (schedError) return <div className="gk-card p-8 text-center"><p className="text-red-600 font-medium">Failed to load schedules.</p><button onClick={schedRefetch} className="mt-2 text-forest-500 underline text-sm">Retry</button></div>;

  return (
    <div>
      <PageHeader title="Exam Schedules" subtitle="Create and manage exam date/time slots." />
      <div className="gk-card p-6 mb-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">{editId ? 'Edit Schedule' : 'Add New Schedule'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam</label>
            <select value={form.examId} onChange={set('examId') as any} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
              <option value="">Select exam</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
          <FormInput label="Date" type="date" value={form.date} onChange={set('date')} required />
          <FormInput label="Start Time" type="time" value={form.start} onChange={set('start')} required />
          <FormInput label="End Time" type="time" value={form.end} onChange={set('end')} required />
          <FormInput label="Max Applicants" type="number" value={form.slots} onChange={set('slots')} placeholder="30" required />
          <div className="flex items-end">
            <button type="submit" disabled={isSavingSched} className="bg-forest-500 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {isSavingSched ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : (editId ? 'Update Schedule' : 'Add Schedule')}
            </button>
          </div>
        </form>
      </div>

      <div className="gk-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Current Schedules</h3>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input value={schedSearch} onChange={e => { setSchedSearch(e.target.value); resetSchedPage(); }} placeholder="Search by exam or date…" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
          <select value={schedExamFilter} onChange={e => { setSchedExamFilter(e.target.value); resetSchedPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
            <option value="all">All Exams</option>
            {exams.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}
          </select>
        </div>
        <div className="space-y-3">
          {paginatedScheds.map(s => {
            const exam = exams.find(e => e.id === s.examId);
            const d = new Date(s.scheduledDate + 'T00:00:00');
            const remaining = s.maxSlots - s.slotsTaken;
            return (
              <div key={s.id} className="flex items-center gap-4 bg-gray-50 rounded-lg p-4">
                <div className="text-center bg-forest-500 text-white rounded-lg px-3 py-2 min-w-[60px]">
                  <div className="text-xs uppercase">{d.toLocaleString('en-US', { month: 'short' })}</div>
                  <div className="text-xl font-bold">{d.getDate()}</div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-forest-500">{exam?.title || 'Unknown Exam'}</h4>
                  <p className="text-gray-500 text-sm">{formatTime(s.startTime)} - {formatTime(s.endTime)}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge className="gk-badge gk-badge-info">{s.slotsTaken} / {s.maxSlots} booked</Badge>
                    <Badge className={remaining > 0 ? 'gk-badge gk-badge-active' : 'gk-badge gk-badge-danger'}>{remaining > 0 ? `${remaining} slots left` : 'Full'}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editSched(s)} className="text-forest-500 hover:underline text-xs inline-flex items-center gap-0.5"><Icon name="edit" className="w-3 h-3" /> Edit</button>
                  <button onClick={async () => { if (await confirm({ title: 'Delete Schedule', message: 'Are you sure you want to delete this schedule?', confirmLabel: 'Delete', variant: 'danger' })) { try { await deleteExamSchedule(s.id); schedRefetch(); } catch { showToast('Failed to delete schedule.', 'error'); } } }} className="text-red-500 hover:underline text-xs inline-flex items-center gap-0.5"><Icon name="trash" className="w-3 h-3" /> Delete</button>
                </div>
              </div>
            );
          })}
          {paginatedScheds.length === 0 && <EmptyState icon="calendar" title="No schedules" text={schedSearch ? `No schedules match "${schedSearch}"${schedExamFilter !== 'all' ? ' for the selected exam' : ''}.` : schedExamFilter !== 'all' ? 'No schedules for the selected exam.' : 'No schedules match your current filters.'} />}
        </div>
        <Pagination currentPage={schedSafePage} totalPages={schedTotalPages} onPageChange={setSchedPage} totalItems={schedTotal} itemsPerPage={SCHED_PER_PAGE} />
      </div>
    </div>
  );
}

/* ===== Shared sub-components ===== */
function DetailField({ label, v }: { label: string; v: string | number }) { return <div><span className="block text-xs text-gray-400 uppercase tracking-wide">{label}</span><span className="text-sm text-forest-500 font-medium">{String(v)}</span></div>; }
function FormInput({ label, required, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) { return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label><input {...props} required={required} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none" /></div>; }

function QuestionCard({ q, i }: { q: ParsedQuestion | ExamQuestion; i: number }) {
  const choices = (q as any).choices || [];
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="bg-forest-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">Q{i + 1}</span>
        <Badge className={q.questionType === 'mc' ? 'gk-badge gk-badge-mc' : 'gk-badge gk-badge-essay'}>{q.questionType === 'mc' ? 'Multiple Choice' : 'Essay'}</Badge>
        <span className="text-xs text-gray-400 ml-auto">{q.points} pts</span>
      </div>
      <p className="text-forest-500 font-medium text-sm mb-2">{q.questionText}</p>
      {q.questionType === 'mc' ? (
        <div className="space-y-1">
          {choices.map((c: any) => (
            <div key={c.id} className={`text-sm px-2 py-1 rounded ${c.isCorrect ? 'bg-forest-50 text-forest-700 font-medium' : 'text-gray-500'}`}>
              {c.isCorrect ? '✓' : '○'} {c.choiceText}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm italic">📝 Essay response required</p>
      )}
    </div>
  );
}
