import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

export const BACKUP_MODELS = [
  ['users', 'user'], ['applicantProfiles', 'applicantProfile'], ['staffProfiles', 'staffProfile'],
  ['academicYears', 'academicYear'], ['semesters', 'semester'], ['questionTemplates', 'questionTemplate'],
  ['admissions', 'admission'], ['admissionDocuments', 'admissionDocument'],
  ['admissionDocumentSubmissions', 'admissionDocumentSubmission'], ['admissionComments', 'admissionComment'],
  ['exams', 'exam'], ['examQuestions', 'examQuestion'], ['questionChoices', 'questionChoice'],
  ['examSchedules', 'examSchedule'], ['examRegistrations', 'examRegistration'],
  ['submittedAnswers', 'submittedAnswer'], ['essayAnswers', 'essayAnswer'], ['examResults', 'examResult'],
  ['notificationPreferences', 'notificationPreference'],
  ['notificationRolePreferences', 'notificationRolePreference'], ['auditLogs', 'auditLog'],
].map(([table, model]) => ({ table, model }));

const ISOLATED_RESTORE_CONFIRMATION = 'RESTORE_ISOLATED_NON_PRODUCTION';

export function assertIsolatedRestoreTarget({ databaseUrl, confirmation }) {
  if (confirmation !== ISOLATED_RESTORE_CONFIRMATION) {
    throw new Error(`Restore confirmation must equal ${ISOLATED_RESTORE_CONFIRMATION}`);
  }

  let target;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
  }

  const targetIdentity = `${target.hostname}/${target.pathname}`.toLowerCase();
  if (/\b(prod|production|live)\b/.test(targetIdentity.replace(/[_-]/g, ' '))) {
    throw new Error('Restore target appears to be a production database');
  }

  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(target.hostname);
  const hasIsolationMarker = /\b(test|testing|stage|staging|preview|drill|sandbox|isolated)\b/
    .test(targetIdentity.replace(/[_-]/g, ' '));
  if (!isLocal && !hasIsolationMarker) {
    throw new Error('Restore target must be local or visibly marked as non-production');
  }
}

function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function tableDigest(rows) {
  const normalized = rows.map(canonicalize)
    .map((row) => JSON.stringify(row))
    .sort();
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function buildRecoveryReport(expectedTables, restoredTables) {
  const tables = Object.fromEntries(Object.keys(expectedTables).sort().map((table) => {
    const expected = Array.isArray(expectedTables[table]) ? expectedTables[table] : [];
    const restored = Array.isArray(restoredTables[table]) ? restoredTables[table] : [];
    const expectedDigest = tableDigest(expected);
    const restoredDigest = tableDigest(restored);
    return [table, {
      expectedCount: expected.length,
      restoredCount: restored.length,
      countMatches: expected.length === restored.length,
      contentMatches: expectedDigest === restoredDigest,
      expectedDigest,
      restoredDigest,
    }];
  }));
  return { ok: Object.values(tables).every((table) => table.countMatches && table.contentMatches), tables };
}

export function assertCompleteBackup(backup) {
  if (!backup?.tables || typeof backup.tables !== 'object') {
    throw new Error('Invalid backup file: missing tables object');
  }
  const missing = BACKUP_MODELS
    .map(({ table }) => table)
    .filter((table) => !Array.isArray(backup.tables[table]));
  if (missing.length > 0) {
    throw new Error(`Invalid backup file: missing table data for ${missing.join(', ')}`);
  }
}

function assertKey(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 32) {
    throw new Error('BACKUP_ENCRYPTION_KEY must contain at least 32 characters');
  }
}

export function encryptBackup(value, passphrase) {
  assertKey(passphrase);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    format: 'golden-key-backup', version: 2, algorithm: 'aes-256-gcm',
    salt: salt.toString('base64'), iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64'),
  };
}

export function decryptBackup(envelope, passphrase) {
  assertKey(passphrase);
  if (envelope?.format !== 'golden-key-backup' || envelope?.version !== 2) {
    throw new Error('Unsupported or unencrypted backup format');
  }
  const key = scryptSync(passphrase, Buffer.from(envelope.salt, 'base64'), 32);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const cleartext = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final(),
  ]).toString('utf8');
  return JSON.parse(cleartext);
}
