import { client } from './client';

export interface NotificationPreference {
  id: number;
  userId: number;
  eventType: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export async function getNotificationPreferences() {
  return client.get<NotificationPreference[]>('/notification-preferences');
}

export async function updateNotificationPreferences(prefs: Array<{ eventType: string; enabled: boolean }>) {
  return client.put('/notification-preferences', prefs);
}
