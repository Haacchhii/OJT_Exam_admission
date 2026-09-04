import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

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
