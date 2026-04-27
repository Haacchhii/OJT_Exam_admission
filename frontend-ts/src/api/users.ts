import { client, qs } from './client';
import type { User } from '../types';

export interface PagedApiResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserStats {
  total: number;
  admins: number;
  registrars: number;
  teachers: number;
  applicants: number;
}

interface UserParams {
  search?: string;
  role?: string;
  status?: string;
  gradeLevel?: string;
  sortBy?: 'newest' | 'oldest' | 'name' | 'gradeLevelAsc' | 'gradeLevelDesc';
  page?: number;
  limit?: number;
}

const DEFAULT_USERS_PAGE = 1;
const DEFAULT_USERS_LIMIT = 50;

function withDefaultUserListParams<T extends { page?: number; limit?: number }>(params?: T): T {
  return {
    ...(params || {}),
    page: params?.page ?? DEFAULT_USERS_PAGE,
    limit: params?.limit ?? DEFAULT_USERS_LIMIT,
  } as T;
}

export async function getUsers(params?: UserParams) {
  return client.get<User[]>(`/users${qs(withDefaultUserListParams(params))}`);
}

export async function getUsersPage(params?: UserParams) {
  return client.get<PagedApiResponse<User>>(`/users${qs(withDefaultUserListParams(params))}`);
}

export async function getUserStats() {
  return client.get<UserStats>('/users/stats');
}

export async function getUserByEmail(email: string) {
  return client.get<User>(`/users/by-email/${encodeURIComponent(email)}`);
}

export async function addUser(user: Record<string, unknown>) {
  return client.post<User & { emailVerificationRequired?: boolean; verificationEmailSent?: boolean; message?: string }>('/users', user);
}

export async function updateUser(id: number, updates: Record<string, unknown>) {
  return client.put<User & { emailVerificationRequired?: boolean; verificationEmailSent?: boolean; message?: string }>(`/users/${id}`, updates);
}

export async function deleteUser(id: number) {
  return client.delete<void>(`/users/${id}`);
}

export async function bulkDeleteUsers(ids: number[]) {
  return client.post<{ deleted: number }>('/users/bulk-delete', { ids });
}
