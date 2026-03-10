import { client, qs } from './client.js';

export const VALID_TRANSITIONS = {
  'Submitted': ['Under Screening', 'Rejected'],
  'Under Screening': ['Under Evaluation', 'Rejected'],
  'Under Evaluation': ['Accepted', 'Rejected'],
  'Accepted': [],
  'Rejected': ['Submitted'],
};

/**
 * Fetch admissions list.
 * Supports server-side filtering/pagination via query params.
 * @param {Object} [params] - { status, grade, search, sort, page, limit }
 */
export async function getAdmissions(params) {
  return client.get(`/admissions${qs(params)}`);
}

/**
 * Fetch the current student's own admission (scoped endpoint).
 */
export async function getMyAdmission() {
  return client.get('/admissions/mine');
}

export async function addAdmission(admission) {
  return client.post('/admissions', admission);
}

/**
 * Upload admission documents (files) for a given admission.
 * Sends multipart/form-data to the server.
 * @param {number|string} admissionId
 * @param {File[]} files
 * @returns {Promise<{ urls: string[] }>}
 */
export async function uploadAdmissionDocuments(admissionId, files) {
  const formData = new FormData();
  files.forEach(f => formData.append('documents', f));
  return client.upload(`/admissions/${admissionId}/documents`, formData);
}

export async function updateAdmissionStatus(id, status, notes) {
  return client.patch(`/admissions/${id}/status`, { status, notes });
}

/**
 * Bulk update admission statuses.
 * @param {number[]} ids
 * @param {string} status
 * @returns {Promise<{ updated: number }>}
 */
export async function bulkUpdateStatus(ids, status) {
  return client.patch('/admissions/bulk-status', { ids, status });
}

export async function getStats(params) {
  return client.get(`/admissions/stats${qs(params)}`);
}

export async function trackApplication(trackingId) {
  return client.get(`/admissions/track/${encodeURIComponent(trackingId)}`);
}
