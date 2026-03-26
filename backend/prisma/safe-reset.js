import { execSync } from 'child_process';

const unlock = process.env.ALLOW_DB_RESET;
const expected = 'YES_I_UNDERSTAND_DELETE_ALL';

if (unlock !== expected) {
  console.error('❌ Refusing to reset database.');
  console.error('Set ALLOW_DB_RESET=YES_I_UNDERSTAND_DELETE_ALL to continue.');
  process.exit(1);
}

console.warn('⚠️  Database reset unlocked. Running prisma migrate reset --force ...');
execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
