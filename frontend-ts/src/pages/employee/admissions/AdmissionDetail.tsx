import { showToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { getAdmission, updateAdmissionStatus, VALID_TRANSITIONS } from '../../../api/admissions';
import { useAsync } from '../../../hooks/useAsync';
import { formatDate, formatDateRange, formatPersonName, badgeClass } from '../../../utils/helpers';
import DocumentReview from '../../../components/DocumentReview';
import { PageHeader, Badge, SkeletonPage, ActionButton, StatusStepper, StatusBanner } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { SCHOOL_NAME, SCHOOL_BRAND, SCHOOL_SUBTITLE, SCHOOL_ADDRESS, SCHOOL_PHONE } from '../../../utils/constants';
import { useAuth } from '../../../context/AuthContext';
import type { Admission } from '../../../types';
import { useEffect, useState } from 'react';

interface DProps {
  label: string;
  value: string | number | undefined | null;
}

function D({ label, value }: DProps) {
  return <div><span className="block text-xs text-gray-400 uppercase tracking-wide">{label}</span><span className="text-sm text-forest-500 font-medium">{value}</span></div>;
}

interface Props {
  admissionId: number;
  onBack: () => void;
}

const STATUS_STEPS = [
  { key: 'Submitted', label: 'Submitted', hint: 'Application received and queued.' },
  { key: 'Under Screening', label: 'Screening', hint: 'Documents and profile checks in progress.' },
  { key: 'Under Evaluation', label: 'Evaluation', hint: 'Academic and final review in progress.' },
  { key: 'Accepted', label: 'Accepted', hint: 'Ready for enrollment handoff.' },
  { key: 'Rejected', label: 'Rejected', hint: 'Decision finalized with notes.' },
];

export default function AdmissionDetail({ admissionId, onBack }: Props) {
  const { user } = useAuth();
  const canManage = user?.role === 'administrator' || user?.role === 'registrar';
  const confirm = useConfirm();
  const { data: fetchedAdm, loading, refetch } = useAsync<Admission | null>(async () => {
    try {
      return await getAdmission(admissionId);
    } catch {
      return null;
    }
  }, [admissionId], 0, { autoRefreshOnDataChange: true, resourcePrefixes: ['/admissions'] });

  const [adm, setAdm] = useState<Admission | null>(null);

  const [statusVal, setStatusVal] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionBanner, setActionBanner] = useState<{ tone: 'info' | 'success' | 'danger'; title: string; message?: string } | null>(null);

  useEffect(() => {
    if (!actionBanner || actionBanner.tone === 'info') return;
    const timer = window.setTimeout(() => setActionBanner(null), 7000);
    return () => window.clearTimeout(timer);
  }, [actionBanner]);

  useEffect(() => {
    if (!fetchedAdm) return;
    setAdm(fetchedAdm);
    setStatusVal(fetchedAdm.status);
    setNotes(fetchedAdm.notes || '');
  }, [fetchedAdm?.id, fetchedAdm?.status, fetchedAdm?.notes]);

  if (loading && !adm) return <SkeletonPage />;
  if (!adm) return <p className="text-gray-500 p-4">Application not found.</p>;

  const currentStatus = statusVal || adm.status;
  const periodLabel = adm.academicYear?.year && adm.semester?.name
    ? `${adm.academicYear.year} - ${adm.semester.name}`
    : adm.academicYear?.year || adm.semester?.name || 'N/A';
  const periodWindow = formatDateRange(adm.semester?.startDate, adm.semester?.endDate, {
    openStartLabel: 'Open',
    openEndLabel: 'Open',
  });

  const suggestedAction =
    currentStatus === 'Submitted'
      ? 'Check required documents and profile completeness, then move to Under Screening.'
      : currentStatus === 'Under Screening'
        ? 'Resolve missing requirements and reviewer notes, then move to Under Evaluation.'
        : currentStatus === 'Under Evaluation'
          ? 'Finalize decision (Accepted or Rejected) and write concise rationale for records.'
          : currentStatus === 'Accepted'
            ? 'Prepare enrollment follow-up instructions and confirm registrar handoff.'
            : 'Provide clear rejection reason and guidance on possible re-application path.';

  const addNoteTemplate = (template: string) => {
    setNotes(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n\n${template}` : template;
    });
  };

  const handlePrint = () => {
    const esc = (s: unknown) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const printWin = window.open('', '_blank');
    if (!printWin || printWin.closed) {
      showToast('Popup blocked - please allow popups for this site and try again.', 'error');
      return;
    }
    const fullName = formatPersonName(adm);
    printWin.document.write(`<!DOCTYPE html><html><head><title>Application - ${esc(fullName)}</title>
      <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        h1 { color: #166534; font-size: 24px; margin-bottom: 4px; }
        h2 { color: #166534; font-size: 16px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #ffd700; }
        .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .field label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 2px; }
        .field span { font-size: 14px; font-weight: 500; }
        .docs { list-style: none; padding: 0; } .docs li { padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; }
        .status.Submitted { background: #fef9c3; color: #854d0e; }
        .status.Under-Screening { background: #dbeafe; color: #1e40af; }
        .status.Under-Evaluation { background: #f3e8ff; color: #7c3aed; }
        .status.Accepted { background: #dcfce7; color: #166534; }
        .status.Rejected { background: #fee2e2; color: #991b1b; }
        .logo { text-align: center; margin-bottom: 20px; } .logo span { font-size: 32px; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>
      <div class="logo"><span>GK</span><h1><span style="color:#fbbf24">${SCHOOL_BRAND}</span><br/><span style="color:#166534">${SCHOOL_SUBTITLE}</span></h1><p class="subtitle">${SCHOOL_ADDRESS} | Tel: ${SCHOOL_PHONE}<br/>Admission Application Form</p></div>
      <h2>Student Information</h2>
      <div class="grid">
        <div class="field"><label>Full Name</label><span>${esc(fullName)}</span></div>
        <div class="field"><label>Email</label><span>${esc(adm.email)}</span></div>
        <div class="field"><label>Phone</label><span>${esc(adm.phone) || 'N/A'}</span></div>
        <div class="field"><label>Date of Birth</label><span>${esc(adm.dob)}</span></div>
        <div class="field"><label>Sex</label><span>${esc(adm.gender)}</span></div>
        <div class="field"><label>Place of Birth</label><span>${esc(adm.placeOfBirth) || 'N/A'}</span></div>
        <div class="field"><label>Religion</label><span>${esc(adm.religion) || 'N/A'}</span></div>
        <div class="field"><label>Grade Level</label><span>${esc(adm.gradeLevel)}</span></div>
        <div class="field"><label>LRN</label><span>${esc(adm.lrn) || 'N/A'}</span></div>
      </div>
      <div style="margin-top:12px" class="grid">
        <div class="field" style="grid-column:span 3"><label>Complete Address</label><span>${esc(adm.address)}</span></div>
        <div class="field" style="grid-column:span 3"><label>Last School Attended</label><span>${esc(adm.prevSchool) || 'N/A'}</span></div>
        <div class="field" style="grid-column:span 3"><label>School Address</label><span>${esc(adm.schoolAddress) || 'N/A'}</span></div>
        <div class="field"><label>Father's Name & Occupation</label><span>${esc(adm.fatherNameOccupation) || 'N/A'}</span></div>
        <div class="field"><label>Mother's Name & Occupation</label><span>${esc(adm.motherNameOccupation) || 'N/A'}</span></div>
        <div class="field"><label>Guardian (if applicable)</label><span>${esc(adm.guardian) || 'N/A'}</span></div>
      </div>
      <h2>Submitted Documents</h2>
      <ul class="docs">${adm.documents.map((d: string) => `<li>File: ${esc(d)}</li>`).join('')}</ul>
      <h2>Application Status</h2>
      <p><span class="status ${esc(adm.status).replace(/\s+/g, '-')}">${esc(adm.status)}</span></p>
      ${adm.notes ? `<p style="margin-top:8px;font-size:13px;color:#666"><strong>Notes:</strong> ${esc(adm.notes)}</p>` : ''}
      <p style="margin-top:30px;font-size:11px;color:#aaa;text-align:center">Printed on ${new Date().toLocaleDateString()} - ${SCHOOL_NAME} &copy; ${new Date().getFullYear()}</p>
    </body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
  };

  const saveStatus = async () => {
    if (saving) return;
    const allowed = VALID_TRANSITIONS[adm.status] || [];
    if (statusVal !== adm.status && !(allowed as string[]).includes(statusVal)) {
      showToast(`Cannot transition from "${adm.status}" to "${statusVal}".`, 'error');
      return;
    }
    if (statusVal !== adm.status) {
      const ok = await confirm({
        title: `Update Status to "${statusVal}"`,
        message: `Are you sure you want to change ${formatPersonName(adm)}'s application from "${adm.status}" to "${statusVal}"?`,
        confirmLabel: statusVal,
        variant: statusVal === 'Rejected' ? 'danger' : 'info',
      });
      if (!ok) return;
    }
    setSaving(true);
    setActionBanner({
      tone: 'info',
      title: 'Updating application status...',
      message: 'Please wait while we save this change for all stakeholders.',
    });
    try {
      const updated = await updateAdmissionStatus(adm.id, statusVal, notes);
      setAdm(updated);
      setStatusVal(updated.status);
      setNotes(updated.notes || '');
      setActionBanner({
        tone: 'success',
        title: 'Application status updated successfully.',
        message: `Current status is now "${updated.status}".`,
      });
      showToast(`Application ${statusVal.toLowerCase()} successfully!`, 'success');
      refetch();
    } catch (err: any) {
      setActionBanner({
        tone: 'danger',
        title: 'Failed to update application status.',
        message: err?.message || 'Please try again.',
      });
      showToast('Update failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ActionButton variant="secondary" onClick={onBack}>Back to List</ActionButton>
        <ActionButton variant="secondary" onClick={handlePrint} className="ml-auto" icon={<Icon name="document" className="w-4 h-4" />}>Print / Export PDF</ActionButton>
      </div>
      <PageHeader title="Application Details" />

      {actionBanner && (
        <StatusBanner
          tone={actionBanner.tone}
          title={actionBanner.title}
          message={actionBanner.message}
          className="mb-4"
        />
      )}

      <div className="gk-section-card p-6 mb-4">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Student Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <D label="Full Name" value={formatPersonName(adm)} />
          <D label="Email" value={adm.email} />
          <D label="Phone" value={adm.phone || 'N/A'} />
          <D label="Date of Birth" value={adm.dob} />
          <D label="Sex" value={adm.gender} />
          <D label="Place of Birth" value={adm.placeOfBirth || 'N/A'} />
          <D label="Religion" value={adm.religion || 'N/A'} />
          <div className="md:col-span-2"><D label="Complete Address" value={adm.address} /></div>
          <D label="Grade Level" value={adm.gradeLevel} />
          <D label="Applicant Type" value={adm.applicantType || 'New'} />
          <D label="Student Number" value={adm.studentNumber || (adm.applicantType === 'New' || adm.applicantType === 'Transferee' ? 'Will be assigned on acceptance' : 'N/A')} />
          <D label="LRN" value={adm.lrn || 'N/A'} />
          <D label="Application Period" value={periodWindow ? `${periodLabel} (${periodWindow})` : periodLabel} />
          <D label="Last School Attended" value={adm.prevSchool || 'N/A'} />
          <div className="md:col-span-2"><D label="School Address" value={adm.schoolAddress || 'N/A'} /></div>
          <D label="Father's Name & Occupation" value={adm.fatherNameOccupation || 'N/A'} />
          <D label="Mother's Name & Occupation" value={adm.motherNameOccupation || 'N/A'} />
          <D label="Guardian (if applicable)" value={adm.guardian || 'N/A'} />
          <D label="Date Submitted" value={formatDate(adm.submittedAt)} />
        </div>
      </div>

      <div className="gk-section-card p-6 mb-4">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Submitted Documents</h3>
        <DocumentReview
          admissionId={adm.id}
          documents={adm.documentFiles || adm.documents.map((d: string) => ({ id: 0, name: d, filePath: null as string | null }))}
          onReviewUpdate={refetch}
        />
      </div>

      <div className="gk-section-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Application Status</h3>
        <div className="mb-4">Current Status: <Badge className={badgeClass(adm.status)}>{adm.status}</Badge></div>
        <StatusStepper steps={STATUS_STEPS} currentKey={currentStatus} className="mb-4" />
        {canManage ? (
          <>
            <div className="mb-4 rounded-lg border border-gold-200 bg-gold-50 px-4 py-3">
              <p className="text-xs font-semibold text-gold-800 mb-1">Reviewer next action</p>
              <p className="text-sm text-gold-800">{suggestedAction}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ActionButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => addNoteTemplate('Document check completed. All required files are present and readable.')}
                  className="text-gold-800 border border-gold-300 bg-white hover:bg-gold-100"
                >
                  + Add Doc Check Note
                </ActionButton>
                <ActionButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => addNoteTemplate('Missing requirement follow-up sent to applicant. Awaiting submission/compliance.')}
                  className="text-gold-800 border border-gold-300 bg-white hover:bg-gold-100"
                >
                  + Add Follow-up Note
                </ActionButton>
                <ActionButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => addNoteTemplate('Decision rationale: Applicant meets evaluation criteria based on records and screening results.')}
                  className="text-gold-800 border border-gold-300 bg-white hover:bg-gold-100"
                >
                  + Add Decision Note
                </ActionButton>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Update Status</label>
                <select value={statusVal} onChange={e => setStatusVal(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
                  <option value={adm.status}>{adm.status} (current)</option>
                  {(VALID_TRANSITIONS[adm.status] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {(VALID_TRANSITIONS[adm.status] || []).length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No further transitions available for this status.</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Remarks</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} placeholder="Add notes about this application..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none min-h-[80px]" />
                <p className="text-xs text-gray-400 mt-1">{notes.length}/500</p>
              </div>
            </div>
            <div className="flex gap-3">
              <ActionButton onClick={saveStatus} loading={saving} icon={!saving ? <Icon name="check" className="w-4 h-4" /> : undefined}>{saving ? 'Saving...' : 'Save Changes'}</ActionButton>
              <ActionButton onClick={onBack} variant="secondary">Cancel</ActionButton>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">You have view-only access to admission applications.</p>
        )}
      </div>
    </div>
  );
}
