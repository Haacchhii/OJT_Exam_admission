import type { GradeGroup, SelectOption } from '../types';

/**
 * Centralized school information constants.
 */
export const SCHOOL_NAME = 'GOLDEN KEY Integrated School of St. Joseph';
export const SCHOOL_BRAND = 'GOLDEN KEY';
export const SCHOOL_SUBTITLE = 'Integrated School of St. Joseph';
export const SCHOOL_ADDRESS = 'Lapolapo 1st, San Jose, Batangas, Philippines';
export const SCHOOL_PHONE = '(043)-702-2153';
export const SCHOOL_YEAR = String(new Date().getFullYear());
export const SCHOOL_COPYRIGHT = `\u00A9 ${SCHOOL_YEAR} ${SCHOOL_NAME}`;
export const SCHOOL_SYSTEM_TITLE = 'Online Exam & Admission System';

export const GRADE_OPTIONS: GradeGroup[] = [
  { group: 'Preschool', items: ['Nursery', 'Kinder'] },
  { group: 'Grade School', items: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'] },
  { group: 'Junior High School', items: ['Grade 7','Grade 8','Grade 9','Grade 10'] },
  { group: 'Senior High School', items: ['Grade 11 — ABM','Grade 11 — STEM','Grade 11 — HUMSS','Grade 12 — ABM','Grade 12 — STEM','Grade 12 — HUMSS'] },
];

export const ALL_GRADE_LEVELS: string[] = GRADE_OPTIONS.flatMap(g => g.items);

export const EXAM_GRADE_LEVELS: string[] = ['Preschool', 'Grade 1-6', 'Grade 7-10', 'Grade 11-12', 'All Levels'];

export const SEMESTER_NAMES: string[] = ['First Semester', 'Second Semester', 'Summer'];

export const USER_ROLES: string[] = ['administrator', 'registrar', 'teacher', 'applicant'];

export const USER_ROLE_OPTIONS: SelectOption[] = USER_ROLES.map(r => ({
  value: r,
  label: r.charAt(0).toUpperCase() + r.slice(1),
}));

export const ADMISSION_STATUSES: string[] = ['Submitted', 'Under Screening', 'Under Evaluation', 'Accepted', 'Rejected'];

export const ADMISSION_PROGRESS_STEPS: string[] = ['Submitted', 'Under Screening', 'Under Evaluation', 'Accepted'];

export const ADMISSION_IN_PROGRESS: string[] = ['Submitted', 'Under Screening', 'Under Evaluation'];

export const DEFAULT_PAGE_SIZE = 10;

export function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 5 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export const GENDER_OPTIONS: { v: string; l: string }[] = [
  { v: '', l: 'Select sex' },
  { v: 'Male', l: 'Male' },
  { v: 'Female', l: 'Female' },
];

export const GUARDIAN_RELATIONS: { v: string; l: string }[] = [
  { v: '', l: 'Select relationship' },
  { v: 'Mother', l: 'Mother' },
  { v: 'Father', l: 'Father' },
  { v: 'Legal Guardian', l: 'Legal Guardian' },
  { v: 'Grandparent', l: 'Grandparent' },
  { v: 'Sibling', l: 'Sibling' },
  { v: 'Other', l: 'Other' },
];

export const APPLICANT_TYPES: { v: string; l: string }[] = [
  { v: 'New', l: 'New Student' },
  { v: 'Transferee', l: 'Transferee' },
  { v: 'Returning', l: 'Returning Student' },
  { v: 'Continuing', l: 'Continuing Student (Current Enrollee)' },
];

interface DocRequirement {
  idPhoto?: boolean;
  baptismal?: boolean;
  birthCert?: boolean;
  eccdChecklist?: boolean;
  reportCard?: boolean;
  goodMoral?: boolean;
  incomeTax?: boolean;
  escCert?: boolean;
}

export const DOC_REQUIREMENTS: Record<string, DocRequirement> = {
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

export const DOC_SLOT_LABELS: Record<string, string> = {
  birthCert: 'PSA Birth Certificate (original & photocopy)',
  idPhoto: '2x2 ID Photos (2 copies)',
  reportCard: 'Report Card / Form 138',
  goodMoral: 'Certificate of Good Moral Character',
  baptismal: 'Baptismal Certificate',
  eccdChecklist: 'ECCD Checklist',
  incomeTax: 'Latest Income Tax Return / Certificate of Tax Exemption / Municipal Cert. of Unemployment',
  escCert: 'ESC Certificate (if applicable)',
};

export const ALLOWED_FILE_TYPES: string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
