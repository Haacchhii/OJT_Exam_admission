import { client, qs } from './client.js';

/**
 * @param {Object} [params] - { search, grade, status, page, limit }
 */
export async function getExams(params) {
  return client.get(`/exams${qs(params)}`);
}

/**
 * Fetch an exam with correct answers stripped (safe for students).
 */
export async function getExamForStudent(id) {
  return client.get(`/exams/${id}/student`);
}

/**
 * Fetch full exam with correct answers for review (student who completed the exam).
 */
export async function getExamForReview(id) {
  return client.get(`/exams/${id}/review`);
}

export async function addExam(exam) {
  return client.post('/exams', exam);
}

export async function updateExam(id, updates) {
  return client.put(`/exams/${id}`, updates);
}

export async function deleteExam(id) {
  return client.delete(`/exams/${id}`);
}

/**
 * @param {number} [examId] - optionally filter by exam
 * @param {Object} [params] - { search, page, limit }
 */
export async function getExamSchedules(examId, params) {
  return client.get(`/exams/schedules${qs({ examId, ...params })}`);
}

/**
 * Fetch only schedules with available slots (for student registration view).
 */
export async function getAvailableSchedules() {
  return client.get('/exams/schedules/available');
}

export async function addExamSchedule(schedule) {
  return client.post('/exams/schedules', schedule);
}

export async function updateExamSchedule(id, updates) {
  return client.put(`/exams/schedules/${id}`, updates);
}

export async function deleteExamSchedule(id) {
  return client.delete(`/exams/schedules/${id}`);
}

/**
 * @param {Object} [params] - { search, status, page, limit }
 */
export async function getExamRegistrations(params) {
  return client.get(`/exams/registrations${qs(params)}`);
}

/**
 * Fetch only the current student's registrations (scoped endpoint).
 */
export async function getMyRegistrations() {
  return client.get('/exams/registrations/mine');
}

export async function registerForExam(userEmail, scheduleId) {
  return client.post('/exams/registrations', { userEmail, scheduleId });
}

export async function startExam(registrationId) {
  return client.patch(`/exams/registrations/${registrationId}/start`);
}
