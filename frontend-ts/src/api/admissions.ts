import { client, qs } from './client';
import type { Admission, AdmissionStats, AdmissionStatus } from '../types';

export const VALID_TRANSITIONS: Record<string, AdmissionStatus[]> = {
  'Submitted': ['Under Screening', 'Rejected'],
  'Under Screening': ['Under Evaluation', 'Rejected'],
  'Under Evaluation': ['Accepted', 'Rejected'],
  'Accepted': [],
  'Rejected': ['Submitted'],
};

interface AdmissionParams {
  status?: string;
  grade?: string;
  levelGroup?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
  academicYearId?: number;
  semesterId?: number;
}

export interface EmployeeDashboardSummary {
  stats: AdmissionStats;
  admissions: Admission[];
  exams: Array<{
    id: number;
    title: string;
    gradeLevel: string;
    questionCount: number;
    scheduleCount: number;
    isActive: boolean;
    registrations: number;
  }>;
  pendingEssays: number;
  completed: number;
  trends: { total: number; accepted: number; inProgress: number; rejected: number };
  overdue: number;
}

export async function getAdmissions(params?: AdmissionParams) {
  return client.get<Admission[]>(`/admissions${qs(params)}`);
}

export async function getMyAdmission() {
  return client.get<Admission | null>('/admissions/mine');
}

export async function addAdmission(admission: Record<string, unknown>) {
  return client.post<Admission>('/admissions', admission);
}

export async function uploadAdmissionDocuments(admissionId: number, files: File[]) {
  const formData = new FormData();
  files.forEach(f => formData.append('documents', f));
  return client.upload<{ urls: string[] }>(`/admissions/${admissionId}/documents`, formData);
}

export async function updateAdmissionStatus(id: number, status: string, notes?: string) {
  return client.patch<Admission>(`/admissions/${id}/status`, { status, notes });
}

export async function bulkUpdateStatus(ids: number[], status: string) {
  return client.patch<{ updated: number }>('/admissions/bulk-status', { ids, status });
}

export async function bulkDeleteAdmissions(ids: number[]) {
  return client.post<{ deleted: number }>('/admissions/bulk-delete', { ids });
}

export async function getStats(params?: Record<string, unknown>) {
  return client.get<AdmissionStats>(`/admissions/stats${qs(params)}`);
}

export async function getDashboardSummary() {
  return client.get<EmployeeDashboardSummary>('/admissions/dashboard-summary');
}

export async function trackApplication(trackingId: string) {
  return client.get<{ type: string; trackingId: string; data: Record<string, any> }>(`/admissions/track/${encodeURIComponent(trackingId)}`);
}

export function getDocumentDownloadUrl(admissionId: number, docId: number): string {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  return `${base}/admissions/${admissionId}/documents/${docId}/download`;
}

export function getDocumentPreviewUrl(admissionId: number, docId: number): string {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  return `${base}/admissions/${admissionId}/documents/${docId}/preview`;
}

export interface ExtractedResult {
  text: string;
  data: { type: string; fields: Record<string, string> };
  extractedAt: string;
  cached: boolean;
}

export async function extractDocumentData(admissionId: number, docId: number): Promise<ExtractedResult> {
  return client.post<ExtractedResult>(`/admissions/${admissionId}/documents/${docId}/extract`, {});
}

export async function reviewDocument(admissionId: number, docId: number, reviewStatus: 'accepted' | 'rejected', reviewNote?: string) {
  return client.patch<{ id: number; reviewStatus: string; reviewNote: string | null; reviewedAt: string }>(`/admissions/${admissionId}/documents/${docId}/review`, { reviewStatus, reviewNote });
}
