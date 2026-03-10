// Valid admission status transitions
export const VALID_TRANSITIONS = {
  'Submitted':        ['Under Screening', 'Rejected'],
  'Under Screening':  ['Under Evaluation', 'Rejected'],
  'Under Evaluation': ['Accepted', 'Rejected'],
  'Rejected':         ['Submitted'],
  'Accepted':         [],
};

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
