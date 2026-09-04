import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '../generated/prisma-client/index.js';
import {
  BACKUP_MODELS,
  assertCompleteBackup,
  assertIsolatedRestoreTarget,
  buildRecoveryReport,
  decryptBackup,
} from './backup-support.js';

const prisma = new PrismaClient();

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) throw new Error('Usage: npm run db:verify-restore -- <path-to-backup-json>');

  assertIsolatedRestoreTarget({
    databaseUrl: process.env.DATABASE_URL,
    confirmation: process.env.RESTORE_CONFIRMATION,
  });

  const envelope = JSON.parse(await fs.readFile(path.resolve(process.cwd(), fileArg), 'utf8'));
  const backup = decryptBackup(envelope, process.env.BACKUP_ENCRYPTION_KEY);
  assertCompleteBackup(backup);
  const restoredTables = Object.fromEntries(await Promise.all(BACKUP_MODELS.map(async ({ table, model }) =>
    [table, await prisma[model].findMany({ orderBy: { id: 'asc' } })])));
  const report = buildRecoveryReport(backup.tables, restoredTables);

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Restore verification failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
