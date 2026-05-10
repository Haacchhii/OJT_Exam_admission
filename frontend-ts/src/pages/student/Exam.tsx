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
import ExamSecurityNotice from '../../components/ExamSecurityNotice';
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
  const [view, setView] = useState<'schedule' | 'lobby' | 'security-notice' | 'exam'>('schedule');
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

  const requestFullscreen = async (): Promise<boolean> => {
    try {
      const elem = document.documentElement;
      if (document.fullscreenElement) return true;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
        return true;
      }
      const fallback = elem as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };
      if (fallback.webkitRequestFullscreen) { await fallback.webkitRequestFullscreen(); return true; }
      if (fallback.mozRequestFullScreen) { await fallback.mozRequestFullScreen(); return true; }
      if (fallback.msRequestFullscreen) { await fallback.msRequestFullscreen(); return true; }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
    return false;
  };

  const showLobby = (exam: Exam) => { setCurrentExam(exam); setView('lobby'); };
  
  const handleStartExam = () => {
    if (startingExam || !activeReg) return;
    // Show security notice instead of starting directly
    setView('security-notice');
  };

  const handleSecurityNoticeConfirm = async () => {
    if (startingExam || !activeReg) return;
    const examId = activeReg.schedule?.examId;
    if (!examId) {
      showToast('Exam details are missing for this registration. Please return to your exam schedule and try again.', 'error');
      return;
    }

    const fullscreenEnabled = await requestFullscreen();
    if (!fullscreenEnabled) {
      showToast('Fullscreen could not be enabled automatically. The exam will still start, but please maximize your browser window.', 'warning');
    }

    setStartingExam(true);
    try {
      await apiStartExam(activeReg.id);
      const loadedExam = await getExamForStudent(examId);
      setCurrentExam(loadedExam);
      setView('exam');
      await refetch();
    } catch (err: unknown) {
      showErrorToast(err, 'Failed to start exam. Please try again.');
      setView('lobby');
    } finally {
      setStartingExam(false);
    }
  };

  const handleSecurityNoticeCancel = () => {
    setView('lobby');
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

  if (view === 'security-notice' && currentExam) {
    return (
      <ExamSecurityNotice
        examTitle={currentExam.title}
        durationMinutes={typeof currentExam.durationMinutes === 'number' ? currentExam.durationMinutes : 0}
        questionCount={currentExam.questionCount ?? currentExam.questions?.length ?? 0}
        passingScore={typeof currentExam.passingScore === 'number' ? currentExam.passingScore : 0}
        onConfirm={handleSecurityNoticeConfirm}
        onCancel={handleSecurityNoticeCancel}
      />
    );
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
          <p className="text-gray-500 mb-8 leading-relaxed">
            You are about to start the <strong>{currentExam.title}</strong>.<br />
            Duration: <strong>{typeof currentExam.durationMinutes === 'number' ? currentExam.durationMinutes : 'N/A'}</strong> minutes<br />
            Total Questions: <strong>{currentExam.questionCount ?? currentExam.questions?.length ?? 0}</strong><br />
            Passing Score: <strong>{typeof currentExam.passingScore === 'number' ? `${currentExam.passingScore}%` : 'N/A'}</strong>
          </p>
          <div className="bg-gold-50 border border-gold-200 rounded-lg p-4 text-left mb-6">
            <h4 className="font-bold text-forest-500 mb-2 flex items-center gap-2"><Icon name="info" className="w-5 h-5 text-gold-500" /> Before You Start</h4>
            <ul className="text-gray-600 text-sm space-y-1 list-disc pl-5">
              <li>You will see a detailed security notice with all exam rules and requirements.</li>
              <li>Please read it carefully and confirm before starting the exam.</li>
              <li>Your answers are saved automatically as you progress through the exam.</li>
            </ul>
          </div>
          <ActionButton onClick={handleStartExam} disabled={startingExam} className="px-8 py-3 text-lg bg-gradient-to-r from-forest-500 to-forest-400 hover:from-gold-500 hover:to-gold-600 shadow-md" icon={<Icon name="exam" className="w-5 h-5" />}>
            {startingExam ? 'Starting...' : 'View Security Notice & Start Exam'}
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
