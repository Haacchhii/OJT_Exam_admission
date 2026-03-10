import { client, qs } from './client.js';

/**
 * @param {Object} [params] - { search, role, status, page, limit }
 */
export async function getUsers(params) {
  return client.get(`/users${qs(params)}`);
}

export async function getUserByEmail(email) {
  return client.get(`/users/by-email/${encodeURIComponent(email)}`);
}

export async function addUser(user) {
  return client.post('/users', user);
}

export async function updateUser(id, updates) {
  return client.put(`/users/${id}`, updates);
}

export async function deleteUser(id) {
  return client.delete(`/users/${id}`);
}
