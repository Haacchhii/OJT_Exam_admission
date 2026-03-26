import prisma from '../config/db.js';
import { ROLES } from './constants.js';

function toIsoDay(value) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWithinPeriod(day, start, end) {
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

export async function isApplicantPeriodOpen(referenceDate = new Date()) {
  const activeYear = await prisma.academicYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!activeYear) return false;

  const activeSemester = await prisma.semester.findFirst({
    where: { academicYearId: activeYear.id, isActive: true },
    orderBy: { id: 'asc' },
    select: { startDate: true, endDate: true },
  });
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