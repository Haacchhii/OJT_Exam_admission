import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getMyAdmission } from '../../api/admissions';
import { getMyRegistrations } from '../../api/exams';
import { getMyResult } from '../../api/results';
import { StatCard, PageHeader, SkeletonPage, ErrorAlert } from '../../components/UI';
import { formatDate, formatTime } from '../../utils/helpers';
import { ADMISSION_PROGRESS_STEPS, SCHOOL_BRAND } from '../../utils/constants';
import Icon from '../../components/Icons';
import type { Admission, ExamRegistration, ExamResult } from '../../types';
import { type ReactNode, useState, useEffect } from 'react';

interface DashboardData {
  myApp: Admission | null;
  myReg: ExamRegistration | null;
  myResult: ExamResult | null;
  examStatus: { text: string; icon: string; color: string };
}

export default function StudentDashboard() {
  const { user } = useAuth();

  const { data: rawData, loading, error, refetch } = useAsync<DashboardData>(async () => {
    const [myApp, myRegs, myResult] = await Promise.all([
      getMyAdmission(), getMyRegistrations(), getMyResult()
    ]);
    const myReg = myRegs?.[0] || null;

    let examText = 'Not Started', examIcon = 'clipboard', examColor = 'blue';
    if (myResult) { examText = myResult.passed ? 'Passed' : 'Failed'; examIcon = myResult.passed ? 'checkCircle' : 'xCircle'; examColor = myResult.passed ? 'emerald' : 'red'; }
    else if (myReg?.status === 'started') { examText = 'In Progress'; examIcon = 'exam'; examColor = 'amber'; }
    else if (myReg) { examText = 'Scheduled'; examIcon = 'calendar'; examColor = 'amber'; }

    return { myApp, myReg, myResult, examStatus: { text: examText, icon: examIcon, color: examColor } };
  }, [user]);

  const myApp = rawData?.myApp || null;
  const myReg = rawData?.myReg || null;
  const myResult = rawData?.myResult || null;
  const examStatus = rawData?.examStatus || { text: 'Not Started', icon: 'clipboard', color: 'blue' };

  const statusText = myApp ? myApp.status : 'Not Submitted';
  const statusColor = statusText === 'Accepted' ? 'emerald' : statusText === 'Rejected' ? 'red' : 'amber';
  const admissionUnlocked = myResult?.passed === true;

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
              <p className="text-gray-500 text-sm mb-4">You're all set. Here's what to do next to complete your application:</p>
              <div className="flex flex-wrap gap-4 mb-5">
                {[
                  { num: '1', label: 'Create account', done: true },
                  { num: '2', label: 'Book entrance exam', done: false },
                  { num: '3', label: 'Submit admission application', done: false },
                ].map(({ num, label, done }) => (
                  <div key={num} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {done ? <Icon name="check" className="w-3.5 h-3.5" /> : num}
                    </div>
                    <span className={`text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{label}</span>
                  </div>
                ))}
              </div>
              <Link to="/student/exam" className="gk-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
                <Icon name="calendar" className="w-4 h-4" />
                Book Entrance Exam
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { step: 1, label: 'Register', desc: 'Create your account', icon: 'check', done: true },
            { step: 2, label: 'Book Exam', desc: 'Schedule entrance exam', icon: 'calendar', done: !!myReg },
            { step: 3, label: 'Pass Exam', desc: 'Complete & pass the exam', icon: 'trophy', done: !!myResult?.passed },
            { step: 4, label: 'Apply', desc: 'Submit admission form', icon: 'admissions', done: !!myApp },
            { step: 5, label: 'Accepted', desc: 'Admission confirmed', icon: 'graduationCap', done: myApp?.status === 'Accepted' },
          ].map(({ step, label, desc, icon, done }) => (
            <div key={step} className={`relative rounded-xl border-2 p-4 text-center transition-all ${done ? 'border-forest-300 bg-forest-50/50' : 'border-gray-200 bg-gray-50/30'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${done ? 'bg-forest-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {done ? <Icon name="check" className="w-5 h-5" /> : <Icon name={icon} className="w-5 h-5" />}
              </div>
              <p className={`text-sm font-bold ${done ? 'text-forest-700' : 'text-gray-500'}`}>{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              {done && <span className="absolute top-2 right-2 text-forest-500"><Icon name="checkCircle" className="w-4 h-4" /></span>}
            </div>
          ))}
        </div>
      </div>

      {/* Exam countdown */}
      {myReg && myReg.status === 'scheduled' && myReg.schedule && (() => {
        const schedDate = new Date(myReg.schedule.scheduledDate + 'T' + (myReg.schedule.startTime || '09:00'));
        const now = new Date();
        const diffMs = schedDate.getTime() - now.getTime();
        if (diffMs <= 0) return null;
        const days = Math.floor(diffMs / 86400000);
        const hours = Math.floor((diffMs % 86400000) / 3600000);
        return (
          <div className="gk-section-card p-5 mb-6 border-l-4 border-amber-400 bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Icon name="clock" className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-800">Exam Coming Up!</h4>
                <p className="text-sm text-gray-500">
                  Your entrance exam is on <strong>{formatDate(myReg.schedule.scheduledDate)}</strong> at <strong>{formatTime(myReg.schedule.startTime)}</strong>
                </p>
              </div>
              <div className="text-center px-4">
                <div className="text-2xl font-extrabold text-amber-600">{days > 0 ? `${days}d ${hours}h` : `${hours}h`}</div>
                <div className="text-xs text-gray-400">until exam</div>
              </div>
              <Link to="/student/exam" className="gk-btn-primary px-4 py-2 text-sm whitespace-nowrap">
                <Icon name="exam" className="w-4 h-4 mr-1.5 inline" />Go to Exam
              </Link>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 animate-stagger">
        <StatCard icon={examStatus.icon} value={examStatus.text} label="Exam Status" color={examStatus.color} />
        <StatCard icon={admissionUnlocked ? 'lockOpen' : 'lock'} value={admissionUnlocked ? 'Unlocked' : 'Locked'} label="Admission Access" color={admissionUnlocked ? 'emerald' : 'blue'} />
        <StatCard icon={statusText === 'Accepted' ? 'checkCircle' : statusText === 'Rejected' ? 'xCircle' : 'clock'} value={statusText} label="Admission Status" color={statusColor} />
        <StatCard icon="document" value={myApp?.documents?.length || 0} label="Documents Uploaded" color="amber" />
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
                <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">You passed the entrance exam! You can now submit your admission application.</p>
                <Link to="/student/admission" className="gk-btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm">
                  <Icon name="plus" className="w-4 h-4" />
                  Apply Now
                </Link>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">You need to pass the entrance exam first before applying for admission.</p>
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
          <Link to="/student/exam" className="gk-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Icon name="exam" className="w-4 h-4" />
            Go to Exam
          </Link>
          <Link to={admissionUnlocked ? '/student/admission' : '/student/exam'} className="gk-btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Icon name={admissionUnlocked ? 'admissions' : 'lock'} className="w-4 h-4" />
            {admissionUnlocked ? 'Go to Admission' : 'Take Exam to Unlock Admission'}
          </Link>
          <Link to="/student/results" className="gk-btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Icon name="results" className="w-4 h-4" />
            View Results
          </Link>
          <Link to="/student/track" className="gk-btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Icon name="search" className="w-4 h-4" />
            Track Application
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
