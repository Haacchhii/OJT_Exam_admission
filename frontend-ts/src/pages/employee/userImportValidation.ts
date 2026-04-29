import { USER_ROLE_OPTIONS } from '../../utils/constants';
import type { ValidatedUserRow } from './UserImportPreviewModal';

const validRoles = USER_ROLE_OPTIONS.map(r => r.value).filter(Boolean);
const validStatuses = ['Active', 'Inactive'];

/**
 * Validates a single user row for import
 * Returns errors if any validation fails
 */
export function validateUserRow(
  row: Record<string, any>,
  index: number,
  options?: { checkDuplicateEmails?: Set<string> }
): ValidatedUserRow {
  const errors: string[] = [];
  const firstName = String(row.firstName || '').trim();
  const middleName = String(row.middleName || '').trim();
  const lastName = String(row.lastName || '').trim();
  const email = String(row.email || '').trim();
  const role = String(row.role || '').trim();
  const status = String(row.status || '').trim();
  const password = String(row.password || '').trim();

  // Validate required fields
  if (!firstName) errors.push('First name is required');
  if (!middleName) errors.push('Middle name is required');
  if (!lastName) errors.push('Last name is required');
  if (!email) errors.push('Email is required');

  // Validate email format
  if (email && !/\S+@\S+\.\S+/.test(email)) {
    errors.push('Invalid email format');
  }

  // Check for duplicate emails (within same batch)
  if (email && options?.checkDuplicateEmails?.has(email)) {
    errors.push('Duplicate email in this import');
  }

  // Validate role
  if (role && !validRoles.includes(role)) {
    errors.push(`Invalid role "${role}". Must be: ${validRoles.join(', ')}`);
  }

  // Validate status
  if (status && !validStatuses.includes(status)) {
    errors.push(`Invalid status "${status}". Must be: ${validStatuses.join(', ')}`);
  }

  // Validate password strength (if provided)
  if (password) {
    const passwordErrors = validatePasswordStrength(password);
    if (passwordErrors.length > 0) {
      errors.push(...passwordErrors);
    }
  }

  const data = {
    firstName,
    middleName,
    lastName,
    email,
    role: role || 'applicant',
    status: status || 'Active',
    password: password || undefined,
  };

  return {
    index,
    data,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates password strength
 */
function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must include lowercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must include number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must include special character');
  }

  return errors;
}

/**
 * Validates all rows in a batch
 */
export function validateUserBatch(rows: Record<string, any>[]): ValidatedUserRow[] {
  const emailSet = new Set<string>();
  const validated: ValidatedUserRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = validateUserRow(row, i, { checkDuplicateEmails: emailSet });

    // Add email to set if valid (case-insensitive)
    if (result.data.email) {
      emailSet.add(result.data.email.toLowerCase());
    }

    validated.push(result);
  }

  return validated;
}
