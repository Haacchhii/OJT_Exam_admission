import { client } from './client';

export interface AdmissionComment {
  id: number;
  admissionId: number;
  userId: number;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  user?: { id: number; firstName?: string; lastName?: string; role?: string };
}

export async function getAdmissionComments(admissionId: number) {
  return client.get<AdmissionComment[]>(`/admissions/${admissionId}/comments`);
}

export async function addAdmissionComment(admissionId: number, content: string) {
  return client.post<AdmissionComment>(`/admissions/${admissionId}/comments`, { content });
}

export async function deleteAdmissionComment(commentId: number) {
  return client.delete<void>(`/admissions/comments/${commentId}`);
}
