// Valid admission status transitions
export const VALID_TRANSITIONS = {
  'Submitted':        ['Under Screening', 'Rejected'],
  'Under Screening':  ['Under Evaluation', 'Rejected'],
  'Under Evaluation': ['Accepted', 'Rejected'],
  'Rejected':         ['Submitted'],
  'Accepted':         [],
};

// All valid status values (for validation)
export const ADMISSION_STATUSES = Object.keys(VALID_TRANSITIONS);
export const EXAM_REG_STATUSES = ['scheduled', 'started', 'done'];
export const USER_STATUSES = ['Active', 'Inactive'];

export const ROLES = {
  ADMIN:     'administrator',
  REGISTRAR: 'registrar',
  TEACHER:   'teacher',
  APPLICANT: 'applicant',
};

/** Roles that count as "employees" (non-applicant). */
export const EMPLOYEE_ROLES = [ROLES.ADMIN, ROLES.TEACHER, ROLES.REGISTRAR];

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// ─── Rate limit configuration ─────────────────────────
export const RATE_LIMITS = {
  GLOBAL:      { windowMs: 15 * 60 * 1000, max: 300  },
  AUTH:        { windowMs: 15 * 60 * 1000, max: 20   },
  UPLOAD:      { windowMs: 60 * 60 * 1000, max: 30   },
  EXAM_SUBMIT: { windowMs: 60 * 60 * 1000, max: 10   },
  RESULT_SUBMIT:{ windowMs: 60 * 60 * 1000, max: 10  },
  PERF_INGEST: { windowMs: 60 * 1000,      max: 120  },
  BULK:        { windowMs: 15 * 60 * 1000, max: 10   },
  WRITE:       { windowMs: 15 * 60 * 1000, max: 30   },
};

// ─── Misc server constants ────────────────────────────
export const BODY_SIZE_LIMIT        = '1mb';
export const BCRYPT_ROUNDS          = 12;
export const RESET_TOKEN_EXPIRY     = '15m';
export const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
export const CACHE_DEFAULT_TTL_MS   = 5 * 60 * 1000;
export const EXAM_GRACE_MINUTES     = 1;
export const DOC_CACHE_MAX_AGE      = 300;
export const MAX_KV_PAIRS           = 20;
export const MAX_BULK_OPERATIONS    = 100;
export const DEFAULT_PAGE_SIZE      = 10;
export const MAX_PAGE_SIZE          = 100;
export const SCHOOL_NAME            = 'Golden Key Integrated School of St. Joseph';

// Map specific student grade levels to exact exam grade-level targets
export const GRADE_TO_EXAM_LEVEL = {
  'Nursery':          'Nursery',
  'Kinder':           'Kinder',
  'Grade 1':          'Grade 1',
  'Grade 2':          'Grade 2',
  'Grade 3':          'Grade 3',
  'Grade 4':          'Grade 4',
  'Grade 5':          'Grade 5',
  'Grade 6':          'Grade 6',
  'Grade 7':          'Grade 7',
  'Grade 8':          'Grade 8',
  'Grade 9':          'Grade 9',
  'Grade 10':         'Grade 10',
  'Grade 11 — ABM':   'Grade 11 — ABM',
  'Grade 11 — STEM':  'Grade 11 — STEM',
  'Grade 11 — HUMSS': 'Grade 11 — HUMSS',
  'Grade 12 — ABM':   'Grade 12 — ABM',
  'Grade 12 — STEM':  'Grade 12 — STEM',
  'Grade 12 — HUMSS': 'Grade 12 — HUMSS',
};

// Temporary compatibility map for old grouped exams already in existing databases.
export const GRADE_TO_LEGACY_EXAM_LEVEL = {
  'Nursery':          'Preschool',
  'Kinder':           'Preschool',
  'Grade 1':          'Grade 1-6',
  'Grade 2':          'Grade 1-6',
  'Grade 3':          'Grade 1-6',
  'Grade 4':          'Grade 1-6',
  'Grade 5':          'Grade 1-6',
  'Grade 6':          'Grade 1-6',
  'Grade 7':          'Grade 7-10',
  'Grade 8':          'Grade 7-10',
  'Grade 9':          'Grade 7-10',
  'Grade 10':         'Grade 7-10',
  'Grade 11 — ABM':   'Grade 11-12',
  'Grade 11 — STEM':  'Grade 11-12',
  'Grade 11 — HUMSS': 'Grade 11-12',
  'Grade 12 — ABM':   'Grade 11-12',
  'Grade 12 — STEM':  'Grade 11-12',
  'Grade 12 — HUMSS': 'Grade 11-12',
};

export const GRADE_OPTIONS = [
  { group: 'Preschool', items: ['Nursery', 'Kinder'] },
  { group: 'Grade School', items: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'] },
  { group: 'Junior High School', items: ['Grade 7','Grade 8','Grade 9','Grade 10'] },
  { group: 'Senior High School', items: ['Grade 11 — ABM','Grade 11 — STEM','Grade 11 — HUMSS','Grade 12 — ABM','Grade 12 — STEM','Grade 12 — HUMSS'] }
];

export function getLevelGroup(grade) {
  const stage = GRADE_OPTIONS.find(g => g.items.includes(grade));
  return stage ? stage.group : null;
}
