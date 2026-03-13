import type { ChangeEvent } from 'react';
import Icon from '../../../components/Icons';
import { Input, Select } from './AdmissionFormFields';
import { checkAgeRequirement } from './useAdmissionWizard';
import { GRADE_OPTIONS, DOC_SLOT_LABELS, APPLICANT_TYPES, SCHOOL_NAME } from '../../../utils/constants';
import type { AdmissionForm, SlotFiles } from './useAdmissionWizard';
import type { User } from '../../../types';

interface Props {
  form: AdmissionForm;
  set: (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  setForm: React.Dispatch<React.SetStateAction<AdmissionForm>>;
  goTo: (n: number) => void;
  requiredDocs: string[];
  slotFiles: SlotFiles;
  user: User | null;
}

export default function StepSchoolInfo({ form, set, setForm, goTo, requiredDocs, slotFiles, user }: Props) {
  return (
    <div className="gk-card p-6">
      <h3 className="text-lg font-bold text-forest-500 mb-1">Step 2: School Information</h3>
      <p className="text-gray-500 text-sm mb-6">Tell us about the academic background.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Select label="Applicant Type" value={form.applicantType} onChange={(e: ChangeEvent<HTMLSelectElement>) => {
          const type = e.target.value;
          setForm(f => ({
            ...f,
            applicantType: type,
            prevSchool: type === 'Continuing' ? SCHOOL_NAME : (f.prevSchool === SCHOOL_NAME ? '' : f.prevSchool),
            studentNumber: type === 'Continuing' && user?.applicantProfile?.studentNumber ? user.applicantProfile.studentNumber : (type !== 'Continuing' ? '' : f.studentNumber),
          }));
        }} required options={APPLICANT_TYPES} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level Applying For <span className="text-red-500">*</span></label>
          <select value={form.gradeLevel} onChange={set('gradeLevel')} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
            <option value="">Select grade level</option>
            {GRADE_OPTIONS.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map(i => <option key={i} value={i}>{i}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <Input label="Previous School" value={form.prevSchool} onChange={set('prevSchool')} placeholder="Name of previous school" readOnly={form.applicantType === 'Continuing'} />
        <Input label="School Year" value={form.schoolYear} onChange={set('schoolYear')} placeholder="e.g. 2026-2027" />
        <Input label="Learner Reference Number (LRN)" value={form.lrn} onChange={(e: ChangeEvent<HTMLInputElement>) => { const v = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, lrn: v })); }} placeholder="12-digit LRN" maxLength={12} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Student Number
            {form.applicantType === 'Continuing' && <span className="text-red-500"> *</span>}
          </label>
          {user?.applicantProfile?.studentNumber ? (
            <div className="flex items-center gap-2">
              <input type="text" value={form.studentNumber || user.applicantProfile.studentNumber} readOnly className="gk-input bg-gray-50 font-mono" />
              <span className="text-xs text-forest-500 font-medium whitespace-nowrap">✓ Auto-detected</span>
            </div>
          ) : form.applicantType === 'Continuing' ? (
            <input type="text" value={form.studentNumber} onChange={(e) => setForm(f => ({ ...f, studentNumber: e.target.value }))} placeholder="Enter your student number" className="gk-input font-mono" required />
          ) : (
            <div className="px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm">
              Will be assigned upon acceptance
            </div>
          )}
        </div>
      </div>
      {checkAgeRequirement(form.gradeLevel, form.dob, form.schoolYear) && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          ⚠️ {checkAgeRequirement(form.gradeLevel, form.dob, form.schoolYear)}
        </div>
      )}
      {form.gradeLevel && (
        <div className="bg-gold-50 border border-gold-200 rounded-lg px-4 py-3 mb-4">
          <h4 className="text-sm font-semibold text-gold-700 mb-2 flex items-center gap-1.5"><Icon name="clipboard" className="w-4 h-4" /> Required Documents for {form.gradeLevel}</h4>
          <ul className="text-xs text-gold-600 space-y-1">
            {requiredDocs.map(docKey => (
              <li key={docKey} className="flex items-center gap-1.5">
                {slotFiles[docKey] ? <span className="text-forest-500"><Icon name="checkCircle" className="w-3.5 h-3.5 inline" /></span> : <span className="text-gray-400">○</span>}
                {(DOC_SLOT_LABELS as Record<string, string>)[docKey]}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-gray-400 mt-2">You will upload these documents in Step 3.</p>
        </div>
      )}
      {form.applicantType === 'Returning' && (
        <div className="bg-forest-50 border border-forest-200 text-forest-700 rounded-lg px-4 py-3 mb-4 text-sm">
          ℹ️ Returning students must settle previous accounts and complete clearance before re-admission.
        </div>
      )}
      {form.applicantType === 'Continuing' && (
        <div className="bg-forest-50 border border-forest-200 text-forest-700 rounded-lg px-4 py-3 mb-4 text-sm">
          ℹ️ As a continuing student of {SCHOOL_NAME}, your student number {user?.applicantProfile?.studentNumber ? 'has been auto-detected' : 'should be entered above'}. This application is for re-enrollment in the next school year.
        </div>
      )}
      <div className="flex justify-between">
        <button onClick={() => goTo(1)} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50">← Back</button>
        <button onClick={() => goTo(3)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600">Next: Documents →</button>
      </div>
    </div>
  );
}
