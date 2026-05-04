import { useState, useEffect, useRef, type ChangeEvent, type DragEvent } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { addExam, updateExam, getExam } from '../../../api/exams';
import { getAcademicYears, getSemesters, getActivePeriod } from '../../../api/academicYears';
import { showToast } from '../../../components/Toast';
import Modal from '../../../components/Modal';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { GRADE_OPTIONS } from '../../../utils/constants';
import { PageHeader, Badge, EmptyState, SkeletonPage } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { uid } from '../../../utils/helpers';
import { FormInput, QuestionCard } from './ExamComponents';
import type { ParsedQuestion, UploadPreview, ChoiceState } from './types';
import type { Exam, AcademicYear, Semester } from '../../../types';

type BuilderQuestionType = 'mc' | 'essay' | 'identification' | 'true_false';

let examParsersModulePromise: Promise<typeof import('./examParsers')> | null = null;

function loadExamParsersModule() {
  if (!examParsersModulePromise) {
    examParsersModulePromise = import('./examParsers');
  }
  return examParsersModulePromise;
}

function questionTypeLabel(type: BuilderQuestionType) {
  if (type === 'mc') return 'Multiple Choice';
  if (type === 'essay') return 'Essay';
  if (type === 'identification') return 'Identification';
  return 'True / False';
}

