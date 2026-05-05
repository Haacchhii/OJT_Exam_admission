import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExam } from '../../../api/exams';
import { useAsync } from '../../../hooks/useAsync';
import { PageHeader, SkeletonPage } from '../../../components/UI';
import Icon from '../../../components/Icons';
import { QuestionCard } from './ExamComponents';
import type { Exam } from '../../../types';

export default function ExamPreview() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const id = Number(examId);

  const { data: exam, loading, error } = useAsync<Exam | null>(
    () => (id ? getExam(id) : Promise.resolve(null)),
    [id]
  );

  if (loading) return <SkeletonPage />;

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-3xl mx-auto">
          <PageHeader title="Exam Preview" subtitle="Preview how this exam will appear to students" />
          <div className="gk-section-card p-8 text-center">
            <Icon name="exclamation" className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-gray-600">Failed to load exam preview.</p>
            <button onClick={() => navigate(-1)} className="mt-4 text-forest-500 hover:underline">Go back</button>
          </div>
        </div>
      </div>
    );
  }

  const questions = exam.questions || [];
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-forest-500">{exam.title}</h2>
            <p className="text-xs text-gray-500 mt-1">Preview Mode — See how students will view this exam</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition"
            title="Close preview"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {/* Exam Details */}
        <div className="gk-section-card p-6 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">Grade Level</span>
              <p className="text-forest-700 font-medium">{exam.gradeLevel}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">Duration</span>
              <p className="text-forest-700 font-medium">{exam.durationMinutes} minutes</p>
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">Passing Score</span>
              <p className="text-forest-700 font-medium">{exam.passingScore}%</p>
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">Total Points</span>
              <p className="text-forest-700 font-medium">{totalPoints}</p>
            </div>
          </div>
        </div>

        {/* Questions */}
        {questions.length > 0 ? (
          <div className="space-y-4 mb-4">
            <div className="text-sm font-bold text-gray-600 px-1">
              {questions.length} Question{questions.length !== 1 ? 's' : ''}
            </div>
            {questions.map((q, i) => (
              <QuestionCard key={q.id} q={q} i={i} />
            ))}
          </div>
        ) : (
          <div className="gk-section-card p-8 text-center">
            <Icon name="documentText" className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No questions in this exam yet.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center pb-4">
          <button
            onClick={() => navigate(-1)}
            className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-50 font-medium transition"
          >
            Close Preview
          </button>
          <button
            onClick={() => navigate(`/employee/exams/edit/${exam.id}`)}
            className="bg-forest-500 text-white px-6 py-2.5 rounded-lg hover:bg-forest-600 font-medium transition"
          >
            Edit Exam
          </button>
        </div>
      </div>
    </div>
  );
}
