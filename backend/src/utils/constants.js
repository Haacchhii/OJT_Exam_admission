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
export const ENROLLMENT_STATUSES = ['Enrolled', 'Dropped', 'Transferred', 'Graduated'];
export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Cancelled', 'Refunded'];

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
