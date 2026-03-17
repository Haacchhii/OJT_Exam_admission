import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getExamSchedules, getMyRegistrations, startExam as apiStartExam, getExamForStudent } from '../../api/exams';
import { getMyResult } from '../../api/results';
import { showToast } from '../../components/Toast';
import { SkeletonPage, ErrorAlert } from '../../components/UI';
import Icon from '../../components/Icons';
import { asArray } from '../../utils/helpers';
import type { Exam, ExamSchedule, ExamRegistration, ExamResult } from '../../types';
import ScheduleView from './exam/ScheduleView';
import LiveExam from './exam/LiveExam';

interface ExamData {
  myReg: ExamRegistration | null;
  myResult: ExamResult | null;
}

export default function StudentExam() {
  const [view, setView] = useState<'schedule' | 'lobby' | 'exam'>('schedule');
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);

  const { user } = useAuth();
  const { data: rawData, loading, error, refetch } = useAsync<ExamData>(async () => {
    const [myRegs, myResult] = await Promise.all([
      getMyRegistrations(), getMyResult()
    ]);
    const myReg = myRegs?.[0] || null;
    return { myReg, myResult };
  }, [user]);

  const myReg = rawData?.myReg || null;
  const myResult = rawData?.myResult || null;

  const [startingExam, setStartingExam] = useState(false);

  const showLobby = (exam: Exam) => { setCurrentExam(exam); setView('lobby'); };
  const handleStartExam = async () => {
    if (startingExam || !myReg) return;
    setStartingExam(true);
    try {
      await apiStartExam(myReg.id);
      refetch();
      setView('exam');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to start exam. Please try again.', 'error');
    } finally {
      setStartingExam(false);
    }
  };

  useEffect(() => {
    if (myReg?.status === 'started') {
      let cancelled = false;
      (async () => {
        try {
          const rawSchedules = await getExamSchedules();
          if (cancelled) return;
          const schedule = asArray<ExamSchedule>(rawSchedules).find((s: ExamSchedule) => s.id === myReg.scheduleId);
          const exam = schedule ? await getExamForStudent(schedule.examId) : null;
          if (!cancelled && exam) { setCurrentExam(exam); setView('exam'); }
        } catch (err) {
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
            Total Questions: <strong>{currentExam.questionCount ?? currentExam.questions?.length ?? 0}</strong><br />
            Passing Score: <strong>{currentExam.passingScore}%</strong>
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left mb-4">
            <h4 className="font-bold text-red-600 mb-2 flex items-center gap-2"><Icon name="exclamation" className="w-5 h-5" /> Critical Rules — Read Before Starting</h4>
            <ul className="text-red-700 text-sm space-y-1.5 list-disc pl-5">
              <li><strong>After 3 tab switches, the exam will be automatically submitted.</strong> Do not switch tabs or apps.</li>
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
          <button onClick={handleStartExam} disabled={startingExam} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:from-gold-500 hover:to-gold-600 shadow-md inline-flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
            {startingExam ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Starting…</> : <><Icon name="exam" className="w-5 h-5" /> Start Exam</>}
          </button>
        </div>
      </div>
    );
  }

  return <ScheduleView myReg={myReg} myResult={myResult} onLobby={showLobby} onRefresh={refetch} user={user} />;
}
