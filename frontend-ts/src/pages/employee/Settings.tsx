import { useState, useMemo } from 'react';
import { useAsync } from '../../hooks/useAsync';
import {
  getAcademicYears, getSemesters,
  createAcademicYear, updateAcademicYear, deleteAcademicYear,
  createSemester, updateSemester, deleteSemester,
} from '../../api/academicYears';
import { showToast } from '../../components/Toast';
import { PageHeader, Badge, EmptyState, ErrorAlert } from '../../components/UI';
import Icon from '../../components/Icons';
import Modal from '../../components/Modal';
import { useConfirm } from '../../components/ConfirmDialog';
import { SEMESTER_NAMES } from '../../utils/constants';
import type { AcademicYear, Semester } from '../../types';

interface YearForm { year: string; isActive: boolean }
interface SemForm {
  name: string;
  academicYearId: number | string;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

const emptyYearForm: YearForm = { year: '', isActive: false };
const emptySemForm: SemForm = {
  name: 'First Semester',
  academicYearId: '',
  isActive: false,
  startDate: '',
  endDate: '',
};

export default function EmployeeSettings() {
  const { data: academicYears, loading: ayLoading, error: ayError, refetch: refetchAY } = useAsync<AcademicYear[]>(() => getAcademicYears());
  const { data: allSemesters, loading: semLoading, error: semError, refetch: refetchSem } = useAsync<Semester[]>(() => getSemesters());

  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);

  const [showYearModal, setShowYearModal] = useState(false);
  const [editYearId, setEditYearId] = useState<number | null>(null);
  const [yearForm, setYearForm] = useState<YearForm>({ ...emptyYearForm });
  const [yearErrors, setYearErrors] = useState<Record<string, string>>({});
  const [savingYear, setSavingYear] = useState(false);
  const [deletingYearId, setDeletingYearId] = useState<number | null>(null);

  const [showSemModal, setShowSemModal] = useState(false);
  const [editSemId, setEditSemId] = useState<number | null>(null);
  const [semForm, setSemForm] = useState<SemForm>({ ...emptySemForm });
  const [semErrors, setSemErrors] = useState<Record<string, string>>({});
  const [savingSem, setSavingSem] = useState(false);
  const [deletingSemId, setDeletingSemId] = useState<number | null>(null);

  const confirm = useConfirm();

  const years = useMemo(() => academicYears || [], [academicYears]);
  const semesters = useMemo(() => {
    const list = allSemesters || [];
    if (!selectedYearId) return list;
    return list.filter(s => s.academicYearId === selectedYearId);
  }, [allSemesters, selectedYearId]);

  const displayedYear = selectedYearId ? years.find(y => y.id === selectedYearId) : null;

  const openAddYear = () => {
    setYearForm({ ...emptyYearForm });
    setEditYearId(null); setYearErrors({}); setShowYearModal(true);
  };
  const openEditYear = (y: AcademicYear) => {
    setYearForm({ year: y.year, isActive: !!y.isActive });
    setEditYearId(y.id); setYearErrors({}); setShowYearModal(true);
  };

