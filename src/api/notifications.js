import { load, save } from '../data/store.js';

export function getNotifications(userId) {
  // Match exact userId only — e.g. 'student_3' or 'employee'
  return load().notifications.filter(n => n.userId === userId);
}

export function getUnreadCount(userId) {
  return getNotifications(userId).filter(n => !n.isRead).length;
}

export function markNotificationRead(id) {
  const data = load();
  const n = data.notifications.find(n => n.id === id);
  if (n) { n.isRead = true; save(data); }
}

export function markAllRead(userId) {
  const data = load();
  data.notifications.filter(n => n.userId === userId).forEach(n => (n.isRead = true));
  save(data);
}

export function addNotification(notification) {
  const data = load();
  notification.id = data.nextNotificationId++;
  notification.isRead = false;
  notification.createdAt = new Date().toISOString();
  data.notifications.unshift(notification);
  save(data);
  return notification;
}
