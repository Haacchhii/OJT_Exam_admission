# Data Integrity and Migration Audit — September 4, 2026

## Safety boundary

No production rows were created, changed, or deleted. No backup, restore, seed, `db push`, or
migration-apply command was run. Production inspection could not proceed because this checkout has
no database connection variables available to Prisma.

## Findings

### Release blockers

1. **Migration history is not reproducible.** The first checked-in migration adds a table to an
   already-existing schema. There is no baseline migration and no `migration_lock.toml`. A clean
   database therefore cannot be reconstructed from the repository's migration history.
2. **Backup coverage is incomplete.** `backup-data.js` and `restore-backup.js` omit five current
   models: `QuestionTemplate`, `AdmissionDocumentSubmission`, `NotificationPreference`,
   `NotificationRolePreference`, and `AdmissionComment`.
3. **Backup confidentiality is unspecified.** The user table is exported wholesale, including
   password hashes and active authentication/reset/verification fields, into unencrypted JSON.
   The repository has no verified encryption, restricted storage, retention enforcement, or
   restore-drill evidence.

### Evidence corrections

`DATA_INTEGRITY_VALIDATION_PLAN.md` labels the tooling “production-ready” and claims 100% model
coverage while its required staging tests remain unchecked. Those claims are not supported by the
current code and must not be used as release evidence.

## Checks completed

- Prisma schema validation passes with placeholder connection URLs.
- Fourteen incremental migration directories exist, spanning March 26 through September 2, 2026.
- A read-only `prisma migrate status` attempt stopped before connecting because `DIRECT_URL` was
  unavailable; a secret-safe retry also confirmed that no database URL is available to the shell.
- Existing account audit scripts were not run because they persist names and email addresses to
  local JSON and print account emails to the console.

## Required next actions

1. Obtain an authorized read-only production connection and export `_prisma_migrations` status.
2. Create a baseline only after reconciling that deployed history; never apply a speculative
   baseline to production.
3. Update backup/restore coverage and remove or encrypt authentication secrets.
4. Restore into an isolated non-production database and compare per-table counts and relationships.
5. Replace the prior “READY FOR GA” statement only after the restore drill passes.

## Local remediation added after the audit

- Backup coverage now derives from one manifest and includes every current Prisma model; a schema
  comparison test will fail when a future model is omitted.
- Backup payloads now require `BACKUP_ENCRYPTION_KEY` of at least 32 characters and are encrypted
  with AES-256-GCM using a random salt and IV. Files are requested with owner-only permissions on
  platforms that support POSIX modes.
- Restore accepts only the authenticated encrypted format and includes the five previously omitted
  models in deletion, creation, and sequence-reset ordering.
- This remediation is locally verified only. The release blocker remains until an encrypted backup
  is restored into an isolated non-production database and counts/relationships are compared.
- Restore now requires explicit isolated-target confirmation and rejects production-looking URLs.
  A verifier compares counts and canonical row-content digests for every model. See
  `docs/BACKUP_RESTORE_DRILL_RUNBOOK.md`. Live execution remains blocked on database access.
