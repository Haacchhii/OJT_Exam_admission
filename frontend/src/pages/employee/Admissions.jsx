import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { getAdmissions, getStats, updateAdmissionStatus, VALID_TRANSITIONS } from '../../api/admissions.js';
import { showToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { PageHeader, Badge, EmptyState, Pagination, usePaginationSlice, SkeletonPage, ErrorAlert } from '../../components/UI.jsx';
import { formatDate, badgeClass } from '../../utils/helpers.js';

const PER_PAGE = 10;

export default function EmployeeAdmissions() {
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const directId = searchParams.get('id');
  const directStatus = searchParams.get('status');
  const [detailId, setDetailId] = useState(directId ? parseInt(directId) : null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(directStatus || 'all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [statusVal, setStatusVal] = useState('');
  const [notes, setNotes] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('Submitted');
  const [saving, setSaving] = useState(false);

  const { data: rawData, loading, error, refetch } = useAsync(async () => {
    const [stats, admissions] = await Promise.all([getStats(), getAdmissions()]);
    const grades = [...new Set(admissions.map(a => a.gradeLevel).filter(Boolean))].sort();
    return { stats, admissions, grades };
  });

  const ADMISSION_STATUSES = ['Submitted', 'Under Screening', 'Under Evaluation', 'Accepted', 'Rejected'];

  const admissions = useMemo(() => {
    let list = rawData?.admissions || [];
    if (filter !== 'all') list = list.filter(a => a.status === filter);
    if (gradeFilter !== 'all') list = list.filter(a => a.gradeLevel === gradeFilter);
    if (search) list = list.filter(a => `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(search.toLowerCase()));
    // Sort
    if (sortBy === 'newest') list = [...list].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    else if (sortBy === 'oldest') list = [...list].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    else if (sortBy === 'name') list = [...list].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    else if (sortBy === 'status') list = [...list].sort((a, b) => a.status.localeCompare(b.status));
    return list;
  }, [rawData, search, filter, gradeFilter, sortBy]);

  const { paginated, totalPages, safePage, totalItems } = usePaginationSlice(admissions, page, PER_PAGE);

  const resetPage = () => setPage(1);

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (paginated.every(a => selected.has(a.id))) {
      setSelected(s => { const n = new Set(s); paginated.forEach(a => n.delete(a.id)); return n; });
    } else {
      setSelected(s => { const n = new Set(s); paginated.forEach(a => n.add(a.id)); return n; });
    }
  };
  const handleBulkAction = async () => {
    if (selected.size === 0 || saving) return;
    // Check which items can legally transition to bulkStatus
    const validIds = [];
    const skippedIds = [];
    selected.forEach(id => {
      const adm = (rawData?.admissions || []).find(a => a.id === id);
      if (!adm) return;
      const allowed = VALID_TRANSITIONS[adm.status] || [];
      if (adm.status === bulkStatus || allowed.includes(bulkStatus)) {
        validIds.push(id);
      } else {
        skippedIds.push(id);
      }
    });
    if (validIds.length === 0) {
      showToast(`None of the selected applications can transition to "${bulkStatus}".`, 'error');
      return;
    }
    const skipNote = skippedIds.length > 0 ? ` (${skippedIds.length} will be skipped due to invalid transitions)` : '';
    const ok = await confirm({
      title: `Bulk ${bulkStatus}`,
      message: `Are you sure you want to mark ${validIds.length} application(s) as "${bulkStatus}"?${skipNote}`,
      confirmLabel: `${bulkStatus} All`,
      variant: bulkStatus === 'Rejected' ? 'danger' : 'info',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await Promise.all(validIds.map(id => updateAdmissionStatus(id, bulkStatus, '')));
      showToast(`${validIds.length} application(s) updated to ${bulkStatus}.${skippedIds.length ? ` ${skippedIds.length} skipped.` : ''}`, 'success');
      setSelected(new Set());
      refetch();
    } catch (err) {
      showToast('Bulk update failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const showDetail = (id) => {
    const adm = (rawData?.admissions || []).find(a => a.id === id);
    if (!adm) return;
    setDetailId(id);
    setStatusVal(adm.status);
    setNotes(adm.notes || '');
    setSearchParams({ id: String(id) });
  };

  const backToList = () => { setDetailId(null); setSearchParams({}); };

  const saveStatus = async () => {
    if (!detailId || saving) return;
    const adm = (rawData?.admissions || []).find(a => a.id === detailId);
    if (!adm) return;
    const allowed = VALID_TRANSITIONS[adm.status] || [];
    if (statusVal !== adm.status && !allowed.includes(statusVal)) {
      showToast(`Cannot transition from "${adm.status}" to "${statusVal}".`, 'error');
      return;
    }
    setSaving(true);
    try {
      await updateAdmissionStatus(detailId, statusVal, notes);
      showToast(`Application ${statusVal.toLowerCase()} successfully!`, 'success');
      refetch();
    } catch (err) {
      showToast('Update failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Loading guard
  if (loading && !rawData) return <SkeletonPage />;
  if (error) return <ErrorAlert error={error} onRetry={refetch} />;

  // Detail View
  if (detailId) {
    const adm = (rawData?.admissions || []).find(a => a.id === detailId);
    if (!adm) return <p>Application not found.</p>;

    const handlePrint = () => {
      const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
        <div class="logo"><span>🔑</span><h1>GOLDEN KEY Integrated School of St. Joseph</h1><p class="subtitle">Lapolapo 1st, San Jose, Batangas, Philippines &bull; Tel: (043)-702-2153<br/>Admission Application Form</p></div>
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
        <ul class="docs">${adm.documents.map(d => `<li>📄 ${esc(d)}</li>`).join('')}</ul>
        <h2>Application Status</h2>
        <p><span class="status ${esc(adm.status).replace(/\s+/g, '-')}">${esc(adm.status)}</span></p>
        ${adm.notes ? `<p style="margin-top:8px;font-size:13px;color:#666"><strong>Notes:</strong> ${esc(adm.notes)}</p>` : ''}
        <p style="margin-top:30px;font-size:11px;color:#aaa;text-align:center">Printed on ${new Date().toLocaleDateString()} — GOLDEN KEY Integrated School of St. Joseph &copy; 2026</p>
      </body></html>`);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 300);
    };

    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <button onClick={backToList} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">← Back to List</button>
          <button onClick={handlePrint} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm ml-auto">🖨️ Print / Export PDF</button>
        </div>
        <PageHeader title="Application Details" />

        <div className="lpu-card p-6 mb-4">
          <h3 className="text-lg font-bold text-forest-500 mb-4">Student Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <D label="Full Name" value={`${adm.firstName} ${adm.lastName}`} />
            <D label="Email" value={adm.email} />
            <D label="Phone" value={adm.phone || 'N/A'} />
            <D label="Date of Birth" value={adm.dob} />
            <D label="Gender" value={adm.gender} />
            <D label="Grade Level" value={adm.gradeLevel} />
            <D label="Applicant Type" value={adm.applicantType || 'New'} />
            <div className="md:col-span-2"><D label="Address" value={adm.address} /></div>
            <D label="Previous School" value={adm.prevSchool || 'N/A'} />
            <D label="Parent / Guardian" value={adm.guardian} />
            <D label="Date Submitted" value={formatDate(adm.submittedAt)} />
          </div>
        </div>

        <div className="lpu-card p-6 mb-4">
          <h3 className="text-lg font-bold text-forest-500 mb-4">Submitted Documents</h3>
          <div className="space-y-2">
            {adm.documents.map((doc, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm">
                <span>📄 {doc}</span>
                <span className="bg-forest-100 text-forest-700 px-2 py-0.5 rounded-full text-xs">Submitted</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lpu-card p-6">
          <h3 className="text-lg font-bold text-forest-500 mb-4">Application Status</h3>
          <div className="mb-4">Current Status: <Badge className={badgeClass(adm.status)}>{adm.status}</Badge></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Update Status</label>
              <select value={statusVal} onChange={e => setStatusVal(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white">
                {ADMISSION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Remarks</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about this application..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none min-h-[80px]" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={saveStatus} disabled={saving} className="bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? '⏳ Saving…' : '💾 Save Changes'}</button>
            <button onClick={backToList} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // List View
  const tabs = [
    { key: 'all', label: 'All', count: rawData?.stats?.total || 0 },
    { key: 'Submitted', label: 'Submitted', count: rawData?.stats?.submitted || 0 },
    { key: 'Under Screening', label: 'Screening', count: rawData?.stats?.underScreening || 0 },
    { key: 'Under Evaluation', label: 'Evaluation', count: rawData?.stats?.underEvaluation || 0 },
    { key: 'Accepted', label: 'Accepted', count: rawData?.stats?.accepted || 0 },
    { key: 'Rejected', label: 'Rejected', count: rawData?.stats?.rejected || 0 },
  ];

  return (
    <div>
      <PageHeader title="All Admission Applications" />

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} placeholder="Search by name or email..." aria-label="Search applications" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none" />
        <select value={filter} onChange={e => { setFilter(e.target.value); resetPage(); }} aria-label="Filter by status" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white">
          <option value="all">All Status</option>
          {ADMISSION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); resetPage(); }} aria-label="Filter by grade" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white">
          <option value="all">All Grades</option>
          {(rawData?.grades || []).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={sortBy} onChange={e => { setSortBy(e.target.value); resetPage(); }} aria-label="Sort by" className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#166534]/20 outline-none bg-white">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name A–Z</option>
          <option value="status">Status</option>
        </select>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap" role="tablist">
        {tabs.map(t => (
          <button key={t.key} role="tab" aria-selected={filter === t.key} onClick={() => { setFilter(t.key); resetPage(); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === t.key ? 'bg-[#166534] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-forest-50 border border-forest-200 rounded-lg px-4 py-3 animate-[fadeInUp_0.2s_ease-out]">
          <span className="text-sm font-semibold text-forest-700">{selected.size} selected</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#166534]/20 outline-none">
            {ADMISSION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleBulkAction} disabled={saving} className="bg-forest-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-forest-600 transition disabled:opacity-50 disabled:cursor-not-allowed">{saving ? '⏳ Applying…' : 'Apply'}</button>
          <button onClick={() => setSelected(new Set())} className="text-gray-500 text-sm hover:underline ml-auto">Clear selection</button>
        </div>
      )}

      <div className="lpu-card p-4">
        {paginated.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-400 uppercase text-xs">
                    <th scope="col" className="py-3 px-2 w-8"><input type="checkbox" checked={paginated.length > 0 && paginated.every(a => selected.has(a.id))} onChange={toggleAll} className="accent-[#166534] rounded" /></th>
                    <th scope="col" className="py-3 px-2">ID</th><th scope="col" className="py-3 px-2">Student Name</th><th scope="col" className="py-3 px-2">Email</th>
                    <th scope="col" className="py-3 px-2">Grade Level</th><th scope="col" className="py-3 px-2">Type</th><th scope="col" className="py-3 px-2">Documents</th><th scope="col" className="py-3 px-2">Status</th>
                    <th scope="col" className="py-3 px-2">Submitted</th><th scope="col" className="py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(a => (
                    <tr key={a.id} onClick={() => showDetail(a.id)} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${selected.has(a.id) ? 'bg-gold-50/50' : ''}`}>
                      <td className="py-3 px-2" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} className="accent-[#166534] rounded" /></td>
                      <td className="py-3 px-2 text-gray-400">{a.id}</td>
                      <td className="py-3 px-2 font-medium text-forest-500">{a.firstName} {a.lastName}</td>
                      <td className="py-3 px-2 text-gray-500">{a.email}</td>
                      <td className="py-3 px-2">{a.gradeLevel}</td>
                      <td className="py-3 px-2"><Badge variant="info">{a.applicantType || 'New'}</Badge></td>
                      <td className="py-3 px-2">{a.documents.length} file(s)</td>
                      <td className="py-3 px-2"><Badge className={badgeClass(a.status)}>{a.status}</Badge></td>
                      <td className="py-3 px-2 text-gray-500">{formatDate(a.submittedAt)}</td>
                      <td className="py-3 px-2"><button onClick={(e) => { e.stopPropagation(); showDetail(a.id); }} className="text-[#166534] hover:underline text-xs font-medium">View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={PER_PAGE} />
          </>
        ) : (
          <EmptyState icon="📭" title="No applications found" text="No admission applications match your current filters." />
        )}
      </div>
    </div>
  );
}

function D({ label, value }) {
  return <div><span className="block text-xs text-gray-400 uppercase tracking-wide">{label}</span><span className="text-sm text-forest-500 font-medium">{value}</span></div>;
}