export default function ExamBuilder({ editExam, onDone }: { editExam: Exam | null; onDone: () => void }) {
  const examGradeGroups = [
    ...GRADE_OPTIONS.filter((group) => group.group === 'Junior High School' || group.group === 'Senior High School'),
    { group: 'General', items: ['All Levels'] },
  ];
  const detectExamStage = (gradeLevel: string) => examGradeGroups.find(g => g.items.includes(gradeLevel))?.group || '';

  const [title, setTitle] = useState(editExam?.title || '');
  const [grade, setGrade] = useState(editExam?.gradeLevel || '');
  const [gradeStage, setGradeStage] = useState(detectExamStage(editExam?.gradeLevel || ''));
  const [duration, setDuration] = useState<string | number>(editExam?.durationMinutes || '');
  const [passing, setPassing] = useState<string | number>(editExam?.passingScore || '');
  const [yearId, setYearId] = useState<string | number>(editExam?.academicYear?.id || '');
  const [semId, setSemId] = useState<string | number>(editExam?.semester?.id || '');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [qModal, setQModal] = useState<BuilderQuestionType | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [qText, setQText] = useState('');
  const [qPts, setQPts] = useState('');
  const [choices, setChoices] = useState<ChoiceState[]>([{ text: '', correct: true }, { text: '' }, { text: '' }, { text: '' }]);
  const [identificationAnswer, setIdentificationAnswer] = useState('');
  const [identificationMatchMode, setIdentificationMatchMode] = useState<'exact' | 'partial'>('exact');
  const [trueFalseCorrect, setTrueFalseCorrect] = useState<'true' | 'false'>('true');
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadPreview[]>([]);
  const [uploadQueueIndex, setUploadQueueIndex] = useState(0);
  const [queuedExamTitle, setQueuedExamTitle] = useState('');
  const [lastAutoTitle, setLastAutoTitle] = useState('');
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

  const { data: years } = useAsync<AcademicYear[]>(() => getAcademicYears(), [], 0, {
    resourcePrefixes: ['/academic-years'],
  });
  const { data: allSems } = useAsync<Semester[]>(() => getSemesters(), [], 0, {
    resourcePrefixes: ['/academic-years'],
  });
  const { data: activePeriod } = useAsync(() => getActivePeriod(), [], 0, {
    resourcePrefixes: ['/academic-years'],
  });
  const semesterOptions = (allSems || []).filter(s => !yearId || s.academicYearId === Number(yearId));
  const selectedExamGroup = examGradeGroups.find(g => g.group === gradeStage);
  const appliedActivePeriodRef = useRef(false);

  useEffect(() => {
    if (editExam || appliedActivePeriodRef.current || !activePeriod) return;
    appliedActivePeriodRef.current = true;
    setYearId(activePeriod.id);
    const activeSemester = activePeriod.semesters?.find((semester) => semester.isActive) || null;
    if (activeSemester) {
      setSemId(activeSemester.id);
    }
  }, [activePeriod, editExam]);

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

  const openQ = (type: BuilderQuestionType) => {
    setEditIdx(null);
    setQModal(type);
    setQText('');
    setQPts('');
    setChoices([{ text: '', correct: true }, { text: '' }, { text: '' }, { text: '' }]);
    setIdentificationAnswer('');
    setIdentificationMatchMode('exact');
    setTrueFalseCorrect('true');
  };

  const openEditQ = (idx: number) => {
    const q = questions[idx];
    setEditIdx(idx);
    setQModal(q.questionType as BuilderQuestionType);
    setQText(q.questionText);
    setQPts(String(q.points));
    if ((q.questionType === 'mc' || q.questionType === 'true_false') && q.choices?.length) {
      setChoices(q.choices.map((c: any) => ({ text: c.choiceText, correct: !!c.isCorrect })));
      if (q.questionType === 'true_false') {
        const trueChoice = q.choices.find((c: any) => String(c.choiceText || '').trim().toLowerCase() === 'true');
        setTrueFalseCorrect(trueChoice?.isCorrect ? 'true' : 'false');
      }
    } else {
      setChoices([{ text: '', correct: true }, { text: '' }, { text: '' }, { text: '' }]);
    }
    if (q.questionType === 'identification') {
      setIdentificationAnswer(q.identificationAnswer || '');
      setIdentificationMatchMode(q.identificationMatchMode === 'partial' ? 'partial' : 'exact');
    } else {
      setIdentificationAnswer('');
      setIdentificationMatchMode('exact');
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
    if (qModal === 'identification' && !identificationAnswer.trim()) {
      showToast('Identification questions require a correct answer key.', 'error');
      return;
    }

    if (!qModal) {
      showToast('Please choose a question type.', 'error');
      return;
    }

    const newQ: ParsedQuestion = {
      id: editIdx !== null ? questions[editIdx].id : uid(),
      questionText: qText,
      questionType: qModal,
      points: pts,
      orderNum: editIdx !== null ? questions[editIdx].orderNum : questions.length + 1,
      choices: [],
    };
    if (qModal === 'mc') {
      newQ.choices = choices.filter(c => c.text.trim()).map(c => ({ id: uid(), choiceText: c.text, isCorrect: !!c.correct }));
    } else if (qModal === 'true_false') {
      newQ.choices = [
        { id: uid(), choiceText: 'True', isCorrect: trueFalseCorrect === 'true' },
        { id: uid(), choiceText: 'False', isCorrect: trueFalseCorrect === 'false' },
      ];
    } else if (qModal === 'identification') {
      newQ.identificationAnswer = identificationAnswer.trim();
      newQ.identificationMatchMode = identificationMatchMode;
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
    setIdentificationAnswer('');
    setIdentificationMatchMode('exact');
    setTrueFalseCorrect('true');
  };

  const suggestTitleFromFileName = (fileName: string) => {
    const noExt = fileName.replace(/\.[^/.]+$/, '');
    return noExt
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const maybeAutoFillTitle = (fileName: string) => {
    const suggested = suggestTitleFromFileName(fileName);
    if (!suggested) return;
    if (!title.trim() || title === lastAutoTitle) {
      setTitle(suggested);
      setLastAutoTitle(suggested);
    }
  };

  const parseQuestionFile = (file: File) => new Promise<{ parsed: ParsedQuestion[]; errs: number; fileName: string }>((resolve, reject) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['json', 'csv', 'xlsx', 'xls'].includes(ext)) {
      reject(new Error(`Unsupported file type in ${file.name}.`));
      return;
    }
    loadExamParsersModule()
      .then((parsers) => {
        if (ext === 'xlsx' || ext === 'xls') {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const { parsed, errs } = parsers.parseExcelQuestions(e.target?.result as ArrayBuffer);
              if (parsed.length === 0) {
                reject(new Error(`No valid questions found in ${file.name}.`));
                return;
              }
              resolve({ parsed, errs, fileName: file.name });
            } catch (err: any) {
              reject(new Error(`Failed to parse ${file.name}: ${err.message}`));
            }
          };
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
          reader.readAsArrayBuffer(file);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const { parsed, errs } = ext === 'json' ? parsers.parseJSONQuestions(text) : parsers.parseCSVQuestions(text);
            if (parsed.length === 0) {
              reject(new Error(`No valid questions found in ${file.name}.`));
              return;
            }
            resolve({ parsed, errs, fileName: file.name });
          } catch (err: any) {
            reject(new Error(`Failed to parse ${file.name}: ${err.message}`));
          }
        };
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
        reader.readAsText(file);
      })
      .catch((err: any) => {
        reject(new Error(err?.message || `Failed to load parser tools for ${file.name}.`));
      });
  });

  const handleDownloadTemplate = async (format: 'csv' | 'json' | 'excel') => {
    const parsers = await loadExamParsersModule();
    parsers.downloadTemplate(format);
  };

  const handleUploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const queue: UploadPreview[] = [];

    for (const file of files) {
      try {
        const parsed = await parseQuestionFile(file);
        queue.push(parsed);
      } catch (err: any) {
        showToast(err.message || `Failed to import ${file.name}.`, 'error');
      }
    }

    if (queue.length === 0) {
      return;
    }

    setUploadQueue(queue);
    setUploadQueueIndex(0);
    setUploadPreview(queue[0]);
    setQueuedExamTitle(suggestTitleFromFileName(queue[0].fileName));
    maybeAutoFillTitle(queue[0].fileName);

    if (queue.length > 1) {
      showToast(`${queue.length} files queued. Review and import each exam individually.`, 'info');
    }
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
    showToast(`${uploadPreview.parsed.length} question(s) imported from ${uploadPreview.fileName}.`, 'success');

    const nextIdx = uploadQueueIndex + 1;
    if (uploadQueue.length > nextIdx) {
      const nextPreview = uploadQueue[nextIdx];
      setUploadQueueIndex(nextIdx);
      setUploadPreview(nextPreview);
      setQueuedExamTitle(suggestTitleFromFileName(nextPreview.fileName));
      maybeAutoFillTitle(nextPreview.fileName);
      return;
    }

    setUploadPreview(null);
    setUploadQueue([]);
    setUploadQueueIndex(0);
    setQueuedExamTitle('');
  };

  const skipCurrentQueuedUpload = () => {
    const nextIdx = uploadQueueIndex + 1;
    if (uploadQueue.length > nextIdx) {
      const nextPreview = uploadQueue[nextIdx];
      setUploadQueueIndex(nextIdx);
      setUploadPreview(nextPreview);
      setQueuedExamTitle(suggestTitleFromFileName(nextPreview.fileName));
      maybeAutoFillTitle(nextPreview.fileName);
      return;
    }
    setUploadPreview(null);
    setUploadQueue([]);
    setUploadQueueIndex(0);
    setQueuedExamTitle('');
  };

  const createSeparateExamFromCurrentFile = async () => {
    if (!uploadPreview) return;
    if (editExam) {
      showToast('Separate exam creation from multi-file upload is disabled while editing an existing exam.', 'error');
      return;
    }
    if (!queuedExamTitle.trim()) {
      showToast('Exam title is required for this file.', 'error');
      return;
    }
    if (!grade || !duration || !passing) {
      showToast('Please set Grade Level, Duration, and Passing Score before creating separate exams.', 'error');
      return;
    }

    const dur = parseInt(String(duration));
    const pass = parseFloat(String(passing));
    if (isNaN(dur) || dur <= 0) { showToast('Duration must be a positive number of minutes.', 'error'); return; }
    if (isNaN(pass) || pass < 0 || pass > 100) { showToast('Passing score must be between 0 and 100.', 'error'); return; }

    try {
      await addExam({
        title: queuedExamTitle.trim(),
        gradeLevel: grade,
        durationMinutes: dur,
        passingScore: pass,
        ...(yearId && { academicYearId: Number(yearId) }),
        ...(semId && { semesterId: Number(semId) }),
        questions: uploadPreview.parsed.map((q, i) => ({
          ...q,
          id: uid(),
          orderNum: i + 1,
          choices: (q.choices || []).map(c => ({ ...c, id: uid() })),
        })),
      });
      showToast(`Created exam "${queuedExamTitle.trim()}" from ${uploadPreview.fileName}.`, 'success');
      skipCurrentQueuedUpload();
    } catch (err: any) {
      showToast('Failed to create exam: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  const saveExam = async (): Promise<Exam | null> => {
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
        const res = await updateExam(editExam.id, payload);
        showToast('Exam updated successfully!', 'success');
        return res.data as Exam;
      } else {
        const res = await addExam(payload);
        showToast('Exam created successfully!', 'success');
        return res.data as Exam;
      }
      clear();
      onDone();
    } catch (err: any) {
      showToast('Failed to save exam: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSaving(false);
    }
    return null;
  };

  const handleAssignAndPublish = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const saved = await saveExam();
      if (!saved) return;
      // publish
      const pubRes = await import('../../../api/exams').then(m => m.publishExam(saved.id));
      showToast(`Exam "${saved.title}" published and activated.`, 'success');
      clear();
      onDone();
    } catch (err: any) {
      showToast('Failed to publish exam: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);
  const mcCount = questions.filter(q => q.questionType === 'mc').length;
  const essayCount = questions.filter(q => q.questionType === 'essay').length;
  const identificationCount = questions.filter(q => q.questionType === 'identification').length;
  const trueFalseCount = questions.filter(q => q.questionType === 'true_false').length;

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
            <button onClick={() => void handleDownloadTemplate('csv')} className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1 font-medium" title="Download a sample CSV file to use as a template"><Icon name="document" className="w-3.5 h-3.5" /> CSV Sample</button>
            <button onClick={() => void handleDownloadTemplate('excel')} className="text-xs border border-forest-300 text-forest-700 bg-forest-50 px-2.5 py-1.5 rounded-lg hover:bg-forest-100 flex items-center gap-1 font-medium" title="Download a sample Excel file to use as a template"><Icon name="document" className="w-3.5 h-3.5" /> Excel Sample</button>
            <button onClick={() => void handleDownloadTemplate('json')} className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1 font-medium" title="Download a sample JSON file to use as a template"><Icon name="document" className="w-3.5 h-3.5" /> JSON Sample</button>
          </div>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-gold-400 bg-gold-50' : 'border-gray-300 hover:border-gold-300 hover:bg-gray-50'}`}
          onClick={() => document.getElementById('questionnaire-upload')?.click()}
          onDragOver={(e: DragEvent) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e: DragEvent) => { e.preventDefault(); setDragOver(false); const files = Array.from(e.dataTransfer.files || []); if (files.length) handleUploadFiles(files); }}
        >
          <div className="text-3xl mb-2"><Icon name="upload" className="w-8 h-8 text-gray-400 mx-auto" /></div>
          <p className="text-gray-600 font-medium">Drag & drop your questionnaire file here</p>
          <p className="text-gray-400 text-sm mt-1">or <span className="text-forest-500 font-medium underline">click to browse</span></p>
          <p className="text-xs text-gray-400 mt-2">Supported: .xlsx (Excel) | .csv | .json | Multiple files allowed (processed individually)</p>
        </div>
        <input id="questionnaire-upload" type="file" accept=".csv,.json,.xlsx,.xls" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []); if (files.length) handleUploadFiles(files); e.target.value = ''; }} />

        <details className="mt-4 group border border-amber-200 rounded-lg p-4 bg-amber-50">
          <summary className="text-sm text-amber-800 font-bold cursor-pointer select-none flex items-center gap-2"><Icon name="info" className="w-4 h-4" /> 📋 Format Guide & Template Samples</summary>
          <div className="mt-4 pt-4 border-t border-amber-200">
            <p className="text-xs text-amber-700 mb-3 font-medium">Download sample files below to see the expected format, then edit them with your questions:</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-forest-500 text-sm mb-1 flex items-center gap-1"><Icon name="document" className="w-4 h-4" /> CSV / Excel Format</h4>
              <p className="text-xs text-gray-500 mb-2">9 columns - same structure for both .csv and .xlsx</p>
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
                    <th className="border border-gray-200 px-1.5 py-1">matchMode</th>
                  </tr></thead>
                  <tbody>
                    <tr><td className="border border-gray-200 px-1.5 py-1 text-blue-600">mc</td><td className="border border-gray-200 px-1.5 py-1">What is 2+2?</td><td className="border border-gray-200 px-1.5 py-1">2</td><td className="border border-gray-200 px-1.5 py-1">3</td><td className="border border-gray-200 px-1.5 py-1">4</td><td className="border border-gray-200 px-1.5 py-1">5</td><td className="border border-gray-200 px-1.5 py-1">6</td><td className="border border-gray-200 px-1.5 py-1 text-green-600">B</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td></tr>
                    <tr><td className="border border-gray-200 px-1.5 py-1 text-indigo-600">true_false</td><td className="border border-gray-200 px-1.5 py-1">The Earth orbits the Sun.</td><td className="border border-gray-200 px-1.5 py-1">1</td><td className="border border-gray-200 px-1.5 py-1">True</td><td className="border border-gray-200 px-1.5 py-1">False</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-green-600">True</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td></tr>
                    <tr><td className="border border-gray-200 px-1.5 py-1 text-teal-600">identification</td><td className="border border-gray-200 px-1.5 py-1">What planet is known as the Red Planet?</td><td className="border border-gray-200 px-1.5 py-1">2</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-green-600">Mars</td><td className="border border-gray-200 px-1.5 py-1">exact</td></tr>
                    <tr><td className="border border-gray-200 px-1.5 py-1 text-purple-600">essay</td><td className="border border-gray-200 px-1.5 py-1">Explain photosynthesis.</td><td className="border border-gray-200 px-1.5 py-1">5</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td><td className="border border-gray-200 px-1.5 py-1 text-gray-300">-</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">- <strong>type:</strong> <code>mc</code>, <code>true_false</code>, <code>identification</code>, or <code>essay</code></p>
              <p className="text-xs text-gray-400">- <strong>correct:</strong> A / B / C / D (or 1 / 2 / 3 / 4)</p>
              <p className="text-xs text-gray-400">- For <strong>true_false</strong>, set correct as True or False.</p>
              <p className="text-xs text-gray-400">- For <strong>identification</strong>, place answer key in <strong>correct</strong> and optional <strong>matchMode</strong> as exact/partial.</p>
              <p className="text-xs text-gray-400">- Leave choiceA-D and correct blank for essay rows.</p>
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
  },
  {
    "type": "true_false",
    "question": "The Pacific Ocean is the largest ocean.",
    "points": 1,
    "correct": "true"
  },
  {
    "type": "identification",
    "question": "What is H2O commonly called?",
    "points": 2,
    "answer": "water",
    "matchMode": "exact"
  }
]`}</pre>
              <p className="text-xs text-gray-400 mt-2">- <strong>correct:</strong> 0-based index <em>or</em> letter A-D</p>
              <p className="text-xs text-gray-400">- choices can be strings or <code>{'{text, isCorrect}'}</code> objects</p>
            </div>
            <div className="bg-gold-50 rounded-lg p-4 border border-gold-200">
              <h4 className="font-bold text-gold-700 text-sm mb-1">Download Templates</h4>
              <p className="text-xs text-gray-500 mb-3">Pre-filled sample files ready to edit</p>
              <div className="space-y-2">
                <button onClick={() => void handleDownloadTemplate('excel')} className="w-full flex items-center gap-2 text-sm text-forest-700 bg-white border border-forest-200 rounded-lg px-3 py-2 hover:bg-forest-50 transition-colors">
                  <Icon name="document" className="w-4 h-4 text-green-600" />
                  <span>Excel Template <span className="text-xs text-gray-400 font-normal">(.xlsx)</span></span>
                </button>
                <button onClick={() => void handleDownloadTemplate('csv')} className="w-full flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
                  <Icon name="document" className="w-4 h-4 text-blue-500" />
                  <span>CSV Template <span className="text-xs text-gray-400 font-normal">(.csv)</span></span>
                </button>
                <button onClick={() => void handleDownloadTemplate('json')} className="w-full flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
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
      <Modal title="Import Preview" open={!!uploadPreview} onClose={() => { setUploadPreview(null); setUploadQueue([]); setUploadQueueIndex(0); setQueuedExamTitle(''); }}>
        {uploadPreview && (
          <div>
            <p className="text-gray-500 text-sm mb-4">File: <span className="font-medium text-forest-500">{uploadPreview.fileName}</span></p>
            {uploadQueue.length > 1 && (
              <p className="text-xs text-gray-500 mb-3">Queued file {uploadQueueIndex + 1} of {uploadQueue.length}. Each file is handled as an individual exam import.</p>
            )}

            {uploadQueue.length > 1 && !editExam && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam title for this file</label>
                <input
                  value={queuedExamTitle}
                  onChange={e => setQueuedExamTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none"
                  placeholder="Exam title"
                />
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="bg-forest-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-forest-700">{uploadPreview.parsed.length}</div>
                <div className="text-xs text-gray-500">Questions</div>
              </div>
              <div className="bg-forest-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-forest-700">{uploadPreview.parsed.filter(q => q.questionType === 'mc').length}</div>
                <div className="text-xs text-gray-500">MC</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-700">{uploadPreview.parsed.filter(q => q.questionType === 'true_false').length}</div>
                <div className="text-xs text-gray-500">True / False</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-indigo-700">{uploadPreview.parsed.filter(q => q.questionType === 'identification').length}</div>
                <div className="text-xs text-gray-500">Identification</div>
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
                      <Badge className={q.questionType === 'mc' ? 'gk-badge gk-badge-mc' : q.questionType === 'essay' ? 'gk-badge gk-badge-essay' : 'gk-badge gk-badge-info'}>{questionTypeLabel(q.questionType as BuilderQuestionType)}</Badge>
                      <span className="text-gray-400 text-xs">{q.points} pts</span>
                    </div>
                    <p className="text-gray-700 truncate">{q.questionText}</p>
                    {(q.questionType === 'mc' || q.questionType === 'true_false') && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {q.choices.map((c, j) => (
                          <span key={j} className={`text-xs px-1.5 py-0.5 rounded ${c.isCorrect ? 'bg-forest-50 text-forest-700 font-medium' : 'bg-gray-100 text-gray-500'}`}>
                            {String.fromCharCode(65 + j)}. {c.choiceText}
                          </span>
                        ))}
                      </div>
                    )}
                    {q.questionType === 'identification' && (
                      <p className="text-xs text-gray-500 mt-1">Answer key: {q.identificationAnswer || '-'} ({q.identificationMatchMode || 'exact'})</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {uploadQueue.length > 1 ? (
              <div>
                <p className="text-sm text-gray-500 mb-3">Create each queued file as its own exam entity.</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={createSeparateExamFromCurrentFile} className="bg-forest-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-forest-600 inline-flex items-center gap-1"><Icon name="check" className="w-4 h-4" /> Create Separate Exam</button>
                  <button onClick={skipCurrentQueuedUpload} className="border border-amber-300 text-amber-700 px-4 py-2 rounded-lg text-sm hover:bg-amber-50">Skip This File</button>
                  <button onClick={() => { setUploadPreview(null); setUploadQueue([]); setUploadQueueIndex(0); setQueuedExamTitle(''); }} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            ) : questions.length > 0 ? (
              <div>
                <p className="text-sm text-gray-500 mb-3">You already have <strong>{questions.length}</strong> question(s). How would you like to import?</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => confirmUpload('append')} className="bg-forest-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-forest-600 inline-flex items-center gap-1"><Icon name="plus" className="w-4 h-4" /> Add to Existing</button>
                  <button onClick={() => confirmUpload('replace')} className="bg-forest-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-forest-600 inline-flex items-center gap-1"><Icon name="refresh" className="w-4 h-4" /> Replace All</button>
                  <button onClick={() => { setUploadPreview(null); setUploadQueue([]); setUploadQueueIndex(0); setQueuedExamTitle(''); }} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => confirmUpload('replace')} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600 inline-flex items-center gap-1.5"><Icon name="check" className="w-4 h-4" /> Import Questions</button>
                <button onClick={() => { setUploadPreview(null); setUploadQueue([]); setUploadQueueIndex(0); setQueuedExamTitle(''); }} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
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
              <p className="text-xs text-gray-400 mt-0.5">{mcCount} MC | {trueFalseCount} True/False | {identificationCount} Identification | {essayCount} Essay | {totalPoints} total pts</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => openQ('mc')} className="bg-forest-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-forest-600">+ Multiple Choice</button>
            <button onClick={() => openQ('true_false')} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">+ True / False</button>
            <button onClick={() => openQ('identification')} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">+ Identification</button>
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
        <button onClick={handleAssignAndPublish} disabled={isSaving} className="border border-gold-400 text-gold-700 bg-gold-50 px-5 py-2.5 rounded-lg hover:bg-gold-100 disabled:opacity-60 inline-flex items-center gap-2">
          <Icon name="rocket" className="w-4 h-4" /> Assign & Publish
        </button>
        <button onClick={onDone} disabled={isSaving} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
      </div>

      {/* Question Modal */}
      <Modal open={!!qModal} onClose={() => { setQModal(null); setEditIdx(null); setIdentificationAnswer(''); setIdentificationMatchMode('exact'); setTrueFalseCorrect('true'); }}>
        <h3 className="text-lg font-bold text-forest-500 mb-4">
          {editIdx !== null ? `Edit ${questionTypeLabel((qModal || 'essay') as BuilderQuestionType)} Question` : `Add ${questionTypeLabel((qModal || 'essay') as BuilderQuestionType)} Question`}
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
          {qModal === 'true_false' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
              <div className="flex gap-2">
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${trueFalseCorrect === 'true' ? 'border-forest-400 bg-forest-50' : 'border-gray-300 bg-white'}`}>
                  <input
                    type="radio"
                    name="trueFalseCorrect"
                    className="accent-forest-500"
                    checked={trueFalseCorrect === 'true'}
                    onChange={() => setTrueFalseCorrect('true')}
                  />
                  <span className="text-sm text-gray-700">True</span>
                </label>
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${trueFalseCorrect === 'false' ? 'border-forest-400 bg-forest-50' : 'border-gray-300 bg-white'}`}>
                  <input
                    type="radio"
                    name="trueFalseCorrect"
                    className="accent-forest-500"
                    checked={trueFalseCorrect === 'false'}
                    onChange={() => setTrueFalseCorrect('false')}
                  />
                  <span className="text-sm text-gray-700">False</span>
                </label>
              </div>
            </div>
          )}
          {qModal === 'identification' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer Key</label>
                <input
                  type="text"
                  value={identificationAnswer}
                  onChange={e => setIdentificationAnswer(e.target.value)}
                  placeholder="Enter the expected answer"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matching Mode</label>
                <select
                  value={identificationMatchMode}
                  onChange={e => setIdentificationMatchMode(e.target.value as 'exact' | 'partial')}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white"
                >
                  <option value="exact">Exact match (trim + case-insensitive)</option>
                  <option value="partial">Partial match (contains expected answer)</option>
                </select>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={addQuestion} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600">
              {editIdx !== null ? 'Update Question' : 'Add Question'}
            </button>
            <button onClick={() => { setQModal(null); setEditIdx(null); setIdentificationAnswer(''); setIdentificationMatchMode('exact'); setTrueFalseCorrect('true'); }} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
