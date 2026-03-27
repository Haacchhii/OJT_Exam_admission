import { useState, useMemo, useCallback, useEffect, type ChangeEvent } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useAsync } from '../../../hooks/useAsync';
import { getMyAdmission, addAdmission, uploadAdmissionDocuments } from '../../../api/admissions';
import { getMyRegistrations } from '../../../api/exams';
import { showToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { DOC_REQUIREMENTS, DOC_OPTIONAL_REQUIREMENTS, DOC_SLOT_LABELS, ALLOWED_FILE_TYPES, MAX_FILE_SIZE, getCurrentSchoolYear } from '../../../utils/constants';
import type { Admission, ExamRegistration } from '../../../types';
import { validateStep1, validateStep2, validateStep3, checkAgeRequirement } from './admissionValidation';

export { checkAgeRequirement };
export interface AdmissionForm {
  firstName: string; middleName: string; lastName: string; email: string; phone: string; dob: string; gender: string;
  noMiddleName: boolean;
  placeOfBirth: string; religion: string;
  addressStreet: string; addressBarangay: string; addressCityMunicipality: string; addressProvince: string; addressZipCode: string;
  prevSchool: string; schoolAddress: string; gradeLevel: string; schoolYear: string; lrn: string; applicantType: string;
  studentNumber: string;
  fatherName: string; fatherOccupation: string; motherName: string; motherOccupation: string; guardian: string;
  guardianRelation: string; guardianPhone: string; guardianEmail: string;
  [key: string]: string | boolean;
}

function splitLegacyMotherNameOccupation(value: string): { motherName: string; motherOccupation: string } {
  const raw = String(value || '').trim();
  if (!raw) return { motherName: '', motherOccupation: '' };
  const commaIndex = raw.indexOf(',');
  if (commaIndex === -1) return { motherName: raw, motherOccupation: '' };
  return {
    motherName: raw.slice(0, commaIndex).trim(),
    motherOccupation: raw.slice(commaIndex + 1).trim(),
  };
}

function composeHomeAddress(form: AdmissionForm): string {
  return [
    form.addressStreet,
    form.addressBarangay ? `Brgy. ${form.addressBarangay}` : '',
    form.addressCityMunicipality,
    form.addressProvince,
    form.addressZipCode,
  ].filter(Boolean).join(', ');
}

export type SlotFiles = Record<string, File | null>;

interface GateData {
  existingApp: Admission | null;
  examCompleted: boolean;
}

export function getRequiredDocs(gradeLevel: string): string[] {
  const reqs = (DOC_REQUIREMENTS as Record<string, Record<string, boolean>>)[gradeLevel] || (DOC_REQUIREMENTS as Record<string, Record<string, boolean>>)['Grade 2'];
  return Object.keys(reqs).filter(k => reqs[k]);
}

export function getOptionalDocs(gradeLevel: string): string[] {
  const optionalReqs = (DOC_OPTIONAL_REQUIREMENTS as Record<string, Record<string, boolean>>)[gradeLevel] || {};
  return Object.keys(optionalReqs).filter(k => optionalReqs[k]);
}

export function useAdmissionWizard() {
  const [step, setStep] = useState(() => {
    try { const s = localStorage.getItem('gk_admission_step'); return s ? Math.min(Math.max(parseInt(s), 1), 5) : 1; } catch { return 1; }
  });
  const [showWizard, setShowWizard] = useState(true);
  const [successOpen, setSuccessOpen] = useState(false);
  const [submittedTrackingId, setSubmittedTrackingId] = useState('');
  const [slotFiles, setSlotFiles] = useState<SlotFiles>({ birthCert: null, idPhoto: null, reportCard: null, goodMoral: null, baptismal: null, eccdChecklist: null, incomeTax: null, escCert: null });
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<AdmissionForm>({
    firstName: '', middleName: '', lastName: '', email: '', phone: '', dob: '', gender: '', noMiddleName: false, placeOfBirth: '', religion: '',
    addressStreet: '', addressBarangay: '', addressCityMunicipality: '', addressProvince: '', addressZipCode: '',
    prevSchool: '', schoolAddress: '', gradeLevel: '', schoolYear: getCurrentSchoolYear(), lrn: '', applicantType: 'New',
    studentNumber: '',
    fatherName: '', fatherOccupation: '', motherName: '', motherOccupation: '', guardian: '',
    guardianRelation: '', guardianPhone: '', guardianEmail: '',
  });

  const { user } = useAuth();
  const confirmDialog = useConfirm();

  const { data: gateData, loading: gateLoading, error: gateError, refetch } = useAsync<GateData>(async () => {
    const [existingApp, myRegs] = await Promise.all([
      getMyAdmission(), getMyRegistrations()
    ]);
    const registrations = Array.isArray(myRegs) ? myRegs : [];
    const examCompleted = registrations.some((reg: ExamRegistration) => reg.status === 'done');
    return { existingApp, examCompleted };
  }, [user]);

  const existingApp = gateData?.existingApp || null;
  const examCompleted = gateData?.examCompleted || false;

  const isDirty = !!(form.firstName || form.middleName || form.lastName || form.email);
  const { restore, clear } = useUnsavedChanges(isDirty, 'gk_admission_draft', form);

  useEffect(() => {
    if (!existingApp && user) {
      setForm(f => {
        const updated: AdmissionForm = {
          ...f,
          firstName: f.firstName || user.firstName || '',
          middleName: f.middleName || user.middleName || '',
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
      const normalized = { ...(saved as AdmissionForm & { motherNameOccupation?: string }) };
      if (!normalized.motherName?.trim() && !normalized.motherOccupation?.trim() && normalized.motherNameOccupation?.trim()) {
        const legacy = splitLegacyMotherNameOccupation(normalized.motherNameOccupation);
        normalized.motherName = legacy.motherName;
        normalized.motherOccupation = legacy.motherOccupation;
      }
      setForm(f => ({ ...f, ...normalized }));
      showToast('Draft restored from your last session.', 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, existingApp]);

  const clearError = useCallback((k: string) => setErrors(e => { if (!e[k]) return e; const { [k]: _, ...r } = e; return r; }), []);
  const set = useCallback((k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    clearError(k);
  }, [clearError]);

  const requiredDocs = useMemo(() => getRequiredDocs(form.gradeLevel), [form.gradeLevel]);
  const optionalDocs = useMemo(() => getOptionalDocs(form.gradeLevel), [form.gradeLevel]);

  const goTo = (n: number) => {
    if (n > step) {
      let stepErrors: Record<string, string> = {};
      if (step === 1) stepErrors = validateStep1(form);
      else if (step === 2) stepErrors = validateStep2(form);
      else if (step === 3) stepErrors = validateStep3(form);
      else if (step === 4) {
        const missingDocs = requiredDocs.filter(k => !slotFiles[k]);
        if (missingDocs.length > 0) {
          showToast(`Please upload all required documents. Missing: ${missingDocs.map(k => (DOC_SLOT_LABELS as Record<string, string>)[k]?.split('(')[0]?.trim() || k).join(', ')}`, 'error');
          return;
        }
      }
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        const firstMsg = Object.values(stepErrors)[0];
        showToast(firstMsg, 'error');
        return;
      }
      setErrors({});
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
      const result = await addAdmission({
        ...form,
        address: composeHomeAddress(form),
        fatherNameOccupation: [form.fatherName.trim(), form.fatherOccupation.trim()].filter(Boolean).join(', '),
        motherNameOccupation: [form.motherName.trim(), form.motherOccupation.trim()].filter(Boolean).join(', '),
        documents: docs.length ? docs : ['(No documents uploaded)'],
      });
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
    if (!ALLOWED_FILE_TYPES.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp)$/i)) {
      showToast(`"${file.name}" is not a supported file type. Use PDF, JPG, JPEG, PNG, or WEBP.`, 'error');
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
    requiredDocs, optionalDocs, isDirty, existingApp, examCompleted, showWizard, setShowWizard,
    successOpen, setSuccessOpen, submittedTrackingId,
    gateLoading, gateError, gateData, refetch, user,
    errors, setErrors, clearError,
    goTo, handleSubmit, handleSlotFile, handleExtraFiles, removeSlot, removeExtra,
  };
}
