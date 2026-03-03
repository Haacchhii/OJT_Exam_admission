import { load, save } from '../data/store.js';
import { addNotification } from './notifications.js';
import { USE_API, client, qs } from './client.js';

const VALID_STATUSES = ['Submitted', 'Under Screening', 'Under Evaluation', 'Accepted', 'Rejected'];
export const VALID_TRANSITIONS = {
  'Submitted': ['Under Screening', 'Rejected'],
  'Under Screening': ['Under Evaluation', 'Rejected'],
  'Under Evaluation': ['Accepted', 'Rejected'],
  'Accepted': [],
  'Rejected': ['Submitted'],
};

/**
 * Fetch admissions list.
 * In API mode, supports server-side filtering/pagination via query params.
 * @param {Object} [params] - { status, grade, search, sort, page, limit }
 */
export async function getAdmissions(params) {
  if (USE_API) return client.get(`/admissions${qs(params)}`);
  return load().admissions;
}

/**
 * Fetch the current student's own admission (scoped endpoint).
 * In localStorage mode, falls back to filtering by email.
 */
export async function getMyAdmission(email) {
  if (USE_API) return client.get('/admissions/mine');
  const all = load().admissions;
  return all.find(a => a.email === email) || null;
}

export async function getAdmission(id) {
  if (USE_API) return client.get(`/admissions/${id}`);
  return load().admissions.find(a => a.id === id) || null;
}

export async function addAdmission(admission) {
  if (USE_API) return client.post('/admissions', admission);
  const data = load();
  // Input validation: require essential fields
  if (!admission.firstName?.trim() || !admission.lastName?.trim() || !admission.email?.trim() || !admission.gradeLevel?.trim()) {
    return { error: 'First name, last name, email, and grade level are required.' };
  }
  // Exam-first gate: verify the student has a passing exam result
  const myReg = data.examRegistrations.find(r => r.userEmail === admission.email && r.status === 'done');
  if (myReg) {
    const result = data.examResults.find(r => r.registrationId === myReg.id);
    if (!result || !result.passed) {
      return { error: 'Student must pass the entrance exam before applying for admission.' };
    }
  } else {
    return { error: 'Student must complete and pass the entrance exam before applying for admission.' };
  }
  admission.id = data.nextId++;
  admission.status = 'Submitted';
  admission.submittedAt = new Date().toISOString();
  admission.notes = '';
  data.admissions.unshift(admission);
  save(data);

  // Notify student
  const userObj = data.users.find(u => u.email === admission.email);
  if (userObj) {
    await addNotification({ userId: `student_${userObj.id}`, title: 'Application Submitted', message: 'Your admission application has been submitted successfully and is now under review.', type: 'info' });
  }
  // Notify employees
  await addNotification({ userId: 'employee', title: 'New Application', message: `${admission.firstName} ${admission.lastName} submitted an admission application for ${admission.gradeLevel}.`, type: 'info' });

  return admission;
}

/**
 * Upload admission documents (files) for a given admission.
 * In localStorage mode, documents are stored as name strings.
 * In API mode, sends multipart/form-data to the server.
 * @param {number|string} admissionId
 * @param {File[]} files
 * @returns {Promise<{ urls: string[] }>}
 */
export async function uploadAdmissionDocuments(admissionId, files) {
  if (USE_API) {
    const formData = new FormData();
    files.forEach(f => formData.append('documents', f));
    return client.upload(`/admissions/${admissionId}/documents`, formData);
  }
  // localStorage mode: just return file names (no real upload)
  return { urls: files.map(f => f.name) };
}

export async function updateAdmissionStatus(id, status, notes) {
  if (USE_API) return client.patch(`/admissions/${id}/status`, { status, notes });
  if (!VALID_STATUSES.includes(status)) return null;
  const data = load();
  const adm = data.admissions.find(a => a.id === id);
  if (adm) {
    const oldStatus = adm.status;
    // Enforce valid transitions (skip check if status unchanged)
    if (status !== oldStatus) {
      const allowed = VALID_TRANSITIONS[oldStatus] || [];
      if (!allowed.includes(status)) return null;
    }
    adm.status = status;
    if (notes !== undefined) adm.notes = notes;
    save(data);

    // Notify the applicant about status change
    const userObj = data.users.find(u => u.email === adm.email);
    if (userObj) {
      const statusMessages = {
        'Under Screening': 'Your application is now under screening.',
        'Under Evaluation': 'Your application is being evaluated.',
        'Accepted': 'Congratulations! Your admission has been accepted.',
        'Rejected': 'Your application has been reviewed. Please contact the registrar for details.',
      };
      await addNotification({
        userId: `student_${userObj.id}`,
        title: `Status Updated: ${status}`,
        message: statusMessages[status] || `Your admission status has been changed from ${oldStatus} to ${status}.`,
        type: status === 'Rejected' ? 'warning' : status === 'Accepted' ? 'success' : 'info',
      });
    }
  }
  return adm;
}

/**
 * Bulk update admission statuses.
 * In API mode, sends a single request. In localStorage mode, loops.
 * @param {number[]} ids
 * @param {string} status
 * @returns {Promise<{ updated: number }>}
 */
export async function bulkUpdateStatus(ids, status) {
  if (USE_API) return client.patch('/admissions/bulk-status', { ids, status });
  let updated = 0;
  for (const id of ids) {
    const result = await updateAdmissionStatus(id, status, '');
    if (result) updated++;
  }
  return { updated };
}

export async function getStats(params) {
  if (USE_API) return client.get(`/admissions/stats${qs(params)}`);
  const admissions = await getAdmissions();
  return {
    total: admissions.length,
    submitted: admissions.filter(a => a.status === 'Submitted').length,
    underScreening: admissions.filter(a => a.status === 'Under Screening').length,
    underEvaluation: admissions.filter(a => a.status === 'Under Evaluation').length,
    accepted: admissions.filter(a => a.status === 'Accepted').length,
    rejected: admissions.filter(a => a.status === 'Rejected').length,
  };
}
