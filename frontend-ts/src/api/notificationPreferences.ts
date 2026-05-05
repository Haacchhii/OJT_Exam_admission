import { client } from './client';

export interface NotificationPreference {
  id: number;
  userId: number;
  eventType: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface NotificationRolePreference {
  id: number;
  role: string;
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

export async function getRoleNotificationDefaults(role?: string) {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  return client.get<NotificationRolePreference[]>(`/notification-preferences/role-defaults${query}`);
}

export async function updateRoleNotificationDefaults(prefs: Array<{ role: string; eventType: string; enabled: boolean }>) {
  return client.put('/notification-preferences/role-defaults', prefs);
}
