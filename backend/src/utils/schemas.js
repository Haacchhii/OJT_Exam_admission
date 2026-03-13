import { z } from 'zod';
import { ROLES, ADMISSION_STATUSES, MAX_BULK_OPERATIONS } from './constants.js';

const ROLE_VALUES = /** @type {[string, ...string[]]} */ (Object.values(ROLES));
const STATUS_VALUES = /** @type {[string, ...string[]]} */ (ADMISSION_STATUSES);

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
  limit:  z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
};

// ─── Auth Schemas ─────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email format'),
  password: passwordSchema,
  gradeLevel: z.string().min(1, 'Grade level is required').max(50),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

// ─── Admission validation helpers ─────────────────────
const nameRegex = /^[\p{L}\p{M}\s\-'.]+$/u;
const nameOccupationRegex = /^[\p{L}\p{M}\p{N}\s\-'.,()]+$/u;
const addressRegex = /^[\p{L}\p{M}\p{N}\s\-'.,/()]+$/u;
const phoneRegex = /^[+\d][\d\s()-]{6,}$/;
const schoolYearRegex = /^\d{4}-\d{4}$/;

// ─── Admission Schemas ────────────────────────────────
export const createAdmissionSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100)
    .regex(nameRegex, 'Use only letters, spaces, hyphens, or apostrophes'),
  lastName: z.string().trim().min(1, 'Last name is required').max(100)
    .regex(nameRegex, 'Use only letters, spaces, hyphens, or apostrophes'),
  email: z.string().trim().email('Invalid email format'),
  phone: z.string().trim().max(20).optional().nullable()
    .refine(v => !v || phoneRegex.test(v) && v.replace(/\D/g, '').length >= 10, 'Invalid phone format (min 10 digits)'),
  dob: z.string().trim().min(1, 'Date of birth is required'),
  gender: z.enum(['Male', 'Female']),
  placeOfBirth: z.string().trim().min(1, 'Place of birth is required').max(200)
    .regex(addressRegex, 'Invalid characters'),
  religion: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  address: z.string().trim().min(1, 'Address is required').max(500)
    .refine(v => v.length >= 10, 'Please provide a complete address'),
  gradeLevel: z.string().trim().min(1, 'Grade level is required'),
  prevSchool: z.string().trim().max(200).optional().nullable().or(z.literal('')),
  schoolAddress: z.string().trim().min(1, 'School address is required').max(500)
    .refine(v => v.length >= 5, 'Please provide a complete school address'),
  schoolYear: z.string().trim().min(1, 'School year is required')
    .regex(schoolYearRegex, 'Use format YYYY-YYYY (e.g. 2026-2027)'),
  lrn: z.string().trim().transform(s => s.replace(/\D/g, ''))
    .refine(s => s.length === 12, 'LRN must be exactly 12 digits')
    .refine(s => /^\d{12}$/.test(s), 'LRN must be numeric'),
  applicantType: z.enum(['New', 'Transferee', 'Returning', 'Continuing']).default('New'),
  studentNumber: z.string().trim().max(50).optional().nullable().or(z.literal('')),
  fatherNameOccupation: z.string().trim().min(1, 'Father\'s name & occupation is required').max(200)
    .regex(nameOccupationRegex, 'Use only letters, numbers, spaces, commas, hyphens'),
  motherNameOccupation: z.string().trim().min(1, 'Mother\'s name & occupation is required').max(200)
    .regex(nameOccupationRegex, 'Use only letters, numbers, spaces, commas, hyphens'),
  guardian: z.string().trim().max(200).optional().nullable().or(z.literal('')),
  guardianRelation: z.string().trim().max(50).optional().nullable().or(z.literal('')),
  guardianPhone: z.string().trim().max(20).optional().nullable().or(z.literal('')),
  guardianEmail: z.string().email().optional().nullable().or(z.literal('')),
  academicYearId: z.number().int().positive().optional().nullable(),
  semesterId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateStatusSchema = z.object({
  status: z.enum(STATUS_VALUES),
  notes: z.string().max(1000).optional().nullable(),
});

export const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(MAX_BULK_OPERATIONS),
  status: z.enum(STATUS_VALUES),
});

export const bulkDeleteSchema = z.object({
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
  questionType: z.enum(['mc', 'essay']),
  points: z.number().int().positive(),
  orderNum: z.number().int().optional(),
  choices: z.array(choiceSchema).optional(),
});

export const createExamSchema = z.object({
  title: z.string().min(1).max(200),
  gradeLevel: z.string().min(1),
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
  maxSlots: z.number().int().positive(),
  venue: z.string().max(200).optional().nullable(),
});

// ─── User Schemas ─────────────────────────────────────
export const createUserSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: passwordSchema,
  role: z.enum(ROLE_VALUES),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
});

// ─── Query Parameter Schemas ──────────────────────────
export const admissionsQuerySchema = z.object({
  ...paginationQuery,
  status: z.enum(STATUS_VALUES).optional(),
  grade:  optionalString,
  sort:   z.enum(['newest', 'oldest']).optional(),
  academicYearId: coerceOptionalInt,
  semesterId:     coerceOptionalInt,
});

export const admissionsStatsQuerySchema = z.object({
  grade:          optionalString,
  from:           isoDateStr.optional(),
  to:             isoDateStr.optional(),
  academicYearId: coerceOptionalInt,
  semesterId:     coerceOptionalInt,
});

export const examsQuerySchema = z.object({
  ...paginationQuery,
  grade:          optionalString,
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
  status: z.enum(['scheduled', 'started', 'done']).optional(),
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
});

export const auditLogQuerySchema = z.object({
  ...paginationQuery,
  action: optionalString,
  entity: optionalString,
  userId: coerceOptionalInt,
  from:   isoDateStr.optional(),
  to:     isoDateStr.optional(),
});

export const notificationsQuerySchema = z.object({
  ...paginationQuery,
});

// ─── Missing update / create schemas ──────────────────
export const updateExamSchema = z.object({
  title:           z.string().min(1).max(200).optional(),
  gradeLevel:      z.string().min(1).optional(),
  durationMinutes: z.number().int().positive().optional(),
  passingScore:    z.number().min(0).max(100).optional(),
  isActive:        z.boolean().optional(),
  questions:       z.array(questionSchema).optional(),
});

export const updateScheduleSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  startTime:     z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').optional(),
  endTime:       z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').optional(),
  maxSlots:      z.number().int().positive().optional(),
  venue:         z.string().max(200).optional().nullable(),
});

export const createNotificationSchema = z.object({
  userId:  z.number().int().positive(),
  title:   z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type:    z.enum(['info', 'success', 'warning', 'error', 'admission', 'exam']).default('info'),
});

export const scoreEssaySchema = z.object({
  points:  z.number().min(0),
  comment: z.string().max(2000).optional().nullable(),
});
