import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getStudentHomeSummary } from '../../api/admissions';
import { StatCard, PageHeader, SkeletonPage, ErrorAlert } from '../../components/UI';
import { formatDate, formatTime } from '../../utils/helpers';
import { ADMISSION_PROGRESS_STEPS, SCHOOL_BRAND, shouldSkipEntranceExam } from '../../utils/constants';
import Icon from '../../components/Icons';
import type { Admission, ExamRegistration, ExamResult } from '../../types';
import { type ReactNode, useState, useEffect, useCallback } from 'react';

interface DashboardData {
  myApp: Admission | null;
  myReg: ExamRegistration | null;
  myResult: ExamResult | null;
  hasCompletedExam: boolean;
  examStatus: { text: string; icon: string; color: string };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [draftStep, setDraftStep] = useState(1);
  const [hasAdmissionDraft, setHasAdmissionDraft] = useState(false);
  const requiresEntranceExam = !shouldSkipEntranceExam(user?.applicantProfile?.gradeLevel);

  const { data: rawData, loading, error, refetch } = useAsync<DashboardData>(async () => {
    const summary = await getStudentHomeSummary();
    const myApp = summary?.myAdmission || null;
    const regSummary = summary?.registrationSummary;
    const myResult = summary?.myResult || null;
    const myReg = regSummary?.latest || null;
    const hasCompletedExam = !!regSummary?.hasCompletedExam;

    let examText = 'Not Started', examIcon = 'clipboard', examColor = 'blue';
    if (myResult) { examText = myResult.passed ? 'Passed' : 'Failed'; examIcon = myResult.passed ? 'checkCircle' : 'xCircle'; examColor = myResult.passed ? 'emerald' : 'red'; }
    else if (myReg?.status === 'started') { examText = 'In Progress'; examIcon = 'exam'; examColor = 'amber'; }
    else if (myReg) { examText = 'Scheduled'; examIcon = 'calendar'; examColor = 'amber'; }

    return { myApp, myReg, myResult, hasCompletedExam, examStatus: { text: examText, icon: examIcon, color: examColor } };
  }, [user]);

  const myApp = rawData?.myApp || null;
  const myReg = rawData?.myReg || null;
  const myResult = rawData?.myResult || null;
  const hasCompletedExam = rawData?.hasCompletedExam || false;
  const examStatus = rawData?.examStatus || { text: 'Not Started', icon: 'clipboard', color: 'blue' };

  const statusText = myApp ? myApp.status : 'Not Submitted';
  const statusColor = statusText === 'Accepted' ? 'emerald' : statusText === 'Rejected' ? 'red' : 'amber';
  const admissionUnlocked = hasCompletedExam || !requiresEntranceExam;
  const dashboardStats = requiresEntranceExam
    ? [
        { icon: examStatus.icon, value: examStatus.text, label: 'Exam Status', color: examStatus.color },
        { icon: admissionUnlocked ? 'lockOpen' : 'lock', value: admissionUnlocked ? 'Unlocked' : 'Locked', label: 'Admission Access', color: admissionUnlocked ? 'emerald' : 'blue' },
        { icon: statusText === 'Accepted' ? 'checkCircle' : statusText === 'Rejected' ? 'xCircle' : 'clock', value: statusText, label: 'Admission Status', color: statusColor },
        { icon: 'document', value: myApp?.documents?.length || 0, label: 'Documents Uploaded', color: 'amber' },
      ]
    : [
        { icon: 'lockOpen', value: 'Open', label: 'Admission Access', color: 'emerald' },
        { icon: statusText === 'Accepted' ? 'checkCircle' : statusText === 'Rejected' ? 'xCircle' : 'clock', value: statusText, label: 'Admission Status', color: statusColor },
        { icon: 'document', value: myApp?.documents?.length || 0, label: 'Documents Uploaded', color: 'amber' },
      ];

  const journeySteps = requiresEntranceExam ? [
    { step: 1, label: 'Register', desc: 'Create your account', icon: 'check', done: true },
    { step: 2, label: 'Book Exam', desc: 'Schedule entrance exam', icon: 'calendar', done: !!myReg },
    { step: 3, label: 'Complete Exam', desc: 'Finish the entrance exam', icon: 'trophy', done: admissionUnlocked },
    { step: 4, label: 'Apply', desc: 'Submit admission form', icon: 'admissions', done: !!myApp },
    { step: 5, label: 'Accepted', desc: 'Admission confirmed', icon: 'graduationCap', done: myApp?.status === 'Accepted' },
  ] : [
    { step: 1, label: 'Register', desc: 'Create your account', icon: 'check', done: true },
    { step: 2, label: 'Open Application', desc: 'Fill out the online form', icon: 'admissions', done: !!myApp || hasAdmissionDraft },
    { step: 3, label: 'Submit Application', desc: 'Upload documents and send it in', icon: 'clipboard', done: !!myApp },
    { step: 4, label: 'Accepted', desc: 'Admission confirmed', icon: 'graduationCap', done: myApp?.status === 'Accepted' },
  ];

