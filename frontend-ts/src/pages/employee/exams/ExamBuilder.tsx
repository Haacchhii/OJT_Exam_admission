import { useState, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { addExam, updateExam, getExam } from '../../../api/exams';
import { getAcademicYears, getSemesters } from '../../../api/academicYears';
import { showToast } from '../../../components/Toast';
import Modal from '../../../components/Modal';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { GRADE_OPTIONS } from '../../../utils/constants';
import { PageHeader, Badge, EmptyState, SkeletonPage } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { uid } from '../../../utils/helpers';
import { parseCSVQuestions, parseJSONQuestions, parseExcelQuestions, downloadTemplate } from './examParsers';
import { FormInput, QuestionCard } from './ExamComponents';
import type { ParsedQuestion, UploadPreview, ChoiceState } from './types';
import type { Exam, AcademicYear, Semester } from '../../../types';

export default function ExamBuilder({ editExam, onDone }: { editExam: Exam | null; onDone: () => void }) {
  const examGradeGroups = [...GRADE_OPTIONS, { group: 'General', items: ['All Levels'] }];
  const detectExamStage = (gradeLevel: string) => examGradeGroups.find(g => g.items.includes(gradeLevel))?.group || '';

  const [title, setTitle] = useState(editExam?.title || '');
  const [grade, setGrade] = useState(editExam?.gradeLevel || '');
  const [gradeStage, setGradeStage] = useState(detectExamStage(editExam?.gradeLevel || ''));
  const [duration, setDuration] = useState<string | number>(editExam?.durationMinutes || '');
  const [passing, setPassing] = useState<string | number>(editExam?.passingScore || '');
  const [yearId, setYearId] = useState<string | number>(editExam?.academicYear?.id || '');
  const [semId, setSemId] = useState<string | number>(editExam?.semester?.id || '');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [qModal, setQModal] = useState<'mc' | 'essay' | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [qText, setQText] = useState('');
  const [qPts, setQPts] = useState('');
  const [choices, setChoices] = useState<ChoiceState[]>([{ text: '', correct: true }, { text: '' }, { text: '' }, { text: '' }]);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch full exam details (with questions) when editing
  const { data: fullExam, loading: examLoading } = useAsync<Exam | null>(
    () => editExam ? getExam(editExam.id) : Promise.resolve(null),
    [editExam?.id]
  );

  // Populate questions from the full exam once loaded
  useEffect(() => {
    if (fullExam?.questions) {
      setQuestions(JSON.parse(JSON.stringify(fullExam.questions)));
    }
  }, [fullExam]);

  const { data: years } = useAsync<AcademicYear[]>(() => getAcademicYears());
  const { data: allSems } = useAsync<Semester[]>(() => getSemesters());
  const semesterOptions = (allSems || []).filter(s => !yearId || s.academicYearId === Number(yearId));
  const selectedExamGroup = examGradeGroups.find(g => g.group === gradeStage);

  useEffect(() => {
    if (!gradeStage) return;
    const validInStage = examGradeGroups.find(g => g.group === gradeStage)?.items || [];
    if (grade && !validInStage.includes(grade)) {
      setGrade('');
    }
  }, [gradeStage, grade]);

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
    setEditIdx(null);
    setQModal(type);
    setQText('');
    setQPts('');
    setChoices([{ text: '', correct: true }, { text: '' }, { text: '' }, { text: '' }]);
  };

  const openEditQ = (idx: number) => {
    const q = questions[idx];
    setEditIdx(idx);
    setQModal(q.questionType as 'mc' | 'essay');
    setQText(q.questionText);
    setQPts(String(q.points));
    if (q.questionType === 'mc' && q.choices?.length) {
      setChoices(q.choices.map((c: any) => ({ text: c.choiceText, correct: !!c.isCorrect })));
    } else {
      setChoices([{ text: '', correct: true }, { text: '' }, { text: '' }, { text: '' }]);
    }
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
    const newQ: ParsedQuestion = {
      id: editIdx !== null ? questions[editIdx].id : uid(),
      questionText: qText,
      questionType: qModal!,
      points: pts,
      orderNum: editIdx !== null ? questions[editIdx].orderNum : questions.length + 1,
      choices: [],
    };
    if (qModal === 'mc') {
      newQ.choices = choices.filter(c => c.text.trim()).map(c => ({ id: uid(), choiceText: c.text, isCorrect: !!c.correct }));
    }
    if (editIdx !== null) {
      setQuestions(qs => qs.map((q, i) => i === editIdx ? newQ : q));
      showToast('Question updated!', 'success');
    } else {
      setQuestions([...questions, newQ]);
      showToast('Question added!', 'success');
    }
    setQModal(null);
    setEditIdx(null);
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

  if (editExam && examLoading && !fullExam) return <SkeletonPage />;

  return (
    <div>
      <PageHeader title={editExam ? 'Edit Exam' : 'Create New Exam'} subtitle="Set up exam details and add questions manually or upload a file." />
      <div className="gk-section-card p-6 mb-4">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Exam Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput label="Exam Title" value={title} onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="e.g. Entrance Exam - Grade 7" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Stage</label>
            <select value={gradeStage} onChange={e => setGradeStage(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
              <option value="">Select stage</option>
              {examGradeGroups.map(g => <option key={g.group} value={g.group}>{g.group}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} disabled={!gradeStage} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">{gradeStage ? 'Select grade level' : 'Select stage first'}</option>
              {(selectedExamGroup?.items || []).map(g => <option key={g} value={g}>{g}</option>)}
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
      <div className="gk-section-card p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-forest-500 flex items-center gap-1.5"><Icon name="upload" className="w-5 h-5" /> Upload Questionnaire</h3>
            <p className="text-gray-500 text-sm mt-0.5">Import questions from a CSV, Excel, or JSON file to quickly build your exam.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => downloadTemplate('csv')} className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1 font-medium" title="Download a sample CSV file to use as a template"><Icon name="document" className="w-3.5 h-3.5" /> CSV Sample</button>
            <button onClick={() => downloadTemplate('excel')} className="text-xs border border-forest-300 text-forest-700 bg-forest-50 px-2.5 py-1.5 rounded-lg hover:bg-forest-100 flex items-center gap-1 font-medium" title="Download a sample Excel file to use as a template"><Icon name="document" className="w-3.5 h-3.5" /> Excel Sample</button>
            <button onClick={() => downloadTemplate('json')} className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1 font-medium" title="Download a sample JSON file to use as a template"><Icon name="document" className="w-3.5 h-3.5" /> JSON Sample</button>
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
          <p className="text-xs text-gray-400 mt-2">Supported: .xlsx (Excel) | .csv | .json</p>
        </div>
        <input id="questionnaire-upload" type="file" accept=".csv,.json,.xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUploadFile(e.target.files[0]); e.target.value = ''; }} />

        <details className="mt-4 group border border-amber-200 rounded-lg p-4 bg-amber-50">
          <summary className="text-sm text-amber-800 font-bold cursor-pointer select-none flex items-center gap-2"><Icon name="info" className="w-4 h-4" /> 📋 Format Guide & Template Samples</summary>
          <div className="mt-4 pt-4 border-t border-amber-200">
            <p className="text-xs text-amber-700 mb-3 font-medium">Download sample files below to see the expected format, then edit them with your questions:</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-forest-500 text-sm mb-1 flex items-center gap-1"><Icon name="document" className="w-4 h-4" /> CSV / Excel Format</h4>
              <p className="text-xs text-gray-500 mb-2">8 columns - same structure for both .csv and .xlsx</p>
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
                    <tr><td className="border border-gray-200 px-1.5 py-1 text-purple-600">essay</td><td className="border border-gray-200 px-1.5 py-1">Explain photosynthesis.</td><td className="border border-gray-200 px-1.5 py-1">5</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">- <strong>type:</strong> <code>mc</code> or <code>essay</code></p>
              <p className="text-xs text-gray-400">- <strong>correct:</strong> A / B / C / D (or 1 / 2 / 3 / 4)</p>
              <p className="text-xs text-gray-400">- Leave choiceA-D and correct blank for essay rows</p>
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
              <p className="text-xs text-gray-400 mt-2">- <strong>correct:</strong> 0-based index <em>or</em> letter A-D</p>
              <p className="text-xs text-gray-400">- choices can be strings or <code>{'{text, isCorrect}'}</code> objects</p>
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
              <p className="text-sm text-red-500 mb-3">Warning: {uploadPreview.errs} row(s) were skipped due to formatting errors.</p>
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
      <div className="gk-section-card p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-forest-500">Questions ({questions.length})</h3>
            {questions.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{mcCount} MC | {essayCount} Essay | {totalPoints} total pts</p>
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
                  <button onClick={() => { if (i > 0) moveQuestion(i, i - 1); }} disabled={i === 0} className="text-gray-400 hover:text-forest-500 disabled:opacity-30 text-xs px-1" aria-label={`Move question ${i + 1} up`}>^</button>
                  <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-forest-500 px-1 select-none text-lg" title="Drag to reorder">::</div>
                  <button onClick={() => { if (i < questions.length - 1) moveQuestion(i, i + 1); }} disabled={i === questions.length - 1} className="text-gray-400 hover:text-forest-500 disabled:opacity-30 text-xs px-1" aria-label={`Move question ${i + 1} down`}>v</button>
                </div>
                <div className="flex-1">
                  <QuestionCard q={q} i={i} />
                </div>
                <button onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs bg-white rounded px-2 py-1 border border-red-200">Remove</button>
                <button onClick={() => openEditQ(i)} className="absolute top-2 right-[70px] text-forest-500 hover:text-forest-700 text-xs bg-white rounded px-2 py-1 border border-forest-200">Edit</button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="documentText" title="No Questions Added" text="Upload a questionnaire file above, or click the buttons to add questions manually." />
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={saveExam} disabled={isSaving} className="bg-forest-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-forest-600 shadow-md inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed">
          {isSaving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : <><Icon name="check" className="w-4 h-4" /> Save Exam</>}
        </button>
        <button onClick={onDone} disabled={isSaving} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
      </div>

      {/* Question Modal */}
      <Modal open={!!qModal} onClose={() => { setQModal(null); setEditIdx(null); }}>
        <h3 className="text-lg font-bold text-forest-500 mb-4">
          {editIdx !== null
            ? (qModal === 'mc' ? 'Edit Multiple Choice Question' : 'Edit Essay Question')
            : (qModal === 'mc' ? 'Add Multiple Choice Question' : 'Add Essay Question')}
        </h3>
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
                    {choices.length > 2 && <button onClick={() => setChoices(cs => cs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">X</button>}
                  </div>
                ))}
              </div>
              {choices.length < 6 && <button onClick={() => setChoices(cs => [...cs, { text: '' }])} className="mt-2 text-gold-500 text-sm font-medium">+ Add Choice</button>}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={addQuestion} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600">
              {editIdx !== null ? 'Update Question' : 'Add Question'}
            </button>
            <button onClick={() => { setQModal(null); setEditIdx(null); }} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
