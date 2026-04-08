import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { getExams, getExamSchedulesPage, addExamSchedule, updateExamSchedule, deleteExamSchedule } from '../../../api/exams';
import { showToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { PageHeader, Badge, EmptyState, Pagination, SkeletonPage } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { formatTime, formatDateRange, asArray } from '../../../utils/helpers';
import { FormInput } from './ExamComponents';
import type { Exam, ExamSchedule } from '../../../types';

const SCHED_PER_PAGE = 8;

function getTodayLocalIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysIso(dateIso: string, days: number) {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ScheduleManager() {
  const confirm = useConfirm();
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ examId: '', date: '', start: '', end: '', visibilityStartDate: '', visibilityEndDate: '', openDate: '', closeDate: '', slots: '' });
  const [selectedExamIds, setSelectedExamIds] = useState<number[]>([]);
  const [schedSearch, setSchedSearch] = useState('');
  const [schedExamFilter, setSchedExamFilter] = useState('all');
  const [schedPage, setSchedPage] = useState(1);
  const [isSavingSched, setIsSavingSched] = useState(false);
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const applyDefaults = (targetDate?: string) => {
    const date = targetDate || form.date;
    if (!date) {
      showToast('Please choose a schedule date first.', 'error');
      return;
    }
    const today = getTodayLocalIso();
    const regClose = addDaysIso(date, -1);
    const visEndCandidate = addDaysIso(today, 9);
    const visibilityEnd = visEndCandidate <= date ? visEndCandidate : date;

    setForm(f => ({
      ...f,
      date,
      start: f.start || '09:00',
      end: f.end || '10:00',
      openDate: f.openDate || today,
      closeDate: f.closeDate || regClose,
      visibilityStartDate: f.visibilityStartDate || today,
      visibilityEndDate: f.visibilityEndDate || visibilityEnd,
      slots: f.slots || '30',
    }));
    showToast('Schedule defaults applied.', 'success');
  };

  const setQuickDate = (daysAhead: number) => {
    const date = addDaysIso(getTodayLocalIso(), daysAhead);
    setForm(f => ({ ...f, date }));
    applyDefaults(date);
  };

  const { data: schedData, loading: schedLoading, error: schedError, refetch: schedRefetch } = useAsync(async () => {
    const [rawExm, schedulesPage] = await Promise.all([
      getExams(),
      getExamSchedulesPage({
        examId: schedExamFilter !== 'all' ? Number(schedExamFilter) : undefined,
        search: schedSearch.trim() || undefined,
        page: schedPage,
        limit: SCHED_PER_PAGE,
      }),
    ]);
    return {
      exams: asArray<Exam>(rawExm),
      schedulesPage,
    };
  }, [schedExamFilter, schedSearch, schedPage], 0, { setLoadingOnReload: true });

  const exams: Exam[] = schedData?.exams || [];
  const schedulesPage = schedData?.schedulesPage || { data: [] as ExamSchedule[], pagination: { page: 1, limit: SCHED_PER_PAGE, total: 0, totalPages: 1 } };

  const toggleBulkExam = (examId: number) => {
    setSelectedExamIds(prev => prev.includes(examId) ? prev.filter(id => id !== examId) : [...prev, examId]);
  };

  const paginatedScheds = schedulesPage.data;
  const schedTotalPages = schedulesPage.pagination.totalPages;
  const schedSafePage = schedulesPage.pagination.page;
  const schedTotal = schedulesPage.pagination.total;
  const resetSchedPage = () => setSchedPage(1);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const targetExamIds = editId
      ? [parseInt(form.examId)]
      : (selectedExamIds.length > 0 ? selectedExamIds : [parseInt(form.examId)]);

    if (targetExamIds.some(id => Number.isNaN(id))) {
      showToast('Please choose an exam before saving the schedule.', 'error');
      return;
    }

    const examsWithoutQuestions = targetExamIds
      .map(id => exams.find(ex => ex.id === id))
      .filter((ex): ex is Exam => !!ex)
      .filter(ex => (ex.questionCount ?? ex.questions?.length ?? 0) === 0)
      .map(ex => ex.title);

    if (examsWithoutQuestions.length > 0) {
      showToast(`Cannot schedule exam(s) with zero questions: ${examsWithoutQuestions.join(', ')}`, 'error');
      return;
    }
    if (form.start && form.end && form.start >= form.end) {
      showToast('End time must be after start time.', 'error');
      return;
    }
    if (form.openDate && form.closeDate && form.openDate > form.closeDate) {
      showToast('Registration close date must be on or after open date.', 'error');
      return;
    }
    if (form.visibilityStartDate && form.visibilityEndDate && form.visibilityStartDate > form.visibilityEndDate) {
      showToast('Visibility end date must be on or after visibility start date.', 'error');
      return;
    }
    if (form.date) {
      const today = getTodayLocalIso();
      if (form.date < today) {
        showToast('Schedule date cannot be in the past.', 'error');
        return;
      }
      if (form.closeDate && form.closeDate > form.date) {
        showToast('Registration close date cannot be after schedule date.', 'error');
        return;
      }
      if (form.visibilityEndDate && form.visibilityEndDate > form.date) {
        showToast('Visibility end date cannot be after schedule date.', 'error');
        return;
      }
    }
    const baseData = {
      scheduledDate: form.date,
      startTime: form.start,
      endTime: form.end,
      visibilityStartDate: form.visibilityStartDate || null,
      visibilityEndDate: form.visibilityEndDate || null,
      registrationOpenDate: form.openDate || null,
      registrationCloseDate: form.closeDate || null,
      maxSlots: parseInt(form.slots),
    };

    const saveLabel = editId
      ? 'Update Schedule'
      : selectedExamIds.length > 0
        ? `Create ${targetExamIds.length} Schedules`
        : 'Create Schedule';

    const saveMessage = editId
      ? 'Apply changes to this schedule?'
      : selectedExamIds.length > 0
        ? `Create schedules for ${targetExamIds.length} selected exams on ${form.date} (${formatTime(form.start)} - ${formatTime(form.end)})?`
        : 'Create this schedule?';

    const ok = await confirm({
      title: saveLabel,
      message: saveMessage,
      confirmLabel: saveLabel,
      variant: 'info',
    });
    if (!ok) return;

    setIsSavingSched(true);
    try {
      if (editId) {
        await updateExamSchedule(editId, baseData);
        showToast('Schedule updated!', 'success');
        setEditId(null);
      } else if (targetExamIds.length > 1) {
        await Promise.all(targetExamIds.map(examId => addExamSchedule({ ...baseData, examId })));
        showToast(`${targetExamIds.length} schedules added!`, 'success');
      } else {
        await addExamSchedule({ ...baseData, examId: targetExamIds[0] });
        showToast('Schedule added!', 'success');
      }
    } catch (err: any) {
      showToast('Failed to save schedule: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSavingSched(false);
    }
    setForm({ examId: '', date: '', start: '', end: '', visibilityStartDate: '', visibilityEndDate: '', openDate: '', closeDate: '', slots: '' });
    setSelectedExamIds([]);
    schedRefetch();
  };

  const editSched = (s: ExamSchedule) => {
    setEditId(s.id);
    setForm({
      examId: String(s.examId),
      date: s.scheduledDate,
      start: s.startTime,
      end: s.endTime,
      visibilityStartDate: s.visibilityStartDate || '',
      visibilityEndDate: s.visibilityEndDate || '',
      openDate: s.registrationOpenDate || '',
      closeDate: s.registrationCloseDate || '',
      slots: String(s.maxSlots),
    });
    setSelectedExamIds([]);
  };

  if (schedLoading && !schedData) return <SkeletonPage />;
  if (schedError) return <div className="gk-section-card p-8 text-center"><p className="text-red-600 font-medium">Failed to load schedules.</p><button onClick={schedRefetch} className="mt-2 text-forest-500 underline text-sm">Retry</button></div>;

  return (
    <div>
      <PageHeader title="Exam Schedules" subtitle="Create and manage exam date/time slots." />
      <div className="gk-section-card p-6 mb-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">{editId ? 'Edit Schedule' : 'Add New Schedule'}</h3>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500 font-medium">Quick setup:</span>
          <button type="button" onClick={() => setQuickDate(1)} className="px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Tomorrow</button>
          <button type="button" onClick={() => setQuickDate(3)} className="px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">+3 days</button>
          <button type="button" onClick={() => setQuickDate(7)} className="px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">+7 days</button>
          <button type="button" onClick={() => applyDefaults()} className="px-2.5 py-1.5 rounded-md border border-forest-300 text-forest-700 hover:bg-forest-50">Auto-fill from selected date</button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam</label>
            <select value={form.examId} onChange={set('examId') as any} required={selectedExamIds.length === 0} disabled={editId !== null || (!editId && selectedExamIds.length > 0)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white disabled:bg-gray-100 disabled:text-gray-400">
              <option value="">Select exam</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            {!editId && (
              <p className="mt-1 text-xs text-gray-500">Tip: Use multi-select chips below to schedule many exams with one submission.</p>
            )}
          </div>
          {!editId && (
            <div className="md:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Bulk Exam Multi-Select</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setSelectedExamIds(exams.map(e => e.id))} className="text-xs text-forest-600 hover:underline">Select all</button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={() => setSelectedExamIds([])} className="text-xs text-gray-500 hover:underline">Clear</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5 max-h-36 overflow-y-auto">
                {exams.map(exam => {
                  const active = selectedExamIds.includes(exam.id);
                  return (
                    <button
                      key={exam.id}
                      type="button"
                      onClick={() => toggleBulkExam(exam.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${active ? 'border-forest-500 bg-forest-500 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-forest-300 hover:text-forest-700'}`}
                    >
                      {exam.title}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-gray-500">{selectedExamIds.length > 0 ? `${selectedExamIds.length} exam(s) selected. Save will create one schedule per selected exam.` : 'No exams selected for bulk mode. Single exam selection above will be used.'}</p>
            </div>
          )}
          <FormInput label="Date" type="date" value={form.date} onChange={set('date')} required />
          <FormInput label="Start Time" type="time" value={form.start} onChange={set('start')} required />
          <FormInput label="End Time" type="time" value={form.end} onChange={set('end')} required />
          <FormInput label="Visibility Starts" type="date" value={form.visibilityStartDate} onChange={set('visibilityStartDate')} />
          <FormInput label="Visibility Ends" type="date" value={form.visibilityEndDate} onChange={set('visibilityEndDate')} />
          <FormInput label="Registration Opens" type="date" value={form.openDate} onChange={set('openDate')} />
          <FormInput label="Registration Closes" type="date" value={form.closeDate} onChange={set('closeDate')} />
          <FormInput label="Max Applicants" type="number" value={form.slots} onChange={set('slots')} placeholder="30" required />
          <div className="md:col-span-2 lg:col-span-3 text-xs text-gray-500">
            Tip: use quick setup and auto-fill to generate time, registration, and visibility windows instantly.
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={isSavingSched} className="bg-forest-500 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {isSavingSched ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : (editId ? 'Update Schedule' : 'Add Schedule')}
            </button>
          </div>
        </form>
      </div>

      <div className="gk-section-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Current Schedules</h3>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input value={schedSearch} onChange={e => { setSchedSearch(e.target.value); resetSchedPage(); }} placeholder="Search by exam or date..." className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
          <select value={schedExamFilter} onChange={e => { setSchedExamFilter(e.target.value); resetSchedPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
            <option value="all">All Exams</option>
            {exams.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}
          </select>
        </div>
        <div className="relative min-h-[140px]">
          <div className="space-y-3">
            {!schedLoading && paginatedScheds.map(s => {
              const exam = exams.find(e => e.id === s.examId);
              const d = new Date(s.scheduledDate + 'T00:00:00');
              const remaining = s.maxSlots - s.slotsTaken;
              const registrationWindow = formatDateRange(s.registrationOpenDate, s.registrationCloseDate, {
                openStartLabel: 'Anytime',
                openEndLabel: 'Until exam date',
              });
              const visibilityWindow = formatDateRange(s.visibilityStartDate, s.visibilityEndDate, {
                openStartLabel: 'Now',
                openEndLabel: 'No end date',
              });
              return (
                <div key={s.id} className="flex items-center gap-4 bg-gray-50 rounded-lg p-4">
                  <div className="text-center bg-forest-500 text-white rounded-lg px-3 py-2 min-w-[60px]">
                    <div className="text-xs uppercase">{d.toLocaleString('en-US', { month: 'short' })}</div>
                    <div className="text-xl font-bold">{d.getDate()}</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-forest-500">{exam?.title || 'Unknown Exam'}</h4>
                    <p className="text-gray-500 text-sm">{formatTime(s.startTime)} - {formatTime(s.endTime)}</p>
                    {registrationWindow && (
                      <p className="text-gray-500 text-xs">
                        Registration window: {registrationWindow}
                      </p>
                    )}
                    {visibilityWindow && (
                      <p className="text-gray-500 text-xs">
                        Visible to students: {visibilityWindow}
                      </p>
                    )}
                    <div className="flex gap-2 mt-1">
                      <Badge className="gk-badge gk-badge-info">{s.slotsTaken} / {s.maxSlots} booked</Badge>
                      <Badge className={remaining > 0 ? 'gk-badge gk-badge-active' : 'gk-badge gk-badge-danger'}>{remaining > 0 ? `${remaining} slots left` : 'Full'}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editSched(s)} className="text-forest-500 hover:underline text-xs inline-flex items-center gap-0.5"><Icon name="edit" className="w-3 h-3" /> Edit</button>
                    <button onClick={async () => { if (await confirm({ title: 'Delete Schedule', message: 'Are you sure you want to delete this schedule?', confirmLabel: 'Delete', variant: 'danger' })) { try { await deleteExamSchedule(s.id); schedRefetch(); } catch { showToast('Failed to delete schedule.', 'error'); } } }} className="text-red-500 hover:underline text-xs inline-flex items-center gap-0.5"><Icon name="trash" className="w-3 h-3" /> Delete</button>
                  </div>
                </div>
              );
            })}
            {!schedLoading && paginatedScheds.length === 0 && <EmptyState icon="calendar" title="No schedules" text={schedSearch ? `No schedules match "${schedSearch}"${schedExamFilter !== 'all' ? ' for the selected exam' : ''}.` : schedExamFilter !== 'all' ? 'No schedules for the selected exam.' : 'No schedules match your current filters.'} />}
          </div>
          {schedLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-forest-100 bg-white px-3 py-1.5 text-xs font-semibold text-forest-600 shadow-sm">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-forest-200 border-t-forest-500 animate-spin" />
                Loading schedules...
              </div>
            </div>
          )}
        </div>
        <Pagination currentPage={schedSafePage} totalPages={schedTotalPages} onPageChange={setSchedPage} totalItems={schedTotal} itemsPerPage={SCHED_PER_PAGE} />
      </div>
    </div>
  );
}
