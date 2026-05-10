import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitExamAnswers } from '../../../api/results';
import { saveDraftAnswers } from '../../../api/exams';
import { showToast } from '../../../components/Toast';
import Modal from '../../../components/Modal';
import { ActionButton, ProcessStatePanel } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { useOfflineExamQueue } from '../../../hooks/useOfflineExamQueue';
import type { Exam, ExamRegistration, ExamQuestion, QuestionChoice } from '../../../types';

type AnswerMap = Record<number, number | string>;
type FlagSet = Set<number>;

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed || 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const temp = out[i];
    out[i] = out[j];
    out[j] = temp;
  }

  return out;
}

function formatDraftAge(lastSavedAt: number | null): string {
  if (!lastSavedAt) return 'Not saved yet';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000));
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `${elapsedHours}h ago`;
}

interface LiveExamProps {
  exam: Exam;
  registration: ExamRegistration;
}

export default function LiveExam({ exam, registration }: LiveExamProps) {
  const navigate = useNavigate();
  const { enqueueSubmission, getQueue, removeFromQueue, incrementAttemptCount } = useOfflineExamQueue();
  const draftStorageKey = `gk_exam_answers_${registration.id}`;
  const flagStorageKey = `gk_exam_flags_${registration.id}`;

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    try {
      const saved = sessionStorage.getItem(draftStorageKey);
      if (saved) return JSON.parse(saved);
      // Fall back to server-saved draft
      if ((registration as any).draftAnswers) {
        try { return JSON.parse((registration as any).draftAnswers); } catch { /* ignore */ }
      }
      return {};
    } catch { return {}; }
  });
  const [flags, setFlags] = useState<FlagSet>(() => {
    try {
      const saved = sessionStorage.getItem(flagStorageKey);
      if (saved) return new Set(JSON.parse(saved));
      return new Set();
    } catch { return new Set(); }
  });
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
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
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);
  const fullscreenWarningCountRef = useRef(0);
  const questionStartTimesRef = useRef<Record<number, number>>({}); // Track when student views each question

  const baseQuestions = Array.isArray(exam.questions) ? exam.questions : [];
  const questions = useMemo(() => {
    if (baseQuestions.length <= 1) return baseQuestions;
    // Stable per-applicant order using registration id as seed.
    return deterministicShuffle(baseQuestions, registration.id);
  }, [baseQuestions, registration.id]);

  useEffect(() => {
    if (questions.length === 0) {
      if (currentQ !== 0) setCurrentQ(0);
      return;
    }
    if (currentQ < 0) setCurrentQ(0);
    if (currentQ > questions.length - 1) setCurrentQ(questions.length - 1);
  }, [questions.length, currentQ]);

  useEffect(() => {
    try { sessionStorage.setItem(draftStorageKey, JSON.stringify(answers)); } catch { /* ignore */ }
  }, [answers, registration.id]);

  useEffect(() => {
    try { sessionStorage.setItem(flagStorageKey, JSON.stringify(Array.from(flags))); } catch { /* ignore */ }
  }, [flags, registration.id]);

  const answersRef = useRef(answers);
  answersRef.current = answers;

  const saveDraftToServer = useCallback(async () => {
    if (submittedRef.current || !isOnline) return;
    setDraftStatus('saving');
    try {
      await saveDraftAnswers(registration.id, answersRef.current);
      setDraftStatus('saved');
      setLastDraftSavedAt(Date.now());
    } catch {
      setDraftStatus('error');
    }
  }, [registration.id, isOnline]);

  const toggleFlag = useCallback((questionId: number) => {
    setFlags(prev => {
      const newFlags = new Set(prev);
      if (newFlags.has(questionId)) {
        newFlags.delete(questionId);
      } else {
        newFlags.add(questionId);
      }
      return newFlags;
    });
  }, []);

  const doSubmit = useCallback(async (title: string | null, msg: string | null) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitPhase('submitting');
    setSubmitFeedback({
      title: 'Submitting Your Exam...',
      message: 'Please wait while we securely save and grade your answers.',
    });
    if (timerRef.current) clearInterval(timerRef.current);

    // Prepare security metadata
    const securityMetadata = {
      tabSwitches: cheatFlags > 0 ? Math.floor(cheatFlags / 2) : 0, // Divide by 2 since both visibility change and blur fire
      windowBlurs: cheatFlags,
      fullscreenExits: fullscreenWarningCountRef.current,
      timePerQuestion: questionStartTimesRef.current,
    };

    // If offline, save to queue instead of submitting
    if (!isOnline) {
      enqueueSubmission(registration.id, answersRef.current);
      submittedRef.current = false;
      setSubmitPhase('idle');
      setSubmitFeedback(null);
      showToast('You are offline. Your exam has been saved and will submit when your connection is restored.', 'warning');
      return;
    }

    try {
      await submitExamAnswers(registration.id, answersRef.current, securityMetadata);
    } catch (err: unknown) {
      // If submission fails due to network error, try to queue it
      if (!navigator.onLine) {
        enqueueSubmission(registration.id, answersRef.current);
        submittedRef.current = false;
        setSubmitPhase('idle');
        setSubmitFeedback(null);
        showToast('Connection lost. Your exam has been saved and will submit when connection is restored.', 'warning');
        return;
      }

      submittedRef.current = false;
      setSubmitPhase('idle');
      setSubmitFeedback(null);
      showToast((err as Error).message || 'Failed to submit exam. Please try again.', 'error');
      return;
    }
    try { 
      sessionStorage.removeItem(draftStorageKey);
      sessionStorage.removeItem(flagStorageKey);
    } catch { /* ignore */ }
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
  }, [registration.id, navigate, isOnline, enqueueSubmission, draftStorageKey]);

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
    const registerViolation = (reason: 'tab' | 'window' | 'pagehide') => {
      setCheatFlags(prev => {
        const next = prev + 1;
        const label = reason === 'tab' ? 'Tab switch' : reason === 'window' ? 'Window switch' : 'Page hidden';
        if (next >= 5) {
          doSubmitRef.current('Warning: Exam Auto-Submitted', 'Your exam was automatically submitted due to multiple security violations.');
        } else if (next === 4) {
          showToast('Final warning! One more security violation and your exam will be auto-submitted.', 'error');
        } else if (next === 3) {
          showToast(`Warning: ${label} detected 3 times. 2 more and your exam will be auto-submitted.`, 'error');
        } else {
          showToast(`${label} detected (${next}/5). Please stay on this page.`, 'error');
        }
        return next;
      });
    };

    const handler = () => {
      if (document.visibilityState !== 'visible' || document.hidden) {
        registerViolation('tab');
      }
    };

    // ── Prevent right-click context menu ──────────────
    const preventContext = (e: MouseEvent) => {
      e.preventDefault();
      showToast('Right-click is disabled during the exam.', 'warning');
    };

    // ── Prevent copy, cut, paste ──────────────────────
    const preventCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      showToast('Copy and paste are disabled during the exam.', 'warning');
    };

    // ── Prevent navigation away ───────────────────────
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    // ── Prevent drag & drop ───────────────────────────
    const preventDragDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // ── Prevent F12, Ctrl+Shift+I, Ctrl+Shift+C (Dev Tools) ─
    const preventDevTools = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isF12 = e.key === 'F12';
      const isCtrlShiftI = (isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key === 'I';
      const isCtrlShiftC = (isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key === 'C';
      const isCtrlShiftJ = (isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key === 'J';

      if (isF12 || isCtrlShiftI || isCtrlShiftC || isCtrlShiftJ) {
        e.preventDefault();
        showToast('Developer tools are disabled during the exam.', 'warning');
      }
    };

    // ── Track window blur/focus ───────────────────────
    const handleBlur = () => {
      registerViolation('window');
    };

    const handlePageHide = () => {
      registerViolation('pagehide');
    };

    document.addEventListener('visibilitychange', handler);
    document.addEventListener('contextmenu', preventContext);
    document.addEventListener('copy', preventCopyPaste);
    document.addEventListener('cut', preventCopyPaste);
    document.addEventListener('paste', preventCopyPaste);
    document.addEventListener('dragstart', preventDragDrop);
    document.addEventListener('drop', preventDragDrop);
    document.addEventListener('keydown', preventDevTools);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handler);
      document.removeEventListener('contextmenu', preventContext);
      document.removeEventListener('copy', preventCopyPaste);
      document.removeEventListener('cut', preventCopyPaste);
      document.removeEventListener('paste', preventCopyPaste);
      document.removeEventListener('dragstart', preventDragDrop);
      document.removeEventListener('drop', preventDragDrop);
      document.removeEventListener('keydown', preventDevTools);
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  // ── Fullscreen enforcement ────────────────────────────────
  useEffect(() => {
    let fullscreenWarningCount = 0;
    let enteringFullscreen = false;

    // Request fullscreen on component mount
    const requestFullscreen = async () => {
      try {
        const elem = document.documentElement;
        if (!document.fullscreenElement) {
          enteringFullscreen = true;
          if (elem.requestFullscreen) {
            await elem.requestFullscreen();
          } else if ((elem as any).webkitRequestFullscreen) {
            await (elem as any).webkitRequestFullscreen();
          } else if ((elem as any).mozRequestFullScreen) {
            await (elem as any).mozRequestFullScreen();
          } else if ((elem as any).msRequestFullscreen) {
            await (elem as any).msRequestFullscreen();
          }
          enteringFullscreen = false;
        }
      } catch (err) {
        console.warn('Fullscreen request failed:', err);
        showToast('Fullscreen mode could not be enabled. Please try maximizing your browser window instead.', 'warning');
      }
    };

    // Handle fullscreen change
    const handleFullscreenChange = () => {
      if (enteringFullscreen) return;

      if (!document.fullscreenElement) {
        // Student exited fullscreen
        fullscreenWarningCount++;
        if (fullscreenWarningCount === 1) {
          showToast('⚠️ You have exited fullscreen. Returning to fullscreen now...', 'error');
          setTimeout(() => requestFullscreen(), 500);
        } else if (fullscreenWarningCount === 2) {
          showToast('⚠️ Final warning: Please stay in fullscreen or your exam will be submitted.', 'error');
          setTimeout(() => requestFullscreen(), 500);
        } else if (fullscreenWarningCount >= 3) {
          showToast('Your exam is being submitted due to repeated fullscreen violations.', 'error');
          doSubmitRef.current(
            'Exam Auto-Submitted',
            'Your exam was automatically submitted due to repeated fullscreen mode violations.'
          );
        }
      }
    };

    const handleFullscreenError = () => {
      console.warn('Fullscreen error - retrying');
      setTimeout(() => requestFullscreen(), 1000);
    };

    // Request fullscreen on load
    requestFullscreen();

    // Add listeners for fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('fullscreenerror', handleFullscreenError);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('fullscreenerror', handleFullscreenError);
    };
  }, []);

  // Network connection listeners
  useEffect(() => {
    const retryOfflineSubmissions = async () => {
      const queue = getQueue();
      for (const submission of queue) {
        try {
          await submitExamAnswers(submission.examId as any, submission.answers);
          removeFromQueue(submission.id);
          showToast('Your queued exam was submitted successfully!', 'success');
        } catch (error) {
          incrementAttemptCount(submission.id);
          const attempt = submission.attemptCount + 1;
          if (attempt > 5) {
            removeFromQueue(submission.id);
            showToast('Unable to submit queued exam after multiple retries. Please try manually.', 'error');
          }
        }
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      showToast('Connection restored. Retrying to submit your exam...', 'info');
      retryOfflineSubmissions();
      void saveDraftToServer();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [getQueue, removeFromQueue, incrementAttemptCount, saveDraftToServer]);

  // Auto-save answers after a short pause, with a periodic backup.
  useEffect(() => {
    if (submittedRef.current) return;
    setDraftStatus('saving');
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      void saveDraftToServer();
    }, 4_000);

    const autoSaveInterval = setInterval(() => {
      void saveDraftToServer();
    }, 30_000);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      clearInterval(autoSaveInterval);
    };
  }, [answers, saveDraftToServer]);

  const q = questions[currentQ] || null;
  const answered = Object.keys(answers).filter(k => answers[Number(k)] !== undefined && answers[Number(k)] !== '').length;
  const progressPct = questions.length > 0 ? (answered / questions.length) * 100 : 0;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerColor = timeLeft <= 60 ? 'text-red-500' : timeLeft <= 300 ? 'text-gold-500' : 'text-forest-500';

  // Filter questions for display if showing flagged only
  const displayQuestions = showFlaggedOnly ? questions.filter(qu => flags.has(qu.id)) : questions;
  const displayedQ = displayQuestions.length > 0 ? displayQuestions[Math.min(currentQ, displayQuestions.length - 1)] : null;
  const flaggedCount = flags.size;

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

  const displayingFiltered = showFlaggedOnly && displayQuestions.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#exam-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-white focus:p-2 focus:rounded focus:shadow focus:z-[100]">Skip to exam content</a>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 py-3">
        {!isOnline && (
          <>
            <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-800 text-sm px-4 py-2 font-semibold text-center mb-2 rounded-md" role="alert" aria-live="assertive">
              ⚠️ You are offline. Your answers are being saved locally and will submit when your connection is restored.
            </div>
            <div className="sr-only" role="status" aria-live="polite">
              {getQueue().length > 0 && `${getQueue().length} exam submission(s) queued for retry`}
            </div>
          </>
        )}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-forest-500 text-lg">{exam.title}</h3>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className={`flex items-center gap-2 font-mono text-lg font-bold ${timerColor}`} role="timer" aria-live="polite" aria-label={`Time remaining: ${mins} minutes ${secs} seconds`}>
              <Icon name="clock" className="w-5 h-5" /> {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${draftStatus === 'saving' ? 'border-gold-200 bg-gold-50 text-gold-700' : draftStatus === 'saved' ? 'border-forest-200 bg-forest-50 text-forest-700' : draftStatus === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`} role="status" aria-live="polite">
              <span className={`h-2.5 w-2.5 rounded-full ${draftStatus === 'saving' ? 'bg-gold-500 animate-pulse' : draftStatus === 'saved' ? 'bg-forest-500' : draftStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'}`} />
              {draftStatus === 'saving' ? 'Saving draft...' : draftStatus === 'saved' ? `Draft saved ${formatDraftAge(lastDraftSavedAt)}` : draftStatus === 'error' ? 'Draft save failed' : 'Draft not saved yet'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-gold-400 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{answered} / {questions.length} answered</span>
              <span className="font-semibold text-forest-600">{Math.round(progressPct)}% complete</span>
            </div>
          </div>
          <div className="text-right text-xs font-medium text-gray-600 whitespace-nowrap" role="status" aria-label={`Progress: ${answered} answered, ${flaggedCount} flagged, ${questions.length - answered} unanswered`}>
            <div className="text-forest-700">{answered} answered</div>
            <div className="text-gold-600">{flaggedCount} flagged</div>
            <div className="text-gray-400">{questions.length - answered} left</div>
          </div>
        </div>
        {cheatFlags > 0 && (
          <div className="mt-2 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded-lg" role="alert">
            <Icon name="exclamation" className="w-4 h-4 inline" /> Tab switch detected! ({cheatFlags}/5)
          </div>
        )}
      </div>

      <div id="exam-content" className="max-w-3xl mx-auto p-4">
        <div className="gk-section-card p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-400">Question {currentQ + 1} of {questions.length}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.questionType === 'mc' ? 'bg-forest-100 text-forest-700' : q.questionType === 'essay' ? 'bg-gold-100 text-gold-700' : q.questionType === 'identification' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                {q.questionType === 'mc' ? 'Multiple Choice' : q.questionType === 'essay' ? 'Essay' : q.questionType === 'identification' ? 'Identification' : 'True / False'}
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer hover:text-forest-600 transition">
              <input 
                type="checkbox" 
                checked={flags.has(q.id)} 
                onChange={() => toggleFlag(q.id)}
                className="accent-gold-500 w-4 h-4"
              />
              <Icon name={flags.has(q.id) ? 'star' : 'star'} className={`w-4 h-4 ${flags.has(q.id) ? 'text-gold-500' : 'text-gray-300'}`} />
              <span className="text-sm font-medium">{flags.has(q.id) ? 'Flagged' : 'Flag for review'}</span>
            </label>
          </div>
          <p className="text-forest-500 text-lg font-medium mb-4">{q.questionText}</p>

          {(q.questionType === 'mc' || q.questionType === 'true_false') ? (
            <div className="space-y-2">
              {q.choices?.map((c: QuestionChoice) => (
                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${answers[q.id] === c.id ? 'border-gold-400 bg-gold-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name={`q${q.id}`} checked={answers[q.id] === c.id} onChange={() => setAnswers(a => ({ ...a, [q.id]: c.id }))} className="accent-forest-500" />
                  <span className="text-gray-700">{c.choiceText}</span>
                </label>
              ))}
            </div>
          ) : q.questionType === 'identification' ? (
            <div>
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none"
                placeholder="Type your answer here..."
                value={(answers[q.id] as string) || ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">{((answers[q.id] as string) || '').length} characters</p>
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

        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-center gap-2">
            <button 
              onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
              className={`text-sm font-medium px-3 py-1.5 rounded-full transition flex items-center gap-1.5 ${showFlaggedOnly ? 'bg-gold-100 text-gold-700 border border-gold-300' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300'}`}
            >
              <Icon name="star" className={`w-4 h-4 ${showFlaggedOnly ? 'text-gold-500' : ''}`} />
              Flagged: {flaggedCount}
            </button>
            {showFlaggedOnly && (
              <button 
                onClick={() => setShowFlaggedOnly(false)}
                className="text-xs px-2 py-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              >
                Show all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {questions.map((qu: ExamQuestion, i: number) => {
              const isAnswered = answers[qu.id] !== undefined && answers[qu.id] !== '';
              const isFlagged = flags.has(qu.id);
              const isCurrentQuestion = qu.id === q.id;
              return (
                <button key={i} onClick={() => setCurrentQ(i)}
                  aria-label={`Question ${i + 1}${isAnswered ? ', answered' : ', unanswered'}${isFlagged ? ', flagged' : ''}${isCurrentQuestion ? ', current' : ''}`}
                  className={`w-8 h-8 rounded-full text-xs font-bold transition relative ${isCurrentQuestion ? 'bg-forest-500 text-white' : isAnswered ? 'bg-forest-100 text-forest-700 border border-forest-300' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                  {i + 1}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-gold-500 rounded-full border border-white"></span>
                  )}
                </button>
              );
            })}
          </div>
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
