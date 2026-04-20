import { client, qs } from './client';
import type {
  Exam,
  ExamSchedule,
  ExamRegistration,
} from '../types';

interface ExamParams {
  search?: string;
  grade?: string;
  levelGroup?: string;
  status?: string;
  page?: number;
  limit?: number;
}

interface ExamReadinessParams {
  search?: string;
  status?: 'all' | 'pending' | 'done' | 'passed' | 'failed';
  page?: number;
  limit?: number;
}

const DEFAULT_LIST_PAGE = 1;
const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 40;

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  const safe = Math.trunc(Number(limit));
  if (safe < 1) return 1;
  return Math.min(MAX_LIST_LIMIT, safe);
}

function withDefaultListParams<T extends { page?: number; limit?: number }>(params?: T): T {
  return {
    ...(params || {}),
    page: params?.page ?? DEFAULT_LIST_PAGE,
    limit: normalizeLimit(params?.limit),
  } as T;
}

export interface PagedApiResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ExamSchedulePayload {
  examId: number;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  visibilityStartDate?: string | null;
  visibilityEndDate?: string | null;
  registrationOpenDate?: string | null;
  registrationCloseDate?: string | null;
  examWindowStartAt?: string | null;
  examWindowEndAt?: string | null;
  maxSlots: number;
  venue?: string | null;
}

export type UpdateExamSchedulePayload = Partial<Omit<ExamSchedulePayload, 'examId'>>;

export async function getExams(params?: ExamParams) {
  return client.get<Exam[]>(`/exams${qs(withDefaultListParams(params))}`);
}

export async function getExam(id: number) {
  return client.get<Exam>(`/exams/${id}`);
}

export async function getExamForStudent(id: number) {
  return client.get<Exam>(`/exams/${id}/student`);
}

export async function getExamForReview(id: number) {
  return client.get<Exam>(`/exams/${id}/review`);
}

export async function addExam(exam: Record<string, unknown>) {
  return client.post<Exam>('/exams', exam);
}

export async function updateExam(id: number, updates: Record<string, unknown>) {
  return client.put<Exam>(`/exams/${id}`, updates);
}

export async function deleteExam(id: number) {
  return client.delete<void>(`/exams/${id}`);
}

export async function bulkDeleteExams(ids: number[]) {
  return client.post<{ deleted: number }>('/exams/bulk-delete', { ids });
}

export async function cloneExam(id: number) {
  return client.post<Exam>(`/exams/${id}/clone`, {});
}

export async function getExamSchedules(examId?: number, params?: ExamParams) {
  const mergedParams = withDefaultListParams({ examId, ...(params || {}) });
  return client.get<ExamSchedule[]>(
    `/exams/schedules${qs(mergedParams)}`
  );
}

export async function getExamSchedulesPage(params?: ExamParams & { examId?: number }) {
  return client.get<PagedApiResponse<ExamSchedule>>(`/exams/schedules${qs(withDefaultListParams(params))}`);
}

export async function getAvailableSchedules() {
  return client.get<ExamSchedule[]>('/exams/schedules/available', { noCache: true });
}

export async function notifyNoExamSchedule(message?: string) {
  return client.post<{ ok: boolean; message: string }>('/exams/schedules/notice', {
    message: message || '',
  });
}

export async function addExamSchedule(schedule: ExamSchedulePayload) {
  return client.post<ExamSchedule>('/exams/schedules', schedule);
}

export async function updateExamSchedule(id: number, updates: UpdateExamSchedulePayload) {
  return client.put<ExamSchedule>(`/exams/schedules/${id}`, updates);
}

export async function deleteExamSchedule(id: number) {
  return client.delete<void>(`/exams/schedules/${id}`);
}

export async function getExamRegistrations(params?: ExamParams) {
  const mergedParams = withDefaultListParams(params);
  return client.get<ExamRegistration[]>(
    `/exams/registrations${qs(mergedParams)}`
  );
}

export async function getExamReadinessPage(params?: ExamReadinessParams) {
  const mergedParams = withDefaultListParams(params);
  return client.get<PagedApiResponse<ExamRegistration & {
    user?: { id: number; firstName: string; middleName?: string | null; lastName: string; email: string } | null;
    schedule?: { exam?: { title?: string } };
    result?: { totalScore: number; maxPossible: number; percentage: number; passed: boolean; essayReviewed: boolean } | null;
  }>>(`/exams/readiness${qs(mergedParams)}`);
}

export async function getMyRegistrations() {
  return client.get<ExamRegistration[]>('/exams/registrations/mine', { noCache: true });
}

export interface MyRegistrationSummary {
  latest: ExamRegistration | null;
  hasCompletedExam: boolean;
  totalRegistrations: number;
}

export async function getMyRegistrationSummary(params?: { academicYearId?: number }) {
  return client.get<MyRegistrationSummary>(`/exams/registrations/mine-summary${qs(params)}`, { noCache: true });
}

export async function registerForExam(userEmail: string, scheduleId: number) {
  return client.post<ExamRegistration>('/exams/registrations', {
    userEmail,
    scheduleId,
  });
}

export async function startExam(registrationId: number) {
  return client.patch<ExamRegistration>(
    `/exams/registrations/${registrationId}/start`
  );
}

export async function saveDraftAnswers(registrationId: number, answers: Record<string | number, unknown>) {
  return client.patch<{ ok: boolean }>(
    `/exams/registrations/${registrationId}/save-draft`,
    { answers }
  );
}

export async function cancelExamRegistration(registrationId: number) {
  return client.delete<void>(`/exams/registrations/${registrationId}`);
}
