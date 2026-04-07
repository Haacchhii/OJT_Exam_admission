import { useState, useMemo } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { getExams, getExam, updateExam, deleteExam, bulkDeleteExams, cloneExam, getExamSchedules, getExamRegistrations, getExamReadinessPage } from '../../../api/exams';
import { getAcademicYears, getSemesters } from '../../../api/academicYears';
import { showToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useSelection } from '../../../hooks/useSelection';
import BulkActionBar from '../../../components/BulkActionBar';
import { PageHeader, StatCard, Badge, EmptyState, Pagination, usePaginationSlice, SkeletonPage, ErrorAlert } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { formatTime, badgeClass, asArray, exportToCSV, formatPersonName, formatDate } from '../../../utils/helpers';
import { DetailField, QuestionCard } from './ExamComponents';
import ExamPreviewModal from './ExamPreviewModal';
import { CSVUploader } from '../../../components/CSVUploader';
import { addExam } from '../../../api/exams';
import type { Exam, ExamSchedule, ExamRegistration, AcademicYear, Semester } from '../../../types';
import { GRADE_OPTIONS, ALL_GRADE_LEVELS } from '../../../utils/constants';

const EXAMS_PER_PAGE = 10;
const READINESS_PER_PAGE = 10;
const QUESTIONS_PER_PAGE = 5;

function semesterLabel(s: Semester) {
  const start = s.startDate ? formatDate(String(s.startDate)) : null;
  const end = s.endDate ? formatDate(String(s.endDate)) : null;
  if (start || end) return `${s.name} (${start || 'open'} to ${end || 'open'})`;
  return s.name;
}

