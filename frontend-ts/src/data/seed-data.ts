export interface DefaultData {
  admissions: unknown[];
  nextId: number;
  exams: unknown[];
  examSchedules: unknown[];
  examRegistrations: unknown[];
  examResults: unknown[];
  essayAnswers: unknown[];
  nextExamId: number;
  nextScheduleId: number;
  nextRegistrationId: number;
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
  nextExamId: 1,
  nextScheduleId: 1,
  nextRegistrationId: 1,
  users: [],
  nextUserId: 1,
  submittedAnswers: [],
};
