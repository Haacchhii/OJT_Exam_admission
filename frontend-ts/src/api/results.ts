import { client, qs } from './client';
import type {
  AcademicYear,
  ExamResult,
  EssayAnswer,
  Semester,
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

interface EmployeeResultsSummaryParams {
  limit?: number;
  includeResults?: boolean;
  includeEssays?: boolean;
}

const DEFAULT_RESULTS_PAGE = 1;
const DEFAULT_RESULTS_LIMIT = 100;

function withDefaultResultListParams<T extends { page?: number; limit?: number }>(params?: T): T {
  return {
    ...(params || {}),
    page: params?.page ?? DEFAULT_RESULTS_PAGE,
    limit: params?.limit ?? DEFAULT_RESULTS_LIMIT,
  } as T;
}

export interface EmployeeResultsSummary {
  results: ExamResult[];
  regs: Array<{ id: number; scheduleId: number; userEmail: string; userId?: number | null; status: string }>;
  users: Array<{
    id: number;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email: string;
    applicantProfile?: { gradeLevel?: string | null } | null;
  }>;
  schedules: Array<{ id: number; examId: number; scheduledDate: string; startTime: string; endTime: string }>;
  exams: Array<{
    id: number;
    title: string;
    gradeLevel: string;
    passingScore: number;
    academicYear?: { id: number } | null;
    semester?: { id: number } | null;
    questions?: Array<{ id: number; questionText: string }>;
  }>;
  essays: EssayAnswer[];
  academicYears: AcademicYear[];
  semesters: Semester[];
  meta?: {
    totalResults: number;
    returnedResults: number;
    totalEssays: number;
    returnedEssays: number;
    totalPendingEssays: number;
    totalScoredEssays: number;
    summaryLimit: number;
    includeResults: boolean;
    includeEssays: boolean;
    capped: boolean;
  };
}

export async function getExamResults(params?: ResultParams) {
  return client.get<ExamResult[]>(`/results${qs(withDefaultResultListParams(params))}`);
}

export async function getEmployeeResultsSummary(params?: EmployeeResultsSummaryParams) {
  return client.get<EmployeeResultsSummary>(`/results/employee-summary${qs(params)}`);
}

export async function getMyResult() {
  return client.get<ExamResult | null>('/results/mine', { noCache: true });
}

export async function getEssayAnswers(params?: EssayParams) {
  return client.get<EssayAnswer[]>(`/results/essays${qs(withDefaultResultListParams(params))}`);
}

export async function scoreEssay(answerId: number, points: number, comment?: string) {
  return client.patch<EssayAnswer>(`/results/essays/${answerId}/score`, { points, comment });
}

export async function getSubmittedAnswers(registrationId: number) {
  return client.get<SubmittedAnswer[]>(`/results/answers/${registrationId}`, { noCache: true });
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
