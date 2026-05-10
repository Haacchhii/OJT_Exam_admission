import { z } from 'zod';
import { ROLES, ADMISSION_STATUSES, MAX_BULK_OPERATIONS, EXAM_GRADE_LEVELS } from './constants.js';

const ROLE_VALUES = /** @type {[string, ...string[]]} */ (Object.values(ROLES));
const STATUS_VALUES = /** @type {[string, ...string[]]} */ (ADMISSION_STATUSES);
const EXAM_GRADE_LEVEL_VALUES = /** @type {[string, ...string[]]} */ (EXAM_GRADE_LEVELS);

// ─── Shared helpers ─────────────────────────────────
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export { passwordSchema };

const coercePositiveInt = z.coerce.number().int().positive();
const coerceOptionalInt = z.coerce.number().int().positive().optional();
const optionalString = z.string().max(200).optional();
const isoDateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/, 'Must be ISO date format');

// Common query param schema for paginated list endpoints
const paginationQuery = {
  page:   z.coerce.number().int().positive().optional(),
  limit:  z.coerce.number().int().min(1, 'Please enter 1 or higher for limit.').max(100, 'Please enter 100 or less for limit.').optional(),
  search: z.string().max(200).optional(),
};

// ─── Auth Schemas ─────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().min(1, 'Middle name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email format'),
  password: passwordSchema,
  gradeLevel: z.string().min(1, 'Grade level is required').max(50),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required').max(512),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  middleName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  currentPassword: z.string().min(1, 'Current password is required').optional(),
  newPassword: passwordSchema.optional(),
});

// ─── Academic Year / Semester Schemas ────────────────
const yearRegex = /^\d{4}-\d{4}$/;
const isoDateFlexible = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;

export const createAcademicYearSchema = z.object({
  year: z.string().regex(yearRegex, 'Year must be in format YYYY-YYYY (e.g. 2026-2027)'),
  isActive: z.boolean().optional(),
  startDate: z.string().regex(isoDateFlexible, 'Invalid date format').optional().nullable(),
  endDate: z.string().regex(isoDateFlexible, 'Invalid date format').optional().nullable(),
});

export const updateAcademicYearSchema = z.object({
  year: z.string().regex(yearRegex, 'Year must be in format YYYY-YYYY (e.g. 2026-2027)').optional(),
  isActive: z.boolean().optional(),
  startDate: z.string().regex(isoDateFlexible, 'Invalid date format').optional().nullable(),
  endDate: z.string().regex(isoDateFlexible, 'Invalid date format').optional().nullable(),
});

export const createSemesterSchema = z.object({
  name: z.string().min(1).max(100),
  academicYearId: z.number().int().positive(),
  isActive: z.boolean().optional(),
  startDate: z.string().regex(isoDateFlexible, 'Invalid date format').optional().nullable(),
  endDate: z.string().regex(isoDateFlexible, 'Invalid date format').optional().nullable(),
});

export const updateSemesterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  startDate: z.string().regex(isoDateFlexible, 'Invalid date format').optional().nullable(),
  endDate: z.string().regex(isoDateFlexible, 'Invalid date format').optional().nullable(),
});

export const semestersQuerySchema = z.object({
  yearId: coerceOptionalInt,
});

// ─── Perf Monitoring Schemas ─────────────────────────
export const perfVitalSchema = z.object({
  metric: z.string().min(1).max(64),
  value: z.number().finite(),
  rating: z.string().max(32).optional(),
  id: z.string().max(200).optional().nullable(),
  page: z.string().max(500).optional().nullable(),
  timestamp: z.number().int().positive().optional(),
  navigationType: z.string().max(64).optional().nullable(),
  userAgent: z.string().max(500).optional().nullable(),
});

export const perfSummaryQuerySchema = z.object({
  key: z.string().max(200).optional(),
  minutes: z.coerce.number().int().min(1).max(24 * 60).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

// ─── Admission Schemas ────────────────────────────────
export const createAdmissionSchema = z.object({
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional().nullable().or(z.literal('')),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional().nullable(),
  dob: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['Male', 'Female']),
  address: z.string().min(1).max(500),
  gradeLevel: z.string().min(1),
  prevSchool: z.string().max(200).optional().nullable(),
  schoolYear: z.string().min(1),
  lrn: z.string().max(20).optional().nullable(),
  applicantType: z.enum(['New', 'Transferee', 'Returning', 'Continuing']).default('New'),
  guardian: z.string().max(200).optional().nullable().or(z.literal('')),
  guardianRelation: z.string().max(100).optional().nullable().or(z.literal('')),
  guardianPhone: z.string().max(20).optional().nullable(),
  guardianEmail: z.string().email().optional().nullable().or(z.literal('')),
  academicYearId: z.number().int().positive().optional().nullable(),
  semesterId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).superRefine((data, ctx) => {
  const hasGuardian = Boolean(String(data.guardian || '').trim());
  const hasRelation = Boolean(String(data.guardianRelation || '').trim());
  if (hasGuardian && !hasRelation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['guardianRelation'],
      message: 'Guardian relationship is required when guardian name is provided',
    });
  }
});

