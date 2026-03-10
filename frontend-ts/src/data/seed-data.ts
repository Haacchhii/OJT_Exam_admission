export interface DefaultData {
  admissions: unknown[];
  nextId: number;
  exams: unknown[];
  examSchedules: unknown[];
  examRegistrations: unknown[];
  examResults: unknown[];
  essayAnswers: unknown[];
  notifications: unknown[];
  nextExamId: number;
  nextScheduleId: number;
  nextRegistrationId: number;
  nextNotificationId: number;
  users: unknown[];
  nextUserId: number;
  submittedAnswers: unknown[];
}

export const defaultData: DefaultData = {
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
