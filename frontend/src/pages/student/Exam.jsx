import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getExams, getExamSchedules, getMyRegistrations, registerForExam, getExamForStudent, startExam as apiStartExam, getAvailableSchedules } from '../../api/exams.js';
import { getMyResult, submitExamAnswers } from '../../api/results.js';
import { showToast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { PageHeader, SkeletonPage, ErrorAlert } from '../../components/UI.jsx';
import Icon from '../../components/Icons.jsx';
import { formatTime } from '../../utils/helpers.js';

export default function StudentExam() {
  const [view, setView] = useState('schedule'); // schedule | lobby | exam
  const [currentExam, setCurrentExam] = useState(null);
  const navigate = useNavigate();

  const { user } = useAuth();
  const { data: rawData, loading, error, refetch } = useAsync(async () => {
    const [myRegs, myResult] = await Promise.all([
      getMyRegistrations(), getMyResult()
    ]);
    const myReg = myRegs?.[0] || null;
    return { myReg, myResult };
  }, [user]);

  const myReg = rawData?.myReg || null;
  const myResult = rawData?.myResult || null;

  const [startingExam, setStartingExam] = useState(false);

  const showLobby = (exam) => { setCurrentExam(exam); setView('lobby'); };
  const handleStartExam = async () => {
    if (startingExam) return;
    setStartingExam(true);
    try {
      await apiStartExam(myReg.id);
      refetch();
      setView('exam');
    } catch (err) {
      showToast(err.message || 'Failed to start exam. Please try again.', 'error');
    } finally {
      setStartingExam(false);
    }
  };

  // Crash recovery: if registration is 'started' but not 'done', resume exam
  useEffect(() => {
    if (myReg?.status === 'started') {
      let cancelled = false;
      (async () => {
        try {
          const schedules = await getExamSchedules();
          if (cancelled) return;
          const schedule = schedules.find(s => s.id === myReg.scheduleId);
          const exam = schedule ? await getExamForStudent(schedule.examId) : null;
          if (!cancelled && exam) { setCurrentExam(exam); setView('exam'); }
        } catch (err) {
          // Network error during recovery — stay on schedule view
          console.error('Exam recovery failed:', err);
        }
      })();
      return () => { cancelled = true; };
    }
  }, [myReg]);

  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  if (view === 'exam' && currentExam && myReg) {
    return <LiveExam exam={currentExam} registration={myReg} />;
  }

  if (view === 'lobby' && currentExam) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="gk-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4"><Icon name="documentText" className="w-8 h-8 text-forest-500" /></div>
          <h2 className="text-2xl font-bold text-forest-500 mb-2">Ready to Begin</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            You are about to start the <strong>{currentExam.title}</strong>.<br />
            Duration: <strong>{currentExam.durationMinutes}</strong> minutes<br />
            Total Questions: <strong>{currentExam.questions.length}</strong><br />
            Passing Score: <strong>{currentExam.passingScore}%</strong>
          </p>
          <div className="bg-gold-50 border border-gold-200 rounded-lg p-4 text-left mb-6">
            <h4 className="font-bold text-forest-500 mb-2 flex items-center gap-2"><Icon name="exclamation" className="w-5 h-5 text-gold-500" /> Important Rules</h4>
            <ul className="text-gray-600 text-sm space-y-1 list-disc pl-5">
              <li>Do not switch tabs or leave this window during the exam.</li>
              <li>Right-click and copy/paste are disabled.</li>
              <li>The exam will auto-submit when the timer reaches zero.</li>
              <li>After 3 tab switches, the exam will be automatically submitted.</li>
              <li>Ensure a stable internet connection before starting.</li>
            </ul>
          </div>
          <button onClick={handleStartExam} disabled={startingExam} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:from-gold-500 hover:to-gold-600 shadow-md inline-flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
            {startingExam ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Starting…</> : <><Icon name="exam" className="w-5 h-5" /> Start Exam</>}
          </button>
        </div>
      </div>
    );
  }

  // Schedule view
  return <ScheduleView myReg={myReg} myResult={myResult} onLobby={showLobby} onRefresh={refetch} user={user} />;
}

