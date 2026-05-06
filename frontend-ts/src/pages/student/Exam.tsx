import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { startExam as apiStartExam, getExamForStudent } from '../../api/exams';
import { getStudentHomeSummary } from '../../api/admissions';
import { showToast, showErrorToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { SkeletonPage, ErrorAlert, ActionButton, ProcessStatePanel } from '../../components/UI';
import Icon from '../../components/Icons';
import type { Exam, ExamRegistration, ExamResult } from '../../types';
import ScheduleView from './exam/ScheduleView';
import LiveExam from './exam/LiveExam';
import { shouldSkipEntranceExam } from '../../utils/constants';

interface ExamData {
  myReg: ExamRegistration | null;
  myResult: ExamResult | null;
}

export default function StudentExam() {
  const confirm = useConfirm();
  const [view, setView] = useState<'schedule' | 'lobby' | 'exam'>('schedule');
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [optimisticReg, setOptimisticReg] = useState<ExamRegistration | null>(null);
  const [cancelledRegId, setCancelledRegId] = useState<number | null>(null);
  const [recentlyBooked, setRecentlyBooked] = useState(false);
  const [recoveringExam, setRecoveringExam] = useState(false);

  const { user } = useAuth();
  if (shouldSkipEntranceExam(user?.applicantProfile?.gradeLevel)) {
    return <Navigate to="/student" replace />;
  }
  const { data: rawData, loading, error, refetch } = useAsync<ExamData>(async () => {
    const summary = await getStudentHomeSummary();
    const regSummary = summary?.registrationSummary;
    const myResult = summary?.myResult || null;
    const myReg = regSummary?.latest || null;
    return { myReg, myResult };
  }, [user], 0, { setLoadingOnReload: true });

  const myReg = rawData?.myReg || null;
  const activeServerReg = myReg && myReg.id !== cancelledRegId ? myReg : null;
  const activeOptimisticReg = optimisticReg && optimisticReg.id !== cancelledRegId ? optimisticReg : null;
  const activeReg = activeServerReg || activeOptimisticReg;
  const myResult = rawData?.myResult || null;

  const [startingExam, setStartingExam] = useState(false);

  const showLobby = (exam: Exam) => { setCurrentExam(exam); setView('lobby'); };
  const handleStartExam = async () => {
    if (startingExam || !activeReg) return;
    const examId = activeReg.schedule?.examId;
    if (!examId) {
      showToast('Exam details are missing for this registration. Please return to your exam schedule and try again.', 'error');
      return;
    }

    const ok = await confirm({
      title: 'Start Exam Now?',
      message: 'You are about to begin the exam. You cannot pause or restart once it starts. Continue?',
      confirmLabel: 'Start Exam',
      variant: 'warning',
    });
    if (!ok) return;

    setStartingExam(true);
    try {
      await apiStartExam(activeReg.id);
      const loadedExam = await getExamForStudent(examId);
      setCurrentExam(loadedExam);
      setView('exam');
      refetch();
    } catch (err: unknown) {
      showErrorToast(err, 'Failed to start exam. Please try again.');
    } finally {
      setStartingExam(false);
    }
  };

  useEffect(() => {
    if (activeReg?.status === 'started') {
      let cancelled = false;
      setRecoveringExam(true);
      (async () => {
        try {
          const examId = activeReg.schedule?.examId;
          const exam = examId ? await getExamForStudent(examId) : null;
          if (!cancelled && exam) {
            setCurrentExam(exam);
            setView('exam');
          }
        } catch (err: unknown) {
          if (!cancelled) {
            showErrorToast(err, 'Could not restore your in-progress exam.');
          }
          console.error('Exam recovery failed:', err);
        } finally {
          if (!cancelled) setRecoveringExam(false);
        }
      })();
      return () => { cancelled = true; };
    }

    setRecoveringExam(false);
  }, [activeReg]);

  useEffect(() => {
    if (myReg && optimisticReg) {
      setOptimisticReg(null);
    }
  }, [myReg, optimisticReg]);

  useEffect(() => {
    if (!myReg && cancelledRegId !== null) {
      setCancelledRegId(null);
    }
  }, [myReg, cancelledRegId]);

  useEffect(() => {
    if (!recentlyBooked) return;
    const timer = window.setTimeout(() => setRecentlyBooked(false), 7000);
    return () => window.clearTimeout(timer);
  }, [recentlyBooked]);

  if (loading && !rawData) return <SkeletonPage />;
  if (recoveringExam && view !== 'exam') return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  if (view === 'exam' && currentExam && activeReg) {
    return <LiveExam exam={currentExam} registration={activeReg} />;
  }

  if (view === 'lobby' && currentExam) {
    if (startingExam) {
      return (
        <div className="max-w-2xl mx-auto">
          <ProcessStatePanel
            tone="info"
            loading
            title="Starting Your Exam Session..."
            message="Please wait while we prepare your question set and timer. This should only take a moment."
          />
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto">
        <div className="gk-section-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4"><Icon name="documentText" className="w-8 h-8 text-forest-500" /></div>
          <h2 className="text-2xl font-bold text-forest-500 mb-2">Ready to Begin</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            You are about to start the <strong>{currentExam.title}</strong>.<br />
            Duration: <strong>{typeof currentExam.durationMinutes === 'number' ? currentExam.durationMinutes : 'N/A'}</strong> minutes<br />
            Total Questions: <strong>{currentExam.questionCount ?? currentExam.questions?.length ?? 0}</strong><br />
            Passing Score: <strong>{typeof currentExam.passingScore === 'number' ? `${currentExam.passingScore}%` : 'N/A'}</strong>
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left mb-4">
            <h4 className="font-bold text-red-600 mb-2 flex items-center gap-2"><Icon name="exclamation" className="w-5 h-5" /> Critical Rules - Read Before Starting</h4>
            <ul className="text-red-700 text-sm space-y-1.5 list-disc pl-5">
              <li><strong>After 5 tab switches, the exam will be automatically submitted.</strong> Do not switch tabs or apps.</li>
              <li><strong>The exam will auto-submit when the timer reaches zero.</strong> Monitor your time.</li>
              <li>Right-click and copy/paste are disabled during the exam.</li>
            </ul>
          </div>
          <div className="bg-gold-50 border border-gold-200 rounded-lg p-4 text-left mb-6">
            <h4 className="font-bold text-forest-500 mb-2 flex items-center gap-2"><Icon name="info" className="w-5 h-5 text-gold-500" /> Reminders</h4>
            <ul className="text-gray-600 text-sm space-y-1 list-disc pl-5">
              <li>Ensure a stable internet connection before starting.</li>
              <li>You cannot pause or restart the exam once it begins.</li>
              <li>Your answers are saved automatically as you go.</li>
            </ul>
          </div>
          <ActionButton onClick={handleStartExam} disabled={startingExam} className="px-8 py-3 text-lg bg-gradient-to-r from-forest-500 to-forest-400 hover:from-gold-500 hover:to-gold-600 shadow-md" icon={<Icon name="exam" className="w-5 h-5" />}>
            {startingExam ? 'Starting...' : 'Start Exam'}
          </ActionButton>
        </div>
      </div>
    );
  }

  return (
    <ScheduleView
      myReg={activeReg}
      myResult={myResult}
      onLobby={showLobby}
      onRefresh={refetch}
      onBookedRegistration={(registration) => {
        setOptimisticReg(registration);
        setCancelledRegId(null);
        setRecentlyBooked(true);
      }}
      onCancelledRegistration={(registrationId) => {
        setCancelledRegId(registrationId);
        setOptimisticReg(prev => (prev?.id === registrationId ? null : prev));
        setRecentlyBooked(false);
        setCurrentExam(null);
        setView('schedule');
      }}
      showBookedSuccess={recentlyBooked}
      user={user}
    />
  );
}