export const updateStatusSchema = z.object({
  status: z.enum(STATUS_VALUES),
  notes: z.string().max(1000).optional().nullable(),
});

export const reviewDocumentSchema = z.object({
  reviewStatus: z.enum(['accepted', 'rejected'], { message: 'Review status must be "accepted" or "rejected"' }),
  reviewNote: z.string().max(2000, 'Review note cannot exceed 2000 characters').optional().nullable(),
});

export const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(MAX_BULK_OPERATIONS),
  status: z.enum(STATUS_VALUES),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(MAX_BULK_OPERATIONS),
});

export const bulkHandoffSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(MAX_BULK_OPERATIONS),
});

// ─── Exam Schemas ─────────────────────────────────────
const choiceSchema = z.object({
  choiceText: z.string().min(1),
  isCorrect: z.boolean().default(false),
  orderNum: z.number().int().optional(),
});

const questionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['mc', 'essay', 'identification', 'true_false']),
  points: z.number().int().positive(),
  orderNum: z.number().int().optional(),
  choices: z.array(choiceSchema).optional(),
  identificationAnswer: z.string().max(5000).optional().nullable(),
  identificationMatchMode: z.enum(['exact', 'partial']).optional().nullable(),
}).superRefine((q, ctx) => {
  const choiceCount = Array.isArray(q.choices) ? q.choices.length : 0;
  const correctCount = Array.isArray(q.choices) ? q.choices.filter(c => c.isCorrect).length : 0;

  if (q.questionType === 'mc') {
    if (choiceCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'Multiple choice questions require at least 2 choices.',
      });
    }
    if (correctCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'Multiple choice questions require at least one correct answer.',
      });
    }
  }

  if (q.questionType === 'true_false') {
    if (choiceCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'True/False questions require True and False options.',
      });
    }
    if (correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'True/False questions must have exactly one correct answer.',
      });
    }
  }

  if (q.questionType === 'identification') {
    const answer = String(q.identificationAnswer || '').trim();
    if (!answer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['identificationAnswer'],
        message: 'Identification questions require a correct answer key.',
      });
    }
  }
});

export const createExamSchema = z.object({
  title: z.string().min(1).max(200),
  gradeLevel: z.enum(EXAM_GRADE_LEVEL_VALUES),
  durationMinutes: z.number().int().positive(),
  passingScore: z.number().min(0).max(100),
  isActive: z.boolean().default(true),
  academicYearId: z.number().int().positive().optional().nullable(),
  semesterId: z.number().int().positive().optional().nullable(),
  questions: z.array(questionSchema).optional(),
});

// ─── Exam Schedule Schemas ────────────────────────────
export const createScheduleSchema = z.object({
  examId: z.number().int().positive(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  visibilityStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional().nullable(),
  visibilityEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional().nullable(),
  registrationOpenDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional().nullable(),
  registrationCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional().nullable(),
  examWindowStartAt: z.string().datetime().optional().nullable(),
  examWindowEndAt: z.string().datetime().optional().nullable(),
  maxSlots: z.number().int().positive(),
  venue: z.string().max(200).optional().nullable(),
});

// ─── User Schemas ─────────────────────────────────────
export const createUserSchema = z.object({
  firstName: z.string().max(100).optional(),
  middleName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email(),
  password: passwordSchema.optional(),
  role: z.enum(ROLE_VALUES),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  middleName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: passwordSchema.optional(),
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
});

// ─── Query Parameter Schemas ──────────────────────────
export const admissionsQuerySchema = z.object({
  ...paginationQuery,
  status: z.enum(STATUS_VALUES).optional(),
  grade:  optionalString,
  levelGroup: optionalString,
  sort:   z.enum(['newest', 'oldest', 'name', 'status']).optional(),
  staleOnly: z.enum(['true', 'false']).optional(),
  slaDays: z.coerce.number().int().min(1).max(60).optional(),
  academicYearId: coerceOptionalInt,
  semesterId:     coerceOptionalInt,
});

export const admissionsStatsQuerySchema = z.object({
  grade:          optionalString,
  levelGroup:     optionalString,
  from:           isoDateStr.optional(),
  to:             isoDateStr.optional(),
  slaDays:        z.coerce.number().int().min(1).max(60).optional(),
  academicYearId: coerceOptionalInt,
  semesterId:     coerceOptionalInt,
});

export const reportsSummaryQuerySchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  levelGroup: optionalString,
  grade: optionalString,
  academicYearId: coerceOptionalInt,
  semesterId: coerceOptionalInt,
  dateFrom: isoDateStr.optional(),
  dateTo: isoDateStr.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'alphabetical', 'school']).optional(),
  school: z.string().max(200).optional(),
});

export const examsQuerySchema = z.object({
  ...paginationQuery,
  grade:          optionalString,
  levelGroup:     optionalString,
  status:         z.enum(['active', 'inactive']).optional(),
  academicYearId: coerceOptionalInt,
  semesterId:     coerceOptionalInt,
});

