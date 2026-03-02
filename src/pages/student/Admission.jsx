import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getAdmissions, addAdmission } from '../../api/admissions.js';
import { getExamRegistrations } from '../../api/exams.js';
import { getExamResults } from '../../api/results.js';
import { showToast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { PageHeader, Badge } from '../../components/UI.jsx';
import { formatDate, badgeClass } from '../../utils/helpers.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

const GRADE_OPTIONS = [
  { group: 'Preschool', items: ['Nursery', 'Kinder'] },
  { group: 'Grade School', items: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'] },
  { group: 'Junior High School', items: ['Grade 7','Grade 8','Grade 9','Grade 10'] },
  { group: 'Senior High School', items: ['Grade 11 — ABM','Grade 11 — STEM','Grade 11 — HUMSS','Grade 12 — ABM','Grade 12 — STEM','Grade 12 — HUMSS'] },
];

/* ===== Document requirements per grade level (from school policy) ===== */
const DOC_REQUIREMENTS = {
  'Nursery':    { idPhoto: true, baptismal: true, birthCert: true },
  'Kinder':     { idPhoto: true, baptismal: true, birthCert: true },
  'Grade 1':    { idPhoto: true, baptismal: true, birthCert: true, eccdChecklist: true },
  'Grade 2':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true },
  'Grade 3':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true },
  'Grade 4':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true },
  'Grade 5':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true },
  'Grade 6':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true },
  'Grade 7':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, incomeTax: true },
  'Grade 8':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 9':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 10':   { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 11 — ABM':  { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 11 — STEM': { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 11 — HUMSS':{ idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 12 — ABM':  { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 12 — STEM': { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 12 — HUMSS':{ idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
};

const ALL_SLOT_LABELS = {
  birthCert: 'PSA Birth Certificate (original & photocopy)',
  idPhoto: '2x2 ID Photos (2 copies)',
  reportCard: 'Report Card / Form 138',
  goodMoral: 'Certificate of Good Moral Character',
  baptismal: 'Baptismal Certificate',
  eccdChecklist: 'ECCD Checklist',
  incomeTax: 'Latest Income Tax Return / Certificate of Tax Exemption / Municipal Cert. of Unemployment',
  escCert: 'ESC Certificate (if applicable)',
};

function getRequiredDocs(gradeLevel) {
  const reqs = DOC_REQUIREMENTS[gradeLevel] || DOC_REQUIREMENTS['Grade 2']; // default fallback
  return Object.keys(reqs).filter(k => reqs[k]);
}

/* Age validation: Kinder requires 5 years old by Oct 31 of school year */
function checkAgeRequirement(gradeLevel, dob, schoolYear) {
  if (!dob || !gradeLevel) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;

  if (gradeLevel === 'Kinder' || gradeLevel === 'Nursery' || gradeLevel === 'Grade 1') {
    const startYear = parseInt(schoolYear) || 2026;
    const cutoff = new Date(startYear, 9, 31); // Oct 31
    const age = cutoff.getFullYear() - birthDate.getFullYear();
    const monthDiff = cutoff.getMonth() - birthDate.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && cutoff.getDate() < birthDate.getDate()) ? age - 1 : age;

    if (gradeLevel === 'Kinder' && actualAge < 5) {
      return `Kindergarten requires the student to be at least 5 years old by October 31, ${startYear}. Student will be ${actualAge} years old by that date.`;
    }
    if (gradeLevel === 'Nursery' && actualAge < 4) {
      return `Nursery requires the student to be at least 4 years old by October 31, ${startYear}. Student will be ${actualAge} years old by that date.`;
    }
    if (gradeLevel === 'Grade 1' && actualAge < 6) {
      return `Grade 1 requires the student to be at least 6 years old by October 31, ${startYear}. Student will be ${actualAge} years old by that date.`;
    }
  }
  return null;
}

export default function StudentAdmission() {
  const [step, setStep] = useState(1);
  const [showWizard, setShowWizard] = useState(true);
  const [successOpen, setSuccessOpen] = useState(false);
  const [slotFiles, setSlotFiles] = useState({ birthCert: null, idPhoto: null, reportCard: null, goodMoral: null, baptismal: null, eccdChecklist: null, incomeTax: null, escCert: null });
  const [extraFiles, setExtraFiles] = useState([]);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', dob: '', gender: '', address: '',
    guardian: '', guardianRelation: '', guardianPhone: '', guardianEmail: '',
    gradeLevel: '', prevSchool: '', schoolYear: '2026-2027', lrn: '', applicantType: 'New',
  });

  const { user } = useAuth();
  const confirmDialog = useConfirm();
  const existingApp = useMemo(() => { const a = getAdmissions(); return a.find(app => app.email === user?.email) || null; }, [user]);

  // Check if student has passed the entrance exam
  const examPassed = useMemo(() => {
    const registrations = getExamRegistrations();
    const myReg = registrations.find(r => r.userEmail === user?.email);
    if (!myReg) return false;
    const results = getExamResults();
    const myResult = results.find(r => r.registrationId === myReg.id);
    return myResult?.passed === true;
  }, [user]);

  const isDirty = !!(form.firstName || form.lastName || form.email);
  const { restore, clear } = useUnsavedChanges(isDirty, 'gk_admission_draft', form);

  // Pre-fill form with user data and restore autosaved draft
  useEffect(() => {
    if (!existingApp && user) {
      setForm(f => ({
        ...f,
        firstName: f.firstName || user.firstName || '',
        lastName: f.lastName || user.lastName || '',
        email: f.email || user.email || '',
      }));
    }
    const saved = restore();
    if (saved && !existingApp) {
      setForm(f => ({ ...f, ...saved }));
      showToast('Draft restored from your last session.', 'info');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, existingApp]);

  const set = useCallback((k) => (e) => setForm(f => ({ ...f, [k]: e.target.value })), []);

  const goTo = (n) => {
    if (n > step) {
      // validate current step
      const required = {
        1: ['firstName','lastName','email','dob','gender','address','guardian','guardianRelation','guardianPhone'],
        2: ['gradeLevel'],
        3: [],
      };
      const missing = (required[step] || []).filter(k => !form[k]?.trim());
      if (missing.length) { showToast('Please fill in all required fields.', 'error'); return; }

      // Email format validation (Step 1)
      if (step === 1) {
        if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) { showToast('Please enter a valid email address.', 'error'); return; }
        if (form.phone && !/^[+\d][\d\s()-]{6,}$/.test(form.phone)) { showToast('Please enter a valid phone number.', 'error'); return; }
        if (form.guardianPhone && !/^[+\d][\d\s()-]{6,}$/.test(form.guardianPhone)) { showToast('Please enter a valid guardian phone number.', 'error'); return; }
      }

      // Age validation (Step 2 when moving to Step 3)
      if (step === 2) {
        const ageWarning = checkAgeRequirement(form.gradeLevel, form.dob, form.schoolYear);
        if (ageWarning) { showToast(ageWarning, 'error'); return; }
      }

      // Document validation (Step 3 when moving to Step 4)
      if (step === 3) {
        const missingDocs = requiredDocs.filter(k => !slotFiles[k]);
        if (missingDocs.length > 0) {
          showToast(`Please upload all required documents. Missing: ${missingDocs.map(k => ALL_SLOT_LABELS[k]?.split('(')[0]?.trim() || k).join(', ')}`, 'error');
          return;
        }
      }
    }
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const requiredDocs = useMemo(() => getRequiredDocs(form.gradeLevel), [form.gradeLevel]);

  const handleSubmit = async () => {
    const ok = await confirmDialog({
      title: 'Submit Application',
      message: 'Are you sure you want to submit your admission application? This action cannot be undone.',
      confirmLabel: 'Submit',
      variant: 'info',
    });
    if (!ok) return;
    const docs = [];
    Object.entries(slotFiles).forEach(([k, f]) => { if (f) docs.push(ALL_SLOT_LABELS[k] || k); });
    extraFiles.forEach(f => docs.push(f.name.replace(/\.[^.]+$/, '')));

    const result = addAdmission({ ...form, documents: docs.length ? docs : ['(No documents uploaded)'] });
    if (result?.error) { showToast(result.error, 'error'); return; }
    clear(); // Clear autosaved draft
    setSuccessOpen(true);
  };

  const handleSlotFile = (slot, file) => setSlotFiles(s => ({ ...s, [slot]: file }));
  const removeSlot = (slot) => setSlotFiles(s => ({ ...s, [slot]: null }));

  // Gate: must pass entrance exam first
  if (!existingApp && !examPassed) {
    return (
      <div>
        <PageHeader title="Admission Application" subtitle="GOLDEN KEY Integrated School of St. Joseph — Admission Form" />
        <div className="lpu-card p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h3 className="text-xl font-bold text-forest-500 mb-2">Entrance Exam Required</h3>
          <p className="text-gray-500 mb-2">You must pass the entrance examination before you can submit an admission application.</p>
          <p className="text-gray-400 text-sm mb-6">Please take and pass the entrance exam first, then come back here to complete your admission.</p>
          <Link to="/student/exam" className="inline-block bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-3 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600 shadow-md">Go to Entrance Exam</Link>
        </div>
      </div>
    );
  }

  // Show existing application
  if (existingApp && showWizard) {
    const statusSteps = ['Submitted','Under Screening','Under Evaluation','Accepted'];
    const currentIdx = statusSteps.indexOf(existingApp.status);
    return (
      <div>
        <PageHeader title="Admission Application" subtitle="Track your admission progress below." />
        <div className="lpu-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-4">Your Submitted Application</h3>

          {/* Admission Progress Tracker */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Detail label="Full Name" value={`${existingApp.firstName} ${existingApp.lastName}`} />
            <Detail label="Email" value={existingApp.email} />
            <Detail label="Grade Level" value={existingApp.gradeLevel} />
            <Detail label="Applicant Type" value={existingApp.applicantType || 'New'} />
            <Detail label="Status"><Badge className={badgeClass(existingApp.status)}>{existingApp.status}</Badge></Detail>
            <Detail label="Submitted" value={formatDate(existingApp.submittedAt)} />
            <Detail label="Documents" value={existingApp.documents.join(', ') || 'None'} />
            {existingApp.notes && <div className="md:col-span-2"><Detail label="Notes from Registrar" value={existingApp.notes} /></div>}
          </div>
          {existingApp.status === 'Rejected' ? (
            <button onClick={() => setShowWizard(false)} className="mt-4 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">Submit New Application</button>
          ) : (
            <p className="mt-4 text-sm text-gray-400">You can only have one active application at a time.</p>
          )}
        </div>
      </div>
    );
  }

  const steps = ['Personal Info', 'School Info', 'Documents', 'Review & Submit'];

  return (
    <div>
      <PageHeader title="Admission Application" subtitle="GOLDEN KEY Integrated School of St. Joseph — Admission Form" />

      {/* Admission Policy Summary */}
      <div className="bg-forest-50 border border-forest-200 rounded-xl p-4 mb-6">
        <h4 className="font-semibold text-forest-700 text-sm mb-2">📋 Admission Policy & Procedure</h4>
        <div className="text-xs text-forest-600 space-y-1">
          <p>Admission is open to all students regardless of race, religion, gender, or socioeconomic status.</p>
          <p><strong>Procedure:</strong> ① Pass Entrance Exam → ② Submit Application & Documents → ③ Screening & Evaluation → ④ Admission Confirmation</p>
          <p><strong>Age Requirement:</strong> Kindergarten applicants must be 5 years old by October 31 of the school year. Grade 1 requires proof of kindergarten completion.</p>
          <p><strong>Late Admission:</strong> Accepted up to 2 weeks after the first day of classes with School Head approval.</p>
          <p className="text-gray-400">New students may undergo an interview and/or diagnostic entrance test as required. All data handled per RA 10173 (Data Privacy Act).</p>
        </div>
      </div>

      <p className="text-sm text-gold-600 bg-gold-50 border border-gold-200 rounded-lg px-4 py-2 mb-6">💡 Parents or guardians may fill out this form on behalf of their child.</p>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-1 mb-8 flex-wrap">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${i + 1 === step ? 'bg-[#166534] text-white' : i + 1 < step ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-400'}`}>
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/30 text-xs font-bold">{i + 1 < step ? '✓' : i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i + 1 < step ? 'bg-forest-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Personal Info */}
      {step === 1 && (
        <div className="lpu-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-1">Step 1: Personal Information</h3>
          <p className="text-gray-500 text-sm mb-6">Provide basic personal details of the student.</p>

          <h4 className="font-semibold text-forest-500 mb-3">👤 Student Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Input label="First Name" value={form.firstName} onChange={set('firstName')} required placeholder="Juan" />
            <Input label="Last Name" value={form.lastName} onChange={set('lastName')} required placeholder="Dela Cruz" />
            <Input label="Email Address" type="email" value={form.email} onChange={set('email')} required placeholder="example@email.com" />
            <Input label="Phone Number" type="tel" value={form.phone} onChange={(e) => { const v = e.target.value.replace(/[^0-9+\-\s()]/g, ''); setForm(f => ({ ...f, phone: v })); }} placeholder="+63 9XX XXX XXXX" />
            <Input label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} required />
            <Select label="Gender" value={form.gender} onChange={set('gender')} required options={[{v:'',l:'Select gender'},{v:'Male',l:'Male'},{v:'Female',l:'Female'},{v:'Other',l:'Other'}]} />
            <div className="md:col-span-2">
              <Input label="Home Address" value={form.address} onChange={set('address')} required placeholder="Street, Barangay, Municipality, Province" />
            </div>
          </div>

          <h4 className="font-semibold text-forest-500 mb-3">👨‍👩‍👧 Parent / Guardian Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Input label="Parent / Guardian Full Name" value={form.guardian} onChange={set('guardian')} required placeholder="Full name" />
            <Select label="Relationship to Student" value={form.guardianRelation} onChange={set('guardianRelation')} required options={[{v:'',l:'Select relationship'},{v:'Mother',l:'Mother'},{v:'Father',l:'Father'},{v:'Legal Guardian',l:'Legal Guardian'},{v:'Grandparent',l:'Grandparent'},{v:'Sibling',l:'Sibling'},{v:'Other',l:'Other'}]} />
            <Input label="Parent / Guardian Contact No." type="tel" value={form.guardianPhone} onChange={(e) => { const v = e.target.value.replace(/[^0-9+\-\s()]/g, ''); setForm(f => ({ ...f, guardianPhone: v })); }} required placeholder="+63 9XX XXX XXXX" />
            <Input label="Parent / Guardian Email" type="email" value={form.guardianEmail} onChange={set('guardianEmail')} placeholder="parent@email.com" />
          </div>

          <div className="flex justify-end">
            <button onClick={() => goTo(2)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600">Next: School Info →</button>
          </div>
        </div>
      )}

      {/* Step 2: School Info */}
      {step === 2 && (
        <div className="lpu-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-1">Step 2: School Information</h3>
          <p className="text-gray-500 text-sm mb-6">Tell us about the academic background.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Select label="Applicant Type" value={form.applicantType} onChange={set('applicantType')} required options={[{v:'New',l:'New Student'},{v:'Transferee',l:'Transferee'},{v:'Returning',l:'Returning Student'}]} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level Applying For <span className="text-red-500">*</span></label>
              <select value={form.gradeLevel} onChange={set('gradeLevel')} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white">
                <option value="">Select grade level</option>
                {GRADE_OPTIONS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map(i => <option key={i} value={i}>{i}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <Input label="Previous School" value={form.prevSchool} onChange={set('prevSchool')} placeholder="Name of previous school" />
            <Input label="School Year" value={form.schoolYear} onChange={set('schoolYear')} placeholder="e.g. 2026-2027" />
            <Input label="Learner Reference Number (LRN)" value={form.lrn} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, lrn: v })); }} placeholder="12-digit LRN" maxLength={12} pattern="[0-9]*" inputMode="numeric" />
          </div>

          {/* Age Requirement Warning */}
          {checkAgeRequirement(form.gradeLevel, form.dob, form.schoolYear) && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
              ⚠️ {checkAgeRequirement(form.gradeLevel, form.dob, form.schoolYear)}
            </div>
          )}

          {/* Dynamic Document Requirements Preview */}
          {form.gradeLevel && (
            <div className="bg-gold-50 border border-gold-200 rounded-lg px-4 py-3 mb-4">
              <h4 className="text-sm font-semibold text-gold-700 mb-2">📋 Required Documents for {form.gradeLevel}</h4>
              <ul className="text-xs text-gold-600 space-y-1">
                {requiredDocs.map(docKey => (
                  <li key={docKey} className="flex items-center gap-1.5">
                    {slotFiles[docKey] ? <span className="text-forest-500">✅</span> : <span className="text-gray-400">◻️</span>}
                    {ALL_SLOT_LABELS[docKey]}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-gray-400 mt-2">You will upload these documents in Step 3.</p>
            </div>
          )}

          {/* Returning student note */}
          {form.applicantType === 'Returning' && (
            <div className="bg-forest-50 border border-forest-200 text-forest-700 rounded-lg px-4 py-3 mb-4 text-sm">
              ℹ️ Returning students must settle previous accounts and complete clearance before re-admission.
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => goTo(1)} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50">← Back</button>
            <button onClick={() => goTo(3)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600">Next: Documents →</button>
          </div>
        </div>
      )}

      {/* Step 3: Documents — Dynamic per grade level */}
      {step === 3 && (
        <div className="lpu-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-1">Step 3: Required Documents</h3>
          <p className="text-gray-500 text-sm mb-2">Upload the documents required for <strong>{form.gradeLevel || 'your grade level'}</strong>.</p>
          <p className="text-xs text-gray-400 mb-6">Accepted formats: PDF, JPG, PNG, DOC, DOCX.</p>

          {/* Required Document Slots (dynamic based on grade) */}
          <h4 className="font-semibold text-forest-500 mb-3">📎 Required Documents</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {requiredDocs.map(docKey => (
              <UploadSlot
                key={docKey}
                label={`📄 ${ALL_SLOT_LABELS[docKey]}`}
                required
                slot={docKey}
                file={slotFiles[docKey]}
                onFile={handleSlotFile}
                onRemove={removeSlot}
              />
            ))}
          </div>

          {/* Checklist Summary */}
          <h4 className="font-semibold text-forest-500 mb-3">✅ Document Checklist</h4>
          <div className="space-y-2 mb-6">
            {requiredDocs.map(docKey => (
              <div key={docKey} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${slotFiles[docKey] ? 'bg-forest-50 text-forest-700' : 'bg-red-50 text-red-500'}`}>
                {slotFiles[docKey] ? '✅' : '⚠️'} {ALL_SLOT_LABELS[docKey]} — <span className="text-xs">{slotFiles[docKey] ? 'Uploaded' : 'Not yet uploaded'}</span>
              </div>
            ))}
          </div>

          <h4 className="font-semibold text-forest-500 mb-3">📁 Other Supporting Files (Optional)</h4>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gold-400 transition"
            onClick={() => document.getElementById('extraFileInput').click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-gold-400'); }}
            onDragLeave={e => e.currentTarget.classList.remove('border-gold-400')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-gold-400'); setExtraFiles(f => [...f, ...Array.from(e.dataTransfer.files)]); }}
          >
            <span className="text-3xl">📁</span>
            <p className="text-gray-500 mt-2">Drag & drop files here or <span className="text-[#166534] font-medium">browse</span></p>
            <p className="text-xs text-gray-400 mt-1">Medical records, recommendation letters, other certificates</p>
          </div>
          <input id="extraFileInput" type="file" multiple className="hidden" onChange={e => { setExtraFiles(f => [...f, ...Array.from(e.target.files)]); e.target.value = ''; }} />
          {extraFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {extraFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm">
                  <span>📄 {f.name} <span className="text-gray-400 text-xs">({(f.size/1024).toFixed(1)} KB)</span></span>
                  <button onClick={() => setExtraFiles(fs => fs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => goTo(2)} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50">← Back</button>
            <button onClick={() => goTo(4)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600">Next: Review →</button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <div className="lpu-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-1">Step 4: Review & Submit</h3>
          <p className="text-gray-500 text-sm mb-6">Please review all information before submitting.</p>

          <ReviewSection title="👤 Personal Information">
            <Detail label="First Name" value={form.firstName} />
            <Detail label="Last Name" value={form.lastName} />
            <Detail label="Email" value={form.email} />
            <Detail label="Phone" value={form.phone || '—'} />
            <Detail label="Date of Birth" value={form.dob} />
            <Detail label="Gender" value={form.gender} />
            <div className="md:col-span-2"><Detail label="Address" value={form.address} /></div>
          </ReviewSection>

          <ReviewSection title="👨‍👩‍👧 Parent / Guardian">
            <Detail label="Full Name" value={form.guardian} />
            <Detail label="Relationship" value={form.guardianRelation} />
            <Detail label="Contact No." value={form.guardianPhone} />
            <Detail label="Email" value={form.guardianEmail || '—'} />
          </ReviewSection>

          <ReviewSection title="🏫 School Information">
            <Detail label="Applicant Type" value={form.applicantType} />
            <Detail label="Grade Level" value={form.gradeLevel} />
            <Detail label="Previous School" value={form.prevSchool || '—'} />
            <Detail label="School Year" value={form.schoolYear || '—'} />
            <Detail label="LRN" value={form.lrn || '—'} />
          </ReviewSection>

          <div className="mb-6">
            <h4 className="font-semibold text-forest-500 mb-3">📄 Uploaded Documents</h4>
            <div className="space-y-2">
              {Object.entries(slotFiles).filter(([,f]) => f).map(([k, f]) => (
                <div key={k} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg text-sm">📄 <strong>{ALL_SLOT_LABELS[k] || k}:</strong> {f.name} <span className="text-gray-400 text-xs">({(f.size/1024).toFixed(1)} KB)</span></div>
              ))}
              {extraFiles.map((f, i) => (
                <div key={`e${i}`} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg text-sm">📄 <strong>Additional:</strong> {f.name} <span className="text-gray-400 text-xs">({(f.size/1024).toFixed(1)} KB)</span></div>
              ))}
              {Object.values(slotFiles).every(f => !f) && extraFiles.length === 0 && <p className="text-gray-400 text-sm">No documents uploaded</p>}
            </div>
            {/* Missing required docs warning */}
            {requiredDocs.filter(k => !slotFiles[k]).length > 0 && (
              <div className="bg-gold-50 border border-gold-200 text-gold-700 rounded-lg px-4 py-3 mt-3 text-sm">
                ⚠️ Missing required documents: {requiredDocs.filter(k => !slotFiles[k]).map(k => ALL_SLOT_LABELS[k]).join(', ')}. You may still submit but your application may be delayed.
              </div>
            )}
          </div>

          {/* Data privacy consent */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6 text-xs text-gray-500">
            🔒 By submitting this application, you consent to the collection and processing of your personal information in accordance with the Data Privacy Act of 2012 (RA 10173) and GOLDEN KEY Integrated School of St. Joseph's privacy policies. Personal data shall not be disclosed without consent, except as required by law.
          </div>

          <div className="flex justify-between">
            <button onClick={() => goTo(3)} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50">← Back</button>
            <button onClick={handleSubmit} className="bg-forest-500 text-white px-8 py-2.5 rounded-lg font-semibold hover:bg-forest-600 shadow-md text-lg">✅ Submit Application</button>
          </div>
        </div>
      )}

      <Modal open={successOpen} onClose={() => setSuccessOpen(false)}>
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-forest-500">Application Submitted!</h3>
          <p className="text-gray-500 mt-2">Your admission application has been received by <strong>GOLDEN KEY Integrated School of St. Joseph</strong>.</p>
          <p className="text-xs text-gray-400 mt-2">Next step: The school will screen your application and notify you of your admission status.</p>
          <Link to="/student/dashboard" className="mt-4 inline-block bg-[#166534] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#14532d]">Go to Dashboard</Link>
        </div>
      </Modal>
    </div>
  );
}

/* ===== Reusable sub-components ===== */

function Input({ label, type = 'text', required, ...props }) {
  const id = props.id || `input-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <input id={id} type={type} {...props} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" />
    </div>
  );
}

function Select({ label, required, options, ...props }) {
  const id = props.id || `select-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <select id={id} {...props} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function UploadSlot({ label, required, slot, file, onFile, onRemove }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</p>
      {file ? (
        <div className="border border-forest-200 bg-forest-50 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-forest-700">✅ {file.name} <span className="text-xs text-gray-400">({(file.size/1024).toFixed(1)} KB)</span></span>
          <button onClick={() => onRemove(slot)} className="text-red-400 hover:text-red-600 text-lg">✕</button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gold-400 transition"
          onClick={() => document.getElementById(`slot-${slot}`).click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-gold-400'); }}
          onDragLeave={e => e.currentTarget.classList.remove('border-gold-400')}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-gold-400'); if (e.dataTransfer.files[0]) onFile(slot, e.dataTransfer.files[0]); }}
        >
          <span className="text-2xl">📁</span>
          <p className="text-gray-500 text-sm mt-1">Click or drag file here</p>
        </div>
      )}
      <input id={`slot-${slot}`} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if (e.target.files[0]) onFile(slot, e.target.files[0]); e.target.value = ''; }} />
    </div>
  );
}

function Detail({ label, value, children }) {
  return (
    <div>
      <span className="block text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      {children || <span className="text-sm text-forest-500 font-medium">{value}</span>}
    </div>
  );
}

function ReviewSection({ title, children }) {
  return (
    <div className="mb-6">
      <h4 className="font-semibold text-forest-500 mb-3">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">{children}</div>
    </div>
  );
}
