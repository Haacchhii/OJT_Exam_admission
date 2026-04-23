import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { getActivePeriod } from '../../api/academicYears';
import { showToast } from '../../components/Toast';
import { useAdmissionWizard } from './admission/useAdmissionWizard';
import ExistingApplication from './admission/ExistingApplication';
import StepPersonalInfo from './admission/StepPersonalInfo';
import StepSchoolInfo from './admission/StepSchoolInfo';
import StepFamilyDetails from './admission/StepFamilyDetails';
import StepDocuments from './admission/StepDocuments';
import StepReview from './admission/StepReview';
import Modal from '../../components/Modal';
import { PageHeader, SkeletonPage, ErrorAlert } from '../../components/UI';
import { SCHOOL_NAME, shouldSkipEntranceExam } from '../../utils/constants';
import Icon from '../../components/Icons';

const STEPS = ['Personal Info', 'School Info', 'Family Details', 'Documents', 'Review & Submit'];

function toIsoDay(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWithinPeriod(today: string, start: string | null, end: string | null) {
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

function formatDisplayDate(v: string | null): string {
  if (!v) return 'Open';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function StudentAdmission() {
  const w = useAdmissionWizard();
  const requiresEntranceExam = !shouldSkipEntranceExam(w.user?.applicantProfile?.gradeLevel);
  const { data: activePeriod } = useAsync(() => getActivePeriod());

  const activeSemester = activePeriod?.semesters?.find(s => s.isActive) || null;
  const todayIso = toIsoDay(new Date()) || '';
  const semStart = toIsoDay(activeSemester?.startDate || null);
  const semEnd = toIsoDay(activeSemester?.endDate || null);
  const semStartText = formatDisplayDate(semStart);
  const semEndText = formatDisplayDate(semEnd);
  const isApplicationPeriodOpen = !!activeSemester && isWithinPeriod(todayIso, semStart, semEnd);

  if (w.gateLoading && !w.gateData) return <SkeletonPage />;
  if (w.gateError) return <ErrorAlert error={w.gateError} onRetry={w.refetch} />;

  if (!w.existingApp && activePeriod && !isApplicationPeriodOpen) {
    return (
      <div>
        <PageHeader title="Admission Application" subtitle={`${SCHOOL_NAME} - Admission Form`} />
        <div className="gk-section-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4"><Icon name="clock" className="w-8 h-8 text-red-500" /></div>
          <h3 className="text-xl font-bold text-red-600 mb-2">Application Period Is Currently Closed</h3>
          <p className="text-gray-500 mb-2">Admissions are only accepted during the active school period.</p>
          <p className="text-gray-500 text-base mb-2">
            Active period: <strong>{activePeriod.year}</strong> - <strong>{activeSemester?.name || 'N/A'}</strong>
          </p>
          <p className="text-gray-500 text-base mb-6">
            Window: <strong>{semStartText}</strong> - <strong>{semEndText}</strong>
          </p>
          <Link to="/student/dashboard" className="inline-block bg-forest-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-forest-600">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  /* Exam gate */
  if (!w.existingApp && requiresEntranceExam && !w.examCompleted) {
    return (
      <div>
        <PageHeader title="Admission Application" subtitle={`${SCHOOL_NAME} - Admission Form`} />
        <div className="gk-section-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4"><Icon name="lock" className="w-8 h-8 text-forest-500" /></div>
          <h3 className="text-xl font-bold text-forest-500 mb-2">Entrance Exam Completion Required</h3>
          <p className="text-gray-500 mb-2">You must complete the entrance examination before you can submit an admission application.</p>
          <p className="text-gray-500 text-base mb-6">Please complete your entrance exam first, then come back here to continue your admission.</p>
          <Link to="/student/exam" className="inline-block bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-3 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600 shadow-md">Go to Entrance Exam</Link>
        </div>
      </div>
    );
  }

  /* Existing application view */
  if (w.existingApp && w.showWizard) {
    return <ExistingApplication existingApp={w.existingApp} onNewApplication={() => w.setShowWizard(false)} />;
  }

  /* Multi-step wizard */
  return (
    <div>
      <PageHeader title="Admission Application" subtitle={`${SCHOOL_NAME} - Admission Form`} />

      {activePeriod && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${isApplicationPeriodOpen ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <p className="font-semibold">Application Period: {activePeriod.year} - {activeSemester?.name || 'N/A'}</p>
          <p className="text-sm mt-1">Window: {semStartText} - {semEndText}</p>
        </div>
      )}

      <div className="bg-forest-50 border border-forest-200 rounded-xl p-4 mb-6">
        <h4 className="font-semibold text-forest-700 text-base mb-2 flex items-center gap-1.5"><Icon name="clipboard" className="w-4 h-4" /> Admission Policy & Procedure</h4>
        <div className="text-sm text-forest-700 space-y-1">
          <p>Admission is open to all students regardless of race, religion, gender, or socioeconomic status.</p>
          <p><strong>Procedure:</strong> {requiresEntranceExam ? '1) Complete Entrance Exam, then 2) Submit Application and Documents, then 3) Screening and Evaluation, then 4) Admission Confirmation' : '1) Complete the online application form, then 2) Upload documents, then 3) Screening and Evaluation, then 4) Admission Confirmation'}</p>
          <p><strong>Age Requirement:</strong> Kindergarten applicants must be 5 years old by October 31 of the school year. Grade 1 requires proof of kindergarten completion.</p>
          <p><strong>Late Admission:</strong> Accepted up to 2 weeks after the first day of classes with School Head approval.</p>
          <p className="text-gray-500">New students may undergo an interview and/or diagnostic entrance test as required. Preschool and Grade School applicants use the online application form directly. All data handled per RA 10173 (Data Privacy Act).</p>
        </div>
      </div>

      <p className="text-sm text-gold-600 bg-gold-50 border border-gold-200 rounded-lg px-4 py-2 mb-6 flex items-center gap-2"><Icon name="info" className="w-4 h-4 shrink-0" /> Parents or guardians may fill out this form on behalf of their child.</p>

      {w.isDirty && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Icon name="checkCircle" className="w-3.5 h-3.5 text-forest-400" />
          <span>Your progress is automatically saved. You can safely close and return later.</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-gray-700">Step {w.step} of {STEPS.length}</span>
          <span className="text-sm font-medium text-forest-600">{Math.round(((w.step - 1) / (STEPS.length - 1)) * 100)}% complete</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-forest-500 rounded-full transition-all duration-300" style={{ width: `${((w.step - 1) / (STEPS.length - 1)) * 100}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-1 mb-8 flex-wrap">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${i + 1 === w.step ? 'bg-forest-500 text-white' : i + 1 < w.step ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-400'}`}>
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/30 text-xs font-bold">{i + 1 < w.step ? 'OK' : i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i + 1 < w.step ? 'bg-forest-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {w.step === 1 && <StepPersonalInfo form={w.form} set={w.set} setForm={w.setForm} goTo={w.goTo} errors={w.errors} clearError={w.clearError} />}
      {w.step === 2 && <StepSchoolInfo form={w.form} set={w.set} setForm={w.setForm} goTo={w.goTo} requiredDocs={w.requiredDocs} slotFiles={w.slotFiles} user={w.user} errors={w.errors} clearError={w.clearError} />}
      {w.step === 3 && <StepFamilyDetails form={w.form} set={w.set} goTo={w.goTo} errors={w.errors} />}
      {w.step === 4 && <StepDocuments form={w.form} requiredDocs={w.requiredDocs} optionalDocs={w.optionalDocs} slotFiles={w.slotFiles} extraFiles={w.extraFiles} goTo={w.goTo} handleSlotFile={w.handleSlotFile} handleExtraFiles={w.handleExtraFiles} removeSlot={w.removeSlot} removeExtra={w.removeExtra} />}
      {w.step === 5 && <StepReview form={w.form} slotFiles={w.slotFiles} extraFiles={w.extraFiles} requiredDocs={w.requiredDocs} privacyConsent={w.privacyConsent} setPrivacyConsent={w.setPrivacyConsent} saving={w.saving} goTo={w.goTo} handleSubmit={w.handleSubmit} />}

      <Modal open={w.successOpen} onClose={() => w.setSuccessOpen(false)}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4"><Icon name="trophy" className="w-8 h-8 text-gold-500" /></div>
          <h3 className="text-xl font-bold text-forest-500">Application Submitted!</h3>
          {w.submittedTrackingId && (
            <div className="mt-3 bg-forest-50 border border-forest-200 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-600 mb-1">Your Tracking ID</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-lg font-mono font-bold text-forest-700">{w.submittedTrackingId}</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(w.submittedTrackingId);
                    showToast('Tracking ID copied to clipboard!', 'success');
                  }}
                  className="p-1.5 rounded-lg hover:bg-forest-100 text-forest-500 transition-colors"
                  title="Copy to clipboard"
                >
                  <Icon name="clipboard" className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">Save this ID to track your application status anytime.</p>
            </div>
          )}
          <p className="text-gray-500 mt-2">Your admission application has been received by <strong>{SCHOOL_NAME}</strong>.</p>
          <div className="mt-3 rounded-lg border border-gold-200 bg-gold-50 px-4 py-3 text-left">
            <p className="text-sm font-semibold text-gold-800 mb-1">What happens next</p>
            <ul className="text-sm text-gold-800 space-y-1 list-disc list-inside">
              <li>Initial screening starts within 1-3 business days.</li>
              <li>Status is usually finalized within 5-10 business days.</li>
              <li>Check your dashboard anytime to view application progress.</li>
            </ul>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link to="/student/dashboard" className="inline-flex items-center gap-1.5 border border-forest-200 text-forest-700 px-5 py-2 rounded-lg font-semibold hover:bg-forest-50">
              <Icon name="dashboard" className="w-4 h-4" /> View Status in Dashboard
            </Link>
            <Link to="/student/results" className="inline-block bg-forest-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-forest-600">Go to Results</Link>
          </div>
        </div>
      </Modal>
    </div>
  );
}
