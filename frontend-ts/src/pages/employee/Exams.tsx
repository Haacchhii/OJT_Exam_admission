import { useState } from 'react';
import Icon from '../../components/Icons';
import ExamsList from './exams/ExamsList';
import ExamBuilder from './exams/ExamBuilder';
import ScheduleManager from './exams/ScheduleManager';
import { useAuth } from '../../context/AuthContext';
import type { Exam } from '../../types';

export default function EmployeeExams() {
  const { user } = useAuth();
  const isRegistrar = user?.role === 'registrar';
  const [tab, setTab] = useState('exams');
  const [editExamData, setEditExamData] = useState<Exam | null>(null);

  const tabs: [string, string][] = isRegistrar
    ? [['exams', 'Exams']]
    : [['exams','Exams'],['builder','Create Exam'],['schedules','Schedules']];

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap" role="tablist">
        {tabs.map(([k,l]) => {
          const tabIcon = k === 'exams' ? 'documentText' : k === 'builder' ? 'plus' : 'calendar';
          return (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { if (k !== 'builder') setEditExamData(null); setTab(k); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5 ${tab === k ? 'bg-forest-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Icon name={tabIcon} className="w-4 h-4" />{l}</button>
        )})}
      </div>
      {tab === 'exams' && <ExamsList onEdit={isRegistrar ? undefined : (exam: Exam) => { setEditExamData(exam); setTab('builder'); }} />}
      {tab === 'builder' && !isRegistrar && <ExamBuilder editExam={editExamData} onDone={() => { setEditExamData(null); setTab('exams'); }} />}
      {tab === 'schedules' && !isRegistrar && <ScheduleManager />}
    </div>
  );
}