export default function ExamsList({ onEdit }: { onEdit?: (exam: Exam) => void }) {
  const canManageExams = !!onEdit;
  const confirm = useConfirm();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchExam, setSearchExam] = useState('');    const [levelGroupFilterExam, setLevelGroupFilterExam] = useState('all');  const [gradeFilterExam, setGradeFilterExam] = useState('all');
  const [statusFilterExam, setStatusFilterExam] = useState('all');
  const [yearFilterExam, setYearFilterExam] = useState('all');
  const [semesterFilterExam, setSemesterFilterExam] = useState('all');
  const [examPage, setExamPage] = useState(1);
  const [readSearch, setReadSearch] = useState('');
  const [readStatusFilter, setReadStatusFilter] = useState('all');
  const [readPage, setReadPage] = useState(1);
  const [questionPage, setQuestionPage] = useState(1);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const { selected, toggle, togglePage, clear: clearSelection, isAllSelected, count: selectedCount } = useSelection();

  const { data, loading, error, refetch } = useAsync(async () => {
    const [rawExm, rawSched, rawRegs] = await Promise.all([
      getExams(), getExamSchedules(), getExamRegistrations(),
    ]);
    return { exams: asArray<Exam>(rawExm), schedules: asArray<ExamSchedule>(rawSched), regs: asArray<ExamRegistration>(rawRegs) };
  });

  const { data: readinessPage, loading: readinessLoading } = useAsync(async () => {
    return getExamReadinessPage({
      search: readSearch.trim() || undefined,
      status: readStatusFilter as 'all' | 'pending' | 'done' | 'passed' | 'failed',
      page: readPage,
      limit: READINESS_PER_PAGE,
    });
  }, [readSearch, readStatusFilter, readPage], 0, { setLoadingOnReload: true });

  // Fetch full exam (with questions) when viewing detail
  const { data: fullExam, loading: examDetailLoading } = useAsync<Exam | null>(
    () => detailId ? getExam(detailId) : Promise.resolve(null),
    [detailId]
  );

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

  const schedulesById = useMemo(() => new Map(schedules.map(s => [s.id, s])), [schedules]);
  const examsById = useMemo(() => new Map(exams.map(e => [e.id, e])), [exams]);

  const filteredExams = useMemo(() => {
    let list = exams;
    if (searchExam.trim()) {
      const q = searchExam.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q));
    }      if (levelGroupFilterExam !== 'all') list = list.filter(e => e.levelGroup === levelGroupFilterExam);    if (gradeFilterExam !== 'all') list = list.filter(e => e.gradeLevel === gradeFilterExam);
    if (statusFilterExam !== 'all') list = list.filter(e => (statusFilterExam === 'active') === e.isActive);
    if (yearFilterExam !== 'all') list = list.filter(e => e.academicYear?.id === Number(yearFilterExam));
    if (semesterFilterExam !== 'all') list = list.filter(e => e.semester?.id === Number(semesterFilterExam));
    return list;
  }, [exams, searchExam, levelGroupFilterExam, gradeFilterExam, statusFilterExam, yearFilterExam, semesterFilterExam]);

  const examGrades = useMemo(() => [...new Set(exams.map(e => e.gradeLevel).filter(Boolean))].sort(), [exams]);

  const { paginated: paginatedExams, totalPages: examTotalPages, safePage: examSafePage, totalItems: examTotal } = usePaginationSlice(filteredExams, examPage, EXAMS_PER_PAGE);
  const resetExamPage = () => setExamPage(1);

  const handleBulkImportExams = async (data: any[]) => {
    if (!data.length) {
      showToast('No exam rows found to import.', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Bulk Import Exams',
      message: `Import ${data.length} exam row(s)? Existing exams will remain unchanged.`,
      confirmLabel: 'Import Exams',
      variant: 'info',
    });
    if (!ok) return;

    let successCount = 0;
    let failedCount = 0;
    setSaving(true);
    try {
      for (const row of data) {
        try {
          const questions = [];
          for (let i = 1; i <= 200; i++) {
            const qtext = row['q' + i + '_text'];
            if (!qtext) continue;
            
            const qType = row['q' + i + '_type'] || 'mc';
            const qPoints = parseInt(row['q' + i + '_points']) || 1;
            
            const choices = [];
            const correctAns = (row['q' + i + '_ans'] || 'a').toLowerCase();
            const optionMap = ['a', 'b', 'c', 'd'];
            
            for (let j = 0; j < 4; j++) {
              const choiceText = row['q' + i + '_' + optionMap[j]];
              if (choiceText) {
                choices.push({
                  choiceText,
                  isCorrect: correctAns === optionMap[j],
                  orderNum: j + 1
                });
              }
            }
            
            questions.push({
              questionText: qtext,
              questionType: qType,
              points: qPoints,
              orderNum: questions.length + 1,
              choices
            });
          }

          await addExam({
            title: row.title || 'Untitled Exam',
            gradeLevel: row.gradeLevel || 'Grade 10',
            durationMinutes: parseInt(row.durationMinutes) || 60,
            passingScore: parseInt(row.passingScore) || 50,
            isActive: row.isActive === 'true' || row.isActive === '1' || row.isActive?.toLowerCase() === 'yes',
            questions
          });
          successCount++;
        } catch (e) {
          failedCount++;
        }
      }
      if (successCount > 0) {
        showToast(`Successfully imported ${successCount} exam(s).${failedCount ? ` ${failedCount} failed.` : ''}`, failedCount ? 'info' : 'success');
      } else {
        showToast('Import failed. No exams were created.', 'error');
      }
      refetch();
    } finally {
      setSaving(false);
    }
  };

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

  const resetReadPage = () => setReadPage(1);

  const paginatedReadiness = readinessPage?.data || [];
  const readTotalPages = readinessPage?.pagination?.totalPages || 1;
  const readSafePage = readinessPage?.pagination?.page || 1;
  const readTotal = readinessPage?.pagination?.total || 0;

  const detailQuestions = useMemo(() => fullExam?.questions || exams.find(e => e.id === detailId)?.questions || [], [fullExam, exams, detailId]);
  const { paginated: paginatedQuestions, totalPages: qTotalPages, safePage: qSafePage, totalItems: qTotal } = usePaginationSlice(detailQuestions, questionPage, QUESTIONS_PER_PAGE);

  if (loading && !data) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  if (detailId) {
    const exam = exams.find(e => e.id === detailId);
    if (!exam) return null;
    const eSched = schedules.filter(s => s.examId === exam.id);
    const eSchedIds = new Set(eSched.map(s => s.id));
    const eRegs = regs.filter(r => eSchedIds.has(r.scheduleId));
    const completed = eRegs.filter(r => r.status === 'done').length;
    

    return (
      <div>
        <button onClick={() => setDetailId(null)} className="mb-4 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">Back to Exam List</button>
        <div className="gk-section-card p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-forest-500">{exam.title}</h2>
              <Badge className={exam.isActive ? 'gk-badge gk-badge-active' : 'gk-badge gk-badge-inactive'}>{exam.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreviewExam(fullExam || exam)} className="border border-forest-300 text-forest-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-forest-50 inline-flex items-center gap-1"><Icon name="eye" className="w-3.5 h-3.5" /> Preview</button>
              {canManageExams && <>
                <button onClick={() => onEdit!(fullExam || exam)} className="bg-forest-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-forest-600 inline-flex items-center gap-1"><Icon name="edit" className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={async () => { const action = exam.isActive ? 'Deactivate' : 'Activate'; const ok = await confirm({ title: `${action} Exam`, message: `Are you sure you want to ${action.toLowerCase()} "${exam.title}"?`, confirmLabel: action, variant: exam.isActive ? 'danger' : 'info' }); if (!ok) return; try { await updateExam(exam.id, { isActive: !exam.isActive }); showToast(`Exam ${action.toLowerCase()}d!`, 'success'); refetch(); } catch { showToast('Failed to update exam.', 'error'); } }} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">{exam.isActive ? 'Deactivate' : 'Activate'}</button>
              </>}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DetailField label="Grade Level" v={exam.gradeLevel} /><DetailField label="Duration" v={`${exam.durationMinutes} minutes`} />
            <DetailField label="Passing Score" v={`${exam.passingScore}%`} /><DetailField label="Questions" v={detailQuestions.length} />
            <DetailField label="Schedules" v={eSched.length} /><DetailField label="Registrations" v={`${eRegs.length} (${completed} completed)`} />
          </div>
        </div>
        <div className="gk-section-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-4">Questions ({detailQuestions.length})</h3>
          {examDetailLoading && !fullExam ? (
            <p className="text-gray-400 text-center py-6">Loading questions...</p>
          ) : (
          <div className="space-y-3">
            {paginatedQuestions.map((q, i) => (
              <QuestionCard key={q.id} q={q} i={(qSafePage - 1) * QUESTIONS_PER_PAGE + i} />
            ))}
              {detailQuestions.length === 0 && <p className="text-gray-400 text-center py-6">No questions in this exam.</p>}
            </div>
          )}
          {detailQuestions.length > 0 && <div className="mt-4"><Pagination currentPage={qSafePage} totalPages={qTotalPages} onPageChange={setQuestionPage} totalItems={qTotal} itemsPerPage={QUESTIONS_PER_PAGE} /></div>}
        </div>
        <div className="gk-section-card p-6 mt-4">
          <h3 className="text-lg font-bold text-forest-500 mb-4">Registered Students ({eRegs.length})</h3>
          {eRegs.length > 0 ? (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs bg-gray-50/95 sticky top-0 z-10 backdrop-blur-sm">
                  <th scope="col" className="py-3 px-2">Student</th><th scope="col" className="py-3 px-2">Email</th><th scope="col" className="py-3 px-2">Status</th><th scope="col" className="py-3 px-2">Schedule</th>
                </tr></thead>
                <tbody>
                  {eRegs.map(r => {
                    const sc = schedulesById.get(r.scheduleId);
                    return (
                      <tr key={r.id} className="border-b border-gray-50">
                        <td className="py-3 px-2 font-medium">{r.userEmail}</td>
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
      <PageHeader title="All Exams" subtitle="View and manage created exams.">
        <div className="flex gap-2">          <button onClick={() => {
            const exportData = exams.map(e => ({
              ID: e.id,
              Title: e.title,
              Grade: e.gradeLevel,
              Duration_Mins: e.durationMinutes,
              Passing_Score: e.passingScore,
              Status: e.isActive ? 'Active' : 'Inactive'
            }));
            exportToCSV(exportData, 'exams_export.csv');
          }} className="bg-white text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 flex items-center gap-2 border border-gray-300">
            Export
          </button>          <CSVUploader title="Bulk Import Exams" isOpen={showBulkImport} onClose={() => setShowBulkImport(false)} onImport={handleBulkImportExams} templateHeaders={['title', 'gradeLevel', 'durationMinutes', 'passingScore', 'isActive']} allowMultiple />
          <button onClick={() => setShowBulkImport(true)} className="bg-white text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 flex items-center gap-2 border border-gray-300">
            <Icon name="upload" className="w-4 h-4" /> Import Exams
          </button>
        </div>
      </PageHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="exam" value={exams.length} label="Total Exams" color="blue" />
        <StatCard icon="calendar" value={schedules.length} label="Schedules" color="emerald" />
        <StatCard icon="users" value={regs.length} label="Registrations" color="amber" />
        <StatCard icon="checkCircle" value={regs.filter(r => r.status === 'done').length} label="Completed" color="amber" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input value={searchExam} onChange={e => { setSearchExam(e.target.value); resetExamPage(); }} placeholder="Search exams..." className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />          <select value={levelGroupFilterExam} onChange={e => { setLevelGroupFilterExam(e.target.value); setGradeFilterExam('all'); resetExamPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
            <option value="all">All Level Groups</option>
            {GRADE_OPTIONS.map(g => <option key={g.group} value={g.group}>{g.group}</option>)}
          </select>        <select value={gradeFilterExam} onChange={e => { setGradeFilterExam(e.target.value); resetExamPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
          <option value="all">All Grades</option>
          {(levelGroupFilterExam === 'all' ? ALL_GRADE_LEVELS : GRADE_OPTIONS.find(g => g.group === levelGroupFilterExam)?.items || []).map(g => <option key={g} value={g}>{g}</option>)}
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
          {semesterOptionsExam.map(s => <option key={s.id} value={s.id}>{semesterLabel(s)}</option>)}
        </select>
      </div>

      {canManageExams && <BulkActionBar count={selectedCount} onDelete={handleBulkDelete} onClear={clearSelection} deleting={bulkDeleting} />}

      <div className="gk-section-card p-4 mb-6">
        {paginatedExams.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs bg-gray-50/95 sticky top-0 z-10 backdrop-blur-sm">
                  {canManageExams && <th scope="col" className="py-3 px-2 w-8"><input type="checkbox" checked={isAllSelected(paginatedExams)} onChange={() => togglePage(paginatedExams)} className="accent-forest-500 rounded" aria-label="Select all exams" /></th>}
                  <th scope="col" className="py-3 px-2">ID</th><th scope="col" className="py-3 px-2">Title</th><th scope="col" className="py-3 px-2">Grade</th>
                    <th scope="col" className="py-3 px-2">Duration</th><th scope="col" className="py-3 px-2">Questions</th><th scope="col" className="py-3 px-2">Registrations</th><th scope="col" className="py-3 px-2">Passing</th>
                  <th scope="col" className="py-3 px-2">Status</th><th scope="col" className="py-3 px-2">Actions</th>
                </tr></thead>
                <tbody>
                  {paginatedExams.map(e => (
                    <tr key={e.id} className={`border-b border-gray-50 hover:bg-gray-50 ${selected.has(e.id) ? 'bg-gold-50/50' : ''}`}>
                      {canManageExams && <td className="py-3 px-2"><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="accent-forest-500 rounded" aria-label={`Select ${e.title}`} /></td>}
                      <td className="py-3 px-2 text-gray-400">{e.id}</td>
                      <td className="py-3 px-2 font-medium text-forest-500">{e.title}</td>
                      <td className="py-3 px-2">{e.gradeLevel}</td>
                      <td className="py-3 px-2">{e.durationMinutes} min</td>
                      <td className="py-3 px-2">{e.questionCount ?? e.questions?.length ?? 0}</td>
                      <td className="py-3 px-2">{regs.filter(r => schedules.some(s => s.examId === e.id && s.id === r.scheduleId)).length}</td>
                      <td className="py-3 px-2">{e.passingScore}%</td>
                      <td className="py-3 px-2"><Badge className={e.isActive ? 'gk-badge gk-badge-active' : 'gk-badge gk-badge-inactive'}>{e.isActive ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          <button onClick={() => setDetailId(e.id)} className="text-forest-500 hover:underline text-xs">View</button>
                          {canManageExams && <>
                            <button onClick={async () => { const ok = await confirm({ title: 'Clone Exam', message: `Create a duplicate copy of "${e.title}"?`, confirmLabel: 'Clone', variant: 'info' }); if (!ok) return; try { await cloneExam(e.id); showToast('Exam cloned successfully!', 'success'); refetch(); } catch { showToast('Failed to clone exam.', 'error'); } }} className="text-gold-600 hover:underline text-xs">Clone</button>
                            <button onClick={async () => { const action = e.isActive ? 'Deactivate' : 'Activate'; const ok = await confirm({ title: `${action} Exam`, message: `Are you sure you want to ${action.toLowerCase()} "${e.title}"?`, confirmLabel: action, variant: e.isActive ? 'danger' : 'info' }); if (!ok) return; try { await updateExam(e.id, { isActive: !e.isActive }); showToast(`Exam ${action.toLowerCase()}d!`, 'success'); refetch(); } catch { showToast('Failed to update exam.', 'error'); } }} className="text-gray-500 hover:underline text-xs">{e.isActive ? 'Deactivate' : 'Activate'}</button>
                            <button onClick={async () => { if (await confirm({ title: 'Delete Exam', message: 'Are you sure you want to delete this exam? This will also delete associated schedules, registrations, and results. This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' })) { try { await deleteExam(e.id); refetch(); } catch { showToast('Failed to delete exam.', 'error'); } } }} className="text-red-500 hover:underline text-xs">Delete</button>
                          </>}
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

      <div className="gk-section-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Exam Registrations & Results</h3>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input value={readSearch} onChange={e => { setReadSearch(e.target.value); resetReadPage(); }} placeholder="Search student..." className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
          <select value={readStatusFilter} onChange={e => { setReadStatusFilter(e.target.value); resetReadPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
            <option value="all">All</option>
            <option value="pending">Scheduled / In Progress</option>
            <option value="done">Completed</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        {paginatedReadiness.length > 0 || readinessLoading ? (
          <>
            <div className="relative table-scroll">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs bg-gray-50/95 sticky top-0 z-10 backdrop-blur-sm">
                  <th scope="col" className="py-3 px-2">Student</th><th scope="col" className="py-3 px-2">Exam</th><th scope="col" className="py-3 px-2">Registration Status</th><th scope="col" className="py-3 px-2">Score</th><th scope="col" className="py-3 px-2">Result</th>
                </tr></thead>
                <tbody>
                  {readinessLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 px-4" />
                    </tr>
                  ) : paginatedReadiness.map(r => (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="py-3 px-2 font-medium">{r.user ? formatPersonName(r.user) : r.userEmail}</td>
                      <td className="py-3 px-2">{r.schedule?.exam?.title || 'N/A'}</td>
                      <td className="py-3 px-2"><Badge className={badgeClass(r.status)}>{r.status}</Badge></td>
                      <td className="py-3 px-2">{r.result ? `${r.result.totalScore}/${r.result.maxPossible} (${r.result.percentage.toFixed(1)}%)` : '-'}</td>
                      <td className="py-3 px-2">{r.result ? <Badge className={r.result.passed ? 'gk-badge gk-badge-passed' : 'gk-badge gk-badge-failed'}>{r.result.passed ? 'Passed' : (r.result.essayReviewed ? 'Failed' : 'Pending Review')}</Badge> : <Badge className="gk-badge gk-badge-neutral">Awaiting</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {readinessLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px] pointer-events-none">
                  <div className="inline-flex items-center gap-2 rounded-full border border-forest-100 bg-white px-3 py-1.5 text-xs font-semibold text-forest-600 shadow-sm">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-forest-200 border-t-forest-500 animate-spin" />
                    Loading registrations...
                  </div>
                </div>
              )}
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
