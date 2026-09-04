import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BACKUP_MODELS, decryptBackup, encryptBackup } from '../prisma/backup-support.js';

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
});
