import Modal from '../../../components/Modal';
import { Badge } from '../../../components/UI';
import type { Exam, ExamQuestion, QuestionChoice } from '../../../types';

export default function ExamPreviewModal({ exam, onClose }: { exam: Exam | null; onClose: () => void }) {
  return (
    <Modal open={!!exam} onClose={onClose}>
      {exam && (
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-forest-500">{exam.title}</h3>
              <p className="text-sm text-gray-500">Grade {exam.gradeLevel} • {exam.durationMinutes} minutes • {exam.questions.length} questions</p>
            </div>
            <Badge className="gk-badge gk-badge-preview">Preview Mode</Badge>
          </div>
          <div className="space-y-4">
            {exam.questions
              .slice()
              .sort((a: ExamQuestion, b: ExamQuestion) => a.orderNum - b.orderNum)
              .map((q: ExamQuestion, i: number) => (
              <div key={q.id} className={`rounded-lg p-4 border ${q.questionType === 'essay' ? 'border-gold-200 bg-gold-50/30' : 'border-gray-200 bg-gray-50/30'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-gray-400">Question {i + 1}</span>
                  <span className="text-xs text-gray-400">{q.points} pts • {q.questionType === 'mc' ? 'Multiple Choice' : 'Essay'}</span>
                </div>
                <p className="text-sm font-medium text-gray-800 mb-3">{q.questionText}</p>
                {q.questionType === 'mc' && q.choices && (
                  <div className="space-y-2">
                    {q.choices
                      .slice()
                      .sort((a: QuestionChoice, b: QuestionChoice) => a.orderNum - b.orderNum)
                      .map((c: QuestionChoice, ci: number) => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm">
                        <span className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        <span>{String.fromCharCode(65 + ci)}. {c.choiceText}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.questionType === 'essay' && (
                  <div className="border border-dashed border-gray-300 rounded-lg p-3 text-sm text-gray-400 italic bg-white">
                    Student will type their answer here…
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
