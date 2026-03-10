// ─── User & Auth ──────────────────────────────────────
export type UserRole = 'administrator' | 'registrar' | 'teacher' | 'applicant';

export interface ApplicantProfile {
  studentNumber: string | null;
  lrn: string | null;
  gradeLevel: string | null;
  guardian: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffProfile {
  employeeId: string | null;
  department: string | null;
  position: string | null;
  hireDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
  applicantProfile?: ApplicantProfile | null;
  staffProfile?: StaffProfile | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ─── Admissions ──────────────────────────────────────
export type AdmissionStatus =
  | 'Submitted'
  | 'Under Screening'
  | 'Under Evaluation'
  | 'Accepted'
  | 'Rejected';

export type ApplicantType = 'New' | 'Transferee' | 'Returning' | 'Continuing';

export interface Admission {
  id: number;
  trackingId: string;
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dob: string;
  gender: string;
  address: string;
  gradeLevel: string;
  prevSchool: string | null;
  schoolYear: string;
  lrn: string | null;
  applicantType: ApplicantType;
  studentNumber: string | null;
  guardian: string;
  guardianRelation: string;
  guardianPhone: string | null;
  guardianEmail: string | null;
  status: AdmissionStatus;
  notes: string | null;
  academicYearId: number | null;
  semesterId: number | null;
  submittedAt: string;
  updatedAt: string;
  documents: string[];
  documentFiles: { name: string; filePath: string | null }[];
  academicYear: { id: number; year: string } | null;
  semester: { id: number; name: string } | null;
}

export interface AdmissionStats {
  total: number;
  submitted: number;
  underScreening: number;
  underEvaluation: number;
  accepted: number;
  rejected: number;
}

// ─── Exams ──────────────────────────────────────────
export interface QuestionChoice {
  id: number;
  choiceText: string;
  isCorrect?: boolean;
  orderNum: number;
}

export interface ExamQuestion {
  id: number;
  questionText: string;
  questionType: 'mc' | 'essay';
  points: number;
  orderNum: number;
  choices: QuestionChoice[];
}

export interface Exam {
  id: number;
  title: string;
  gradeLevel: string;
  durationMinutes: number;
  passingScore: number;
  isActive: boolean;
  academicYearId: number | null;
  semesterId: number | null;
  createdById: number | null;
  createdAt: string;
  updatedAt: string;
  questions: ExamQuestion[];
  _count?: { questions: number };
}

export interface ExamSchedule {
  id: number;
  examId: number;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  maxSlots: number;
  slotsTaken: number;
  venue: string | null;
  exam?: Exam;
}

export type RegistrationStatus = 'scheduled' | 'started' | 'done';

export interface ExamRegistration {
  id: number;
  trackingId: string;
  userEmail: string;
  scheduleId: number;
  status: RegistrationStatus;
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  schedule?: ExamSchedule;
  result?: ExamResult | null;
}

// ─── Results ──────────────────────────────────────────
export interface ExamResult {
  id: number;
  registrationId: number;
  totalScore: number;
  maxPossible: number;
  percentage: number;
  passed: boolean;
  essayReviewed: boolean;
  reviewedById: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EssayAnswer {
  id: number;
  registrationId: number;
  questionId: number;
  essayResponse: string;
  pointsAwarded: number | null;
  maxPoints: number;
  scored: boolean;
  scoredById: number | null;
  scoredAt: string | null;
  question?: ExamQuestion;
  registration?: ExamRegistration;
}

export interface SubmittedAnswer {
  id: number;
  registrationId: number;
  questionId: number;
  selectedChoiceId: number | null;
  essayText: string | null;
  pointsAwarded?: number | null;
  question?: ExamQuestion;
}

// ─── Notifications ──────────────────────────────────
export type NotificationType = 'info' | 'success' | 'warning' | 'exam' | 'admission' | 'status' | 'scoring';

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ─── Audit ──────────────────────────────────────────
export interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string } | null;
}

// ─── Academic ──────────────────────────────────────
export interface AcademicYear {
  id: number;
  year: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface Semester {
  id: number;
  name: string;
  academicYearId: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
}

// ─── API Response Wrappers ─────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Component Props ───────────────────────────────
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface SelectOption {
  value: string;
  label: string;
}

export interface GradeGroup {
  group: string;
  items: string[];
}
