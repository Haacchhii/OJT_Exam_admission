import Icon from '../../../components/Icons';
import { Detail, ReviewSection } from './AdmissionFormFields';
import { DOC_SLOT_LABELS } from '../../../utils/constants';
import type { AdmissionForm, SlotFiles } from './useAdmissionWizard';

interface Props {
  form: AdmissionForm;
  slotFiles: SlotFiles;
  extraFiles: File[];
  requiredDocs: string[];
  privacyConsent: boolean;
  setPrivacyConsent: (v: boolean) => void;
  saving: boolean;
  goTo: (n: number) => void;
  handleSubmit: () => void;
}

export default function StepReview({ form, slotFiles, extraFiles, requiredDocs, privacyConsent, setPrivacyConsent, saving, goTo, handleSubmit }: Props) {
  return (
    <div className="gk-card p-6">
      <h3 className="text-lg font-bold text-forest-500 mb-1">Step 4: Review & Submit</h3>
      <p className="text-gray-500 text-sm mb-6">Please review all information before submitting.</p>
      <ReviewSection title={<><Icon name="userCircle" className="w-4 h-4 inline" /> Personal Information</>}>
        <Detail label="First Name" value={form.firstName} />
        <Detail label="Last Name" value={form.lastName} />
        <Detail label="Email" value={form.email} />
        <Detail label="Phone" value={form.phone || '—'} />
        <Detail label="Date of Birth" value={form.dob} />
        <Detail label="Gender" value={form.gender} />
        <div className="md:col-span-2"><Detail label="Address" value={form.address} /></div>
      </ReviewSection>
      <ReviewSection title={<><Icon name="users" className="w-4 h-4 inline" /> Parent / Guardian</>}>
        <Detail label="Full Name" value={form.guardian} />
        <Detail label="Relationship" value={form.guardianRelation} />
        <Detail label="Contact No." value={form.guardianPhone} />
        <Detail label="Email" value={form.guardianEmail || '—'} />
      </ReviewSection>
      <ReviewSection title={<><Icon name="graduationCap" className="w-4 h-4 inline" /> School Information</>}>
        <Detail label="Applicant Type" value={form.applicantType} />
        <Detail label="Grade Level" value={form.gradeLevel} />
        <Detail label="Previous School" value={form.prevSchool || '—'} />
        <Detail label="School Year" value={form.schoolYear || '—'} />
        <Detail label="LRN" value={form.lrn || '—'} />
      </ReviewSection>
      <div className="mb-6">
        <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="document" className="w-4 h-4" /> Uploaded Documents</h4>
        <div className="space-y-2">
          {Object.entries(slotFiles).filter(([,f]) => f).map(([k, f]) => (
            <div key={k} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg text-sm"><Icon name="document" className="w-4 h-4 text-gray-400 shrink-0" /> <strong>{(DOC_SLOT_LABELS as Record<string, string>)[k] || k}:</strong> {f!.name} <span className="text-gray-400 text-xs">({(f!.size/1024).toFixed(1)} KB)</span></div>
          ))}
          {extraFiles.map((f, i) => (
            <div key={`e${i}`} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg text-sm"><Icon name="document" className="w-4 h-4 text-gray-400 shrink-0" /> <strong>Additional:</strong> {f.name} <span className="text-gray-400 text-xs">({(f.size/1024).toFixed(1)} KB)</span></div>
          ))}
          {Object.values(slotFiles).every(f => !f) && extraFiles.length === 0 && <p className="text-gray-400 text-sm">No documents uploaded</p>}
        </div>
        {requiredDocs.filter(k => !slotFiles[k]).length > 0 && (
          <div className="bg-gold-50 border border-gold-200 text-gold-700 rounded-lg px-4 py-3 mt-3 text-sm">
            ⚠️ Missing required documents: {requiredDocs.filter(k => !slotFiles[k]).map(k => (DOC_SLOT_LABELS as Record<string, string>)[k]).join(', ')}. You may still submit but your application may be delayed.
          </div>
        )}
      </div>
      <label className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6 text-xs text-gray-500 flex items-start gap-3 cursor-pointer select-none">
        <input type="checkbox" checked={privacyConsent} onChange={e => setPrivacyConsent(e.target.checked)} className="accent-forest-500 mt-0.5 shrink-0" />
        <span><Icon name="lock" className="w-4 h-4 inline shrink-0 mr-1" /> By submitting this application, I consent to the collection and processing of my personal information in accordance with the Data Privacy Act of 2012 (RA 10173) and GOLDEN KEY Integrated School of St. Joseph's privacy policies. Personal data shall not be disclosed without consent, except as required by law.</span>
      </label>
      <div className="flex justify-between">
        <button onClick={() => goTo(3)} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50">← Back</button>
        <button onClick={handleSubmit} disabled={saving} className="bg-forest-500 text-white px-8 py-2.5 rounded-lg font-semibold hover:bg-forest-600 shadow-md text-lg disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">{saving ? <><Icon name="spinner" className="w-4 h-4 animate-spin" /> Submitting…</> : <><Icon name="check" className="w-5 h-5" /> Submit Application</>}</button>
      </div>
    </div>
  );
}
