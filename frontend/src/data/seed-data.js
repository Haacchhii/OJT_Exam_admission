// ============================================
// seed-data.js — Empty defaults for localStorage fallback
// ============================================
// All data comes from the backend API when VITE_API_URL is configured.
// This file only provides empty scaffolding for the localStorage fallback
// so the app does not crash when running without a backend.
export const defaultData = {
  admissions: [],
  nextId: 1,
  exams: [],
  examSchedules: [],
  examRegistrations: [],
  examResults: [],
  essayAnswers: [],
  notifications: [],
  nextExamId: 1,
  nextScheduleId: 1,
  nextRegistrationId: 1,
  nextNotificationId: 1,
  users: [],
  nextUserId: 1,
  submittedAnswers: [],
};
