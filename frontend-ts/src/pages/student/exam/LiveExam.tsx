import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitExamAnswers } from '../../../api/results';
import { saveDraftAnswers } from '../../../api/exams';
import { showToast } from '../../../components/Toast';
import Modal from '../../../components/Modal';
import { ActionButton, ProcessStatePanel } from '../../../components/UI';
import Icon from '../../../components/Icons';
import type { Exam, ExamRegistration, ExamQuestion, QuestionChoice } from '../../../types';

type AnswerMap = Record<number, number | string>;

interface LiveExamProps {
  exam: Exam;
  registration: ExamRegistration;
}

export default function LiveExam({ exam, registration }: LiveExamProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    try {
      const saved = sessionStorage.getItem(`gk_exam_answers_${registration.id}`);
      if (saved) return JSON.parse(saved);
      // Fall back to server-saved draft
      if ((registration as any).draftAnswers) {
        try { return JSON.parse((registration as any).draftAnswers); } catch { /* ignore */ }
      }
      return {};
    } catch { return {}; }
  });
  const calcRemaining = () => {
    if (registration.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(registration.startedAt).getTime()) / 1000);
      return Math.max(0, exam.durationMinutes * 60 - elapsed);
    }
    return exam.durationMinutes * 60;
  };
  const [timeLeft, setTimeLeft] = useState(calcRemaining);
  const [cheatFlags, setCheatFlags] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [autoModal, setAutoModal] = useState<{ title: string; msg: string } | null>(null);
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'submitting' | 'submitted'>('idle');
  const [submitFeedback, setSubmitFeedback] = useState<{ title: string; message: string } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);
  const navigate = useNavigate();

  const questions = Array.isArray(exam.questions) ? exam.questions : [];

  useEffect(() => {
    if (questions.length === 0) {
      if (currentQ !== 0) setCurrentQ(0);
      return;
    }
    if (currentQ < 0) setCurrentQ(0);
    if (currentQ > questions.length - 1) setCurrentQ(questions.length - 1);
  }, [questions.length, currentQ]);

  useEffect(() => {
    try { sessionStorage.setItem(`gk_exam_answers_${registration.id}`, JSON.stringify(answers)); } catch { /* ignore */ }
  }, [answers, registration.id]);

  const answersRef = useRef(answers);
  answersRef.current = answers;

  const doSubmit = useCallback(async (title: string | null, msg: string | null) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitPhase('submitting');
    setSubmitFeedback({
      title: 'Submitting Your Exam...',
      message: 'Please wait while we securely save and grade your answers.',
    });
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await submitExamAnswers(registration.id, answersRef.current);
    } catch (err: unknown) {
      submittedRef.current = false;
      setSubmitPhase('idle');
      setSubmitFeedback(null);
      showToast((err as Error).message || 'Failed to submit exam. Please try again.', 'error');
      return;
    }
    try { sessionStorage.removeItem(`gk_exam_answers_${registration.id}`); } catch { /* ignore */ }
    if (title && msg) {
      setSubmitPhase('idle');
      setSubmitFeedback(null);
      setAutoModal({ title, msg });
    }
    else {
      setSubmitPhase('submitted');
      setSubmitFeedback({
        title: 'Exam Submitted Successfully',
        message: 'Your answers were saved. Redirecting to your results page...',
      });
      showToast('Exam submitted successfully!', 'success');
      setTimeout(() => navigate('/student/results'), 1500);
    }
  }, [registration.id, navigate]);

  const doSubmitRef = useRef(doSubmit);
  doSubmitRef.current = doSubmit;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          doSubmitRef.current('Time\'s Up!', 'Your exam has been automatically submitted because the time ran out.');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        setCheatFlags(prev => {
          const next = prev + 1;
          if (next >= 5) {
            doSubmitRef.current('Warning: Exam Auto-Submitted', 'Your exam was automatically submitted due to multiple tab switches.');
          } else if (next === 4) {
            showToast('Final warning! One more tab switch and your exam will be auto-submitted.', 'error');
          } else if (next === 3) {
            showToast('Warning: You have switched tabs 3 times. 2 more and your exam will be auto-submitted.', 'error');
          } else {
            showToast(`Tab switch detected (${next}/5). Please stay on this page.`, 'error');
          }
          return next;
        });
      }
    };
    const preventContext = (e: MouseEvent) => e.preventDefault();
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    document.addEventListener('visibilitychange', handler);
    document.addEventListener('contextmenu', preventContext);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { document.removeEventListener('visibilitychange', handler); document.removeEventListener('contextmenu', preventContext); window.removeEventListener('beforeunload', beforeUnload); };
  }, []);

  // Network connection listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-save answers to server every 30 seconds
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (!submittedRef.current) {
        saveDraftAnswers(registration.id, answersRef.current).catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(autoSaveInterval);
  }, [registration.id]);

  const q = questions[currentQ] || null;
  const answered = Object.keys(answers).filter(k => answers[Number(k)] !== undefined && answers[Number(k)] !== '').length;
  const progressPct = questions.length > 0 ? (answered / questions.length) * 100 : 0;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerColor = timeLeft <= 60 ? 'text-red-500' : timeLeft <= 300 ? 'text-gold-500' : 'text-forest-500';

  if (submitPhase === 'submitting' && submitFeedback) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-3xl mx-auto">
          <ProcessStatePanel
            tone="info"
            loading
            title={submitFeedback.title}
            message={submitFeedback.message}
          />
        </div>
      </div>
    );
  }

  if (submitPhase === 'submitted' && submitFeedback) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-3xl mx-auto">
          <ProcessStatePanel
            tone="success"
            loading={false}
            title={submitFeedback.title}
            message={submitFeedback.message}
          />
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-3xl mx-auto gk-section-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gold-50 flex items-center justify-center mx-auto mb-3">
            <Icon name="exclamation" className="w-7 h-7 text-gold-600" />
          </div>
          <h3 className="text-xl font-bold text-forest-500">Exam Not Ready</h3>
          <p className="text-gray-500 mt-2">
            This exam currently has no questions available. Please contact support and try again.
          </p>
          <ActionButton
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
            className="mt-4"
          >
            Go Back
          </ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#exam-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-white focus:p-2 focus:rounded focus:shadow focus:z-[100]">Skip to exam content</a>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 py-3">
        {!isOnline && (
          <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-800 text-sm px-4 py-2 font-semibold text-center mb-2 rounded-md">
            Warning: You are offline. Please do not submit the exam or refresh the page until your connection is restored.
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-forest-500 text-lg">{exam.title}</h3>
          <div className={`flex items-center gap-2 font-mono text-lg font-bold ${timerColor}`} role="timer" aria-live="polite" aria-label={`Time remaining: ${mins} minutes ${secs} seconds`}>
            <Icon name="clock" className="w-5 h-5" /> {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gold-400 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-sm text-gray-500">{answered} / {questions.length} answered</span>
        </div>
        {cheatFlags > 0 && (
          <div className="mt-2 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded-lg" role="alert">
            <Icon name="exclamation" className="w-4 h-4 inline" /> Tab switch detected! ({cheatFlags}/5)
          </div>
        )}
      </div>

      <div id="exam-content" className="max-w-3xl mx-auto p-4">
        <div className="gk-section-card p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-bold text-gray-400">Question {currentQ + 1} of {questions.length}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.questionType === 'mc' ? 'bg-forest-100 text-forest-700' : 'bg-gold-100 text-gold-700'}`}>
              {q.questionType === 'mc' ? 'Multiple Choice' : 'Essay'}
            </span>
          </div>
          <p className="text-forest-500 text-lg font-medium mb-4">{q.questionText}</p>

          {q.questionType === 'mc' ? (
            <div className="space-y-2">
              {q.choices?.map((c: QuestionChoice) => (
                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${answers[q.id] === c.id ? 'border-gold-400 bg-gold-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name={`q${q.id}`} checked={answers[q.id] === c.id} onChange={() => setAnswers(a => ({ ...a, [q.id]: c.id }))} className="accent-forest-500" />
                  <span className="text-gray-700">{c.choiceText}</span>
                </label>
              ))}
            </div>
          ) : (
            <div>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none min-h-[160px] resize-y"
                placeholder="Type your answer here..."
                value={(answers[q.id] as string) || ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">{((answers[q.id] as string) || '').length} characters</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 justify-center mb-4">
          {questions.map((qu: ExamQuestion, i: number) => {
            const isAnswered = answers[qu.id] !== undefined && answers[qu.id] !== '';
            return (
              <button key={i} onClick={() => setCurrentQ(i)}
                aria-label={`Question ${i + 1}${isAnswered ? ', answered' : ', unanswered'}${i === currentQ ? ', current' : ''}`}
                className={`w-8 h-8 rounded-full text-xs font-bold transition ${i === currentQ ? 'bg-forest-500 text-white' : isAnswered ? 'bg-forest-100 text-forest-700 border border-forest-300' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <ActionButton variant="secondary" onClick={() => setCurrentQ(c => Math.max(0, c - 1))} disabled={currentQ === 0} icon={<Icon name="chevronLeft" className="w-4 h-4" />}>Previous</ActionButton>
          <ActionButton onClick={() => setShowSubmitModal(true)} icon={<Icon name="check" className="w-4 h-4" />} className="px-6 py-2.5 shadow-md">Submit Exam</ActionButton>
          <ActionButton variant="secondary" onClick={() => setCurrentQ(c => Math.min(questions.length - 1, c + 1))} disabled={currentQ === questions.length - 1} icon={<Icon name="chevronRight" className="w-4 h-4" />}>Next</ActionButton>
        </div>
      </div>

      <Modal open={showSubmitModal} onClose={() => setShowSubmitModal(false)}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-3"><Icon name="clipboard" className="w-7 h-7 text-forest-500" /></div>
          <h3 className="text-xl font-bold text-forest-500">Submit Your Exam?</h3>
          <p className="text-gray-500 mt-2">You have answered {answered} out of {questions.length} questions.</p>
          <div className="flex gap-3 justify-center mt-4">
            <ActionButton onClick={() => { setShowSubmitModal(false); doSubmit(null, null); }} className="px-5 py-2">Yes, Submit</ActionButton>
            <ActionButton variant="secondary" onClick={() => setShowSubmitModal(false)} className="px-5 py-2">Go Back</ActionButton>
          </div>
        </div>
      </Modal>

      <Modal open={!!autoModal} onClose={() => navigate('/student/results')}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gold-50 flex items-center justify-center mx-auto mb-3"><Icon name="clock" className="w-7 h-7 text-gold-500" /></div>
          <h3 className="text-xl font-bold text-forest-500">{autoModal?.title}</h3>
          <p className="text-gray-500 mt-2">{autoModal?.msg}</p>
          <ActionButton onClick={() => navigate('/student/results')} className="mt-4 px-6 py-2">View Results</ActionButton>
        </div>
      </Modal>
    </div>
  );
}
