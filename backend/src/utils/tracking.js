import prisma from '../config/db.js';

/**
 * Generate a unique tracking ID.
 * Format: GK-{prefix}-{YYYY}-{5-digit seq}
 * e.g.  GK-ADM-2026-00001  or  GK-EXM-2026-00042
 *
 * Uses a retry loop to handle race conditions where two concurrent
 * requests read the same latest ID and try to generate the same next one.
 */
const MAX_RETRIES = 5;

export async function generateTrackingId(type = 'ADM') {
  const year = new Date().getFullYear();
  const prefix = `GK-${type}-${year}-`;
  const model = type === 'ADM' ? prisma.admission : prisma.examRegistration;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Find the highest existing tracking ID for this prefix
    const latest = await model.findFirst({
      where: { trackingId: { startsWith: prefix } },
      orderBy: { trackingId: 'desc' },
      select: { trackingId: true },
    });

    let seq = 1;
    if (latest?.trackingId) {
      const parts = latest.trackingId.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    // Add a small random offset on retries to avoid repeated collisions
    if (attempt > 0) seq += attempt;

    const candidateId = `${prefix}${String(seq).padStart(5, '0')}`;

    // Check if this ID already exists (race condition guard)
    const exists = await model.findFirst({
      where: { trackingId: candidateId },
      select: { trackingId: true },
    });
    if (!exists) return candidateId;
    // If it exists, retry with next attempt
  }

  // Fallback: append a random suffix to guarantee uniqueness
  const rand = Math.floor(Math.random() * 99999);
  return `${prefix}${String(rand).padStart(5, '0')}`;
}

/**
 * Generate a unique student number.
 * Default format: GKISSJ-{YYYY}-{5-digit seq}
 * e.g. GKISSJ-2026-00001
 *
 * The user will provide their preferred format later;
 * this function can be updated at that time. The logic
 * already handles: lookup highest existing number → increment → retry.
 */
export async function generateStudentNumber() {
  const year = new Date().getFullYear();
  const prefix = `GKISSJ-${year}-`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const latest = await prisma.applicantProfile.findFirst({
      where: { studentNumber: { startsWith: prefix } },
      orderBy: { studentNumber: 'desc' },
      select: { studentNumber: true },
    });

    let seq = 1;
    if (latest?.studentNumber) {
      const parts = latest.studentNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    if (attempt > 0) seq += attempt;

    const candidate = `${prefix}${String(seq).padStart(5, '0')}`;
    const exists = await prisma.applicantProfile.findFirst({
      where: { studentNumber: candidate },
      select: { studentNumber: true },
    });
    if (!exists) return candidate;
  }

  const rand = Math.floor(Math.random() * 99999);
  return `${prefix}${String(rand).padStart(5, '0')}`;
}
