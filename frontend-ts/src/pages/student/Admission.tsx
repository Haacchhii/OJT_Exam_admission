import { useState, useMemo, useCallback, useEffect, type ReactNode, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getMyAdmission, addAdmission, uploadAdmissionDocuments } from '../../api/admissions';
import { getMyRegistrations } from '../../api/exams';
import { getMyResult } from '../../api/results';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { useConfirm } from '../../components/ConfirmDialog';
import { PageHeader, Badge, SkeletonPage, ErrorAlert } from '../../components/UI';
import Icon from '../../components/Icons';
import { formatDate, badgeClass } from '../../utils/helpers';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { GRADE_OPTIONS, DOC_REQUIREMENTS, DOC_SLOT_LABELS, ALLOWED_FILE_TYPES, MAX_FILE_SIZE, getCurrentSchoolYear, GENDER_OPTIONS, GUARDIAN_RELATIONS, APPLICANT_TYPES, ADMISSION_PROGRESS_STEPS } from '../../utils/constants';
import type { Admission } from '../../types';

interface AdmissionForm {
  firstName: string; lastName: string; email: string; phone: string; dob: string; gender: string; address: string;
  guardian: string; guardianRelation: string; guardianPhone: string; guardianEmail: string;
  gradeLevel: string; prevSchool: string; schoolYear: string; lrn: string; applicantType: string;
  studentNumber: string;
  [key: string]: string;
}

type SlotFiles = Record<string, File | null>;

function getRequiredDocs(gradeLevel: string): string[] {
  const reqs = (DOC_REQUIREMENTS as Record<string, Record<string, boolean>>)[gradeLevel] || (DOC_REQUIREMENTS as Record<string, Record<string, boolean>>)['Grade 2'];
  return Object.keys(reqs).filter(k => reqs[k]);
}

function checkAgeRequirement(gradeLevel: string, dob: string, schoolYear: string): string | null {
  if (!dob || !gradeLevel) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  if (gradeLevel === 'Kinder' || gradeLevel === 'Nursery' || gradeLevel === 'Grade 1') {
    const startYear = parseInt(schoolYear) || 2026;
    const cutoff = new Date(startYear, 9, 31);
    const age = cutoff.getFullYear() - birthDate.getFullYear();
    const monthDiff = cutoff.getMonth() - birthDate.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && cutoff.getDate() < birthDate.getDate()) ? age - 1 : age;
    if (gradeLevel === 'Kinder' && actualAge < 5)
      return `Kindergarten requires the student to be at least 5 years old by October 31, ${startYear}. Student will be ${actualAge} years old by that date.`;
    if (gradeLevel === 'Nursery' && actualAge < 4)
      return `Nursery requires the student to be at least 4 years old by October 31, ${startYear}. Student will be ${actualAge} years old by that date.`;
    if (gradeLevel === 'Grade 1' && actualAge < 6)
      return `Grade 1 requires the student to be at least 6 years old by October 31, ${startYear}. Student will be ${actualAge} years old by that date.`;
  }
  return null;
}

interface GateData {
  existingApp: Admission | null;
  examPassed: boolean;
}

