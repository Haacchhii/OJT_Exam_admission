import { client, qs } from './client';
import type {
  ExamResult,
  EssayAnswer,
  SubmittedAnswer,
} from '../types';

interface ResultParams {
  search?: string;
  passed?: boolean;
  examId?: number;
  page?: number;
  limit?: number;
}

interface EssayParams {
  status?: 'pending' | 'scored' | 'all';
  page?: number;
  limit?: number;
}

export async function getExamResults(params?: ResultParams) {
  return client.get<ExamResult[]>(`/results${qs(params)}`);
}

export async function getMyResult() {
  return client.get<ExamResult | null>('/results/mine');
}

export async function getEssayAnswers(params?: EssayParams) {
  return client.get<EssayAnswer[]>(`/results/essays${qs(params)}`);
}

export async function scoreEssay(answerId: number, points: number, comment?: string) {
  return client.patch<EssayAnswer>(`/results/essays/${answerId}/score`, { points, comment });
}

export async function getSubmittedAnswers(registrationId: number) {
  return client.get<SubmittedAnswer[]>(`/results/answers/${registrationId}`);
}

export async function getQuestionAnalytics(examId: number) {
  return getQuestionAnalyticsPage(examId);
}

export async function getQuestionAnalyticsPage(examId: number, params?: { page?: number; limit?: number }) {
  return client.get<{
    examId: number;
    examTitle: string;
    totalTakers: number;
    analytics: Array<{
      questionId: number;
      questionText: string;
      questionType: 'mc' | 'essay';
      points: number;
      totalAnswered: number;
      correctCount?: number;
      correctRate?: number;
      choiceDistribution?: Array<{ choiceId: number; choiceText: string; isCorrect: boolean; count: number }>;
      scoredCount?: number;
      avgScore?: number | null;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>(`/results/analytics/${examId}${qs(params)}`);
}

export async function submitExamAnswers(
  registrationId: number,
  answersObj: Record<string | number, unknown>
) {
  return client.post<ExamResult>('/results/submit', {
    registrationId,
    answers: answersObj,
  });
}
