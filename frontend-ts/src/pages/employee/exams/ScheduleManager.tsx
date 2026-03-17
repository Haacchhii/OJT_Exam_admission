import { useState, useMemo, type ChangeEvent, type FormEvent } from 'react';
import { useAsync } from '../../../hooks/useAsync';
import { getExams, getExamSchedules, addExamSchedule, updateExamSchedule, deleteExamSchedule } from '../../../api/exams';
import { showToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { PageHeader, Badge, EmptyState, Pagination, usePaginationSlice, SkeletonPage } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { formatTime, asArray } from '../../../utils/helpers';
import { FormInput } from './ExamComponents';
import type { Exam, ExamSchedule } from '../../../types';

const SCHED_PER_PAGE = 8;

export default function ScheduleManager() {
  const confirm = useConfirm();
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ examId: '', date: '', start: '', end: '', slots: '' });
  const [schedSearch, setSchedSearch] = useState('');
  const [schedExamFilter, setSchedExamFilter] = useState('all');
  const [schedPage, setSchedPage] = useState(1);
  const [isSavingSched, setIsSavingSched] = useState(false);
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const { data: schedData, loading: schedLoading, error: schedError, refetch: schedRefetch } = useAsync(async () => {
    const [rawExm, rawSched] = await Promise.all([getExams(), getExamSchedules()]);
    return { exams: asArray<Exam>(rawExm), allSchedules: asArray<ExamSchedule>(rawSched) };
  });

  const exams: Exam[] = schedData?.exams || [];
  const allSchedules: ExamSchedule[] = schedData?.allSchedules || [];

  const filteredScheds = useMemo(() => {
    let list = allSchedules;
    if (schedExamFilter !== 'all') list = list.filter(s => String(s.examId) === schedExamFilter);
    if (schedSearch.trim()) {
      const q = schedSearch.toLowerCase();
      list = list.filter(s => {
        const exam = exams.find(e => e.id === s.examId);
        return (exam?.title || '').toLowerCase().includes(q) || s.scheduledDate.includes(q);
      });
    }
    return list;
  }, [allSchedules, schedExamFilter, schedSearch, exams]);

  const { paginated: paginatedScheds, totalPages: schedTotalPages, safePage: schedSafePage, totalItems: schedTotal } = usePaginationSlice(filteredScheds, schedPage, SCHED_PER_PAGE);
  const resetSchedPage = () => setSchedPage(1);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.examId) {
      const selectedExam = exams.find(ex => String(ex.id) === String(form.examId));
      const qCount = selectedExam?.questionCount ?? selectedExam?.questions?.length ?? 0;
      if (selectedExam && qCount === 0) {
        showToast('Cannot schedule an exam with zero questions. Add questions first.', 'error');
        return;
      }
    }
    if (form.start && form.end && form.start >= form.end) {
      showToast('End time must be after start time.', 'error');
      return;
    }
    if (form.date) {
      const today = new Date().toISOString().split('T')[0];
      if (form.date < today) {
        showToast('Schedule date cannot be in the past.', 'error');
        return;
      }
    }
    const data = { examId: parseInt(form.examId), scheduledDate: form.date, startTime: form.start, endTime: form.end, maxSlots: parseInt(form.slots) };
    setIsSavingSched(true);
    try {
      if (editId) { await updateExamSchedule(editId, data); showToast('Schedule updated!', 'success'); setEditId(null); }
      else { await addExamSchedule(data); showToast('Schedule added!', 'success'); }
    } catch (err: any) {
      showToast('Failed to save schedule: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSavingSched(false);
    }
    setForm({ examId: '', date: '', start: '', end: '', slots: '' });
    schedRefetch();
  };

  const editSched = (s: ExamSchedule) => { setEditId(s.id); setForm({ examId: String(s.examId), date: s.scheduledDate, start: s.startTime, end: s.endTime, slots: String(s.maxSlots) }); };

  if (schedLoading) return <SkeletonPage />;
  if (schedError) return <div className="gk-card p-8 text-center"><p className="text-red-600 font-medium">Failed to load schedules.</p><button onClick={schedRefetch} className="mt-2 text-forest-500 underline text-sm">Retry</button></div>;

  return (
    <div>
      <PageHeader title="Exam Schedules" subtitle="Create and manage exam date/time slots." />
      <div className="gk-card p-6 mb-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">{editId ? 'Edit Schedule' : 'Add New Schedule'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam</label>
            <select value={form.examId} onChange={set('examId') as any} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white">
              <option value="">Select exam</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
          <FormInput label="Date" type="date" value={form.date} onChange={set('date')} required />
          <FormInput label="Start Time" type="time" value={form.start} onChange={set('start')} required />
          <FormInput label="End Time" type="time" value={form.end} onChange={set('end')} required />
          <FormInput label="Max Applicants" type="number" value={form.slots} onChange={set('slots')} placeholder="30" required />
          <div className="flex items-end">
            <button type="submit" disabled={isSavingSched} className="bg-forest-500 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {isSavingSched ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : (editId ? 'Update Schedule' : 'Add Schedule')}
            </button>
          </div>
        </form>
      </div>

      <div className="gk-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Current Schedules</h3>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input value={schedSearch} onChange={e => { setSchedSearch(e.target.value); resetSchedPage(); }} placeholder="Search by exam or date…" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none text-sm" />
          <select value={schedExamFilter} onChange={e => { setSchedExamFilter(e.target.value); resetSchedPage(); }} className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none bg-white text-sm">
            <option value="all">All Exams</option>
            {exams.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}
          </select>
        </div>
        <div className="space-y-3">
          {paginatedScheds.map(s => {
            const exam = exams.find(e => e.id === s.examId);
            const d = new Date(s.scheduledDate + 'T00:00:00');
            const remaining = s.maxSlots - s.slotsTaken;
            return (
              <div key={s.id} className="flex items-center gap-4 bg-gray-50 rounded-lg p-4">
                <div className="text-center bg-forest-500 text-white rounded-lg px-3 py-2 min-w-[60px]">
                  <div className="text-xs uppercase">{d.toLocaleString('en-US', { month: 'short' })}</div>
                  <div className="text-xl font-bold">{d.getDate()}</div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-forest-500">{exam?.title || 'Unknown Exam'}</h4>
                  <p className="text-gray-500 text-sm">{formatTime(s.startTime)} - {formatTime(s.endTime)}</p>
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
          {paginatedScheds.length === 0 && <EmptyState icon="calendar" title="No schedules" text={schedSearch ? `No schedules match "${schedSearch}"${schedExamFilter !== 'all' ? ' for the selected exam' : ''}.` : schedExamFilter !== 'all' ? 'No schedules for the selected exam.' : 'No schedules match your current filters.'} />}
        </div>
        <Pagination currentPage={schedSafePage} totalPages={schedTotalPages} onPageChange={setSchedPage} totalItems={schedTotal} itemsPerPage={SCHED_PER_PAGE} />
      </div>
    </div>
  );
}