  const validateYear = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!yearForm.year.trim()) e.year = 'School year is required (e.g. 2026-2027)';
    else if (!/^\d{4}-\d{4}$/.test(yearForm.year.trim())) e.year = 'Format must be YYYY-YYYY (e.g. 2026-2027)';
    return e;
  };

  const handleSaveYear = async () => {
    const e = validateYear();
    if (Object.keys(e).length) { setYearErrors(e); return; }
    setSavingYear(true);
    try {
      if (editYearId) {
        await updateAcademicYear(editYearId, yearForm);
        showToast('School year updated', 'success');
      } else {
        await createAcademicYear(yearForm);
        showToast('School year created', 'success');
      }
      setShowYearModal(false);
      refetchAY(); refetchSem();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save school year', 'error');
    } finally { setSavingYear(false); }
  };

  const handleDeleteYear = async (y: AcademicYear) => {
    if (deletingYearId === y.id) return;
    const ok = await confirm({
      title: 'Delete School Year',
      message: `Delete "${y.year}"? All semesters under this year will also be deleted.`,
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (!ok) return;
    setDeletingYearId(y.id);
    try {
      await deleteAcademicYear(y.id);
      showToast('School year deleted', 'success');
      if (selectedYearId === y.id) setSelectedYearId(null);
      refetchAY(); refetchSem();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to delete school year', 'error');
    } finally {
      setDeletingYearId(null);
    }
  };

  const openAddSem = (yearId: number | string) => {
    setSemForm({ name: 'First Semester', academicYearId: yearId, isActive: false, startDate: '', endDate: '' });
    setEditSemId(null); setSemErrors({}); setShowSemModal(true);
  };
  const openEditSem = (s: Semester) => {
    setSemForm({
      name: s.name,
      academicYearId: s.academicYearId,
      isActive: !!s.isActive,
      startDate: s.startDate ? String(s.startDate).slice(0, 10) : '',
      endDate: s.endDate ? String(s.endDate).slice(0, 10) : '',
    });
    setEditSemId(s.id); setSemErrors({}); setShowSemModal(true);
  };

  const validateSem = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!semForm.name) e.name = 'Semester name is required';
    if (!semForm.academicYearId) e.academicYearId = 'School year is required';
    if (semForm.startDate && semForm.endDate && semForm.startDate > semForm.endDate) {
      e.endDate = 'End date must be on or after start date';
    }
    if (semForm.isActive && (!semForm.startDate || !semForm.endDate)) {
      e.startDate = 'Active semester requires start and end dates';
    }
    return e;
  };

  const handleSaveSem = async () => {
    const e = validateSem();
    if (Object.keys(e).length) { setSemErrors(e); return; }
    setSavingSem(true);
    try {
      if (editSemId) {
        await updateSemester(editSemId, { ...semForm, academicYearId: Number(semForm.academicYearId) });
        showToast('Semester updated', 'success');
      } else {
        await createSemester({ ...semForm, academicYearId: Number(semForm.academicYearId) });
        showToast('Semester created', 'success');
      }
      setShowSemModal(false);
      refetchSem();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save semester', 'error');
    } finally { setSavingSem(false); }
  };

  const handleDeleteSem = async (s: Semester) => {
    if (deletingSemId === s.id) return;
    const yearLabel = years.find(y => y.id === s.academicYearId)?.year || '';
    const ok = await confirm({
      title: 'Delete Semester',
      message: `Delete "${s.name}" from ${yearLabel}?`,
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (!ok) return;
    setDeletingSemId(s.id);
    try {
      await deleteSemester(s.id);
      showToast('Semester deleted', 'success');
      refetchSem();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to delete semester', 'error');
    } finally {
      setDeletingSemId(null);
    }
  };

  if (ayLoading || semLoading) return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="Manage academic years and semesters" />
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
      </div>
    </div>
  );

  if (ayError || semError) return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="Manage academic years and semesters" />
      <ErrorAlert error={ayError || semError} />
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="Manage academic years and semesters" />

      {/* School Years Panel */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Icon name="calendar" className="w-5 h-5 text-forest-600" />
            <h2 className="font-semibold text-gray-800">School Years</h2>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{years.length}</span>
          </div>
          <button onClick={openAddYear} className="flex items-center gap-1.5 text-sm font-medium text-white bg-forest-600 hover:bg-forest-700 px-3 py-1.5 rounded-lg transition-colors">
            <Icon name="plus" className="w-4 h-4" /> Add Year
          </button>
        </div>

        {years.length === 0 ? (
          <EmptyState icon="calendar" title="No school years" text="Add a school year to get started" />
        ) : (
          <div className="divide-y divide-gray-100">
            {years.map(y => (
              <div
                key={y.id}
                className={`flex items-center justify-between px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedYearId === y.id ? 'bg-forest-50' : ''}`}
                onClick={() => setSelectedYearId(selectedYearId === y.id ? null : y.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">{y.year}</span>
                  {deletingYearId === y.id && (
                    <Badge className="bg-gray-100 text-gray-700 inline-flex items-center gap-1">
                      <Icon name="spinner" className="w-3 h-3 animate-spin" />
                      Deleting...
                    </Badge>
                  )}
                  {y.isActive && <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>}
                  <button onClick={(e) => { e.stopPropagation(); setSelectedYearId(y.id); }} disabled={deletingYearId === y.id} className="text-xs text-forest-600 hover:text-forest-800 px-2 py-1 rounded hover:bg-forest-50 transition-colors disabled:opacity-50 disabled:pointer-events-none" title="View semesters">
                    <Icon name="eye" className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openEditYear(y); }} disabled={deletingYearId === y.id} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:pointer-events-none" title="Edit">
                    <Icon name="edit" className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteYear(y); }} disabled={deletingYearId === y.id} className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-1" title="Delete">
                    {deletingYearId === y.id ? (
                      <>
                        <Icon name="spinner" className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <Icon name="trash" className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Semesters Panel */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Icon name="cog" className="w-5 h-5 text-forest-600" />
            <h2 className="font-semibold text-gray-800">
              Semesters
              {displayedYear && <span className="text-gray-400 font-normal"> — {displayedYear.year}</span>}
            </h2>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{semesters.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {years.length > 0 && (
              <select
                value={selectedYearId || ''}
                onChange={e => setSelectedYearId(e.target.value ? Number(e.target.value) : null)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-forest-500"
              >
                <option value="">All years</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
              </select>
            )}
            <button
              onClick={() => openAddSem(selectedYearId || (years[0]?.id ?? ''))}
              disabled={years.length === 0}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-forest-600 hover:bg-forest-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Icon name="plus" className="w-4 h-4" /> Add Semester
            </button>
          </div>
        </div>

        {semesters.length === 0 ? (
          <EmptyState icon="cog" title="No semesters" text={selectedYearId ? "Add a semester for this school year" : "Select a school year or add one first"} />
        ) : (
          <div className="divide-y divide-gray-100">
            {semesters.map(s => {
              const yearLabel = years.find(y => y.id === s.academicYearId)?.year || '';
              return (
                <div key={s.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-medium text-gray-800">{s.name}</span>
                      {!selectedYearId && <span className="text-sm text-gray-400 ml-2">{yearLabel}</span>}
                      <p className="text-xs text-gray-500 mt-0.5">
                        Period: {s.startDate ? String(s.startDate).slice(0, 10) : 'Not set'} to {s.endDate ? String(s.endDate).slice(0, 10) : 'Not set'}
                      </p>
                    </div>
                    {s.isActive && <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditSem(s)} disabled={deletingSemId === s.id} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:pointer-events-none" title="Edit">
                      <Icon name="edit" className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteSem(s)} disabled={deletingSemId === s.id} className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-1" title="Delete">
                      {deletingSemId === s.id ? (
                        <>
                          <Icon name="spinner" className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <Icon name="trash" className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* School Year Modal */}
      <Modal
        open={showYearModal}
        onClose={() => setShowYearModal(false)}
        title={editYearId ? 'Edit School Year' : 'Add School Year'}
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowYearModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg">Cancel</button>
            <button onClick={handleSaveYear} disabled={savingYear} className="px-4 py-2 text-sm font-medium text-white bg-forest-600 hover:bg-forest-700 disabled:opacity-50 rounded-lg">
              {savingYear ? 'Saving…' : (editYearId ? 'Save Changes' : 'Create')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Year <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="e.g. 2026-2027"
              value={yearForm.year}
              onChange={e => setYearForm(f => ({ ...f, year: e.target.value }))}
              aria-describedby={yearErrors.year ? 'year-error' : undefined}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 ${yearErrors.year ? 'border-red-400' : 'border-gray-200'}`}
            />
            {yearErrors.year && <p id="year-error" className="text-xs text-red-500 mt-1" role="alert">{yearErrors.year}</p>}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!yearForm.isActive}
              onChange={e => setYearForm(f => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-gray-300 text-forest-600 focus:ring-forest-500"
            />
            <span className="text-sm text-gray-700">Set as active school year</span>
          </label>
        </div>
      </Modal>

      {/* Semester Modal */}
      <Modal
        open={showSemModal}
        onClose={() => setShowSemModal(false)}
        title={editSemId ? 'Edit Semester' : 'Add Semester'}
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowSemModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg">Cancel</button>
            <button onClick={handleSaveSem} disabled={savingSem} className="px-4 py-2 text-sm font-medium text-white bg-forest-600 hover:bg-forest-700 disabled:opacity-50 rounded-lg">
              {savingSem ? 'Saving…' : (editSemId ? 'Save Changes' : 'Create')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester <span className="text-red-500">*</span></label>
            <select
              value={semForm.name}
              onChange={e => setSemForm(f => ({ ...f, name: e.target.value }))}
              aria-describedby={semErrors.name ? 'sem-name-error' : undefined}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 ${semErrors.name ? 'border-red-400' : 'border-gray-200'}`}
            >
              {SEMESTER_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {semErrors.name && <p id="sem-name-error" className="text-xs text-red-500 mt-1" role="alert">{semErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Year <span className="text-red-500">*</span></label>
            <select
              value={semForm.academicYearId}
              onChange={e => setSemForm(f => ({ ...f, academicYearId: Number(e.target.value) }))}
              aria-describedby={semErrors.academicYearId ? 'sem-year-error' : undefined}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 ${semErrors.academicYearId ? 'border-red-400' : 'border-gray-200'}`}
            >
              <option value="">Select school year…</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
            {semErrors.academicYearId && <p id="sem-year-error" className="text-xs text-red-500 mt-1" role="alert">{semErrors.academicYearId}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
              <input
                type="date"
                value={semForm.startDate}
                onChange={e => setSemForm(f => ({ ...f, startDate: e.target.value }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 ${semErrors.startDate ? 'border-red-400' : 'border-gray-200'}`}
              />
              {semErrors.startDate && <p className="text-xs text-red-500 mt-1" role="alert">{semErrors.startDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
              <input
                type="date"
                value={semForm.endDate}
                onChange={e => setSemForm(f => ({ ...f, endDate: e.target.value }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 ${semErrors.endDate ? 'border-red-400' : 'border-gray-200'}`}
              />
              {semErrors.endDate && <p className="text-xs text-red-500 mt-1" role="alert">{semErrors.endDate}</p>}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!semForm.isActive}
              onChange={e => setSemForm(f => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-gray-300 text-forest-600 focus:ring-forest-500"
            />
            <span className="text-sm text-gray-700">Set as active semester</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
