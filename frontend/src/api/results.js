import { client, qs } from './client.js';

/**
 * @param {Object} [params] - { search, passed, examId, page, limit }
 */
export async function getExamResults(params) {
  return client.get(`/results${qs(params)}`);
}

/**
 * Fetch the current student's own result (scoped endpoint).
 */
export async function getMyResult() {
  return client.get('/results/mine');
}

/**
 * @param {Object} [params] - { status, page, limit } — status: 'pending'|'scored'|'all'
 */
export async function getEssayAnswers(params) {
  return client.get(`/results/essays${qs(params)}`);
}

export async function scoreEssay(answerId, points, comment) {
  return client.patch(`/results/essays/${answerId}/score`, { points, comment });
}

export async function getSubmittedAnswers(registrationId) {
  return client.get(`/results/answers/${registrationId}`);
}

/**
 * Submit exam answers.
 * Only `registrationId` and `answers` are sent to the backend.
 * The backend looks up the exam questions from its own database
 * to prevent clients from injecting modified correct answers.
 *
 * @param {number} registrationId
 * @param {Record<string|number, any>} answersObj — { [questionId]: choiceId | essayText }
 */
export async function submitExamAnswers(registrationId, answersObj) {
  return client.post('/results/submit', { registrationId, answers: answersObj });
}