  const syncDraftState = useCallback(() => {
    try {
      const rawStep = localStorage.getItem('gk_admission_step');
      const parsedStep = rawStep ? Number.parseInt(rawStep, 10) : 1;
      const safeStep = Number.isFinite(parsedStep) ? Math.min(Math.max(parsedStep, 1), 5) : 1;
      setDraftStep(safeStep);
      setHasAdmissionDraft(!!localStorage.getItem('gk_admission_draft'));
    } catch {
      setDraftStep(1);
      setHasAdmissionDraft(false);
    }
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === 'gk_admission_step' || event.key === 'gk_admission_draft') {
        syncDraftState();
      }
    };
    const onStorageChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (!detail?.key || detail.key === 'gk_admission_step' || detail.key === 'gk_admission_draft') {
        syncDraftState();
      }
    };

    syncDraftState();
    window.addEventListener('storage', onStorage);
    window.addEventListener('gk:storage-changed', onStorageChanged as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('gk:storage-changed', onStorageChanged as EventListener);
    };
  }, [syncDraftState, myApp?.id, myApp?.status]);

  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <PageHeader title={`Welcome, ${user?.firstName || 'Student'}`} subtitle="Here is an overview of your exam and admission status." />

      {!myReg && !myApp && !loading && (
        <div className="gk-section-card p-6 mb-6 border-l-4 border-gold-400 bg-gradient-to-r from-gold-50 to-white">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gold-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="key" className="w-5 h-5 text-gold-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800 mb-1">Welcome to {SCHOOL_BRAND}!</h3>
              <p className="text-gray-500 text-sm mb-4">
                {requiresEntranceExam
                  ? "You're all set. Here's what to do next to complete your application:"
                  : 'Applicants for Grade 6 and below can go straight to the online application form.'}
              </p>
              <div className="flex flex-wrap gap-4 mb-5">
                {(requiresEntranceExam ? [
                  { num: '1', label: 'Create account', done: true },
                  { num: '2', label: 'Book entrance exam', done: false },
                  { num: '3', label: 'Submit admission application', done: false },
                ] : [
                  { num: '1', label: 'Create account', done: true },
                  { num: '2', label: 'Open online application', done: true },
                  { num: '3', label: 'Submit admission application', done: false },
                ]).map(({ num, label, done }) => (
                  <div key={num} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {done ? <Icon name="check" className="w-3.5 h-3.5" /> : num}
                    </div>
                    <span className={`text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{label}</span>
                  </div>
                ))}
              </div>
              <Link to={requiresEntranceExam ? '/student/exam' : '/student/admission'} className="gk-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
                <Icon name={requiresEntranceExam ? 'calendar' : 'admissions'} className="w-4 h-4" />
                {requiresEntranceExam ? 'Book Entrance Exam' : 'Open Online Application Form'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Step-by-step journey tracker */}
      <div className="gk-section-card p-6 mb-6">
        <h3 className="gk-heading-sm text-gray-800 mb-5 flex items-center gap-2">
          <span className="p-1.5 bg-gold-50 rounded-lg"><Icon name="star" className="w-5 h-5 text-gold-500" /></span>
          Your Application Journey
        </h3>
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${requiresEntranceExam ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
          {journeySteps.map(({ step, label, desc, icon, done }) => (
            <div key={step} className={`relative rounded-xl border-2 p-4 text-center transition-all ${done ? 'border-forest-300 bg-forest-50/50' : 'border-gray-200 bg-gray-50/30'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${done ? 'bg-forest-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {done ? <Icon name="check" className="w-5 h-5" /> : <Icon name={icon} className="w-5 h-5" />}
              </div>
              <p className={`text-sm font-bold ${done ? 'text-forest-700' : 'text-gray-500'}`}>{label}</p>
              <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
              {done && <span className="absolute top-2 right-2 text-forest-500"><Icon name="checkCircle" className="w-4 h-4" /></span>}
            </div>
          ))}
        </div>
      </div>

      {/* Exam countdown */}
      {myReg && myReg.status === 'scheduled' && myReg.schedule && (() => {
        const schedDate = new Date(myReg.schedule.scheduledDate + 'T00:00:00');
        const now = new Date();
        const diffMs = schedDate.getTime() - now.getTime();
        if (diffMs <= 0) return null;
        const days = Math.ceil(diffMs / 86400000);
        return (
          <div className="gk-section-card p-5 mb-6 border-l-4 border-amber-400 bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Icon name="clock" className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-800">Exam Coming Up!</h4>
                <p className="text-sm text-gray-500">
                  Your entrance exam is on <strong>{formatDate(myReg.schedule.scheduledDate)}</strong> and will be available all day.
                </p>
              </div>
              <div className="text-center px-4">
                <div className="text-2xl font-extrabold text-amber-600">{days}d</div>
                <div className="text-sm text-gray-500">until available</div>
              </div>
              <Link to="/student/exam" className="gk-btn-primary px-4 py-2 text-sm whitespace-nowrap">
                <Icon name="exam" className="w-4 h-4 mr-1.5 inline" />Go to Exam
              </Link>
            </div>
          </div>
        );
      })()}

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${requiresEntranceExam ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-5 mb-8 animate-stagger`}>
        {dashboardStats.map((stat) => (
          <StatCard key={stat.label} icon={stat.icon} value={stat.value} label={stat.label} color={stat.color} />
        ))}
      </div>

      <div className="gk-section-card p-6 mb-8">
        <h3 className="gk-heading-sm text-gray-800 mb-5 flex items-center gap-2">
          <span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="admissions" className="w-5 h-5 text-forest-500" /></span>
          Admission Progress
        </h3>
        {myApp ? (
          <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
            {(() => {
              const steps = ADMISSION_PROGRESS_STEPS;
              const rejected = myApp.status === 'Rejected';
              const currentIdx = steps.indexOf(myApp.status);
              return (
                <>
                  {steps.map((step, i) => {
                    const done = currentIdx >= 0 ? i < currentIdx : false;
                    const current = !rejected && myApp.status === step;
                    const detail = current ? (
                      step === 'Submitted' ? 'Your application has been received and is awaiting screening.' :
                      step === 'Under Screening' ? 'Your documents are being screened by the admissions office.' :
                      step === 'Under Evaluation' ? 'Your application is being evaluated for admission.' :
                      'Congratulations! Your admission has been accepted.'
                    ) : done ? 'Completed' : 'Pending';
                    return <TimelineItem key={step} done={done || (current && step === 'Accepted')} current={current && step !== 'Accepted'} label={step} detail={i === 0 ? formatDate(myApp.submittedAt) : detail} />;
                  })}
                  {rejected && <TimelineItem done label="Rejected" detail="Your application was not approved. Please contact the registrar for details." />}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="clipboard" className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="font-bold text-gray-800 mb-1.5">No Application Yet</h4>
            {admissionUnlocked ? (
              <>
                <p className="text-gray-500 text-sm mb-4 max-w-lg mx-auto">
                  {requiresEntranceExam
                    ? 'You completed the entrance exam. Track your admission form progress below and continue where you left off.'
                    : 'You can continue to the online application form below and track your submission from this dashboard.'}
                </p>

                <div className="max-w-xl mx-auto text-left rounded-xl border border-forest-200 bg-forest-50/60 p-4 mb-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-forest-700">Admission Form Progress</span>
                    <span className="text-xs font-semibold text-forest-700">{Math.round(((draftStep - 1) / 4) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-forest-100">
                    <div className="h-full bg-forest-500 rounded-full transition-all" style={{ width: `${((draftStep - 1) / 4) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {hasAdmissionDraft
                      ? `Draft found. You are on Step ${draftStep} of 5.`
                      : 'No saved draft yet. Start your application to begin tracking progress.'}
                  </p>
                </div>

                <Link to="/student/admission" className="gk-btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm">
                  <Icon name={hasAdmissionDraft ? 'arrowRight' : 'plus'} className="w-4 h-4" />
                  {hasAdmissionDraft ? `Continue Application (Step ${draftStep})` : 'Start Application'}
                </Link>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">You need to complete the entrance exam first before applying for admission.</p>
                <Link to="/student/exam" className="gk-btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm">
                  <Icon name="exam" className="w-4 h-4" />
                  Take Entrance Exam
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <div className="gk-section-card p-6">
        <h3 className="gk-heading-sm text-gray-800 mb-5 flex items-center gap-2">
          <span className="p-1.5 bg-forest-50 rounded-lg"><Icon name="arrowRight" className="w-5 h-5 text-forest-500" /></span>
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <Link to={requiresEntranceExam ? '/student/exam' : '/student/admission'} className="gk-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Icon name={requiresEntranceExam ? 'exam' : 'admissions'} className="w-4 h-4" />
            {requiresEntranceExam ? 'Go to Exam' : 'Open Application Form'}
          </Link>
          <Link to={admissionUnlocked ? '/student/admission' : '/student/track'} className="gk-btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Icon name={admissionUnlocked ? 'admissions' : 'clipboard'} className="w-4 h-4" />
            {admissionUnlocked ? 'Go to Admission' : 'Track Application'}
          </Link>
          <Link to="/student/results" className="gk-btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Icon name="results" className="w-4 h-4" />
            View Results
          </Link>
        </div>
      </div>
    </div>
  );
}

interface TimelineItemProps {
  done?: boolean;
  current?: boolean;
  label: string;
  detail: ReactNode;
}

function TimelineItem({ done, current, label, detail }: TimelineItemProps) {
  return (
    <div className="relative">
      <div className={`absolute -left-5 w-3 h-3 rounded-full border-2 transition-all ${done ? 'bg-forest-500 border-forest-500' : current ? 'bg-gold-400 border-gold-400 animate-pulse shadow-[0_0_0_4px_rgba(255,215,0,0.15)]' : 'bg-white border-gray-300'}`} />
      <h4 className={`font-semibold text-sm ${done ? 'text-forest-600' : current ? 'text-gray-800' : 'text-gray-400'}`}>{label}</h4>
      <p className="text-gray-500 text-xs mt-0.5">{detail}</p>
    </div>
  );
}
