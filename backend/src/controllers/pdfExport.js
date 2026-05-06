/**
 * PDF export controllers for results and admissions
 */

import prisma from '../config/db.js';
import { ROLES } from '../utils/constants.js';
import { generateExamResultPdf, generateAdmissionReceiptPdf, savePdfToBuffer } from '../services/pdfService.js';

export async function exportExamResultPdf(req, res, next) {
  try {
    const { registrationId } = req.params;
    const user = req.user;

    // Get exam result with all necessary details
    const result = await prisma.examResult.findFirst({
      where: { registration: { id: Number(registrationId) } },
      include: {
        registration: {
          include: {
            schedule: {
              include: {
                exam: true,
              },
            },
            user: true,
          },
        },
      },
    });

    if (!result) {
      return res.status(404).json({ error: 'Exam result not found', code: 'NOT_FOUND' });
    }

    // Ownership check: must be the result owner or staff
    const isOwner =
      (user.role === ROLES.APPLICANT &&
        (result.registration.userId === user.id ||
          result.registration.userEmail.toLowerCase() === user.email.toLowerCase())) ||
      [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER].includes(user.role);

    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized to view this result', code: 'FORBIDDEN' });
    }

    // Get user details (fallback to registration email if no userId)
    let studentUser = result.registration.user;
    if (!studentUser && result.registration.userEmail) {
      studentUser = await prisma.user.findUnique({
        where: { email: result.registration.userEmail },
        select: { id: true, firstName: true, middleName: true, lastName: true, email: true },
      });
    }

    if (!studentUser) {
      return res.status(400).json({
        error: 'Student information not found',
        code: 'INVALID_DATA',
      });
    }

    const pdf = await generateExamResultPdf(
      result,
      result.registration,
      studentUser,
      result.registration.schedule.exam
    );

    const pdfBuffer = await savePdfToBuffer(pdf);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="exam-result-${result.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function exportAdmissionReceiptPdf(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;

    // Get admission with all necessary details
    const admission = await prisma.admission.findUnique({
      where: { id: Number(id) },
      include: {
        user: true,
        academicYear: true,
        semester: true,
      },
    });

    if (!admission) {
      return res.status(404).json({ error: 'Admission not found', code: 'NOT_FOUND' });
    }

    // Ownership check: must be the applicant or staff
    const isOwner =
      (user.role === ROLES.APPLICANT && admission.userId === user.id) ||
      [ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER].includes(user.role);

    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized to view this admission', code: 'FORBIDDEN' });
    }

    const pdf = await generateAdmissionReceiptPdf(
      admission,
      admission.user,
      admission.academicYear,
      admission.semester
    );

    const pdfBuffer = await savePdfToBuffer(pdf);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="admission-receipt-${admission.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}
