import { Link } from 'react-router-dom';
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
import { SCHOOL_NAME } from '../../utils/constants';
import Icon from '../../components/Icons';

const STEPS = ['Personal Info', 'School Info', 'Family Details', 'Documents', 'Review & Submit'];

export default function StudentAdmission() {
  const w = useAdmissionWizard();

  if (w.gateLoading && !w.gateData) return <SkeletonPage />;
  if (w.gateError) return <ErrorAlert error={w.gateError} onRetry={w.refetch} />;

  /* Exam gate */
  if (!w.existingApp && !w.examPassed) {
    return (
      <div>
        <PageHeader title="Admission Application" subtitle={`${SCHOOL_NAME} \u2014 Admission Form`} />
        <div className="gk-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4"><Icon name="lock" className="w-8 h-8 text-forest-500" /></div>
          <h3 className="text-xl font-bold text-forest-500 mb-2">Entrance Exam Required</h3>
          <p className="text-gray-500 mb-2">You must pass the entrance examination before you can submit an admission application.</p>
          <p className="text-gray-400 text-sm mb-6">Please take and pass the entrance exam first, then come back here to complete your admission.</p>
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
      <PageHeader title="Admission Application" subtitle={`${SCHOOL_NAME} \u2014 Admission Form`} />

      <div className="bg-forest-50 border border-forest-200 rounded-xl p-4 mb-6">
        <h4 className="font-semibold text-forest-700 text-sm mb-2 flex items-center gap-1.5"><Icon name="clipboard" className="w-4 h-4" /> Admission Policy & Procedure</h4>
        <div className="text-xs text-forest-600 space-y-1">
          <p>Admission is open to all students regardless of race, religion, gender, or socioeconomic status.</p>
          <p><strong>Procedure:</strong> ① Pass Entrance Exam → ② Submit Application & Documents → ③ Screening & Evaluation → ④ Admission Confirmation</p>
          <p><strong>Age Requirement:</strong> Kindergarten applicants must be 5 years old by October 31 of the school year. Grade 1 requires proof of kindergarten completion.</p>
          <p><strong>Late Admission:</strong> Accepted up to 2 weeks after the first day of classes with School Head approval.</p>
          <p className="text-gray-400">New students may undergo an interview and/or diagnostic entrance test as required. All data handled per RA 10173 (Data Privacy Act).</p>
        </div>
      </div>

      <p className="text-sm text-gold-600 bg-gold-50 border border-gold-200 rounded-lg px-4 py-2 mb-6 flex items-center gap-2"><Icon name="info" className="w-4 h-4 shrink-0" /> Parents or guardians may fill out this form on behalf of their child.</p>

      {w.isDirty && (
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
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
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/30 text-xs font-bold">{i + 1 < w.step ? '✓' : i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i + 1 < w.step ? 'bg-forest-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {w.step === 1 && <StepPersonalInfo form={w.form} set={w.set} setForm={w.setForm} goTo={w.goTo} />}
      {w.step === 2 && <StepSchoolInfo form={w.form} set={w.set} setForm={w.setForm} goTo={w.goTo} requiredDocs={w.requiredDocs} slotFiles={w.slotFiles} user={w.user} />}
      {w.step === 3 && <StepFamilyDetails form={w.form} set={w.set} goTo={w.goTo} />}
      {w.step === 4 && <StepDocuments form={w.form} requiredDocs={w.requiredDocs} slotFiles={w.slotFiles} extraFiles={w.extraFiles} goTo={w.goTo} handleSlotFile={w.handleSlotFile} handleExtraFiles={w.handleExtraFiles} removeSlot={w.removeSlot} removeExtra={w.removeExtra} />}
      {w.step === 5 && <StepReview form={w.form} slotFiles={w.slotFiles} extraFiles={w.extraFiles} requiredDocs={w.requiredDocs} privacyConsent={w.privacyConsent} setPrivacyConsent={w.setPrivacyConsent} saving={w.saving} goTo={w.goTo} handleSubmit={w.handleSubmit} />}

      <Modal open={w.successOpen} onClose={() => w.setSuccessOpen(false)}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4"><Icon name="trophy" className="w-8 h-8 text-gold-500" /></div>
          <h3 className="text-xl font-bold text-forest-500">Application Submitted!</h3>
          {w.submittedTrackingId && (
            <div className="mt-3 bg-forest-50 border border-forest-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Your Tracking ID</p>
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
              <p className="text-xs text-gray-400 mt-1">Save this ID to track your application status anytime.</p>
            </div>
          )}
          <p className="text-gray-500 mt-2">Your admission application has been received by <strong>{SCHOOL_NAME}</strong>.</p>
          <p className="text-xs text-gray-400 mt-2">Next step: The school will screen your application and notify you of your admission status.</p>
          <Link to="/student/dashboard" className="mt-4 inline-block bg-forest-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-forest-600">Go to Dashboard</Link>
        </div>
      </Modal>
    </div>
  );
}
