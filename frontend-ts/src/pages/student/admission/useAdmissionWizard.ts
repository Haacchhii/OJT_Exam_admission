import { useState, useMemo, useCallback, useEffect, type ChangeEvent } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { getMyAdmission, addAdmission, uploadAdmissionDocuments } from '../../../api/admissions';
import { getMyResult } from '../../../api/results';
import { showToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { DOC_REQUIREMENTS, DOC_SLOT_LABELS, ALLOWED_FILE_TYPES, MAX_FILE_SIZE, getCurrentSchoolYear } from '../../../utils/constants';
import type { Admission } from '../../../types';

export interface AdmissionForm {
  firstName: string; lastName: string; email: string; phone: string; dob: string; gender: string; address: string;
  guardian: string; guardianRelation: string; guardianPhone: string; guardianEmail: string;
  gradeLevel: string; prevSchool: string; schoolYear: string; lrn: string; applicantType: string;
  studentNumber: string;
  [key: string]: string;
}

export type SlotFiles = Record<string, File | null>;

interface GateData {
  existingApp: Admission | null;
  examPassed: boolean;
}

export function getRequiredDocs(gradeLevel: string): string[] {
  const reqs = (DOC_REQUIREMENTS as Record<string, Record<string, boolean>>)[gradeLevel] || (DOC_REQUIREMENTS as Record<string, Record<string, boolean>>)['Grade 2'];
  return Object.keys(reqs).filter(k => reqs[k]);
}

export function checkAgeRequirement(gradeLevel: string, dob: string, schoolYear: string): string | null {
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

export function useAdmissionWizard() {
  const [step, setStep] = useState(() => {
    try { const s = localStorage.getItem('gk_admission_step'); return s ? Math.min(Math.max(parseInt(s), 1), 4) : 1; } catch { return 1; }
  });
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
    const [existingApp, myResult] = await Promise.all([
      getMyAdmission(), getMyResult()
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
          studentNumber: f.studentNumber || user.applicantProfile?.studentNumber || '',
        };
        if (user.applicantProfile?.studentNumber && !f.applicantType) {
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
    try { localStorage.setItem('gk_admission_step', String(n)); } catch { /* ignore */ }
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
      try { localStorage.removeItem('gk_admission_step'); } catch { /* ignore */ }
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
  const removeExtra = (index: number) => setExtraFiles(fs => fs.filter((_, j) => j !== index));

  return {
    step, form, setForm, set, slotFiles, extraFiles, saving, privacyConsent, setPrivacyConsent,
    requiredDocs, isDirty, existingApp, examPassed, showWizard, setShowWizard,
    successOpen, setSuccessOpen, submittedTrackingId,
    gateLoading, gateError, gateData, refetch, user,
    goTo, handleSubmit, handleSlotFile, handleExtraFiles, removeSlot, removeExtra,
  };
}
