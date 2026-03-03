import { load, save } from '../data/store.js';
import { USE_API, client, qs } from './client.js';

/**
 * @param {string} userId
 * @param {Object} [params] - { page, limit }
 */
export async function getNotifications(userId, params) {
  if (USE_API) return client.get(`/notifications/${encodeURIComponent(userId)}${qs(params)}`);
  // Match exact userId only — e.g. 'student_3' or 'employee'
  return load().notifications.filter(n => n.userId === userId);
}

export async function getUnreadCount(userId) {
  if (USE_API) return client.get(`/notifications/${encodeURIComponent(userId)}/unread-count`).then(r => r.count ?? r);
  return (await getNotifications(userId)).filter(n => !n.isRead).length;
}

export async function markNotificationRead(id) {
  if (USE_API) return client.patch(`/notifications/${id}/read`);
  const data = load();
  const n = data.notifications.find(n => n.id === id);
  if (n) { n.isRead = true; save(data); }
}

export async function markAllRead(userId) {
  if (USE_API) return client.patch(`/notifications/${encodeURIComponent(userId)}/read-all`);
  const data = load();
  data.notifications.filter(n => n.userId === userId).forEach(n => (n.isRead = true));
  save(data);
}

export async function addNotification(notification) {
  if (USE_API) return client.post('/notifications', notification);
  const data = load();
  notification.id = data.nextNotificationId++;
  notification.isRead = false;
  notification.createdAt = new Date().toISOString();
  data.notifications.unshift(notification);
  save(data);
  return notification;
}
