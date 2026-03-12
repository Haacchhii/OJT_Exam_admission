import { client, qs } from './client';
import type {
  Exam,
  ExamSchedule,
  ExamRegistration,
} from '../types';

interface ExamParams {
  search?: string;
  grade?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function getExams(params?: ExamParams) {
  return client.get<Exam[]>(`/exams${qs(params)}`);
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
  return client.get<ExamSchedule[]>(
    `/exams/schedules${qs({ examId, ...params })}`
  );
}

export async function getAvailableSchedules() {
  return client.get<ExamSchedule[]>('/exams/schedules/available');
}

export async function addExamSchedule(schedule: Record<string, unknown>) {
  return client.post<ExamSchedule>('/exams/schedules', schedule);
}

export async function updateExamSchedule(id: number, updates: Record<string, unknown>) {
  return client.put<ExamSchedule>(`/exams/schedules/${id}`, updates);
}

export async function deleteExamSchedule(id: number) {
  return client.delete<void>(`/exams/schedules/${id}`);
}

export async function getExamRegistrations(params?: ExamParams) {
  return client.get<ExamRegistration[]>(
    `/exams/registrations${qs(params)}`
  );
}

export async function getMyRegistrations() {
  return client.get<ExamRegistration[]>('/exams/registrations/mine');
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
