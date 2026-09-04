import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BACKUP_MODELS,
  assertIsolatedRestoreTarget,
  decryptBackup,
  encryptBackup,
} from '../prisma/backup-support.js';

describe('backup safety', () => {
  it('covers every current Prisma model', () => {
    const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
    const schemaModels = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)]
      .map(([, name]) => `${name[0].toLowerCase()}${name.slice(1)}`)
      .sort();
    expect(BACKUP_MODELS.map(({ model }) => model).sort()).toEqual(schemaModels);
  });

  it('encrypts backup content and rejects the wrong key', () => {
    const source = { tables: { users: [{ email: 'private@example.test' }] } };
    const encrypted = encryptBackup(source, 'a sufficiently long backup encryption key');

    expect(JSON.stringify(encrypted)).not.toContain('private@example.test');
    expect(decryptBackup(encrypted, 'a sufficiently long backup encryption key')).toEqual(source);
    expect(() => decryptBackup(encrypted, 'another sufficiently long encryption key')).toThrow();
  });

  it('refuses destructive restore without an explicit isolated non-production target', () => {
    expect(() => assertIsolatedRestoreTarget({
      databaseUrl: 'postgresql://user:pass@db.example.test/golden_key_production',
      confirmation: 'RESTORE_ISOLATED_NON_PRODUCTION',
    })).toThrow(/production/i);

    expect(() => assertIsolatedRestoreTarget({
      databaseUrl: 'postgresql://user:pass@localhost:5432/golden_key_restore_drill',
    })).toThrow(/confirmation/i);

    expect(() => assertIsolatedRestoreTarget({
      databaseUrl: 'postgresql://user:pass@localhost:5432/golden_key_restore_drill',
      confirmation: 'RESTORE_ISOLATED_NON_PRODUCTION',
    })).not.toThrow();
  });
});