/* ===== Schedule View ===== */
function ScheduleView({ myReg, myResult, onLobby, onRefresh, user }) {
  // All hooks must be called before any early returns (Rules of Hooks)
  const confirm = useConfirm();
  const [bookingSlotId, setBookingSlotId] = useState(null);

  const { data: schedData } = useAsync(async () => {
    const [schedules, exams, availableSchedules] = await Promise.all([getExamSchedules(), getExams(), getAvailableSchedules()]);
    return { schedules, exams, availableSchedules };
  });

  const schedules = schedData?.schedules || [];
  const exams = schedData?.exams || [];

  if (myReg?.status === 'done') {
    return (
      <div>
        <PageHeader title="Entrance Examination" subtitle="Select an available exam slot and confirm your booking." />
        <div className="gk-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-3"><Icon name="checkCircle" className="w-7 h-7 text-forest-500" /></div>
          <h3 className="font-bold text-forest-500 mb-1">Exam Completed</h3>
          <p className="text-gray-500 text-sm mb-4">You have already taken the exam. View your results below.</p>
          <Link to="/student/results" className="inline-block bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600">View Results</Link>
        </div>
      </div>
    );
  }

  if (myReg) {
    const schedule = schedules.find(s => s.id === myReg.scheduleId);
    const exam = schedule ? exams.find(e => e.id === schedule.examId) : null;
    // Time gate: only allow starting exam when current time >= scheduled date+start time
    const [now, setNow] = useState(() => new Date());
    const schedStart = schedule ? new Date(`${schedule.scheduledDate}T${schedule.startTime}:00`) : null;
    const canStart = schedStart ? now >= schedStart : false;
    // Re-check canStart every 30 seconds so the button appears on time
    useEffect(() => {
      if (canStart) return; // already eligible, no need to poll
      const interval = setInterval(() => setNow(new Date()), 30000);
      return () => clearInterval(interval);
    }, [canStart]);
    return (
      <div>
        <PageHeader title="Entrance Examination" subtitle="Select an available exam slot and confirm your booking." />
        <div className="gk-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-3"><Icon name="calendar" className="w-7 h-7 text-forest-500" /></div>
          <h3 className="font-bold text-forest-500 mb-2">Exam Scheduled</h3>
          {myReg.trackingId && (
            <div className="mb-4 bg-forest-50 border border-forest-200 rounded-lg px-4 py-2 inline-block">
              <span className="text-xs text-gray-500">Tracking ID: </span>
              <span className="font-mono font-bold text-forest-700">{myReg.trackingId}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left mb-6">
            <span className="text-xs text-gray-400">Exam</span><span className="text-sm font-medium">{exam?.title || 'N/A'}</span>
            <span className="text-xs text-gray-400">Date</span><span className="text-sm font-medium">{schedule?.scheduledDate || 'N/A'}</span>
            <span className="text-xs text-gray-400">Time</span><span className="text-sm font-medium">{schedule ? `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}` : 'N/A'}</span>
            <span className="text-xs text-gray-400">Duration</span><span className="text-sm font-medium">{exam ? `${exam.durationMinutes} minutes` : 'N/A'}</span>
          </div>
          {canStart ? (
            <button onClick={() => onLobby(exam)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-8 py-3 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600 shadow-md">Take Exam Now</button>
          ) : (
            <p className="text-gray-400 text-sm flex items-center justify-center gap-1.5"><Icon name="clock" className="w-4 h-4" /> Exam will open on <strong>{schedule?.scheduledDate}</strong> at <strong>{formatTime(schedule?.startTime)}</strong></p>
          )}
        </div>
      </div>
    );
  }

  // Not registered - show available slots (from server-side filtering)
  const available = schedData?.availableSchedules || [];

  const bookSlot = async (scheduleId) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    const exam = schedule ? exams.find(e => e.id === schedule.examId) : null;
    const ok = await confirm({
      title: 'Confirm Booking',
      message: `Book "${exam?.title || 'Exam'}" on ${schedule?.scheduledDate} at ${formatTime(schedule?.startTime)}?`,
      confirmLabel: 'Book Slot',
      variant: 'info',
    });
    if (!ok) return;
    setBookingSlotId(scheduleId);
    try {
      const reg = await registerForExam(user.email, scheduleId);
      if (reg) {
        const trackMsg = reg.trackingId ? ` Your tracking ID: ${reg.trackingId}` : '';
        showToast(`Exam slot booked successfully!${trackMsg}`, 'success');
        onRefresh();
      }
      else showToast('Slot is full or you are already registered. Please choose another.', 'error');
    } catch {
      showToast('Failed to book slot. Please try again.', 'error');
    } finally {
      setBookingSlotId(null);
    }
  };

  return (
    <div>
      <PageHeader title="Entrance Examination" subtitle="Select an available exam slot and confirm your booking." />
      <div className="gk-card p-4 mb-6">
        <div className="flex items-center gap-3 text-forest-600">
          <Icon name="clipboard" className="w-6 h-6 text-forest-500" />
          <div><strong className="text-forest-500">Welcome to the Entrance Exam</strong><p className="text-gray-500 text-sm">Select an available exam slot below to book your entrance examination.</p></div>
        </div>
      </div>
      <div className="gk-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Available Exam Slots</h3>
        {available.length > 0 ? (
          <div className="space-y-3">
            {available.map(s => {
              const exam = exams.find(e => e.id === s.examId);
              const remaining = s.maxSlots - s.slotsTaken;
              const d = new Date(s.scheduledDate + 'T00:00:00');
              return (
                <div key={s.id} className="flex items-center gap-4 bg-gray-50 rounded-lg p-4">
                  <div className="text-center bg-forest-500 text-white rounded-lg px-3 py-2 min-w-[60px]">
                    <div className="text-xs uppercase">{d.toLocaleString('en-US', { month: 'short' })}</div>
                    <div className="text-xl font-bold">{d.getDate()}</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-forest-500">{exam?.title || 'Exam'}</h4>
                    <p className="text-gray-500 text-sm">{formatTime(s.startTime)} - {formatTime(s.endTime)} · {remaining} slots left</p>
                  </div>
                  <button
                    onClick={() => bookSlot(s.id)}
                    disabled={bookingSlotId === s.id}
                    className="bg-forest-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-forest-600 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {bookingSlotId === s.id ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Booking…</> : 'Book This Slot'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-6">No available exam slots at this time.</p>
        )}
      </div>
    </div>
  );
}

/* ===== Live Exam ===== */
function LiveExam({ exam, registration }) {
  const [currentQ, setCurrentQ] = useState(0);
  // Recover answers from sessionStorage if available (crash recovery)
  const [answers, setAnswers] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`gk_exam_answers_${registration.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  // Calculate remaining time from startedAt to survive page refresh
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
  const [autoModal, setAutoModal] = useState(null);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);
  const navigate = useNavigate();

  const questions = exam.questions;

  // Persist answers to sessionStorage on change for crash recovery
  useEffect(() => {
    try { sessionStorage.setItem(`gk_exam_answers_${registration.id}`, JSON.stringify(answers)); } catch {}
  }, [answers, registration.id]);

  // Keep a ref to the latest answers so timer/cheat effects always see current state
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const doSubmit = useCallback(async (title, msg) => {
    if (submittedRef.current) return; // Prevent double-fire
    submittedRef.current = true;
    clearInterval(timerRef.current);
    try {
      await submitExamAnswers(registration.id, answersRef.current);
    } catch (err) {
      // Allow retry on failure — answers are still in sessionStorage
      submittedRef.current = false;
      showToast(err.message || 'Failed to submit exam. Please try again.', 'error');
      return;
    }
    try { sessionStorage.removeItem(`gk_exam_answers_${registration.id}`); } catch {}
    if (title) setAutoModal({ title, msg });
    else { showToast('Exam submitted successfully!', 'success'); setTimeout(() => navigate('/student/results'), 1500); }
  }, [registration.id, navigate]);

  // Keep a stable ref to doSubmit for effects
  const doSubmitRef = useRef(doSubmit);
  doSubmitRef.current = doSubmit;

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          doSubmitRef.current('Time\'s Up!', 'Your exam has been automatically submitted because the time ran out.');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Cheat detection
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        setCheatFlags(prev => {
          const next = prev + 1;
          if (next >= 3) {
            doSubmitRef.current('⚠️ Exam Auto-Submitted', 'Your exam was automatically submitted due to multiple tab switches.');
          }
          return next;
        });
      }
    };
    const preventContext = (e) => e.preventDefault();
    // Warn before leaving/refreshing during exam
    const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    document.addEventListener('visibilitychange', handler);
    document.addEventListener('contextmenu', preventContext);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { document.removeEventListener('visibilitychange', handler); document.removeEventListener('contextmenu', preventContext); window.removeEventListener('beforeunload', beforeUnload); };
  }, []);

  const q = questions[currentQ];
  const answered = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== '').length;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerColor = timeLeft <= 60 ? 'text-red-500' : timeLeft <= 300 ? 'text-gold-500' : 'text-forest-500';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip link for accessibility — LiveExam renders outside Layout */}
      <a href="#exam-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-white focus:p-2 focus:rounded focus:shadow focus:z-[100]">Skip to exam content</a>
      {/* Exam Top Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-forest-500 text-lg">{exam.title}</h3>
          <div className={`flex items-center gap-2 font-mono text-lg font-bold ${timerColor}`} role="timer" aria-live="polite" aria-label={`Time remaining: ${mins} minutes ${secs} seconds`}>
            <Icon name="clock" className="w-5 h-5" /> {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gold-400 transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
          </div>
          <span className="text-sm text-gray-500">{answered} / {questions.length} answered</span>
        </div>
        {cheatFlags > 0 && (
          <div className="mt-2 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded-lg" role="alert">
            <Icon name="exclamation" className="w-4 h-4 inline" /> Tab switch detected! ({cheatFlags}/3)
          </div>
        )}
      </div>

      {/* Question */}
      <div id="exam-content" className="max-w-3xl mx-auto p-4">
        <div className="gk-card p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-bold text-gray-400">Question {currentQ + 1} of {questions.length}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.questionType === 'mc' ? 'bg-forest-100 text-forest-700' : 'bg-gold-100 text-gold-700'}`}>
              {q.questionType === 'mc' ? 'Multiple Choice' : 'Essay'}
            </span>
          </div>
          <p className="text-forest-500 text-lg font-medium mb-4">{q.questionText}</p>

          {q.questionType === 'mc' ? (
            <div className="space-y-2">
              {q.choices.map(c => (
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
                value={answers[q.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">{(answers[q.id] || '').length} characters</p>
            </div>
          )}
        </div>

        {/* Question Dots */}
        <div className="flex flex-wrap gap-1.5 justify-center mb-4">
          {questions.map((qu, i) => {
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

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrentQ(c => Math.max(0, c - 1))} disabled={currentQ === 0} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg disabled:opacity-40 hover:bg-gray-50 inline-flex items-center gap-1.5"><Icon name="chevronLeft" className="w-4 h-4" /> Previous</button>
          <button onClick={() => setShowSubmitModal(true)} className="bg-forest-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-forest-600 shadow-md inline-flex items-center gap-2"><Icon name="check" className="w-4 h-4" /> Submit Exam</button>
          <button onClick={() => setCurrentQ(c => Math.min(questions.length - 1, c + 1))} disabled={currentQ === questions.length - 1} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg disabled:opacity-40 hover:bg-gray-50 inline-flex items-center gap-1.5">Next <Icon name="chevronRight" className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Submit Confirmation */}
      <Modal open={showSubmitModal} onClose={() => setShowSubmitModal(false)}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-3"><Icon name="clipboard" className="w-7 h-7 text-forest-500" /></div>
          <h3 className="text-xl font-bold text-forest-500">Submit Your Exam?</h3>
          <p className="text-gray-500 mt-2">You have answered {answered} out of {questions.length} questions.</p>
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={() => { setShowSubmitModal(false); doSubmit(null, null); }} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600">Yes, Submit</button>
            <button onClick={() => setShowSubmitModal(false)} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Go Back</button>
          </div>
        </div>
      </Modal>

      {/* Auto-submit Modal */}
      <Modal open={!!autoModal} onClose={() => navigate('/student/results')}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gold-50 flex items-center justify-center mx-auto mb-3"><Icon name="clock" className="w-7 h-7 text-gold-500" /></div>
          <h3 className="text-xl font-bold text-forest-500">{autoModal?.title}</h3>
          <p className="text-gray-500 mt-2">{autoModal?.msg}</p>
          <button onClick={() => navigate('/student/results')} className="mt-4 bg-forest-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-forest-600">View Results</button>
        </div>
      </Modal>
    </div>
  );
}
