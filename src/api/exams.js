import { load, save } from '../data/store.js';
import { addNotification } from './notifications.js';

export function getExams() { return load().exams; }
export function getExam(id) { return load().exams.find(e => e.id === id) || null; }

export function addExam(exam) {
  const data = load();
  exam.id = data.nextExamId++;
  exam.isActive = true;
  exam.createdBy = 'Admin';
  exam.questions = exam.questions || [];
  data.exams.push(exam);
  save(data);
  return exam;
}

export function updateExam(id, updates) {
  const data = load();
  const exam = data.exams.find(e => e.id === id);
  if (exam) {
    const { id: _id, ...safeUpdates } = updates; // Prevent id overwrite
    Object.assign(exam, safeUpdates);
    save(data);
  }
  return exam;
}

export function deleteExam(id) {
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

export function getExamSchedules(examId) {
  const schedules = load().examSchedules;
  return examId ? schedules.filter(s => s.examId === examId) : schedules;
}

export function addExamSchedule(schedule) {
  const data = load();
  schedule.id = data.nextScheduleId++;
  schedule.slotsTaken = 0;
  data.examSchedules.push(schedule);
  save(data);
  return schedule;
}

export function updateExamSchedule(id, updates) {
  const data = load();
  const sched = data.examSchedules.find(s => s.id === id);
  if (sched) {
    const { id: _id, ...safeUpdates } = updates; // Prevent id overwrite
    Object.assign(sched, safeUpdates);
    save(data);
  }
  return sched;
}

export function deleteExamSchedule(id) {
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

export function getExamRegistrations() { return load().examRegistrations; }

export function registerForExam(userEmail, scheduleId) {
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
    addNotification({ userId: `student_${userObj.id}`, title: 'Exam Scheduled', message: `You have been scheduled for an exam on ${schedule.scheduledDate} at ${schedule.startTime}.`, type: 'exam' });
  }
  // Notify employees
  addNotification({ userId: 'employee', title: 'Exam Registration', message: `${userObj ? `${userObj.firstName} ${userObj.lastName}` : 'A student'} has booked an exam slot for ${schedule.scheduledDate}.`, type: 'exam' });

  return reg;
}

export function startExam(registrationId) {
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
