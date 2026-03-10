import { z } from 'zod';

// ─── Auth Schemas ─────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email format'),
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

// ─── Admission Schemas ────────────────────────────────
export const createAdmissionSchema = z.object({
  firstName: z.string().min(1).max(100),
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
  guardian: z.string().min(1),
  guardianRelation: z.string().min(1),
  guardianPhone: z.string().max(20).optional().nullable(),
  guardianEmail: z.string().email().optional().nullable().or(z.literal('')),
  academicYearId: z.number().int().positive().optional().nullable(),
  semesterId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['Submitted', 'Under Screening', 'Under Evaluation', 'Accepted', 'Rejected']),
  notes: z.string().max(1000).optional().nullable(),
});

export const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  status: z.enum(['Submitted', 'Under Screening', 'Under Evaluation', 'Accepted', 'Rejected']),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
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
  role: z.enum(['administrator', 'registrar', 'teacher', 'applicant']),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['administrator', 'registrar', 'teacher', 'applicant']).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
});