export default function StudentAdmission() {
  const [step, setStep] = useState(1);
  const [showWizard, setShowWizard] = useState(true);
  const [successOpen, setSuccessOpen] = useState(false);
  const [submittedTrackingId, setSubmittedTrackingId] = useState('');
  const [slotFiles, setSlotFiles] = useState<SlotFiles>({ birthCert: null, idPhoto: null, reportCard: null, goodMoral: null, baptismal: null, eccdChecklist: null, incomeTax: null, escCert: null });
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [form, setForm] = useState<AdmissionForm>({
    firstName: '', lastName: '', email: '', phone: '', dob: '', gender: '', address: '',
    guardian: '', guardianRelation: '', guardianPhone: '', guardianEmail: '',
    gradeLevel: '', prevSchool: '', schoolYear: getCurrentSchoolYear(), lrn: '', applicantType: 'New',
    studentNumber: '',
  });

  const { user } = useAuth();
  const confirmDialog = useConfirm();

  const { data: gateData, loading: gateLoading, error: gateError, refetch } = useAsync<GateData>(async () => {
    const [existingApp, myRegs, myResult] = await Promise.all([
      getMyAdmission(), getMyRegistrations(), getMyResult()
    ]);
    const examPassed = myResult?.passed === true;
    return { existingApp, examPassed };
  }, [user]);

  const existingApp = gateData?.existingApp || null;
  const examPassed = gateData?.examPassed || false;

  const isDirty = !!(form.firstName || form.lastName || form.email);
  const { restore, clear } = useUnsavedChanges(isDirty, 'gk_admission_draft', form);

  useEffect(() => {
    if (!existingApp && user) {
      setForm(f => {
        const updated: AdmissionForm = {
          ...f,
          firstName: f.firstName || user.firstName || '',
          lastName: f.lastName || user.lastName || '',
          email: f.email || user.email || '',
          studentNumber: f.studentNumber || (user as any).applicantProfile?.studentNumber || '',
        };
        if ((user as any).applicantProfile?.studentNumber && !f.applicantType) {
          updated.applicantType = 'Continuing';
        }
        return updated;
      });
    }
    const saved = restore();
    if (saved && !existingApp) {
      setForm(f => ({ ...f, ...(saved as AdmissionForm) }));
      showToast('Draft restored from your last session.', 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, existingApp]);

  const set = useCallback((k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value })), []);

  const requiredDocs = useMemo(() => getRequiredDocs(form.gradeLevel), [form.gradeLevel]);

  const goTo = (n: number) => {
    if (n > step) {
      const required: Record<number, string[]> = {
        1: ['firstName','lastName','email','dob','gender','address','guardian','guardianRelation','guardianPhone'],
        2: ['gradeLevel'],
        3: [],
      };
      const missing = (required[step] || []).filter(k => !form[k]?.trim());
      if (missing.length) { showToast('Please fill in all required fields.', 'error'); return; }
      if (step === 1) {
        if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) { showToast('Please enter a valid email address.', 'error'); return; }
        if (form.phone && !/^[+\d][\d\s()-]{6,}$/.test(form.phone)) { showToast('Please enter a valid phone number.', 'error'); return; }
        if (form.guardianPhone && !/^[+\d][\d\s()-]{6,}$/.test(form.guardianPhone)) { showToast('Please enter a valid guardian phone number.', 'error'); return; }
      }
      if (step === 2) {
        if (form.applicantType === 'Continuing' && !form.studentNumber?.trim()) {
          showToast('Continuing students must provide their student number.', 'error'); return;
        }
        const ageWarning = checkAgeRequirement(form.gradeLevel, form.dob, form.schoolYear);
        if (ageWarning) { showToast(ageWarning, 'error'); return; }
      }
      if (step === 3) {
        const missingDocs = requiredDocs.filter(k => !slotFiles[k]);
        if (missingDocs.length > 0) {
          showToast(`Please upload all required documents. Missing: ${missingDocs.map(k => (DOC_SLOT_LABELS as Record<string, string>)[k]?.split('(')[0]?.trim() || k).join(', ')}`, 'error');
          return;
        }
      }
    }
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!privacyConsent) { showToast('Please agree to the Data Privacy consent before submitting.', 'error'); return; }
    const ok = await confirmDialog({
      title: 'Submit Application',
      message: 'Are you sure you want to submit your admission application? This action cannot be undone.',
      confirmLabel: 'Submit',
      variant: 'info',
    });
    if (!ok) return;
    const docs: string[] = [];
    Object.entries(slotFiles).forEach(([k, f]) => { if (f) docs.push((DOC_SLOT_LABELS as Record<string, string>)[k] || k); });
    extraFiles.forEach(f => docs.push(f.name.replace(/\.[^.]+$/, '')));

    setSaving(true);
    try {
      const result = await addAdmission({ ...form, documents: docs.length ? docs : ['(No documents uploaded)'] });
      if ((result as any)?.error) { showToast((result as any).error, 'error'); return; }
      const allFiles = [...Object.values(slotFiles).filter(Boolean) as File[], ...extraFiles];
      if (allFiles.length > 0 && result?.id) {
        try { await uploadAdmissionDocuments(result.id, allFiles); }
        catch { showToast('Application submitted but some documents failed to upload. Please contact the registrar.', 'warning'); }
      }
      if (result?.trackingId) setSubmittedTrackingId(result.trackingId);
      clear();
      refetch();
      setSuccessOpen(true);
    } catch (err: unknown) {
      showToast('Submission failed: ' + ((err as Error).message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_FILE_TYPES.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|doc|docx)$/i)) {
      showToast(`"${file.name}" is not a supported file type. Use PDF, JPG, PNG, or DOC.`, 'error');
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast(`"${file.name}" exceeds the 10MB file size limit.`, 'error');
      return false;
    }
    return true;
  };

  const handleSlotFile = (slot: string, file: File) => {
    if (!validateFile(file)) return;
    setSlotFiles(s => ({ ...s, [slot]: file }));
  };
  const handleExtraFiles = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(validateFile);
    if (valid.length > 0) setExtraFiles(f => [...f, ...valid]);
  };
  const removeSlot = (slot: string) => setSlotFiles(s => ({ ...s, [slot]: null }));

  if (gateLoading && !gateData) return <SkeletonPage />;
  if (gateError) return <ErrorAlert error={gateError} onRetry={refetch} />;

  if (!existingApp && !examPassed) {
    return (
      <div>
        <PageHeader title="Admission Application" subtitle="GOLDEN KEY Integrated School of St. Joseph — Admission Form" />
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

  if (existingApp && showWizard) {
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
            <Detail label="Applicant Type" value={(existingApp as any).applicantType || 'New'} />
            <Detail label="Status"><Badge className={badgeClass(existingApp.status)}>{existingApp.status}</Badge></Detail>
            <Detail label="Submitted" value={formatDate(existingApp.submittedAt)} />
            <Detail label="Documents" value={existingApp.documents.join(', ') || 'None'} />
            {(existingApp as any).notes && <div className="md:col-span-2"><Detail label="Notes from Registrar" value={(existingApp as any).notes} /></div>}
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

      <div className="flex items-center justify-center gap-1 mb-8 flex-wrap">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${i + 1 === step ? 'bg-forest-500 text-white' : i + 1 < step ? 'bg-forest-100 text-forest-700' : 'bg-gray-100 text-gray-400'}`}>
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/30 text-xs font-bold">{i + 1 < step ? '✓' : i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i + 1 < step ? 'bg-forest-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Personal Info */}
      {step === 1 && (
        <div className="gk-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-1">Step 1: Personal Information</h3>
          <p className="text-gray-500 text-sm mb-6">Provide basic personal details of the student.</p>
          <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="userCircle" className="w-4 h-4" /> Student Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Input label="First Name" value={form.firstName} onChange={set('firstName')} required placeholder="Juan" />
            <Input label="Last Name" value={form.lastName} onChange={set('lastName')} required placeholder="Dela Cruz" />
            <Input label="Email Address" type="email" value={form.email} onChange={set('email')} required placeholder="example@email.com" />
            <Input label="Phone Number" type="tel" value={form.phone} onChange={(e: ChangeEvent<HTMLInputElement>) => { const v = e.target.value.replace(/[^0-9+\-\s()]/g, ''); setForm(f => ({ ...f, phone: v })); }} placeholder="+63 9XX XXX XXXX" />
            <Input label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} required />
            <Select label="Gender" value={form.gender} onChange={set('gender')} required options={GENDER_OPTIONS} />
            <div className="md:col-span-2">
              <Input label="Home Address" value={form.address} onChange={set('address')} required placeholder="Street, Barangay, Municipality, Province" />
            </div>
          </div>
          <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="users" className="w-4 h-4" /> Parent / Guardian Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Input label="Parent / Guardian Full Name" value={form.guardian} onChange={set('guardian')} required placeholder="Full name" />
            <Select label="Relationship to Student" value={form.guardianRelation} onChange={set('guardianRelation')} required options={GUARDIAN_RELATIONS} />
            <Input label="Parent / Guardian Contact No." type="tel" value={form.guardianPhone} onChange={(e: ChangeEvent<HTMLInputElement>) => { const v = e.target.value.replace(/[^0-9+\-\s()]/g, ''); setForm(f => ({ ...f, guardianPhone: v })); }} required placeholder="+63 9XX XXX XXXX" />
            <Input label="Parent / Guardian Email" type="email" value={form.guardianEmail} onChange={set('guardianEmail')} placeholder="parent@email.com" />
          </div>
          <div className="flex justify-end">
            <button onClick={() => goTo(2)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600">Next: School Info →</button>
          </div>
        </div>
      )}

      {/* Step 2: School Info */}
      {step === 2 && (
        <div className="gk-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-1">Step 2: School Information</h3>
          <p className="text-gray-500 text-sm mb-6">Tell us about the academic background.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Select label="Applicant Type" value={form.applicantType} onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              const type = e.target.value;
              setForm(f => ({
                ...f,
                applicantType: type,
                prevSchool: type === 'Continuing' ? 'GOLDEN KEY Integrated School of St. Joseph' : (f.prevSchool === 'GOLDEN KEY Integrated School of St. Joseph' ? '' : f.prevSchool),
                studentNumber: type === 'Continuing' && (user as any)?.applicantProfile?.studentNumber ? (user as any).applicantProfile.studentNumber : (type !== 'Continuing' ? '' : f.studentNumber),
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
              {(user as any)?.applicantProfile?.studentNumber ? (
                <div className="flex items-center gap-2">
                  <input type="text" value={form.studentNumber || (user as any).applicantProfile.studentNumber} readOnly className="gk-input bg-gray-50 font-mono" />
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
              ℹ️ As a continuing student of Golden Key Integrated School of St. Joseph, your student number {(user as any)?.applicantProfile?.studentNumber ? 'has been auto-detected' : 'should be entered above'}. This application is for re-enrollment in the next school year.
            </div>
          )}
          <div className="flex justify-between">
            <button onClick={() => goTo(1)} className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50">← Back</button>
            <button onClick={() => goTo(3)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600">Next: Documents →</button>
          </div>
        </div>
      )}

      {/* Step 3: Documents */}
      {step === 3 && (
        <div className="gk-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-1">Step 3: Required Documents</h3>
          <p className="text-gray-500 text-sm mb-2">Upload the documents required for <strong>{form.gradeLevel || 'your grade level'}</strong>.</p>
          <p className="text-xs text-gray-400 mb-6">Accepted formats: PDF, JPG, PNG, DOC, DOCX.</p>
          <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="document" className="w-4 h-4" /> Required Documents</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {requiredDocs.map(docKey => (
              <UploadSlot key={docKey} label={`📄 ${(DOC_SLOT_LABELS as Record<string, string>)[docKey]}`} required slot={docKey} file={slotFiles[docKey]} onFile={handleSlotFile} onRemove={removeSlot} />
            ))}
          </div>
          <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="checkCircle" className="w-4 h-4" /> Document Checklist</h4>
          <div className="space-y-2 mb-6">
            {requiredDocs.map(docKey => (
              <div key={docKey} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${slotFiles[docKey] ? 'bg-forest-50 text-forest-700' : 'bg-red-50 text-red-500'}`}>
                {slotFiles[docKey] ? <Icon name="checkCircle" className="w-4 h-4" /> : <Icon name="exclamation" className="w-4 h-4" />} {(DOC_SLOT_LABELS as Record<string, string>)[docKey]} — <span className="text-xs">{slotFiles[docKey] ? 'Uploaded' : 'Not yet uploaded'}</span>
              </div>
            ))}
          </div>
          <h4 className="font-semibold text-forest-500 mb-3 flex items-center gap-1.5"><Icon name="upload" className="w-4 h-4" /> Other Supporting Files (Optional)</h4>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gold-400 transition"
            onClick={() => document.getElementById('extraFileInput')?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-gold-400'); }}
            onDragLeave={e => e.currentTarget.classList.remove('border-gold-400')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-gold-400'); handleExtraFiles(e.dataTransfer.files); }}
          >
            <Icon name="upload" className="w-8 h-8 text-gray-400" />
            <p className="text-gray-500 mt-2">Drag & drop files here or <span className="text-forest-500 font-medium">browse</span></p>
            <p className="text-xs text-gray-400 mt-1">Medical records, recommendation letters, other certificates</p>
          </div>
          <input id="extraFileInput" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" onChange={e => { handleExtraFiles(e.target.files); e.target.value = ''; }} />
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
      )}

      <Modal open={successOpen} onClose={() => setSuccessOpen(false)}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-4"><Icon name="trophy" className="w-8 h-8 text-gold-500" /></div>
          <h3 className="text-xl font-bold text-forest-500">Application Submitted!</h3>
          {submittedTrackingId && (
            <div className="mt-3 bg-forest-50 border border-forest-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">Your Tracking ID</p>
              <p className="text-lg font-mono font-bold text-forest-700">{submittedTrackingId}</p>
              <p className="text-xs text-gray-400 mt-1">Save this ID to track your application status anytime.</p>
            </div>
          )}
          <p className="text-gray-500 mt-2">Your admission application has been received by <strong>GOLDEN KEY Integrated School of St. Joseph</strong>.</p>
          <p className="text-xs text-gray-400 mt-2">Next step: The school will screen your application and notify you of your admission status.</p>
          <Link to="/student/dashboard" className="mt-4 inline-block bg-forest-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-forest-600">Go to Dashboard</Link>
        </div>
      </Modal>
    </div>
  );
}

