import { client, qs } from './client.js';

/**
 * @param {string} userId
 * @param {Object} [params] - { page, limit }
 */
export async function getNotifications(userId, params) {
  return client.get(`/notifications/${encodeURIComponent(userId)}${qs(params)}`);
}

export async function markNotificationRead(id) {
  return client.patch(`/notifications/${id}/read`);
}

export async function markAllRead(userId) {
  return client.patch(`/notifications/${encodeURIComponent(userId)}/read-all`);
}
