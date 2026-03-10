/**
 * Centralized school information constants.
 * Update these values in one place to propagate across the entire app.
 */
export const SCHOOL_NAME = 'GOLDEN KEY Integrated School of St. Joseph';
export const SCHOOL_ADDRESS = 'Lapolapo 1st, San Jose, Batangas, Philippines';
export const SCHOOL_PHONE = '(043)-702-2153';
export const SCHOOL_YEAR = String(new Date().getFullYear());
export const SCHOOL_COPYRIGHT = `\u00A9 ${SCHOOL_YEAR} ${SCHOOL_NAME}`;
export const SCHOOL_SYSTEM_TITLE = 'Online Exam & Admission System';

/**
 * Unified grade-level options used across the entire app
 * (Exam Builder, Admission form, Reports filters, etc.)
 */
export const GRADE_OPTIONS = [
  { group: 'Preschool', items: ['Nursery', 'Kinder'] },
  { group: 'Grade School', items: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'] },
  { group: 'Junior High School', items: ['Grade 7','Grade 8','Grade 9','Grade 10'] },
  { group: 'Senior High School', items: ['Grade 11 — ABM','Grade 11 — STEM','Grade 11 — HUMSS','Grade 12 — ABM','Grade 12 — STEM','Grade 12 — HUMSS'] },
];

/**
 * Flat list of all grade levels (handy for validation & selects)
 */
export const ALL_GRADE_LEVELS = GRADE_OPTIONS.flatMap(g => g.items);

/**
 * Simpler grade buckets used in the Exam Builder's grade-level selector.
 * Maps to the broader groups students belong to.
 */
export const EXAM_GRADE_LEVELS = ['Preschool', 'Grade 1-6', 'Grade 7-10', 'Grade 11-12', 'All Levels'];

/**
 * Semester name options for academic period selectors.
 */
export const SEMESTER_NAMES = ['First Semester', 'Second Semester', 'Summer'];

/**
 * User roles known to the system.
 */
export const USER_ROLES = ['administrator', 'registrar', 'teacher', 'applicant'];

/**
 * Role options formatted for dropdowns ({ value, label }).
 */
export const USER_ROLE_OPTIONS = USER_ROLES.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }));

/**
 * Admission status values and their allowed transitions.
 */
export const ADMISSION_STATUSES = ['Submitted', 'Under Screening', 'Under Evaluation', 'Accepted', 'Rejected'];

/**
 * Admission progress steps (excludes Rejected — used for status timeline UI).
 */
export const ADMISSION_PROGRESS_STEPS = ['Submitted', 'Under Screening', 'Under Evaluation', 'Accepted'];

/**
 * "In-progress" statuses (neither accepted nor rejected).
 */
export const ADMISSION_IN_PROGRESS = ['Submitted', 'Under Screening', 'Under Evaluation'];

/**
 * Per-page defaults used across list views.
 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Dynamic school year — derives from current date.
 * Before June → current year is the first year (e.g. 2026-2027).
 * June or later → next year cycle (e.g. 2026-2027 if accessed in June 2026).
 */
export function getCurrentSchoolYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed: 0=Jan, 5=Jun
  const startYear = month >= 5 ? year : year - 1; // School year starts in June in PH
  return `${startYear}-${startYear + 1}`;
}

/**
 * Gender options for admission form.
 */
export const GENDER_OPTIONS = [
  { v: '', l: 'Select gender' },
  { v: 'Male', l: 'Male' },
  { v: 'Female', l: 'Female' },
  { v: 'Other', l: 'Other' },
];

/**
 * Guardian relationship options.
 */
export const GUARDIAN_RELATIONS = [
  { v: '', l: 'Select relationship' },
  { v: 'Mother', l: 'Mother' },
  { v: 'Father', l: 'Father' },
  { v: 'Legal Guardian', l: 'Legal Guardian' },
  { v: 'Grandparent', l: 'Grandparent' },
  { v: 'Sibling', l: 'Sibling' },
  { v: 'Other', l: 'Other' },
];

/**
 * Applicant type options.
 */
export const APPLICANT_TYPES = [
  { v: 'New', l: 'New Student' },
  { v: 'Transferee', l: 'Transferee' },
  { v: 'Returning', l: 'Returning Student' },
  { v: 'Continuing', l: 'Continuing Student (Current Enrollee)' },
];

/**
 * Document requirements per grade level (school policy).
 * Keyed by grade level string → set of required document slot IDs.
 */
export const DOC_REQUIREMENTS = {
  'Nursery':    { idPhoto: true, baptismal: true, birthCert: true },
  'Kinder':     { idPhoto: true, baptismal: true, birthCert: true },
  'Grade 1':    { idPhoto: true, baptismal: true, birthCert: true, eccdChecklist: true },
  'Grade 2':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true },
  'Grade 3':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true },
  'Grade 4':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true },
  'Grade 5':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true },
  'Grade 6':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true },
  'Grade 7':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, incomeTax: true },
  'Grade 8':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 9':    { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 10':   { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 11 — ABM':  { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 11 — STEM': { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 11 — HUMSS':{ idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 12 — ABM':  { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 12 — STEM': { idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
  'Grade 12 — HUMSS':{ idPhoto: true, baptismal: true, birthCert: true, reportCard: true, goodMoral: true, escCert: true },
};

/**
 * Human-readable labels for each document slot.
 */
export const DOC_SLOT_LABELS = {
  birthCert: 'PSA Birth Certificate (original & photocopy)',
  idPhoto: '2x2 ID Photos (2 copies)',
  reportCard: 'Report Card / Form 138',
  goodMoral: 'Certificate of Good Moral Character',
  baptismal: 'Baptismal Certificate',
  eccdChecklist: 'ECCD Checklist',
  incomeTax: 'Latest Income Tax Return / Certificate of Tax Exemption / Municipal Cert. of Unemployment',
  escCert: 'ESC Certificate (if applicable)',
};

/**
 * Allowed file MIME types for document uploads.
 */
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** Max upload file size in bytes (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
