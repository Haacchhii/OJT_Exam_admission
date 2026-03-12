import { client, qs } from './client';
import type { Notification } from '../types';

interface NotificationParams {
  page?: number;
  limit?: number;
}

export async function getNotifications(userId: string, params?: NotificationParams) {
  return client.get<Notification[]>(
    `/notifications/${encodeURIComponent(userId)}${qs(params)}`
  );
}

export async function markNotificationRead(id: number) {
  return client.patch<Notification>(`/notifications/${id}/read`);
}

export async function markAllRead(userId: string) {
  return client.patch<void>(`/notifications/${encodeURIComponent(userId)}/read-all`);
}

export async function createNotification(data: { userId: number; title: string; message: string; type?: string }) {
  return client.post<Notification>('/notifications', data);
}
