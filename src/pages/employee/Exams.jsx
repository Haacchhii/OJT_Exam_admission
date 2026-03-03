import { useState, useMemo } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { getExams, getExam, addExam, updateExam, deleteExam, getExamSchedules, addExamSchedule, updateExamSchedule, deleteExamSchedule, getExamRegistrations } from '../../api/exams.js';
import { getAdmissions } from '../../api/admissions.js';
import { getExamResults } from '../../api/results.js';
import { getUsers } from '../../api/users.js';
import { showToast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { PageHeader, StatCard, Badge, EmptyState, Pagination, usePaginationSlice, SkeletonPage, ErrorAlert } from '../../components/UI.jsx';
import { formatTime, badgeClass, uid } from '../../utils/helpers.js';

const EXAMS_PER_PAGE = 10;
const READINESS_PER_PAGE = 10;
const SCHED_PER_PAGE = 8;

export default function EmployeeExams() {
  const [tab, setTab] = useState('exams');
  const [editExamData, setEditExamData] = useState(null);

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap" role="tablist">
        {[['exams','ðŸ" Exams'],['builder','âž• Create Exam'],['schedules','ðŸ"… Schedules']].map(([k,l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { if (k !== 'builder') setEditExamData(null); setTab(k); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === k ? 'bg-[#166534] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
        ))}
      </div>
      {tab === 'exams' && <ExamsList onEdit={(exam) => { setEditExamData(exam); setTab('builder'); }} />}
      {tab === 'builder' && <ExamBuilder editExam={editExamData} onDone={() => { setEditExamData(null); setTab('exams'); }} />}
      {tab === 'schedules' && <ScheduleManager />}
    </div>
  );
}

/* ===== EXAMS LIST ===== */
function ExamsList({ onEdit }) {
  const confirm = useConfirm();
  const [detailId, setDetailId] = useState(null);
  const [searchExam, setSearchExam] = useState('');
  const [gradeFilterExam, setGradeFilterExam] = useState('all');
  const [statusFilterExam, setStatusFilterExam] = useState('all');
  const [examPage, setExamPage] = useState(1);
  const [readSearch, setReadSearch] = useState('');
  const [readStatusFilter, setReadStatusFilter] = useState('all');
  const [readPage, setReadPage] = useState(1);

  const { data, loading, error, refetch } = useAsync(async () => {
    const [exams, schedules, regs, allUsers, allResults] = await Promise.all([
      getExams(), getExamSchedules(), getExamRegistrations(), getUsers(), getExamResults()
    ]);
    return { exams, schedules, regs, allUsers, allResults };
  });

  const exams = data?.exams || [];
  const schedules = data?.schedules || [];
  const regs = data?.regs || [];
  const allUsers = data?.allUsers || [];
  const allResults = data?.allResults || [];

  // Filtered exams
  const filteredExams = useMemo(() => {
    let list = exams;
    if (searchExam.trim()) {
      const q = searchExam.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q));
    }
    if (gradeFilterExam !== 'all') list = list.filter(e => e.gradeLevel === gradeFilterExam);
    if (statusFilterExam !== 'all') list = list.filter(e => (statusFilterExam === 'active') === e.isActive);
    return list;
  }, [exams, searchExam, gradeFilterExam, statusFilterExam]);

  const examGrades = useMemo(() => [...new Set(exams.map(e => e.gradeLevel).filter(Boolean))].sort(), [exams]);

  const { paginated: paginatedExams, totalPages: examTotalPages, safePage: examSafePage, totalItems: examTotal } = usePaginationSlice(filteredExams, examPage, EXAMS_PER_PAGE);
  const resetExamPage = () => setExamPage(1);

  // Filtered readiness â€” show exam registrations & results
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
        <button onClick={() => setDetailId(null)} className="mb-4 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">â† Back to Exam List</button>
        <div className="lpu-card p-6 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-forest-500">{exam.title}</h2>
              <Badge className={exam.isActive ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-500'}>{exam.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(exam)} className="bg-[#166534] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#14532d]">âœï¸ Edit</button>
              <button onClick={async () => { try { await updateExam(exam.id, { isActive: !exam.isActive }); refetch(); } catch (err) { showToast('Failed to update exam.', 'error'); } }} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">{exam.isActive ? 'Deactivate' : 'Activate'}</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DetailField label="Grade Level" v={exam.gradeLevel} /><DetailField label="Duration" v={`${exam.durationMinutes} minutes`} />
            <DetailField label="Passing Score" v={`${exam.passingScore}%`} /><DetailField label="Questions" v={exam.questions.length} />
            <DetailField label="Schedules" v={eSched.length} /><DetailField label="Registrations" v={`${eRegs.length} (${completed} completed)`} />
          </div>
        </div>
        <div className="lpu-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-4">Questions ({exam.questions.length})</h3>
          <div className="space-y-3">
            {exam.questions.map((q, i) => (
              <QuestionCard key={q.id} q={q} i={i} />
            ))}
            {exam.questions.length === 0 && <p className="text-gray-400 text-center py-6">No questions in this exam.</p>}
          </div>
        </div>

        {/* Registered Students */}
        <div className="lpu-card p-6 mt-4">
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
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="All Exams" subtitle="View and manage created exams." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="ðŸ“" value={exams.length} label="Total Exams" color="blue" />
        <StatCard icon="ðŸ“…" value={schedules.length} label="Schedules" color="emerald" />
        <StatCard icon="ðŸ‘¥" value={regs.length} label="Registrations" color="amber" />
        <StatCard icon="âœ…" value={regs.filter(r => r.status === 'done').length} label="Completed" color="amber" />
      </div>

      {/* Exams filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input value={searchExam} onChange={e => { setSearchExam(e.target.value); resetExamPage(); }} placeholder="Search examsâ€¦" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none text-sm" />
        <select value={gradeFilterExam} onChange={e => { setGradeFilterExam(e.target.value); resetExamPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white text-sm">
          <option value="all">All Grades</option>
          {examGrades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={statusFilterExam} onChange={e => { setStatusFilterExam(e.target.value); resetExamPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white text-sm">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="lpu-card p-4 mb-6">
        {paginatedExams.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs">
                  <th scope="col" className="py-3 px-2">ID</th><th scope="col" className="py-3 px-2">Title</th><th scope="col" className="py-3 px-2">Grade</th>
                  <th scope="col" className="py-3 px-2">Duration</th><th scope="col" className="py-3 px-2">Questions</th><th scope="col" className="py-3 px-2">Passing</th>
                  <th scope="col" className="py-3 px-2">Status</th><th scope="col" className="py-3 px-2">Actions</th>
                </tr></thead>
                <tbody>
                  {paginatedExams.map(e => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2 text-gray-400">{e.id}</td>
                      <td className="py-3 px-2 font-medium text-forest-500">{e.title}</td>
                      <td className="py-3 px-2">{e.gradeLevel}</td>
                      <td className="py-3 px-2">{e.durationMinutes} min</td>
                      <td className="py-3 px-2">{e.questions.length}</td>
                      <td className="py-3 px-2">{e.passingScore}%</td>
                      <td className="py-3 px-2"><Badge className={e.isActive ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-500'}>{e.isActive ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          <button onClick={() => setDetailId(e.id)} className="text-[#166534] hover:underline text-xs">View</button>
                          <button onClick={async () => { try { await updateExam(e.id, { isActive: !e.isActive }); refetch(); } catch (err) { showToast('Failed to update exam.', 'error'); } }} className="text-gray-500 hover:underline text-xs">{e.isActive ? 'Deactivate' : 'Activate'}</button>
                          <button onClick={async () => { if (await confirm({ title: 'Delete Exam', message: 'Are you sure you want to delete this exam? This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' })) { try { await deleteExam(e.id); refetch(); } catch (err) { showToast('Failed to delete exam.', 'error'); } } }} className="text-red-500 hover:underline text-xs">Delete</button>
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
          <EmptyState icon="ðŸ“" title="No exams found" text="No exams match your filters." />
        )}
      </div>

      {/* Readiness */}
      <div className="lpu-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Exam Registrations & Results</h3>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input value={readSearch} onChange={e => { setReadSearch(e.target.value); resetReadPage(); }} placeholder="Search studentâ€¦" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none text-sm" />
          <select value={readStatusFilter} onChange={e => { setReadStatusFilter(e.target.value); resetReadPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white text-sm">
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
                      <td className="py-3 px-2">{r.result ? `${r.result.totalScore}/${r.result.maxPossible} (${r.result.percentage.toFixed(1)}%)` : 'â€”'}</td>
                      <td className="py-3 px-2">{r.result ? <Badge className={r.result.passed ? 'bg-forest-100 text-forest-700' : 'bg-red-100 text-red-700'}>{r.result.passed ? 'Passed' : (r.result.essayReviewed ? 'Failed' : 'Pending Review')}</Badge> : <Badge className="bg-gray-100 text-gray-500">Awaiting</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={readSafePage} totalPages={readTotalPages} onPageChange={setReadPage} totalItems={readTotal} itemsPerPage={READINESS_PER_PAGE} />
          </>
        ) : (
          <EmptyState icon="ðŸ“‹" title="No registrations found" text="No exam registrations match your filters." />
        )}
      </div>
    </div>
  );
}

/* ===== Upload Questionnaire Parser ===== */
function parseCSVQuestions(text) {
  // CSV format: type,question,points,choiceA,choiceB,choiceC,choiceD,correct
  // For essay: essay,question,points
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.toLowerCase().startsWith('type'));
  const parsed = [];
  let errs = 0;
  for (const line of lines) {
    // Handle quoted CSV fields properly
    const cols = [];
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

function parseJSONQuestions(text) {
  const raw = JSON.parse(text);
  const items = Array.isArray(raw) ? raw : raw.questions || [];
  const parsed = [];
  let errs = 0;
  for (const item of items) {
    const type = (item.type || item.questionType || '').toLowerCase();
    const qText = item.question || item.questionText || '';
    const pts = parseInt(item.points) || 1;
    if (!qText) { errs++; continue; }
    if (type === 'essay') {
      parsed.push({ id: uid(), questionText: qText, questionType: 'essay', points: pts, orderNum: parsed.length + 1, choices: [] });
    } else if (type === 'mc' || type === 'multiple choice' || type === 'multiple_choice') {
      const rawChoices = item.choices || item.options || [];
      if (rawChoices.length < 2) { errs++; continue; }
      const correctVal = item.correct ?? item.answer ?? 0;
      const choices = rawChoices.map((c, i) => {
        const text = typeof c === 'string' ? c : (c.text || c.choiceText || '');
        const isCorrect = typeof c === 'object' ? !!c.isCorrect : (typeof correctVal === 'number' ? i === correctVal : String(correctVal).toUpperCase() === String.fromCharCode(65 + i));
        return { id: uid(), choiceText: text, isCorrect };
      });
      parsed.push({ id: uid(), questionText: qText, questionType: 'mc', points: pts, orderNum: parsed.length + 1, choices });
    } else { errs++; }
  }
  return { parsed, errs };
}

function downloadTemplate(format) {
  let content, mime, filename;
  if (format === 'csv') {
    content = 'type,question,points,choiceA,choiceB,choiceC,choiceD,correct\nmc,What is 2 + 2?,2,3,4,5,6,B\nmc,"Which planet is closest to the Sun?",3,Venus,Mercury,Earth,Mars,B\nessay,Explain the importance of education in society.,5,,,,,\n';
    mime = 'text/csv';
    filename = 'exam_template.csv';
  } else {
    content = JSON.stringify([
      { type: 'mc', question: 'What is 2 + 2?', points: 2, choices: ['3', '4', '5', '6'], correct: 1 },
      { type: 'mc', question: 'Which planet is closest to the Sun?', points: 3, choices: [{ text: 'Venus', isCorrect: false }, { text: 'Mercury', isCorrect: true }, { text: 'Earth', isCorrect: false }, { text: 'Mars', isCorrect: false }] },
      { type: 'essay', question: 'Explain the importance of education in society.', points: 5 },
    ], null, 2);
    mime = 'application/json';
    filename = 'exam_template.json';
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ===== EXAM BUILDER ===== */
function ExamBuilder({ editExam, onDone }) {
  const [title, setTitle] = useState(editExam?.title || '');
  const [grade, setGrade] = useState(editExam?.gradeLevel || '');
  const [duration, setDuration] = useState(editExam?.durationMinutes || '');
  const [passing, setPassing] = useState(editExam?.passingScore || '');
  const [questions, setQuestions] = useState(editExam ? JSON.parse(JSON.stringify(editExam.questions)) : []);
  const [qModal, setQModal] = useState(null); // null | 'mc' | 'essay'
  const [qText, setQText] = useState('');
  const [qPts, setQPts] = useState('');
  const [choices, setChoices] = useState([{ text: '', correct: true }, { text: '' }, { text: '' }, { text: '' }]);
  const [uploadPreview, setUploadPreview] = useState(null); // { parsed, errs, fileName }
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);

  const isDirty = !!(title || questions.length > 0);
  const { clear } = useUnsavedChanges(isDirty);

  const moveQuestion = (fromIdx, toIdx) => {
    setQuestions(qs => {
      const arr = [...qs];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr.map((q, i) => ({ ...q, orderNum: i + 1 }));
    });
  };

  const openQ = (type) => {
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
    const q = { id: uid(), questionText: qText, questionType: qModal, points: pts, orderNum: questions.length + 1, choices: [] };
    if (qModal === 'mc') {
      q.choices = choices.filter(c => c.text.trim()).map((c, i) => ({ id: uid(), choiceText: c.text, isCorrect: !!c.correct }));
    }
    setQuestions([...questions, q]);
    setQModal(null);
    showToast('Question added!', 'success');
  };

  /* ===== File Upload Handler ===== */
  const handleUploadFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['json', 'csv'].includes(ext)) {
      showToast('Unsupported file type. Please upload a .csv or .json file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const { parsed, errs } = ext === 'json' ? parseJSONQuestions(text) : parseCSVQuestions(text);
        if (parsed.length === 0) {
          showToast('No valid questions found in file. Check the format.', 'error');
          return;
        }
        setUploadPreview({ parsed, errs, fileName: file.name });
      } catch (err) {
        showToast(`Failed to parse file: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const confirmUpload = (mode) => {
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
    if (!title || !grade || !duration || !passing) { showToast('Fill in all exam details.', 'error'); return; }
    if (questions.length === 0) { showToast('Add at least one question.', 'error'); return; }
    try {
      if (editExam) {
        await updateExam(editExam.id, { title, gradeLevel: grade, durationMinutes: parseInt(duration), passingScore: parseInt(passing), questions });
        showToast('Exam updated!', 'success');
      } else {
        await addExam({ title, gradeLevel: grade, durationMinutes: parseInt(duration), passingScore: parseInt(passing), questions });
        showToast('Exam created!', 'success');
      }
      onDone();
    } catch (err) {
      showToast('Failed to save exam.', 'error');
    }
  };

  const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);
  const mcCount = questions.filter(q => q.questionType === 'mc').length;
  const essayCount = questions.filter(q => q.questionType === 'essay').length;

  return (
    <div>
      <PageHeader title={editExam ? 'Edit Exam' : 'Create New Exam'} subtitle="Set up exam details and add questions manually or upload a file." />
      <div className="lpu-card p-6 mb-4">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Exam Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput label="Exam Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Entrance Exam - Grade 7" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white">
              <option value="">Select grade level</option>
              <option>Grade 7-10</option><option>Grade 11-12</option><option>All Levels</option>
            </select>
          </div>
          <FormInput label="Duration (minutes)" type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="60" />
          <FormInput label="Passing Score (%)" type="number" value={passing} onChange={e => setPassing(e.target.value)} placeholder="60" />
        </div>
      </div>

      {/* Upload Questionnaire Section */}
      <div className="lpu-card p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-forest-500">ðŸ“¤ Upload Questionnaire</h3>
            <p className="text-gray-500 text-sm mt-0.5">Import questions from a CSV or JSON file to quickly build your exam.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => downloadTemplate('csv')} className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1">ðŸ“„ CSV Template</button>
            <button onClick={() => downloadTemplate('json')} className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1">ðŸ“„ JSON Template</button>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-gold-400 bg-gold-50' : 'border-gray-300 hover:border-gold-300 hover:bg-gray-50'}`}
          onClick={() => document.getElementById('questionnaire-upload').click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]); }}
        >
          <div className="text-3xl mb-2">ðŸ“</div>
          <p className="text-gray-600 font-medium">Drag & drop your questionnaire file here</p>
          <p className="text-gray-400 text-sm mt-1">or <span className="text-[#166534] font-medium underline">click to browse</span></p>
          <p className="text-xs text-gray-400 mt-2">Supported formats: .csv, .json</p>
        </div>
        <input id="questionnaire-upload" type="file" accept=".csv,.json" className="hidden" onChange={e => { if (e.target.files[0]) handleUploadFile(e.target.files[0]); e.target.value = ''; }} />

        {/* Format Guide */}
        <details className="mt-4 group">
          <summary className="text-sm text-forest-500 font-medium cursor-pointer hover:underline select-none">â„¹ï¸ How to format your file</summary>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-forest-500 text-sm mb-2">CSV Format</h4>
              <p className="text-xs text-gray-500 mb-2">Columns: type, question, points, choiceA, choiceB, choiceC, choiceD, correct</p>
              <pre className="text-xs bg-white rounded p-2 border border-gray-200 overflow-x-auto whitespace-pre-wrap text-gray-600">
{`mc,What is 2+2?,2,3,4,5,6,B
essay,Explain photosynthesis.,5`}
              </pre>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-forest-500 text-sm mb-2">JSON Format</h4>
              <p className="text-xs text-gray-500 mb-2">Array of question objects with type, question, points, choices, correct</p>
              <pre className="text-xs bg-white rounded p-2 border border-gray-200 overflow-x-auto whitespace-pre-wrap text-gray-600">
{`[
  { "type": "mc", "question": "...",
    "points": 2, "choices": ["A","B","C","D"],
    "correct": 1 },
  { "type": "essay", "question": "...",
    "points": 5 }
]`}
              </pre>
            </div>
          </div>
        </details>
      </div>

      {/* Upload Preview Modal */}
      <Modal open={!!uploadPreview} onClose={() => setUploadPreview(null)}>
        {uploadPreview && (
          <div>
            <h3 className="text-lg font-bold text-forest-500 mb-2">ðŸ“‹ Import Preview</h3>
            <p className="text-gray-500 text-sm mb-4">File: <span className="font-medium text-forest-500">{uploadPreview.fileName}</span></p>

            {/* Summary */}
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
              <p className="text-sm text-red-500 mb-3">âš ï¸ {uploadPreview.errs} row(s) were skipped due to formatting errors.</p>
            )}

            {/* Preview list */}
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4 border border-gray-100 rounded-lg p-3 bg-gray-50">
              {uploadPreview.parsed.map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="bg-forest-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 mt-0.5">Q{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={q.questionType === 'mc' ? 'bg-forest-100 text-forest-700' : 'bg-gold-100 text-gold-700'}>{q.questionType === 'mc' ? 'MC' : 'Essay'}</Badge>
                      <span className="text-gray-400 text-xs">{q.points} pts</span>
                    </div>
                    <p className="text-gray-700 truncate">{q.questionText}</p>
                    {q.questionType === 'mc' && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {q.choices.map((c, j) => (
                          <span key={j} className={`text-xs px-1.5 py-0.5 rounded ${c.isCorrect ? 'bg-forest-100 text-forest-700 font-medium' : 'bg-gray-100 text-gray-500'}`}>
                            {String.fromCharCode(65 + j)}. {c.choiceText}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            {questions.length > 0 ? (
              <div>
                <p className="text-sm text-gray-500 mb-3">You already have <strong>{questions.length}</strong> question(s). How would you like to import?</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => confirmUpload('append')} className="bg-[#166534] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#14532d]">âž• Add to Existing</button>
                  <button onClick={() => confirmUpload('replace')} className="bg-forest-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-forest-600">ðŸ”„ Replace All</button>
                  <button onClick={() => setUploadPreview(null)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => confirmUpload('replace')} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600">âœ… Import Questions</button>
                <button onClick={() => setUploadPreview(null)} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Questions Section */}
      <div className="lpu-card p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-forest-500">Questions ({questions.length})</h3>
            {questions.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{mcCount} MC Â· {essayCount} Essay Â· {totalPoints} total pts</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => openQ('mc')} className="bg-[#166534] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#14532d]">+ Multiple Choice</button>
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
                  <button onClick={() => { if (i > 0) moveQuestion(i, i - 1); }} disabled={i === 0} className="text-gray-400 hover:text-forest-500 disabled:opacity-30 text-xs px-1" aria-label={`Move question ${i + 1} up`}>â–²</button>
                  <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-forest-500 px-1 select-none text-lg" title="Drag to reorder">â —</div>
                  <button onClick={() => { if (i < questions.length - 1) moveQuestion(i, i + 1); }} disabled={i === questions.length - 1} className="text-gray-400 hover:text-forest-500 disabled:opacity-30 text-xs px-1" aria-label={`Move question ${i + 1} down`}>â–¼</button>
                </div>
                <div className="flex-1">
                  <QuestionCard q={q} i={i} />
                </div>
                <button onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs bg-white rounded px-2 py-1 border border-red-200">Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="ðŸ“" title="No Questions Added" text="Upload a questionnaire file above, or click the buttons to add questions manually." />
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={saveExam} className="bg-forest-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-forest-600 shadow-md">ðŸ’¾ Save Exam</button>
        <button onClick={onDone} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50">Cancel</button>
      </div>

      {/* Question Modal */}
      <Modal open={!!qModal} onClose={() => setQModal(null)}>
        <h3 className="text-lg font-bold text-forest-500 mb-4">{qModal === 'mc' ? 'Add Multiple Choice Question' : 'Add Essay Question'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
            <textarea value={qText} onChange={e => setQText(e.target.value)} placeholder="Enter your question..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none min-h-[80px]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
            <input type="number" value={qPts} onChange={e => setQPts(e.target.value)} placeholder="5" className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" />
          </div>
          {qModal === 'mc' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Choices (select correct)</label>
              <div className="space-y-2">
                {choices.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correctChoice" checked={!!c.correct} onChange={() => setChoices(cs => cs.map((cc, j) => ({ ...cc, correct: j === i })))} className="accent-[#166534]" />
                    <input type="text" value={c.text} onChange={e => setChoices(cs => cs.map((cc, j) => j === i ? { ...cc, text: e.target.value } : cc))} placeholder={`Choice ${i + 1}`} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none text-sm" />
                    {choices.length > 2 && <button onClick={() => setChoices(cs => cs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">âœ•</button>}
                  </div>
                ))}
              </div>
              {choices.length < 6 && <button onClick={() => setChoices(cs => [...cs, { text: '' }])} className="mt-2 text-gold-500 text-sm font-medium">+ Add Choice</button>}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={addQuestion} className="bg-[#166534] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#14532d]">Add Question</button>
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
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ examId: '', date: '', start: '', end: '', slots: '' });
  const [schedSearch, setSchedSearch] = useState('');
  const [schedExamFilter, setSchedExamFilter] = useState('all');
  const [schedPage, setSchedPage] = useState(1);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const { data: schedData, loading: schedLoading, error: schedError, refetch: schedRefetch } = useAsync(async () => {
    const [exams, allSchedules] = await Promise.all([getExams(), getExamSchedules()]);
    return { exams, allSchedules };
  });

  const exams = schedData?.exams || [];
  const allSchedules = schedData?.allSchedules || [];

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate exam has questions
    if (form.examId) {
      const selectedExam = exams.find(ex => String(ex.id) === String(form.examId));
      if (selectedExam && (!selectedExam.questions || selectedExam.questions.length === 0)) {
        showToast('Cannot schedule an exam with zero questions. Add questions first.', 'error');
        return;
      }
    }
    // Validate end time > start time
    if (form.start && form.end && form.start >= form.end) {
      showToast('End time must be after start time.', 'error');
      return;
    }
    // Validate date is not in the past (for new schedules)
    if (!editId && form.date) {
      const today = new Date().toISOString().split('T')[0];
      if (form.date < today) {
        showToast('Schedule date cannot be in the past.', 'error');
        return;
      }
    }
    const data = { examId: parseInt(form.examId), scheduledDate: form.date, startTime: form.start, endTime: form.end, maxSlots: parseInt(form.slots) };
    try {
      if (editId) { await updateExamSchedule(editId, data); showToast('Schedule updated!', 'success'); setEditId(null); }
      else { await addExamSchedule(data); showToast('Schedule added!', 'success'); }
    } catch (err) {
      showToast('Failed to save schedule.', 'error');
    }
    setForm({ examId: '', date: '', start: '', end: '', slots: '' });
    schedRefetch();
  };

  const editSched = (s) => { setEditId(s.id); setForm({ examId: String(s.examId), date: s.scheduledDate, start: s.startTime, end: s.endTime, slots: String(s.maxSlots) }); };

  if (schedLoading) return <SkeletonPage />;
  if (schedError) return <div className="lpu-card p-8 text-center"><p className="text-red-600 font-medium">Failed to load schedules.</p><button onClick={schedRefetch} className="mt-2 text-[#166534] underline text-sm">Retry</button></div>;

  return (
    <div>
      <PageHeader title="Exam Schedules" subtitle="Create and manage exam date/time slots." />
      <div className="lpu-card p-6 mb-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">{editId ? 'Edit Schedule' : 'Add New Schedule'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam</label>
            <select value={form.examId} onChange={set('examId')} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white">
              <option value="">Select exam</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
          <FormInput label="Date" type="date" value={form.date} onChange={set('date')} required />
          <FormInput label="Start Time" type="time" value={form.start} onChange={set('start')} required />
          <FormInput label="End Time" type="time" value={form.end} onChange={set('end')} required />
          <FormInput label="Max Applicants" type="number" value={form.slots} onChange={set('slots')} placeholder="30" required />
          <div className="flex items-end">
            <button type="submit" className="bg-[#166534] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#14532d]">{editId ? 'Update Schedule' : 'Add Schedule'}</button>
          </div>
        </form>
      </div>

      <div className="lpu-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Current Schedules</h3>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input value={schedSearch} onChange={e => { setSchedSearch(e.target.value); resetSchedPage(); }} placeholder="Search by exam or dateâ€¦" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none text-sm" />
          <select value={schedExamFilter} onChange={e => { setSchedExamFilter(e.target.value); resetSchedPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white text-sm">
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
                    <Badge className="bg-forest-100 text-forest-700">{s.slotsTaken} / {s.maxSlots} booked</Badge>
                    <Badge className={remaining > 0 ? 'bg-forest-100 text-forest-700' : 'bg-red-100 text-red-700'}>{remaining > 0 ? `${remaining} slots left` : 'Full'}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editSched(s)} className="text-[#166534] hover:underline text-xs">âœï¸ Edit</button>
                  <button onClick={async () => { if (await confirm({ title: 'Delete Schedule', message: 'Are you sure you want to delete this schedule?', confirmLabel: 'Delete', variant: 'danger' })) { try { await deleteExamSchedule(s.id); schedRefetch(); } catch (err) { showToast('Failed to delete schedule.', 'error'); } } }} className="text-red-500 hover:underline text-xs">ðŸ—‘ Delete</button>
                </div>
              </div>
            );
          })}
          {paginatedScheds.length === 0 && <EmptyState icon="ðŸ“…" title="No schedules" text="No schedules match your filters." />}
        </div>
        <Pagination currentPage={schedSafePage} totalPages={schedTotalPages} onPageChange={setSchedPage} totalItems={schedTotal} itemsPerPage={SCHED_PER_PAGE} />
      </div>
    </div>
  );
}

/* ===== Shared sub-components ===== */
function DetailField({ label, v }) { return <div><span className="block text-xs text-gray-400 uppercase tracking-wide">{label}</span><span className="text-sm text-forest-500 font-medium">{String(v)}</span></div>; }
function FormInput({ label, required, ...props }) { return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label><input {...props} required={required} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" /></div>; }

function QuestionCard({ q, i }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="bg-forest-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">Q{i + 1}</span>
        <Badge className={q.questionType === 'mc' ? 'bg-forest-100 text-forest-700' : 'bg-gold-100 text-gold-700'}>{q.questionType === 'mc' ? 'Multiple Choice' : 'Essay'}</Badge>
        <span className="text-xs text-gray-400 ml-auto">{q.points} pts</span>
      </div>
      <p className="text-forest-500 font-medium text-sm mb-2">{q.questionText}</p>
      {q.questionType === 'mc' ? (
        <div className="space-y-1">
          {q.choices.map(c => (
            <div key={c.id} className={`text-sm px-2 py-1 rounded ${c.isCorrect ? 'bg-forest-50 text-forest-700 font-medium' : 'text-gray-500'}`}>
              {c.isCorrect ? 'âœ“' : 'â—‹'} {c.choiceText}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm italic">ðŸ“ Essay response required</p>
      )}
    </div>
  );
}
