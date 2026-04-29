import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { getActivePeriod } from '../../api/academicYears';
import Icon from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { showToast } from '../../components/Toast';
import { lazyWithRetry, LazyLoadingFallback } from '../../components/lazyWithRetry';
import type { Exam } from '../../types';

const ExamsList = lazyWithRetry(() => import('./exams/ExamsList'));
const ExamBuilder = lazyWithRetry(() => import('./exams/ExamBuilder'));
const ScheduleManager = lazyWithRetry(() => import('./exams/ScheduleManager'));

export default function EmployeeExams() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const isRegistrar = user?.role === 'registrar';
  const { data: activePeriod } = useAsync(() => getActivePeriod(), [], 0, {
    resourcePrefixes: ['/academic-years'],
  });
  const [tab, setTab] = useState('exams');
  const [editExamData, setEditExamData] = useState<Exam | null>(null);

  const activeYearLabel = activePeriod?.year || 'No active school year';
  const activeSemesterLabel = useMemo(() => {
    const activeSemester = activePeriod?.semesters?.find((semester) => semester.isActive) || null;
    return activeSemester?.name || 'No active semester';
  }, [activePeriod]);

  useEffect(() => {
    if (!socket || !isConnected) return;
    const onScheduleNotice = (payload: { studentName?: string; gradeLevel?: string }) => {
      const who = payload?.studentName || 'A student';
      const grade = payload?.gradeLevel || 'their grade level';
      showToast(`${who} requested exam schedules for ${grade}.`, 'info');
    };
    socket.on('exam_schedule_notice', onScheduleNotice);
    return () => {
      socket.off('exam_schedule_notice', onScheduleNotice);
    };
  }, [socket, isConnected]);

  const tabs: [string, string][] = isRegistrar
    ? [['exams', 'Exams']]
    : [['exams','Exams'],['builder','Create Exam'],['schedules','Schedules']];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1 rounded-full border border-forest-200 bg-forest-50 px-3 py-1 font-semibold text-forest-700">
          <Icon name="calendar" className="w-3.5 h-3.5" />
          Active year: {activeYearLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-gold-200 bg-gold-50 px-3 py-1 font-semibold text-gold-700">
          <Icon name="calendar" className="w-3.5 h-3.5" />
          Active semester: {activeSemesterLabel}
        </span>
      </div>
      <div className="mb-2 text-xs text-gray-500">Choose a tab to switch between exam records, authoring, and scheduling tools.{isRegistrar ? ' Registrar access is view-only for exam records.' : ''}</div>
      <div className="inline-flex flex-wrap gap-2 mb-6 p-1.5 rounded-2xl border border-gray-200 bg-white/80 shadow-sm" role="tablist" aria-label="Exams workspace tabs">
        {tabs.map(([k,l]) => {
          const tabIcon = k === 'exams' ? 'documentText' : k === 'builder' ? 'plus' : 'calendar';
          const active = tab === k;
          return (
          <button
            key={k}
            role="tab"
            aria-selected={active}
            onClick={() => { if (k !== 'builder') setEditExamData(null); setTab(k); }}
            className={`relative px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 inline-flex items-center gap-2 border ${active ? 'bg-gradient-to-r from-forest-600 to-forest-500 text-white border-forest-600 shadow-[0_8px_20px_rgba(21,128,61,0.28)]' : 'bg-white text-gray-600 border-gray-200 hover:border-forest-200 hover:text-forest-700 hover:bg-forest-50'}`}
          >
            <Icon name={tabIcon} className="w-4 h-4" />
            {l}
            {active && <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gold-300" />}
          </button>
        )})}
      </div>
      <Suspense fallback={<LazyLoadingFallback />}>
        {tab === 'exams' && <ExamsList onEdit={isRegistrar ? undefined : (exam: Exam) => { setEditExamData(exam); setTab('builder'); }} />}
        {tab === 'builder' && !isRegistrar && <ExamBuilder editExam={editExamData} onDone={() => { setEditExamData(null); setTab('exams'); }} />}
        {tab === 'schedules' && !isRegistrar && <ScheduleManager />}
      </Suspense>
    </div>
  );
}
