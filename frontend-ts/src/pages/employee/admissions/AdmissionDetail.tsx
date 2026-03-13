import { showToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { getAdmissions, updateAdmissionStatus, VALID_TRANSITIONS } from '../../../api/admissions';
import { useAsync } from '../../../hooks/useAsync';
import { asArray } from '../../../utils/helpers';
import DocumentReview from '../../../components/DocumentReview';
import { PageHeader, Badge, SkeletonPage } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { formatDate, badgeClass } from '../../../utils/helpers';
import { SCHOOL_NAME, SCHOOL_BRAND, SCHOOL_SUBTITLE, SCHOOL_ADDRESS, SCHOOL_PHONE } from '../../../utils/constants';
import { useAuth } from '../../../context/AuthContext';
import type { Admission } from '../../../types';
import { useState } from 'react';

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

export default function AdmissionDetail({ admissionId, onBack }: Props) {
  const { user } = useAuth();
  const canManage = user?.role === 'administrator' || user?.role === 'registrar';
  const confirm = useConfirm();
  const { data: adm, loading, refetch } = useAsync<Admission | null>(async () => {
    const raw = await getAdmissions();
    const all = asArray<Admission>(raw);
    return all.find(a => a.id === admissionId) || null;
  }, [admissionId]);

  const [statusVal, setStatusVal] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Sync state from fetched data once loaded
  if (adm && !initialized) {
    setStatusVal(adm.status);
    setNotes(adm.notes || '');
    setInitialized(true);
  }

  if (loading && !adm) return <SkeletonPage />;
  if (!adm) return <p className="text-gray-500 p-4">Application not found.</p>;

  const handlePrint = () => {
    const esc = (s: unknown) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const printWin = window.open('', '_blank');
    if (!printWin || printWin.closed) {
      showToast('Popup blocked — please allow popups for this site and try again.', 'error');
      return;
    }
    printWin.document.write(`<!DOCTYPE html><html><head><title>Application - ${esc(adm.firstName)} ${esc(adm.lastName)}</title>
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
      <div class="logo"><span>🔑</span><h1><span style="color:#fbbf24">${SCHOOL_BRAND}</span><br/><span style="color:#166534">${SCHOOL_SUBTITLE}</span></h1><p class="subtitle">${SCHOOL_ADDRESS} &bull; Tel: ${SCHOOL_PHONE}<br/>Admission Application Form</p></div>
      <h2>Student Information</h2>
      <div class="grid">
        <div class="field"><label>Full Name</label><span>${esc(adm.firstName)} ${esc(adm.lastName)}</span></div>
        <div class="field"><label>Email</label><span>${esc(adm.email)}</span></div>
        <div class="field"><label>Phone</label><span>${esc(adm.phone) || 'N/A'}</span></div>
        <div class="field"><label>Date of Birth</label><span>${esc(adm.dob)}</span></div>
        <div class="field"><label>Gender</label><span>${esc(adm.gender)}</span></div>
        <div class="field"><label>Grade Level</label><span>${esc(adm.gradeLevel)}</span></div>
      </div>
      <div style="margin-top:12px" class="grid">
        <div class="field"><label>Address</label><span>${esc(adm.address)}</span></div>
        <div class="field"><label>Previous School</label><span>${esc(adm.prevSchool) || 'N/A'}</span></div>
        <div class="field"><label>Parent / Guardian</label><span>${esc(adm.guardian)}</span></div>
      </div>
      <h2>Submitted Documents</h2>
      <ul class="docs">${adm.documents.map((d: string) => `<li>📄 ${esc(d)}</li>`).join('')}</ul>
      <h2>Application Status</h2>
      <p><span class="status ${esc(adm.status).replace(/\s+/g, '-')}">${esc(adm.status)}</span></p>
      ${adm.notes ? `<p style="margin-top:8px;font-size:13px;color:#666"><strong>Notes:</strong> ${esc(adm.notes)}</p>` : ''}
      <p style="margin-top:30px;font-size:11px;color:#aaa;text-align:center">Printed on ${new Date().toLocaleDateString()} — ${SCHOOL_NAME} &copy; ${new Date().getFullYear()}</p>
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
        message: `Are you sure you want to change ${adm.firstName} ${adm.lastName}'s application from "${adm.status}" to "${statusVal}"?`,
        confirmLabel: statusVal,
        variant: statusVal === 'Rejected' ? 'danger' : 'info',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await updateAdmissionStatus(adm.id, statusVal, notes);
      showToast(`Application ${statusVal.toLowerCase()} successfully!`, 'success');
      refetch();
    } catch (err: any) {
      showToast('Update failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">← Back to List</button>
        <button onClick={handlePrint} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm ml-auto inline-flex items-center gap-1.5"><Icon name="document" className="w-4 h-4" /> Print / Export PDF</button>
      </div>
      <PageHeader title="Application Details" />

      <div className="gk-card p-6 mb-4">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Student Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <D label="Full Name" value={`${adm.firstName} ${adm.lastName}`} />
          <D label="Email" value={adm.email} />
          <D label="Phone" value={adm.phone || 'N/A'} />
          <D label="Date of Birth" value={adm.dob} />
          <D label="Gender" value={adm.gender} />
          <D label="Grade Level" value={adm.gradeLevel} />
          <D label="Applicant Type" value={adm.applicantType || 'New'} />
          <D label="Student Number" value={adm.studentNumber || (adm.applicantType === 'New' || adm.applicantType === 'Transferee' ? 'Will be assigned on acceptance' : 'N/A')} />
          <div className="md:col-span-2"><D label="Address" value={adm.address} /></div>
          <D label="Previous School" value={adm.prevSchool || 'N/A'} />
          <D label="Parent / Guardian" value={adm.guardian} />
          <D label="Date Submitted" value={formatDate(adm.submittedAt)} />
        </div>
      </div>

      <div className="gk-card p-6 mb-4">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Submitted Documents</h3>
        <DocumentReview
          admissionId={adm.id}
          documents={adm.documentFiles || adm.documents.map((d: string) => ({ id: 0, name: d, filePath: null as string | null }))}
          onReviewUpdate={refetch}
        />
      </div>

      <div className="gk-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Application Status</h3>
        <div className="mb-4">Current Status: <Badge className={badgeClass(adm.status)}>{adm.status}</Badge></div>
        {canManage ? (
          <>
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
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about this application..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none min-h-[80px]" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={saveStatus} disabled={saving} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">{saving ? <><Icon name="spinner" className="w-4 h-4 animate-spin" /> Saving…</> : <><Icon name="check" className="w-4 h-4" /> Save Changes</>}</button>
              <button onClick={onBack} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">You have view-only access to admission applications.</p>
        )}
      </div>
    </div>
  );
}
