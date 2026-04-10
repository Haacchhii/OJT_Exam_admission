import DocumentReview from '../../../components/DocumentReview';
import { PageHeader, Badge, ActionButton } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { Detail } from './AdmissionFormFields';
import { formatDate, badgeClass } from '../../../utils/helpers';
import { showToast } from '../../../components/Toast';
import { ADMISSION_PROGRESS_STEPS, SCHOOL_PHONE } from '../../../utils/constants';
import type { Admission } from '../../../types';

interface Props {
  existingApp: Admission;
  onNewApplication: () => void;
}

export default function ExistingApplication({ existingApp, onNewApplication }: Props) {
  const statusSteps = ADMISSION_PROGRESS_STEPS;
  const currentIdx = statusSteps.indexOf(existingApp.status);

  // Build a timeline from available data
  const timeline: { label: string; date?: string; done: boolean; icon: string }[] = [
    { label: 'Application Submitted', date: existingApp.submittedAt, done: true, icon: 'document' },
    { label: 'Under Screening', date: currentIdx >= 1 ? existingApp.updatedAt : undefined, done: currentIdx >= 1, icon: 'search' },
    { label: 'Under Evaluation', date: currentIdx >= 2 ? existingApp.updatedAt : undefined, done: currentIdx >= 2, icon: 'clipboard' },
    ...(existingApp.status === 'Rejected'
      ? [{ label: 'Rejected', date: existingApp.updatedAt, done: true, icon: 'xCircle' }]
      : [{ label: 'Accepted', date: currentIdx >= 3 ? existingApp.updatedAt : undefined, done: currentIdx >= 3, icon: 'checkCircle' }]
    ),
  ];

  return (
    <div>
      <PageHeader title="Admission Application" subtitle="Track your admission progress below." />
      <div className="gk-section-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Your Submitted Application</h3>
        {existingApp.status !== 'Rejected' && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-500 mb-3">Admission Progress</h4>
            <div className="flex items-center gap-1 flex-wrap">
              {statusSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${i <= currentIdx ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-400'}`}>
                    <span className="w-4 h-4 flex items-center justify-center rounded-full bg-white/50 text-[10px] font-bold">{i <= currentIdx ? 'OK' : i + 1}</span>
                    <span className="hidden sm:inline">{s}</span>
                  </div>
                  {i < statusSteps.length - 1 && <div className={`w-6 h-0.5 ${i < currentIdx ? 'bg-forest-400' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
          </div>
        )}
        {existingApp.trackingId && (
          <div className="mb-4 bg-forest-50 border border-forest-200 rounded-lg px-4 py-3 inline-flex items-center gap-2">
            <span className="text-xs text-gray-500">Tracking ID: </span>
            <span className="font-mono font-bold text-forest-700">{existingApp.trackingId}</span>
            <ActionButton
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(existingApp.trackingId);
                showToast('Tracking ID copied to clipboard!', 'success');
              }}
              variant="ghost"
              size="sm"
              className="p-1 text-forest-500 hover:bg-forest-100"
              title="Copy to clipboard"
            >
              <Icon name="clipboard" className="w-3.5 h-3.5" />
            </ActionButton>
          </div>
        )}

        {/* Activity Timeline */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-500 mb-3">Activity Timeline</h4>
          <div className="relative pl-6 border-l-2 border-gray-200 space-y-4">
            {timeline.map((t, i) => (
              <div key={i} className="relative">
                <div className={`absolute -left-[25px] w-4 h-4 rounded-full border-2 ${t.done ? 'bg-forest-500 border-forest-500' : 'bg-white border-gray-300'}`} />
                <div className="flex items-start gap-2">
                  <Icon name={t.icon} className={`w-4 h-4 mt-0.5 flex-shrink-0 ${t.done ? 'text-forest-500' : 'text-gray-300'}`} />
                  <div>
                    <p className={`text-sm font-medium ${t.done ? 'text-gray-800' : 'text-gray-400'}`}>{t.label}</p>
                    {t.date && t.done && <p className="text-xs text-gray-400">{formatDate(t.date)}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Detail label="Full Name" value={`${existingApp.firstName} ${existingApp.middleName || ''} ${existingApp.lastName}`.replace(/\s+/g, ' ').trim()} />
          <Detail label="Email" value={existingApp.email} />
          <Detail label="Grade Level" value={existingApp.gradeLevel} />
          <Detail label="Applicant Type" value={existingApp.applicantType || 'New'} />
          <Detail label="Status"><Badge className={badgeClass(existingApp.status)}>{existingApp.status}</Badge></Detail>
          <Detail label="Submitted" value={formatDate(existingApp.submittedAt)} />
          <Detail label="Documents">
            {existingApp.documentFiles?.length > 0 ? (
              <DocumentReview admissionId={existingApp.id} documents={existingApp.documentFiles} />
            ) : (
              <span className="text-sm text-gray-500">{existingApp.documents.join(', ') || 'None'}</span>
            )}
          </Detail>
          {existingApp.notes && <div className="md:col-span-2"><Detail label="Notes from Registrar" value={existingApp.notes} /></div>}
        </div>
        {existingApp.status === 'Rejected' ? (
          <ActionButton variant="secondary" onClick={onNewApplication} className="mt-4">Submit New Application</ActionButton>
        ) : existingApp.status === 'Accepted' ? (
          <div className="mt-6 bg-forest-50 border border-forest-200 rounded-xl p-5">
            <h4 className="font-bold text-forest-700 mb-3 flex items-center gap-2"><Icon name="trophy" className="w-5 h-5 text-gold-500" /> Congratulations! Your application has been accepted.</h4>
            <p className="text-sm text-forest-600 mb-3">Here are the next steps to complete your enrollment:</p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-forest-600">
              <li><strong>Visit the Registrar's Office</strong> - Bring original documents for verification (Birth Certificate, Report Card, Good Moral Certificate).</li>
              <li><strong>Pay the enrollment/reservation fee</strong> - Secure your slot by paying at the school cashier or through the designated payment channels.</li>
              <li><strong>Attend the orientation</strong> - Check your email or the school bulletin for the scheduled orientation date for new students and parents.</li>
              <li><strong>Complete enrollment forms</strong> - Fill out the official Student Enrollment Form, Medical Form, and Emergency Contact Form at the Registrar's Office.</li>
              <li><strong>Receive your student ID and class schedule</strong> - These will be provided on or before the first day of classes.</li>
            </ol>
            <p className="text-xs text-gray-400 mt-3">For questions, contact the Registrar's Office at {SCHOOL_PHONE} or visit in person during office hours (Mon-Fri, 8AM-5PM).</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-400">You can only have one active application at a time.</p>
        )}
      </div>
    </div>
  );
}
