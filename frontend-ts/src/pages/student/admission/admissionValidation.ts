/**
 * Admission form validation helpers — matches patterns used in Login, Users, Register.
 */
import type { AdmissionForm } from './useAdmissionWizard';

export function checkAgeRequirement(gradeLevel: string, dob: string, schoolYear: string): string | null {
  if (!dob || !gradeLevel) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  if (gradeLevel === 'Kinder' || gradeLevel === 'Nursery' || gradeLevel === 'Grade 1') {
    const startYear = parseInt(schoolYear) || 2026;
    const cutoff = new Date(startYear, 9, 31);
    const age = cutoff.getFullYear() - birthDate.getFullYear();
    const monthDiff = cutoff.getMonth() - birthDate.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && cutoff.getDate() < birthDate.getDate()) ? age - 1 : age;
    if (gradeLevel === 'Kinder' && actualAge < 5)
      return `Kindergarten requires the student to be at least 5 years old by October 31, ${startYear}. Student will be ${actualAge} years old by that date.`;
    if (gradeLevel === 'Nursery' && actualAge < 4)
      return `Nursery requires the student to be at least 4 years old by October 31, ${startYear}. Student will be ${actualAge} years old by that date.`;
    if (gradeLevel === 'Grade 1' && actualAge < 6)
      return `Grade 1 requires the student to be at least 6 years old by October 31, ${startYear}. Student will be ${actualAge} years old by that date.`;
  }
  return null;
}

export type AdmissionErrors = Record<string, string>;

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const PHONE_REGEX = /^[+\d][\d\s()-]{6,}$/;
const SCHOOL_YEAR_REGEX = /^\d{4}-\d{4}$/;
/** Letters, spaces, hyphens, apostrophes — for names (incl. Filipino: O'Brien, Dela Cruz) */
const NAME_REGEX = /^[\p{L}\p{M}\s\-'.]+$/u;
/** Letters, numbers, spaces, commas, hyphens, apostrophes, periods — for "Name, Occupation" */
const NAME_OCCUPATION_REGEX = /^[\p{L}\p{M}\p{N}\s\-'.,()]+$/u;
/** Address / place: letters, numbers, spaces, commas, hyphens, periods, slashes */
const ADDRESS_REGEX = /^[\p{L}\p{M}\p{N}\s\-'.,/()]+$/u;

export function validateStep1(form: AdmissionForm): AdmissionErrors {
  const e: AdmissionErrors = {};
  if (!form.firstName?.trim()) e.firstName = 'Required';
  else if (form.firstName.trim().length < 2) e.firstName = 'At least 2 characters';
  else if (!NAME_REGEX.test(form.firstName.trim())) e.firstName = 'Use only letters, spaces, hyphens, or apostrophes';

  if (!form.middleName?.trim()) e.middleName = 'Required';
  else if (form.middleName.trim().length < 2) e.middleName = 'At least 2 characters';
  else if (!NAME_REGEX.test(form.middleName.trim())) e.middleName = 'Use only letters, spaces, hyphens, or apostrophes';

  if (!form.lastName?.trim()) e.lastName = 'Required';
  else if (form.lastName.trim().length < 2) e.lastName = 'At least 2 characters';
  else if (!NAME_REGEX.test(form.lastName.trim())) e.lastName = 'Use only letters, spaces, hyphens, or apostrophes';

  if (!form.email?.trim()) e.email = 'Required';
  else if (!EMAIL_REGEX.test(form.email.trim())) e.email = 'Invalid email format';

  if (!form.dob?.trim()) e.dob = 'Required';

  if (!form.gender?.trim()) e.gender = 'Required';

  if (!form.placeOfBirth?.trim()) e.placeOfBirth = 'Required';
  else if (form.placeOfBirth.trim().length < 2) e.placeOfBirth = 'At least 2 characters (e.g. City, Province)';
  else if (!ADDRESS_REGEX.test(form.placeOfBirth.trim())) e.placeOfBirth = 'Invalid characters';

  if (form.religion?.trim() && form.religion.trim().length > 100) e.religion = 'Max 100 characters';

  if (!form.phone?.trim()) e.phone = 'Required';
  else if (!PHONE_REGEX.test(form.phone.trim())) e.phone = 'Invalid format (e.g. +63 9XX XXX XXXX)';
  else if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'At least 10 digits';

  if (!form.address?.trim()) e.address = 'Required';
  else if (form.address.trim().length < 10) e.address = 'Please provide a complete address (min 10 characters)';
  else if (form.address.length > 500) e.address = 'Max 500 characters';

  return e;
}

export function validateStep2(form: AdmissionForm): AdmissionErrors {
  const e: AdmissionErrors = {};

  if (!form.prevSchool?.trim()) e.prevSchool = 'Required';
  else if (form.prevSchool.trim().length < 2) e.prevSchool = 'At least 2 characters';
  else if (form.prevSchool.length > 200) e.prevSchool = 'Max 200 characters';

  if (!form.schoolAddress?.trim()) e.schoolAddress = 'Required';
  else if (form.schoolAddress.trim().length < 5) e.schoolAddress = 'Please provide a complete address (min 5 characters)';
  else if (form.schoolAddress.length > 500) e.schoolAddress = 'Max 500 characters';

  if (!form.gradeLevel?.trim()) e.gradeLevel = 'Required';

  if (!form.lrn?.trim()) e.lrn = 'Required';
  else {
    const digits = form.lrn.replace(/\D/g, '');
    if (digits.length !== 12) e.lrn = 'LRN must be exactly 12 digits';
    else if (!/^\d{12}$/.test(digits)) e.lrn = 'LRN must be numeric only';
  }

  if (!form.schoolYear?.trim()) e.schoolYear = 'Required';
  else if (!SCHOOL_YEAR_REGEX.test(form.schoolYear.trim())) e.schoolYear = 'Use format YYYY-YYYY (e.g. 2026-2027)';

  if (form.applicantType === 'Continuing' && !form.studentNumber?.trim()) {
    e.studentNumber = 'Required for continuing students';
  }

  const ageWarning = checkAgeRequirement(form.gradeLevel, form.dob, form.schoolYear);
  if (ageWarning) e.gradeLevel = ageWarning;

  return e;
}

export function validateStep3(form: AdmissionForm): AdmissionErrors {
  const e: AdmissionErrors = {};

  if (!form.fatherNameOccupation?.trim()) e.fatherNameOccupation = 'Required';
  else if (form.fatherNameOccupation.trim().length < 3) e.fatherNameOccupation = 'At least 3 characters (e.g. Name, Occupation)';
  else if (!NAME_OCCUPATION_REGEX.test(form.fatherNameOccupation.trim())) e.fatherNameOccupation = 'Use only letters, numbers, spaces, commas, hyphens';
  else if (form.fatherNameOccupation.length > 200) e.fatherNameOccupation = 'Max 200 characters';

  if (!form.motherNameOccupation?.trim()) e.motherNameOccupation = 'Required';
  else if (form.motherNameOccupation.trim().length < 3) e.motherNameOccupation = 'At least 3 characters (e.g. Name, Occupation)';
  else if (!NAME_OCCUPATION_REGEX.test(form.motherNameOccupation.trim())) e.motherNameOccupation = 'Use only letters, numbers, spaces, commas, hyphens';
  else if (form.motherNameOccupation.length > 200) e.motherNameOccupation = 'Max 200 characters';

  if (form.guardian?.trim() && form.guardian.length > 200) e.guardian = 'Max 200 characters';

  return e;
}
