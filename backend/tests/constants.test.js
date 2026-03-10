import { describe, it, expect } from 'vitest';
import { VALID_TRANSITIONS, ROLES, EMPLOYEE_ROLES, ALLOWED_MIME_TYPES } from '../src/utils/constants.js';

describe('VALID_TRANSITIONS', () => {
  it('Submitted can go to Under Screening or Rejected', () => {
    expect(VALID_TRANSITIONS['Submitted']).toEqual(['Under Screening', 'Rejected']);
  });

  it('Under Screening can go to Under Evaluation or Rejected', () => {
    expect(VALID_TRANSITIONS['Under Screening']).toEqual(['Under Evaluation', 'Rejected']);
  });

  it('Under Evaluation can go to Accepted or Rejected', () => {
    expect(VALID_TRANSITIONS['Under Evaluation']).toEqual(['Accepted', 'Rejected']);
  });

  it('Accepted cannot transition further', () => {
    expect(VALID_TRANSITIONS['Accepted']).toEqual([]);
  });

  it('Rejected can go back to Submitted', () => {
    expect(VALID_TRANSITIONS['Rejected']).toEqual(['Submitted']);
  });

  it('does not allow Submitted to jump to Accepted', () => {
    expect(VALID_TRANSITIONS['Submitted']).not.toContain('Accepted');
  });
});

describe('ROLES', () => {
  it('defines all four roles', () => {
    expect(ROLES).toEqual({
      ADMIN: 'administrator',
      REGISTRAR: 'registrar',
      TEACHER: 'teacher',
      APPLICANT: 'applicant',
    });
  });
});

describe('EMPLOYEE_ROLES', () => {
  it('includes admin, teacher, registrar but not applicant', () => {
    expect(EMPLOYEE_ROLES).toContain('administrator');
    expect(EMPLOYEE_ROLES).toContain('teacher');
    expect(EMPLOYEE_ROLES).toContain('registrar');
    expect(EMPLOYEE_ROLES).not.toContain('applicant');
  });
});

describe('ALLOWED_MIME_TYPES', () => {
  it('includes PDF', () => {
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
  });

  it('includes common image types', () => {
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES).toContain('image/png');
  });

  it('does not include executable types', () => {
    expect(ALLOWED_MIME_TYPES).not.toContain('application/x-executable');
    expect(ALLOWED_MIME_TYPES).not.toContain('application/javascript');
  });
});
