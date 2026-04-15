import { Badge } from '../../../components/UI';
import type { ParsedQuestion } from './types';
import type { ExamQuestion } from '../../../types';

export function DetailField({ label, v }: { label: string; v: string | number }) {
  return <div><span className="block text-xs text-gray-400 uppercase tracking-wide">{label}</span><span className="text-sm text-forest-500 font-medium">{String(v)}</span></div>;
}

export function FormInput({ label, required, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label><input {...props} required={required} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500/20 outline-none" /></div>;
}

export function QuestionCard({ q, i }: { q: ParsedQuestion | ExamQuestion; i: number }) {
  const choices = q.choices || [];
  const typeLabel = q.questionType === 'mc'
    ? 'Multiple Choice'
    : q.questionType === 'essay'
      ? 'Essay'
      : q.questionType === 'identification'
        ? 'Identification'
        : 'True / False';
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="bg-forest-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">Q{i + 1}</span>
        <Badge className={q.questionType === 'mc' ? 'gk-badge gk-badge-mc' : q.questionType === 'essay' ? 'gk-badge gk-badge-essay' : 'gk-badge gk-badge-info'}>{typeLabel}</Badge>
        <span className="text-xs text-gray-400 ml-auto">{q.points} pts</span>
      </div>
      <p className="text-forest-500 font-medium text-sm mb-2">{q.questionText}</p>
      {q.questionType === 'mc' || q.questionType === 'true_false' ? (
        <div className="space-y-1">
          {choices.map((c: any) => (
            <div key={c.id} className={`text-sm px-2 py-1 rounded ${c.isCorrect ? 'bg-forest-50 text-forest-700 font-medium' : 'text-gray-500'}`}>
              {c.isCorrect ? '✓' : '○'} {c.choiceText}
            </div>
          ))}
        </div>
      ) : q.questionType === 'identification' ? (
        <div className="space-y-1.5">
          <p className="text-sm text-gray-600">Answer Key: <span className="font-semibold text-forest-700">{q.identificationAnswer || '-'}</span></p>
          <p className="text-xs text-gray-400">Match mode: {q.identificationMatchMode || 'exact'}</p>
        </div>
      ) : (
        <p className="text-gray-400 text-sm italic">📝 Essay response required</p>
      )}
    </div>
  );
}
