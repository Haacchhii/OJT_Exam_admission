import { VALID_TRANSITIONS } from '../utils/constants.js';
import { generateStudentNumber as defaultGenerateStudentNumber } from '../utils/tracking.js';

export class AdmissionWorkflowError extends Error {
  constructor(message, code, status = 409) {
    super(message);
    this.name = 'AdmissionWorkflowError';
    this.code = code;
    this.status = status;
  }
}

function assertCompleteSelection(admissions, ids) {
  if (admissions.length !== ids.length) {
    throw new AdmissionWorkflowError(
      'One or more selected admissions no longer exist. Refresh the list and try again.',
      'ADMISSION_SET_CHANGED',
    );
  }
}

function assertTransitionAllowed(admission, targetStatus) {
  const allowed = VALID_TRANSITIONS[admission.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new AdmissionWorkflowError(
      `Admission #${admission.id} cannot be moved from "${admission.status}" to "${targetStatus}".`,
      'INVALID_STATUS_TRANSITION',
      400,
    );
  }
}

function assertDocumentsAccepted(admission) {
  if (!admission.documents?.length) {
    throw new AdmissionWorkflowError(
      `Admission #${admission.id} has no submitted documents to review.`,
      'DOCUMENT_REVIEW_INCOMPLETE',
    );
  }
  const unresolved = admission.documents?.filter(document => document.reviewStatus !== 'accepted') || [];
  if (unresolved.length > 0) {
    throw new AdmissionWorkflowError(
      `Admission #${admission.id} has ${unresolved.length} document(s) that are still pending or rejected.`,
      'DOCUMENT_REVIEW_INCOMPLETE',
    );
  }
}

async function lockAdmissions(tx, ids) {
  for (const id of [...ids].sort((a, b) => a - b)) {
    await tx.$queryRaw`SELECT id FROM admissions WHERE id = ${id} FOR UPDATE`;
  }
}

export async function createAdmissionOnce({ db, userId, academicYearId, semesterId, data }) {
  return db.$transaction(async tx => {
    // Serialize submissions per applicant so simultaneous requests cannot both
    // pass the duplicate check before either admission is inserted.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(743921, ${userId})`;

    const existing = await tx.admission.findFirst({
      where: { userId, academicYearId, semesterId, deletedAt: null },
      select: { id: true, trackingId: true, status: true },
    });
    if (existing) {
      throw new AdmissionWorkflowError(
        'You already have an application for the active admission period.',
        'DUPLICATE_ADMISSION',
      );
    }

    return tx.admission.create({
      data,
      include: { documents: true, academicYear: true, semester: true },
    });
  });
}

export async function transitionAdmissions({
  db,
  ids,
  targetStatus,
  notes,
  generateStudentNumber = defaultGenerateStudentNumber,
}) {
  return db.$transaction(async tx => {
    await lockAdmissions(tx, ids);
    const admissions = await tx.admission.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: { documents: true, academicYear: true, semester: true },
    });
    assertCompleteSelection(admissions, ids);

    for (const admission of admissions) {
      assertTransitionAllowed(admission, targetStatus);
      if (targetStatus === 'Accepted') assertDocumentsAccepted(admission);
    }

    const updated = [];
    for (const admission of admissions) {
      if (targetStatus === 'Accepted') {
        const profile = await tx.applicantProfile.findUnique({
          where: { userId: admission.userId },
          select: { studentNumber: true },
        });
        if (!profile?.studentNumber) {
          const studentNumber = await generateStudentNumber(tx);
          await tx.applicantProfile.upsert({
            where: { userId: admission.userId },
            update: { studentNumber },
            create: { userId: admission.userId, studentNumber },
          });
        }
      }

      updated.push(await tx.admission.update({
        where: { id: admission.id },
        data: { status: targetStatus, ...(ids.length === 1 && notes !== undefined ? { notes } : {}) },
        include: { documents: true, academicYear: true, semester: true },
      }));
    }

    return updated;
  });
}

export async function completeEnrollmentHandoff({ db, ids, actorId, completedAt = new Date() }) {
  return db.$transaction(async tx => {
    await lockAdmissions(tx, ids);
    const admissions = await tx.admission.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: { documents: true, academicYear: true, semester: true },
    });
    assertCompleteSelection(admissions, ids);

    for (const admission of admissions) {
      if (admission.status !== 'Accepted') {
        throw new AdmissionWorkflowError(
          `Admission #${admission.id} must be Accepted before enrollment handoff.`,
          'ADMISSION_NOT_ACCEPTED',
          400,
        );
      }
    }

    const updated = [];
    const alreadyCompletedIds = [];
    for (const admission of admissions) {
      if (admission.enrollmentHandoffAt) {
        alreadyCompletedIds.push(admission.id);
        continue;
      }
      updated.push(await tx.admission.update({
        where: { id: admission.id },
        data: { enrollmentHandoffAt: completedAt, enrollmentHandoffById: actorId },
        include: { documents: true, academicYear: true, semester: true },
      }));
    }

    return { updated, updatedIds: updated.map(admission => admission.id), alreadyCompletedIds };
  });
}
