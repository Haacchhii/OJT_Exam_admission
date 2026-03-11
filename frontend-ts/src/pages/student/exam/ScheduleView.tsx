import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../../hooks/useAsync';
import { getExams, getExamSchedules, registerForExam, getAvailableSchedules } from '../../../api/exams';
import { showToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { PageHeader } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { formatTime, asArray } from '../../../utils/helpers';
import type { Exam, ExamSchedule, ExamRegistration, ExamResult, User } from '../../../types';

interface ScheduleData {
  schedules: ExamSchedule[];
  exams: Exam[];
  availableSchedules: ExamSchedule[];
}

interface ScheduleViewProps {
  myReg: ExamRegistration | null;
  myResult: ExamResult | null;
  onLobby: (exam: Exam) => void;
  onRefresh: () => void;
  user: User | null;
}

export default function ScheduleView({ myReg, myResult, onLobby, onRefresh, user }: ScheduleViewProps) {
  const confirm = useConfirm();
  const [bookingSlotId, setBookingSlotId] = useState<number | null>(null);

  const { data: schedData } = useAsync<ScheduleData>(async () => {
    const [rawSched, rawExm, rawAvail] = await Promise.all([getExamSchedules(), getExams(), getAvailableSchedules()]);
    return { schedules: asArray<ExamSchedule>(rawSched), exams: asArray<Exam>(rawExm), availableSchedules: asArray<ExamSchedule>(rawAvail) };
  });

  const schedules = schedData?.schedules || [];
  const exams = schedData?.exams || [];

  if (myReg?.status === 'done') {
    return (
      <div>
        <PageHeader title="Entrance Examination" subtitle="Select an available exam slot and confirm your booking." />
        <div className="gk-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-3"><Icon name="checkCircle" className="w-7 h-7 text-forest-500" /></div>
          <h3 className="font-bold text-forest-500 mb-1">Exam Completed</h3>
          <p className="text-gray-500 text-sm mb-4">You have already taken the exam. View your results below.</p>
          <Link to="/student/results" className="inline-block bg-forest-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-forest-600">View Results</Link>
        </div>
      </div>
    );
  }

  if (myReg) {
    return <ScheduledView myReg={myReg} schedules={schedules} exams={exams} onLobby={onLobby} />;
  }

  const available = schedData?.availableSchedules || [];

  const bookSlot = async (scheduleId: number) => {
    const schedule = schedules.find((s: ExamSchedule) => s.id === scheduleId);
    const exam = schedule ? exams.find((e: Exam) => e.id === schedule.examId) : null;
    const ok = await confirm({
      title: 'Confirm Booking',
      message: `Book "${exam?.title || 'Exam'}" on ${schedule?.scheduledDate} at ${formatTime(schedule?.startTime)}?`,
      confirmLabel: 'Book Slot',
      variant: 'info',
    });
    if (!ok) return;
    setBookingSlotId(scheduleId);
    try {
      const reg = await registerForExam(user?.email || '', scheduleId);
      if (reg) {
        const trackMsg = reg.trackingId ? ` Your tracking ID: ${reg.trackingId}` : '';
        showToast(`Exam slot booked successfully!${trackMsg}`, 'success');
        onRefresh();
      }
      else showToast('Slot is full or you are already registered. Please choose another.', 'error');
    } catch {
      showToast('Failed to book slot. Please try again.', 'error');
    } finally {
      setBookingSlotId(null);
    }
  };

  return (
    <div>
      <PageHeader title="Entrance Examination" subtitle="Select an available exam slot and confirm your booking." />
      <div className="gk-card p-4 mb-6">
        <div className="flex items-center gap-3 text-forest-600">
          <Icon name="clipboard" className="w-6 h-6 text-forest-500" />
          <div><strong className="text-forest-500">Welcome to the Entrance Exam</strong><p className="text-gray-500 text-sm">Select an available exam slot below to book your entrance examination.</p></div>
        </div>
      </div>
      <div className="gk-card p-6">
        <h3 className="text-lg font-bold text-forest-500 mb-4">Available Exam Slots</h3>
        {available.length > 0 ? (
          <div className="space-y-3">
            {available.map((s: ExamSchedule) => {
              const exam = exams.find((e: Exam) => e.id === s.examId);
              const remaining = s.maxSlots - s.slotsTaken;
              const d = new Date(s.scheduledDate + 'T00:00:00');
              return (
                <div key={s.id} className="flex items-center gap-4 bg-gray-50 rounded-lg p-4">
                  <div className="text-center bg-forest-500 text-white rounded-lg px-3 py-2 min-w-[60px]">
                    <div className="text-xs uppercase">{d.toLocaleString('en-US', { month: 'short' })}</div>
                    <div className="text-xl font-bold">{d.getDate()}</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-forest-500">{exam?.title || 'Exam'}</h4>
                    <p className="text-gray-500 text-sm">{formatTime(s.startTime)} - {formatTime(s.endTime)} · {remaining} slots left</p>
                  </div>
                  <button
                    onClick={() => bookSlot(s.id)}
                    disabled={bookingSlotId === s.id}
                    className="bg-forest-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-forest-600 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {bookingSlotId === s.id ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Booking…</> : 'Book This Slot'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-6">No available exam slots at this time.</p>
        )}
      </div>
    </div>
  );
}

/* ===== Scheduled View ===== */
interface ScheduledViewProps {
  myReg: ExamRegistration;
  schedules: ExamSchedule[];
  exams: Exam[];
  onLobby: (exam: Exam) => void;
}

function ScheduledView({ myReg, schedules, exams, onLobby }: ScheduledViewProps) {
  const schedule = schedules.find((s: ExamSchedule) => s.id === myReg.scheduleId);
  const exam = schedule ? exams.find((e: Exam) => e.id === schedule.examId) : null;
  const [now, setNow] = useState(() => new Date());
  const schedStart = schedule ? new Date(`${schedule.scheduledDate}T${schedule.startTime}:00`) : null;
  const canStart = schedStart ? now >= schedStart : false;

  useEffect(() => {
    if (canStart) return;
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, [canStart]);

  return (
    <div>
      <PageHeader title="Entrance Examination" subtitle="Select an available exam slot and confirm your booking." />
      <div className="gk-card p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-forest-50 flex items-center justify-center mx-auto mb-3"><Icon name="calendar" className="w-7 h-7 text-forest-500" /></div>
        <h3 className="font-bold text-forest-500 mb-2">Exam Scheduled</h3>
        {myReg.trackingId && (
          <div className="mb-4 bg-forest-50 border border-forest-200 rounded-lg px-4 py-2 inline-block">
            <span className="text-xs text-gray-500">Tracking ID: </span>
            <span className="font-mono font-bold text-forest-700">{myReg.trackingId}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left mb-6">
          <span className="text-xs text-gray-400">Exam</span><span className="text-sm font-medium">{exam?.title || 'N/A'}</span>
          <span className="text-xs text-gray-400">Date</span><span className="text-sm font-medium">{schedule?.scheduledDate || 'N/A'}</span>
          <span className="text-xs text-gray-400">Time</span><span className="text-sm font-medium">{schedule ? `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}` : 'N/A'}</span>
          <span className="text-xs text-gray-400">Duration</span><span className="text-sm font-medium">{exam ? `${exam.durationMinutes} minutes` : 'N/A'}</span>
        </div>
        {canStart && exam ? (
          <button onClick={() => onLobby(exam)} className="bg-gradient-to-r from-forest-500 to-forest-400 text-white px-8 py-3 rounded-lg font-semibold hover:from-gold-500 hover:to-gold-600 shadow-md">Take Exam Now</button>
        ) : (
          <p className="text-gray-400 text-sm flex items-center justify-center gap-1.5"><Icon name="clock" className="w-4 h-4" /> Exam will open on <strong>{schedule?.scheduledDate}</strong> at <strong>{formatTime(schedule?.startTime)}</strong></p>
        )}
      </div>
    </div>
  );
}
