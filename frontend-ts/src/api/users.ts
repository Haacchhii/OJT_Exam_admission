import { client, qs } from './client';
import type { User } from '../types';

interface UserParams {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function getUsers(params?: UserParams) {
  return client.get<User[]>(`/users${qs(params)}`);
}

export async function getUserByEmail(email: string) {
  return client.get<User>(`/users/by-email/${encodeURIComponent(email)}`);
}

export async function addUser(user: Record<string, unknown>) {
  return client.post<User>('/users', user);
}

export async function updateUser(id: number, updates: Record<string, unknown>) {
  return client.put<User>(`/users/${id}`, updates);
}

export async function deleteUser(id: number) {
  return client.delete<void>(`/users/${id}`);
}

export async function bulkDeleteUsers(ids: number[]) {
  return client.post<{ deleted: number }>('/users/bulk-delete', { ids });
}
