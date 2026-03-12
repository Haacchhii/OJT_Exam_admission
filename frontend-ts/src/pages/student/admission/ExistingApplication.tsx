import { Link } from 'react-router-dom';
import { getDocumentDownloadUrl } from '../../../api/admissions';
import { PageHeader, Badge } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { Detail } from './AdmissionFormFields';
import { formatDate, badgeClass } from '../../../utils/helpers';
import { ADMISSION_PROGRESS_STEPS } from '../../../utils/constants';
import type { Admission } from '../../../types';

interface Props {
  existingApp: Admission;
  onNewApplication: () => void;
}

export default function ExistingApplication({ existingApp, onNewApplication }: Props) {
  const statusSteps = ADMISSION_PROGRESS_STEPS;
  const currentIdx = statusSteps.indexOf(existingApp.status);

  return (
    <div>
      <PageHeader title="Admission Application" subtitle="Track your admission progress below." />
      <div className="gk-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Your Submitted Application</h3>
        {existingApp.status !== 'Rejected' && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-500 mb-3">Admission Progress</h4>
            <div className="flex items-center gap-1 flex-wrap">
              {statusSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${i <= currentIdx ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-400'}`}>
                    <span className="w-4 h-4 flex items-center justify-center rounded-full bg-white/50 text-[10px] font-bold">{i <= currentIdx ? '✓' : i + 1}</span>
                    <span className="hidden sm:inline">{s}</span>
                  </div>
                  {i < statusSteps.length - 1 && <div className={`w-6 h-0.5 ${i < currentIdx ? 'bg-forest-400' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
          </div>
        )}
        {existingApp.trackingId && (
          <div className="mb-4 bg-forest-50 border border-forest-200 rounded-lg px-4 py-3 inline-block">
            <span className="text-xs text-gray-500">Tracking ID: </span>
            <span className="font-mono font-bold text-forest-700">{existingApp.trackingId}</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Detail label="Full Name" value={`${existingApp.firstName} ${existingApp.lastName}`} />
          <Detail label="Email" value={existingApp.email} />
          <Detail label="Grade Level" value={existingApp.gradeLevel} />
          <Detail label="Applicant Type" value={existingApp.applicantType || 'New'} />
          <Detail label="Status"><Badge className={badgeClass(existingApp.status)}>{existingApp.status}</Badge></Detail>
          <Detail label="Submitted" value={formatDate(existingApp.submittedAt)} />
          <Detail label="Documents">
            {existingApp.documentFiles?.length > 0 ? (
              <ul className="space-y-1">
                {existingApp.documentFiles.map((df) => (
                  <li key={df.id} className="flex items-center gap-2">
                    <Icon name="documentText" className="w-4 h-4 text-forest-500 flex-shrink-0" />
                    {df.filePath ? (
                      <a
                        href={getDocumentDownloadUrl(existingApp.id, df.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-forest-600 hover:text-forest-800 underline"
                      >{df.name}</a>
                    ) : (
                      <span className="text-sm text-gray-600">{df.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-gray-500">{existingApp.documents.join(', ') || 'None'}</span>
            )}
          </Detail>
          {existingApp.notes && <div className="md:col-span-2"><Detail label="Notes from Registrar" value={existingApp.notes} /></div>}
        </div>
        {existingApp.status === 'Rejected' ? (
          <button onClick={onNewApplication} className="mt-4 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">Submit New Application</button>
        ) : existingApp.status === 'Accepted' ? (
          <div className="mt-6 bg-forest-50 border border-forest-200 rounded-xl p-5">
            <h4 className="font-bold text-forest-700 mb-3 flex items-center gap-2"><Icon name="trophy" className="w-5 h-5 text-gold-500" /> Congratulations! Your application has been accepted.</h4>
            <p className="text-sm text-forest-600 mb-3">Here are the next steps to complete your enrollment:</p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-forest-600">
              <li><strong>Visit the Registrar's Office</strong> — Bring original documents for verification (Birth Certificate, Report Card, Good Moral Certificate).</li>
              <li><strong>Pay the enrollment/reservation fee</strong> — Secure your slot by paying at the school cashier or through the designated payment channels.</li>
              <li><strong>Attend the orientation</strong> — Check your email or the school bulletin for the scheduled orientation date for new students and parents.</li>
              <li><strong>Complete enrollment forms</strong> — Fill out the official Student Enrollment Form, Medical Form, and Emergency Contact Form at the Registrar's Office.</li>
              <li><strong>Receive your student ID and class schedule</strong> — These will be provided on or before the first day of classes.</li>
            </ol>
            <p className="text-xs text-gray-400 mt-3">For questions, contact the Registrar's Office at (043)-702-2153 or visit in person during office hours (Mon–Fri, 8AM–5PM).</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-400">You can only have one active application at a time.</p>
        )}
      </div>
    </div>
  );
}
