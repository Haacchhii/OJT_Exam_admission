import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { getAdmissions } from '../../api/admissions.js';
import { getExamRegistrations } from '../../api/exams.js';
import { getExamResults } from '../../api/results.js';
import { StatCard, PageHeader, SkeletonPage, ErrorAlert } from '../../components/UI.jsx';
import { formatDate } from '../../utils/helpers.js';

export default function StudentDashboard() {
  const { user } = useAuth();

  const { data: rawData, loading, error, refetch } = useAsync(async () => {
    const [admissions, registrations, results] = await Promise.all([
      getAdmissions(), getExamRegistrations(), getExamResults()
    ]);
    const myApp = admissions.find(a => a.email === user?.email) || null;
    const myReg = registrations.find(r => r.userEmail === user?.email) || null;
    const myResult = myReg ? results.find(r => r.registrationId === myReg.id) : null;

    let examText = 'Not Started', examIcon = '📋', examColor = 'blue';
    if (myResult) { examText = myResult.passed ? 'Passed' : 'Failed'; examIcon = myResult.passed ? '✅' : '❌'; examColor = myResult.passed ? 'emerald' : 'red'; }
    else if (myReg?.status === 'started') { examText = 'In Progress'; examIcon = '📝'; examColor = 'amber'; }
    else if (myReg) { examText = 'Scheduled'; examIcon = '📅'; examColor = 'amber'; }

    return { myApp, myReg, myResult, examStatus: { text: examText, icon: examIcon, color: examColor } };
  }, [user]);

  const myApp = rawData?.myApp || null;
  const myReg = rawData?.myReg || null;
  const myResult = rawData?.myResult || null;
  const examStatus = rawData?.examStatus || { text: 'Not Started', icon: '📋', color: 'blue' };

  const statusText = myApp ? myApp.status : 'Not Submitted';
  const statusColor = statusText === 'Accepted' ? 'emerald' : statusText === 'Rejected' ? 'red' : 'amber';
  const admissionUnlocked = myResult?.passed === true;

  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title={`Welcome, ${user?.firstName || 'Student'}`} subtitle="Here is an overview of your exam and admission status." />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={examStatus.icon} value={examStatus.text} label="Exam Status" color={examStatus.color} />
        <StatCard icon={admissionUnlocked ? '🔓' : '🔒'} value={admissionUnlocked ? 'Unlocked' : 'Locked'} label="Admission Access" color={admissionUnlocked ? 'emerald' : 'blue'} />
        <StatCard icon={statusText === 'Accepted' ? '✅' : statusText === 'Rejected' ? '❌' : '⏳'} value={statusText} label="Admission Status" color={statusColor} />
        <StatCard icon="📄" value={myApp ? myApp.documents.length : 0} label="Documents Uploaded" color="amber" />
      </div>

      {/* Admission Timeline */}
      <div className="lpu-card p-6 mb-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Admission Status</h3>
        {myApp ? (
          <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
            {(() => {
              const steps = ['Submitted', 'Under Screening', 'Under Evaluation', 'Accepted'];
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
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📋</div>
            <h4 className="font-bold text-forest-500 mb-1">No Application Yet</h4>
            {admissionUnlocked ? (
              <>
                <p className="text-gray-500 text-sm mb-4">You passed the entrance exam! You can now submit your admission application.</p>
                <Link to="/student/admission" className="inline-block bg-[#166534] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#14532d]">Apply Now</Link>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-4">You need to pass the entrance exam first before applying for admission.</p>
                <Link to="/student/exam" className="inline-block bg-[#166534] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#14532d]">Take Entrance Exam</Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="lpu-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/student/exam" className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-5 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600 shadow-sm">📖 Go to Exam</Link>
          <Link to="/student/admission" className={`border px-5 py-2.5 rounded-lg font-semibold ${admissionUnlocked ? 'border-forest-300 text-forest-700 hover:bg-forest-50' : 'border-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'}`}>📝 {admissionUnlocked ? 'Go to Admission' : 'Admission (Locked)'}</Link>
          <Link to="/student/results" className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-50">📊 View Results</Link>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ done, current, label, detail }) {
  return (
    <div className="relative">
      <div className={`absolute -left-5 w-3 h-3 rounded-full border-2 ${done ? 'bg-forest-500 border-forest-500' : current ? 'bg-gold-400 border-gold-400 animate-pulse' : 'bg-white border-gray-300'}`} />
      <h4 className={`font-semibold text-sm ${done ? 'text-forest-500' : 'text-gray-400'}`}>{label}</h4>
      <p className="text-gray-500 text-xs mt-0.5">{detail}</p>
    </div>
  );
}
