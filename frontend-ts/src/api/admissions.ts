import { client, qs } from './client';
import type { Admission, AdmissionStats, AdmissionStatus, AcademicYear, Semester } from '../types';

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
  staleOnly?: boolean;
  slaDays?: number;
  academicYearId?: number;
  semesterId?: number;
}

interface ReportsSummaryParams {
  status?: string;
  levelGroup?: string;
  grade?: string;
  academicYearId?: number;
  semesterId?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
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

export interface EmployeeReportsSummary {
  admissions: Admission[];
  results: Array<{
    id: number;
    registrationId: number;
    totalScore: number;
    maxPossible: number;
    percentage: number;
    passed: boolean;
    essayReviewed: boolean;
    createdAt: string;
  }>;
  exams: Array<{ id: number; title: string; gradeLevel: string }>;
  schedules: Array<{
    id: number;
    examId: number;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    registrationOpenDate?: string | null;
    registrationCloseDate?: string | null;
    maxSlots: number;
    slotsTaken: number;
  }>;
  regs: Array<{ id: number; scheduleId: number; userEmail: string; userId?: number | null; status: string }>;
  essays: Array<{ id: number; registrationId: number; scored: boolean }>;
  users: Array<{
    id: number;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email: string;
    applicantProfile?: { gradeLevel?: string | null } | null;
  }>;
  academicYears: AcademicYear[];
  semesters: Semester[];
  meta?: {
    admissionCountTotal: number;
    admissionCountReturned: number;
    admissionLimit: number;
    admissionsCapped: boolean;
  };
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

export async function getAdmission(id: number) {
  return client.get<Admission>(`/admissions/${id}`);
}

export async function getAdmissionsPage(params?: AdmissionParams) {
  return client.get<PagedApiResponse<Admission>>(`/admissions${qs(params)}`);
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

export async function getReportsSummary(params?: ReportsSummaryParams) {
  return client.get<EmployeeReportsSummary>(`/admissions/reports-summary${qs(params)}`);
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

interface ExtractJobResponse {
  jobId: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: ExtractedResult;
  error?: string;
}

export async function extractDocumentData(admissionId: number, docId: number): Promise<ExtractedResult> {
  const start = await client.post<ExtractJobResponse>(`/admissions/${admissionId}/documents/${docId}/extract`, {});
  if (start.status === 'completed' && start.result) return start.result;
  if (start.status === 'failed') throw new Error(start.error || 'Document extraction failed');
  if (!start.jobId) throw new Error('Document extraction did not start');

  const startedAt = Date.now();
  const timeoutMs = 90_000;

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const status = await client.get<ExtractJobResponse>(`/admissions/${admissionId}/documents/${docId}/extract/${encodeURIComponent(start.jobId)}`);
    if (status.status === 'completed' && status.result) return status.result;
    if (status.status === 'failed') throw new Error(status.error || 'Document extraction failed');
  }

  throw new Error('Document extraction is taking longer than expected. Please try again in a moment.');
}

export async function reviewDocument(admissionId: number, docId: number, reviewStatus: 'accepted' | 'rejected', reviewNote?: string) {
  return client.patch<{ id: number; reviewStatus: string; reviewNote: string | null; reviewedAt: string }>(`/admissions/${admissionId}/documents/${docId}/review`, { reviewStatus, reviewNote });
}
