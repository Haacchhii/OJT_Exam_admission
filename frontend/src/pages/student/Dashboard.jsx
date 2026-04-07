import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getMyAdmission } from '../../api/admissions.js';
import { getMyRegistrationSummary } from '../../api/exams.js';
import { getMyResult } from '../../api/results.js';
import { StatCard, PageHeader, SkeletonPage, ErrorAlert } from '../../components/UI.jsx';
import { formatDate } from '../../utils/helpers.js';
import { ADMISSION_PROGRESS_STEPS } from '../../utils/constants.js';
import Icon from '../../components/Icons.jsx';
import { SCHOOL_NAME_SHORT } from '../../utils/constants';

export default function StudentDashboard() {
  const { user } = useAuth();

  const { data: rawData, loading, error, refetch } = useAsync(async () => {
    const [myApp, regSummary, myResult] = await Promise.all([
      getMyAdmission(), getMyRegistrationSummary(), getMyResult()
    ]);
    const myReg = regSummary?.latest || null;

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

      {/* Onboarding banner — shown only to brand-new accounts that haven't booked an exam yet */}
      {!myReg && !myApp && !loading && (
        <div className="gk-card p-6 mb-6 border-l-4 border-gold-400 bg-gradient-to-r from-gold-50 to-white">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gold-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="key" className="w-5 h-5 text-gold-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-800 mb-1">Welcome to {SCHOOL_NAME_SHORT}!</h3>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-stagger">
        <StatCard icon={examStatus.icon} value={examStatus.text} label="Exam Status" color={examStatus.color} />
        <StatCard icon={admissionUnlocked ? 'lockOpen' : 'lock'} value={admissionUnlocked ? 'Unlocked' : 'Locked'} label="Admission Access" color={admissionUnlocked ? 'emerald' : 'blue'} />
        <StatCard icon={statusText === 'Accepted' ? 'checkCircle' : statusText === 'Rejected' ? 'xCircle' : 'clock'} value={statusText} label="Admission Status" color={statusColor} />
        <StatCard icon="document" value={myApp?.documents?.length || 0} label="Documents Uploaded" color="amber" />
      </div>

      {/* Admission Timeline */}
      <div className="gk-card p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
          <Icon name="admissions" className="w-5 h-5 text-forest-500" />
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

      {/* Quick Actions */}
      <div className="gk-card p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
          <Icon name="arrowRight" className="w-5 h-5 text-forest-500" />
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/student/exam" className="gk-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Icon name="exam" className="w-4 h-4" />
            Go to Exam
          </Link>
          <Link to="/student/admission" className={`gk-btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm ${!admissionUnlocked ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
            <Icon name="admissions" className="w-4 h-4" />
            {admissionUnlocked ? 'Go to Admission' : 'Admission (Locked)'}
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

function TimelineItem({ done, current, label, detail }) {
  return (
    <div className="relative">
      <div className={`absolute -left-5 w-3 h-3 rounded-full border-2 transition-all ${done ? 'bg-forest-500 border-forest-500' : current ? 'bg-gold-400 border-gold-400 animate-pulse shadow-[0_0_0_4px_rgba(255,215,0,0.15)]' : 'bg-white border-gray-300'}`} />
      <h4 className={`font-semibold text-sm ${done ? 'text-forest-600' : current ? 'text-gray-800' : 'text-gray-400'}`}>{label}</h4>
      <p className="text-gray-500 text-xs mt-0.5">{detail}</p>
    </div>
  );
}
