import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '../generated/prisma-client/index.js';
import { BACKUP_MODELS, encryptBackup } from './backup-support.js';

const prisma = new PrismaClient();

function timestamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}-${hh}${mm}${ss}`;
}

async function main() {
  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
  const root = process.cwd();
  const outDir = path.join(root, 'backups');
  await fs.mkdir(outDir, { recursive: true });

  const data = {
    meta: {
      createdAt: new Date().toISOString(),
      source: 'golden-key-backend',
      version: '2',
    },
    tables: Object.fromEntries(await Promise.all(BACKUP_MODELS.map(async ({ table, model }) =>
      [table, await prisma[model].findMany({ orderBy: { id: 'asc' } })]))),
  };

  const filePath = path.join(outDir, `backup-${timestamp()}.json`);
  await fs.writeFile(filePath, JSON.stringify(encryptBackup(data, encryptionKey)), { encoding: 'utf8', mode: 0o600 });

  console.log(`✅ Backup complete: ${filePath}`);
}

main()
  .catch((e) => {
    console.error('Backup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
