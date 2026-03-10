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

export async function scoreEssay(answerId: number, points: number) {
  return client.patch<EssayAnswer>(`/results/essays/${answerId}/score`, { points });
}

export async function getSubmittedAnswers(registrationId: number) {
  return client.get<SubmittedAnswer[]>(`/results/answers/${registrationId}`);
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
