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
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
  academicYearId?: number;
  semesterId?: number;
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

export async function getStats(params?: Record<string, unknown>) {
  return client.get<AdmissionStats>(`/admissions/stats${qs(params)}`);
}

export async function trackApplication(trackingId: string) {
  return client.get<{ type: string; trackingId: string; data: Record<string, any> }>(`/admissions/track/${encodeURIComponent(trackingId)}`);
}
