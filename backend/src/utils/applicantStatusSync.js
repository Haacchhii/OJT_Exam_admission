import prisma from '../config/db.js';
import { ROLES } from './constants.js';
import { toManilaIsoDay } from './timezone.js';

function toIsoDay(value) {
  return toManilaIsoDay(value);
}

function isWithinPeriod(day, start, end) {
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

export async function isApplicantPeriodOpen(referenceDate = new Date()) {
  // Cast restored PostgreSQL timestamps to text at the database boundary.
  // Some restored deployments expose Prisma DateTime values as opaque objects,
  // which serialize as `{}` and cannot be compared as calendar days.
  const [activeSemester] = await prisma.$queryRaw`
    SELECT
      s.start_date::date::text AS "startDate",
      s.end_date::date::text AS "endDate"
    FROM semesters s
    INNER JOIN academic_years ay ON ay.id = s.academic_year_id
    WHERE s.is_active = true
      AND ay.is_active = true
    ORDER BY s.id ASC
    LIMIT 1
  `;
  if (!activeSemester) return false;

  const today = toIsoDay(referenceDate);
  const semStart = toIsoDay(activeSemester.startDate);
  const semEnd = toIsoDay(activeSemester.endDate);
  if (!today) return false;
  return isWithinPeriod(today, semStart, semEnd);
}

export async function syncApplicantUserStatusById(userId, referenceDate = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.role !== ROLES.APPLICANT) {
    return { changed: false, status: user?.status ?? null };
  }

  const shouldBeActive = await isApplicantPeriodOpen(referenceDate);
  const targetStatus = shouldBeActive ? 'Active' : 'Inactive';
  if (user.status === targetStatus) {
    return { changed: false, status: user.status };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { status: targetStatus },
  });

  return { changed: true, status: targetStatus };
}

export async function syncAllApplicantStatuses(referenceDate = new Date()) {
  const shouldBeActive = await isApplicantPeriodOpen(referenceDate);
  const targetStatus = shouldBeActive ? 'Active' : 'Inactive';

  const result = await prisma.user.updateMany({
    where: {
      role: ROLES.APPLICANT,
      deletedAt: null,
      status: { not: targetStatus },
    },
    data: { status: targetStatus },
  });

  return {
    changedCount: result.count,
    status: targetStatus,
  };
}
