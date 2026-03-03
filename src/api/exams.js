import { load, save } from '../data/store.js';
import { addNotification } from './notifications.js';
import { USE_API, client, qs } from './client.js';

/**
 * @param {Object} [params] - { search, grade, status, page, limit }
 */
export async function getExams(params) {
  if (USE_API) return client.get(`/exams${qs(params)}`);
  return load().exams;
}
export async function getExam(id) {
  if (USE_API) return client.get(`/exams/${id}`);
  return load().exams.find(e => e.id === id) || null;
}

/**
 * Fetch an exam with correct answers stripped (safe for students).
 * Backend should return questions without `isCorrect` on choices.
 * In localStorage mode, strips correct answers client-side.
 */
export async function getExamForStudent(id) {
  if (USE_API) return client.get(`/exams/${id}/student`);
  const exam = load().exams.find(e => e.id === id);
  if (!exam) return null;
  return {
    ...exam,
    questions: exam.questions.map(q => ({
      ...q,
      choices: q.choices?.map(({ isCorrect: _, ...c }) => c) || [],
    })),
  };
}

export async function addExam(exam) {
  if (USE_API) return client.post('/exams', exam);
  const data = load();
  exam.id = data.nextExamId++;
  exam.isActive = true;
  exam.createdBy = 'Admin';
  exam.questions = exam.questions || [];
  data.exams.push(exam);
  save(data);
  return exam;
}

export async function updateExam(id, updates) {
  if (USE_API) return client.put(`/exams/${id}`, updates);
  const data = load();
  const exam = data.exams.find(e => e.id === id);
  if (exam) {
    const { id: _id, ...safeUpdates } = updates; // Prevent id overwrite
    Object.assign(exam, safeUpdates);
    save(data);
  }
  return exam;
}

export async function deleteExam(id) {
  if (USE_API) return client.delete(`/exams/${id}`);
  const data = load();
  // Cascade: remove schedules, registrations, and results tied to this exam
  const schedIds = data.examSchedules.filter(s => s.examId === id).map(s => s.id);
  const regIds = data.examRegistrations.filter(r => schedIds.includes(r.scheduleId)).map(r => r.id);
  data.examResults = data.examResults.filter(r => !regIds.includes(r.registrationId));
  data.essayAnswers = data.essayAnswers.filter(a => !regIds.includes(a.registrationId));
  data.submittedAnswers = data.submittedAnswers.filter(a => !regIds.includes(a.registrationId));
  data.examRegistrations = data.examRegistrations.filter(r => !schedIds.includes(r.scheduleId));
  data.examSchedules = data.examSchedules.filter(s => s.examId !== id);
  data.exams = data.exams.filter(e => e.id !== id);
  save(data);
}

/**
 * @param {number} [examId] - optionally filter by exam
 * @param {Object} [params] - { search, page, limit }
 */
export async function getExamSchedules(examId, params) {
  if (USE_API) return client.get(`/exams/schedules${qs({ examId, ...params })}`);
  const schedules = load().examSchedules;
  return examId ? schedules.filter(s => s.examId === examId) : schedules;
}

/**
 * Fetch only schedules with available slots (for student registration view).
 */
export async function getAvailableSchedules() {
  if (USE_API) return client.get('/exams/schedules/available');
  const data = load();
  return data.examSchedules.filter(s => {
    const exam = data.exams.find(e => e.id === s.examId);
    return exam && exam.isActive && s.slotsTaken < s.maxSlots
      && new Date(`${s.scheduledDate}T${s.endTime}`) > new Date();
  });
}

export async function addExamSchedule(schedule) {
  if (USE_API) return client.post('/exams/schedules', schedule);
  const data = load();
  schedule.id = data.nextScheduleId++;
  schedule.slotsTaken = 0;
  data.examSchedules.push(schedule);
  save(data);
  return schedule;
}

export async function updateExamSchedule(id, updates) {
  if (USE_API) return client.put(`/exams/schedules/${id}`, updates);
  const data = load();
  const sched = data.examSchedules.find(s => s.id === id);
  if (sched) {
    const { id: _id, ...safeUpdates } = updates; // Prevent id overwrite
    Object.assign(sched, safeUpdates);
    save(data);
  }
  return sched;
}

export async function deleteExamSchedule(id) {
  if (USE_API) return client.delete(`/exams/schedules/${id}`);
  const data = load();
  // Cascade: remove registrations tied to this schedule
  const regIds = data.examRegistrations.filter(r => r.scheduleId === id).map(r => r.id);
  data.examResults = data.examResults.filter(r => !regIds.includes(r.registrationId));
  data.essayAnswers = data.essayAnswers.filter(a => !regIds.includes(a.registrationId));
  data.submittedAnswers = data.submittedAnswers.filter(a => !regIds.includes(a.registrationId));
  data.examRegistrations = data.examRegistrations.filter(r => r.scheduleId !== id);
  data.examSchedules = data.examSchedules.filter(s => s.id !== id);
  save(data);
}

/**
 * @param {Object} [params] - { search, status, page, limit }
 */
export async function getExamRegistrations(params) {
  if (USE_API) return client.get(`/exams/registrations${qs(params)}`);
  return load().examRegistrations;
}

/**
 * Fetch only the current student's registrations (scoped endpoint).
 */
export async function getMyRegistrations(email) {
  if (USE_API) return client.get('/exams/registrations/mine');
  return load().examRegistrations.filter(r => r.userEmail === email);
}

export async function registerForExam(userEmail, scheduleId) {
  if (USE_API) return client.post('/exams/registrations', { userEmail, scheduleId });
  const data = load();
  // Prevent duplicate active registration (allow re-registration after completing)
  const existing = data.examRegistrations.find(r => r.userEmail === userEmail && r.status !== 'done');
  if (existing) return null;
  const schedule = data.examSchedules.find(s => s.id === scheduleId);
  if (!schedule || schedule.slotsTaken >= schedule.maxSlots) return null;
  const reg = {
    id: data.nextRegistrationId++,
    userEmail, scheduleId,
    status: 'scheduled', startedAt: null, submittedAt: null,
  };
  schedule.slotsTaken++;
  data.examRegistrations.push(reg);
  save(data);

  // Notify student about successful booking
  const userObj = data.users.find(u => u.email === userEmail);
  if (userObj) {
    await addNotification({ userId: `student_${userObj.id}`, title: 'Exam Scheduled', message: `You have been scheduled for an exam on ${schedule.scheduledDate} at ${schedule.startTime}.`, type: 'exam' });
  }
  // Notify employees
  await addNotification({ userId: 'employee', title: 'Exam Registration', message: `${userObj ? `${userObj.firstName} ${userObj.lastName}` : 'A student'} has booked an exam slot for ${schedule.scheduledDate}.`, type: 'exam' });

  return reg;
}

export async function startExam(registrationId) {
  if (USE_API) return client.patch(`/exams/registrations/${registrationId}/start`);
  const data = load();
  const reg = data.examRegistrations.find(r => r.id === registrationId);
  if (!reg) return null;
  // Only allow starting if status is 'scheduled'
  if (reg.status !== 'scheduled') return reg;
  reg.status = 'started';
  reg.startedAt = new Date().toISOString();
  save(data);
  return reg;
}