/* ===== Reusable sub-components ===== */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

function Input({ label, type = 'text', required, ...props }: InputProps) {
  const id = props.id || `input-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <input id={id} type={type} {...props} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none" />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { v: string; l: string }[];
}

function Select({ label, required, options, ...props }: SelectProps) {
  const id = props.id || `select-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <select id={id} {...props} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

interface UploadSlotProps {
  label: string;
  required?: boolean;
  slot: string;
  file: File | null;
  onFile: (slot: string, file: File) => void;
  onRemove: (slot: string) => void;
}

function UploadSlot({ label, required, slot, file, onFile, onRemove }: UploadSlotProps) {
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
          onClick={() => document.getElementById(`slot-${slot}`)?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-gold-400'); }}
          onDragLeave={e => e.currentTarget.classList.remove('border-gold-400')}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-gold-400'); if (e.dataTransfer.files[0]) onFile(slot, e.dataTransfer.files[0]); }}
        >
          <span className="text-2xl">📁</span>
          <p className="text-gray-500 text-sm mt-1">Click or drag file here</p>
        </div>
      )}
      <input id={`slot-${slot}`} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if (e.target.files?.[0]) onFile(slot, e.target.files[0]); e.target.value = ''; }} />
    </div>
  );
}

interface DetailProps {
  label: string;
  value?: string;
  children?: ReactNode;
}

function Detail({ label, value, children }: DetailProps) {
  return (
    <div>
      <span className="block text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      {children || <span className="text-sm text-forest-500 font-medium">{value}</span>}
    </div>
  );
}

interface ReviewSectionProps {
  title: ReactNode;
  children: ReactNode;
}

function ReviewSection({ title, children }: ReviewSectionProps) {
  return (
    <div className="mb-6">
      <h4 className="font-semibold text-forest-500 mb-3">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">{children}</div>
    </div>
  );
}
