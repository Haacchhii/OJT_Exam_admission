import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/tracking.js', () => ({ generateStudentNumber: vi.fn() }));

import { completeEnrollmentHandoff, transitionAdmissions } from '../src/services/admissionWorkflow.js';

function fakeDb(admissions) {
  const rows = new Map(admissions.map(admission => [admission.id, structuredClone(admission)]));
  const profiles = new Map();
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    admission: {
      findMany: vi.fn(async ({ where }) => (where.id.in || []).map(id => rows.get(id)).filter(Boolean)),
      findUnique: vi.fn(async ({ where }) => rows.get(where.id) || null),
      update: vi.fn(async ({ where, data }) => {
        const updated = { ...rows.get(where.id), ...data };
        rows.set(where.id, updated);
        return updated;
      }),
    },
    applicantProfile: {
      findUnique: vi.fn(async ({ where }) => profiles.get(where.userId) || null),
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async ({ where, update, create }) => {
        const profile = profiles.has(where.userId)
          ? { ...profiles.get(where.userId), ...update }
          : create;
        profiles.set(where.userId, profile);
        return profile;
      }),
    },
  };
  return {
    rows,
    profiles,
    tx,
    db: { $transaction: vi.fn(callback => callback(tx)) },
  };
}

const readyAdmission = {
  id: 11,
  userId: 21,
  status: 'Under Evaluation',
  deletedAt: null,
  enrollmentHandoffAt: null,
  documents: [{ id: 1, reviewStatus: 'accepted' }],
};

describe('admission workflow integrity', () => {
  it('rejects acceptance while any document is not accepted', async () => {
    const fixture = fakeDb([{ ...readyAdmission, documents: [{ id: 1, reviewStatus: 'pending' }] }]);

    await expect(transitionAdmissions({
      db: fixture.db,
      ids: [11],
      targetStatus: 'Accepted',
      generateStudentNumber: vi.fn(),
    })).rejects.toMatchObject({ code: 'DOCUMENT_REVIEW_INCOMPLETE', status: 409 });

    expect(fixture.tx.admission.update).not.toHaveBeenCalled();
  });

  it('rejects acceptance when no documents were submitted', async () => {
    const fixture = fakeDb([{ ...readyAdmission, documents: [] }]);

    await expect(transitionAdmissions({
      db: fixture.db,
      ids: [11],
      targetStatus: 'Accepted',
      generateStudentNumber: vi.fn(),
    })).rejects.toMatchObject({ code: 'DOCUMENT_REVIEW_INCOMPLETE', status: 409 });
  });

  it('makes acceptance and student-number assignment one transaction', async () => {
    const fixture = fakeDb([readyAdmission]);

    const updated = await transitionAdmissions({
      db: fixture.db,
      ids: [11],
      targetStatus: 'Accepted',
      generateStudentNumber: vi.fn().mockResolvedValue('GKISSJ-2026-00001'),
    });

    expect(updated).toHaveLength(1);
    expect(fixture.rows.get(11).status).toBe('Accepted');
    expect(fixture.profiles.get(21).studentNumber).toBe('GKISSJ-2026-00001');
  });

  it('rolls back acceptance when student-number generation fails', async () => {
    const fixture = fakeDb([readyAdmission]);
    fixture.db.$transaction = vi.fn(async callback => {
      const original = structuredClone(fixture.rows.get(11));
      try {
        return await callback(fixture.tx);
      } catch (error) {
        fixture.rows.set(11, original);
        throw error;
      }
    });

    await expect(transitionAdmissions({
      db: fixture.db,
      ids: [11],
      targetStatus: 'Accepted',
      generateStudentNumber: vi.fn().mockRejectedValue(new Error('number unavailable')),
    })).rejects.toThrow('number unavailable');

    expect(fixture.rows.get(11).status).toBe('Under Evaluation');
  });

  it('rejects a bulk request when any requested admission is missing', async () => {
    const fixture = fakeDb([readyAdmission]);

    await expect(transitionAdmissions({
      db: fixture.db,
      ids: [11, 999],
      targetStatus: 'Accepted',
      generateStudentNumber: vi.fn(),
    })).rejects.toMatchObject({ code: 'ADMISSION_SET_CHANGED', status: 409 });
  });

  it('records handoff once and treats retries as an idempotent no-op', async () => {
    const fixture = fakeDb([{ ...readyAdmission, status: 'Accepted' }]);
    const completedAt = new Date('2026-08-31T10:00:00.000Z');

    const first = await completeEnrollmentHandoff({ db: fixture.db, ids: [11], actorId: 5, completedAt });
    const second = await completeEnrollmentHandoff({ db: fixture.db, ids: [11], actorId: 7, completedAt: new Date('2026-09-01T10:00:00.000Z') });

    expect(first.updatedIds).toEqual([11]);
    expect(second.updatedIds).toEqual([]);
    expect(second.alreadyCompletedIds).toEqual([11]);
    expect(fixture.rows.get(11).enrollmentHandoffAt).toEqual(completedAt);
    expect(fixture.rows.get(11).enrollmentHandoffById).toBe(5);
  });
});