export const schedulesQuerySchema = z.object({
  ...paginationQuery,
  examId: coerceOptionalInt,
});

export const registrationsQuerySchema = z.object({
  ...paginationQuery,
  examId: coerceOptionalInt,
  status: z.enum(['scheduled', 'started', 'done']).optional(),
});

export const examReadinessQuerySchema = z.object({
  ...paginationQuery,
  status: z.enum(['all', 'pending', 'done', 'passed', 'failed']).optional(),
});

export const createRegistrationSchema = z.object({
  userEmail: z.string().email().optional(),
  scheduleId: z.number().int().positive(),
});

export const resultsQuerySchema = z.object({
  ...paginationQuery,
  passed: z.enum(['true', 'false']).optional(),
  examId: coerceOptionalInt,
});

export const essaysQuerySchema = z.object({
  ...paginationQuery,
  status: z.enum(['pending', 'scored', 'all']).optional(),
});

export const usersQuerySchema = z.object({
  ...paginationQuery,
  role:   z.enum(ROLE_VALUES).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  gradeLevel: z.string().max(100).optional(),
  sortBy: z.enum(['newest', 'oldest', 'name', 'gradeLevelAsc', 'gradeLevelDesc']).optional(),
});

export const auditLogQuerySchema = z.object({
  ...paginationQuery,
  action: optionalString,
  entity: optionalString,
  userId: coerceOptionalInt,
  from:   isoDateStr.optional(),
  to:     isoDateStr.optional(),
});

// ─── Missing update / create schemas ──────────────────
export const updateExamSchema = z.object({
  title:           z.string().min(1).max(200).optional(),
  gradeLevel:      z.enum(EXAM_GRADE_LEVEL_VALUES).optional(),
  durationMinutes: z.number().int().positive().optional(),
  passingScore:    z.number().min(0).max(100).optional(),
  isActive:        z.boolean().optional(),
  questions:       z.array(questionSchema).optional(),
});

export const updateScheduleSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  startTime:     z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').optional(),
  endTime:       z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').optional(),
  visibilityStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional().nullable(),
  visibilityEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional().nullable(),
  registrationOpenDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional().nullable(),
  registrationCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional().nullable(),
  examWindowStartAt: z.string().datetime().optional().nullable(),
  examWindowEndAt: z.string().datetime().optional().nullable(),
  maxSlots:      z.number().int().positive().optional(),
  venue:         z.string().max(200).optional().nullable(),
});

export const saveDraftSchema = z.object({
  answers: z.record(
    z.string(),
    z.union([
      z.number().int().positive(),     // choiceId for multiple choice
      z.string().max(5000),            // essay answer text
      z.null(),
    ])
  ).refine(
    (value) => Object.keys(value).length <= 1000,
    'Cannot save more than 1000 questions'
  ),
});

export const submitExamSchema = z.object({
  registrationId: z.number().int().positive(),
  answers: z.record(
    z.string(),
    z.union([
      z.number().int().positive(),
      z.string().max(5000),
      z.null(),
    ])
  ).refine(
    (value) => Object.keys(value).length <= 1000,
    'Cannot submit more than 1000 questions'
  ),
});

export const scoreEssaySchema = z.object({
  points:  z.number().min(0),
  comment: z.string().max(2000).optional().nullable(),
});

export const admissionIdParamSchema = z.object({
  admissionId: z.coerce.number().int().positive(),
});

export const commentIdParamSchema = z.object({
  commentId: z.coerce.number().int().positive(),
});

export const templateIdParamSchema = z.object({
  templateId: z.coerce.number().int().positive(),
});

export const admissionCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(3000),
});

export const notifyNoScheduleSchema = z.object({
  message: z.string().max(500).optional().default(''),
});

export const notificationPreferenceItemSchema = z.object({
  eventType: z.string().min(1).max(100),
  enabled: z.boolean(),
});

export const notificationPreferencesUpdateSchema = z.array(notificationPreferenceItemSchema)
  .min(1)
  .max(200);

export const notificationRolePreferenceItemSchema = z.object({
  role: z.enum(ROLE_VALUES),
  eventType: z.string().min(1).max(100),
  enabled: z.boolean(),
});

export const notificationRoleDefaultsUpdateSchema = z.array(notificationRolePreferenceItemSchema)
  .min(1)
  .max(200);

export const notificationRoleDefaultsQuerySchema = z.object({
  role: z.enum(ROLE_VALUES).optional(),
});

export const questionTemplateSchema = z.object({
  title: z.string().min(1).max(200),
  questionText: z.string().min(1).max(5000),
  questionType: z.enum(['mc', 'essay', 'identification', 'true_false']),
  points: z.number().int().positive().max(100).optional(),
  choices: z.array(choiceSchema).max(20).optional(),
  identificationAnswer: z.string().max(5000).optional().nullable(),
  identificationMatchMode: z.enum(['exact', 'partial']).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
});
