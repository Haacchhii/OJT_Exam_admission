# Encrypted Backup and Restore Drill Runbook

## Safety boundary

Run restore commands only against a disposable local, test, staging, preview, sandbox, drill, or
isolated PostgreSQL database. The restore command rejects production-looking targets and requires
`RESTORE_CONFIRMATION=RESTORE_ISOLATED_NON_PRODUCTION` before it can delete any rows.

Never point `DATABASE_URL` or `DIRECT_URL` at production during restore and verification.

## Prerequisites

- An authorized source connection for the backup.
- A separate empty non-production PostgreSQL database visibly identified as non-production.
- A secret `BACKUP_ENCRYPTION_KEY` containing at least 32 characters.
- Backend dependencies installed and Prisma Client generated.

## Procedure

1. With the authorized source connection active, create the encrypted backup: `npm run db:backup`.
2. Disconnect the source credentials. Point both database URLs at the isolated target and initialize
   that disposable database with `npx prisma db push`.
3. Set `RESTORE_CONFIRMATION=RESTORE_ISOLATED_NON_PRODUCTION`, then run
   `npm run db:restore -- backups/backup-YYYYMMDD-HHMMSS.json`.
4. Run `npm run db:verify-restore -- backups/backup-YYYYMMDD-HHMMSS.json`.
5. Save the verifier's secret-free JSON output as release evidence.

## Pass criteria

- Restore succeeds against the isolated target.
- Verification exits successfully with `"ok": true`.
- Every table has matching counts and content digests.
- No production write or destructive command occurred.

## Current execution status

The guarded restore and verifier are ready. The live drill remains blocked on an isolated
PostgreSQL target and authorized source connection; neither is available in the current shell.
