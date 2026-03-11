import { useState, useMemo } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { getExams, updateExam, deleteExam, bulkDeleteExams, getExamSchedules, getExamRegistrations } from '../../../api/exams';
import { getAcademicYears, getSemesters } from '../../../api/academicYears';
import { getExamResults } from '../../../api/results';
import { getUsers } from '../../../api/users';
import { showToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useSelection } from '../../../hooks/useSelection';
import BulkActionBar from '../../../components/BulkActionBar';
import { PageHeader, StatCard, Badge, EmptyState, Pagination, usePaginationSlice, SkeletonPage, ErrorAlert } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { formatTime, badgeClass, asArray } from '../../../utils/helpers';
import { DetailField, QuestionCard } from './ExamComponents';
import ExamPreviewModal from './ExamPreviewModal';
import type { Exam, ExamSchedule, ExamRegistration, ExamResult, User, AcademicYear, Semester } from '../../../types';

const EXAMS_PER_PAGE = 10;
const READINESS_PER_PAGE = 10;

export default function ExamsList({ onEdit }: { onEdit: (exam: Exam) => void }) {
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
