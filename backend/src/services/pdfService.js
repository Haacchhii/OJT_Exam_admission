/**
 * PDF generation service for exam results and admission receipts
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import env from '../config/env.js';

// School branding
const SCHOOL_NAME = 'Golden Key Integrated School of St. Joseph';
const HEADER_COLOR = rgb(0.1, 0.24, 0.16); // Forest green
const ACCENT_COLOR = rgb(0.71, 0.52, 0.05); // Gold
const TEXT_DARK = rgb(0.15, 0.23, 0.32);
const TEXT_LIGHT = rgb(0.52, 0.64, 0.74);
const BORDER_COLOR = rgb(0.9, 0.93, 0.97);

async function createBasePdf() {
  return await PDFDocument.create();
}

function addHeader(page, title, subtitle = '', helveticaBold) {
  const { width, height } = page.getSize();
  const margin = 40;

  // Header background
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width: width,
    height: 80,
    color: HEADER_COLOR,
  });

  // School name
  page.drawText(SCHOOL_NAME, {
    x: margin,
    y: height - 35,
    size: 16,
    color: rgb(1, 1, 1),
    font: helveticaBold,
  });

  // Title
  page.drawText(title, {
    x: margin,
    y: height - 58,
    size: 14,
    color: ACCENT_COLOR,
    font: helveticaBold,
  });

  if (subtitle) {
    page.drawText(subtitle, {
      x: margin,
      y: height - 70,
      size: 10,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  return height - 100;
}

function addFooter(page, pageNum) {
  const { width, height } = page.getSize();
  const footerY = 20;

  page.drawLine({
    start: { x: 40, y: footerY + 10 },
    end: { x: width - 40, y: footerY + 10 },
    color: BORDER_COLOR,
    thickness: 0.5,
  });

  page.drawText(`Page ${pageNum}`, {
    x: width / 2 - 20,
    y: footerY,
    size: 9,
    color: TEXT_LIGHT,
  });

  page.drawText(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }), {
    x: 40,
    y: footerY,
    size: 8,
    color: TEXT_LIGHT,
  });
}

export async function generateExamResultPdf(result, registration, user, exam) {
  const pdf = await createBasePdf();
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage();
  const { width } = page.getSize();
  const margin = 40;

  let y = addHeader(page, 'Exam Result Slip', `${exam.title}`, helveticaBold);
  y -= 20;

  // Student info section
  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: width - 2 * margin,
    height: 60,
    color: rgb(0.97, 0.98, 1),
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  const studentName = `${user.firstName} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName}`;
  page.drawText('Student Information', {
    x: margin + 10,
    y: y - 20,
    size: 11,
    color: HEADER_COLOR,
    font: helveticaBold,
  });

  page.drawText(`Name: ${studentName}`, {
    x: margin + 10,
    y: y - 35,
    size: 10,
    color: TEXT_DARK,
  });

  page.drawText(`Email: ${user.email}`, {
    x: margin + 10,
    y: y - 48,
    size: 10,
    color: TEXT_DARK,
  });

  y -= 90;

  // Score section
  const passed = result.passed ? 'PASSED' : 'FAILED';
  const passColor = result.passed ? rgb(0.09, 0.64, 0.29) : rgb(0.94, 0.28, 0.28);

  page.drawRectangle({
    x: margin,
    y: y - 80,
    width: width - 2 * margin,
    height: 80,
    color: rgb(0.97, 0.98, 1),
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  page.drawText('Exam Score', {
    x: margin + 10,
    y: y - 20,
    size: 11,
    color: HEADER_COLOR,
    font: helveticaBold,
  });

  page.drawText(`Total Score: ${result.totalScore} / ${result.maxPossible}`, {
    x: margin + 10,
    y: y - 35,
    size: 11,
    color: TEXT_DARK,
    font: helveticaBold,
  });

  page.drawText(`Percentage: ${result.percentage.toFixed(2)}%`, {
    x: margin + 10,
    y: y - 50,
    size: 11,
    color: TEXT_DARK,
    font: helveticaBold,
  });

  page.drawText(`Status: ${passed}`, {
    x: margin + 10,
    y: y - 65,
    size: 11,
    color: passColor,
    font: helveticaBold,
  });

  y -= 110;

  // Exam info
  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: width - 2 * margin,
    height: 60,
    color: rgb(0.97, 0.98, 1),
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  page.drawText('Exam Details', {
    x: margin + 10,
    y: y - 20,
    size: 11,
    color: HEADER_COLOR,
    font: helveticaBold,
  });

  page.drawText(`Date Taken: ${new Date(result.createdAt).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' })}`, {
    x: margin + 10,
    y: y - 35,
    size: 10,
    color: TEXT_DARK,
  });

  if (result.essayReviewed) {
    page.drawText('Essay Review: Completed', {
      x: margin + 10,
      y: y - 48,
      size: 10,
      color: TEXT_DARK,
    });
  }

  y -= 90;

  // Footer info
  page.drawText(
    'This is an official exam result slip. Please keep a copy for your records.',
    {
      x: margin,
      y: y,
      size: 9,
      color: TEXT_LIGHT,
    }
  );

  addFooter(page, 1);

  return pdf;
}

export async function generateAdmissionReceiptPdf(admission, user, academicYear, semester) {
  const pdf = await createBasePdf();
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage();
  const { width } = page.getSize();
  const margin = 40;

  let y = addHeader(page, 'Application Receipt', `Status: ${admission.status}`, helveticaBold);
  y -= 20;

  // Tracking info - prominent
  page.drawRectangle({
    x: margin,
    y: y - 50,
    width: width - 2 * margin,
    height: 50,
    color: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
    borderWidth: 2,
  });

  page.drawText('APPLICATION TRACKING ID', {
    x: margin + 10,
    y: y - 25,
    size: 9,
    color: rgb(1, 1, 1),
    font: helveticaBold,
  });

  page.drawText(admission.trackingId || 'N/A', {
    x: margin + 10,
    y: y - 42,
    size: 14,
    color: rgb(1, 1, 1),
    font: helveticaBold,
  });

  y -= 70;

  // Applicant info
  page.drawRectangle({
    x: margin,
    y: y - 80,
    width: width - 2 * margin,
    height: 80,
    color: rgb(0.97, 0.98, 1),
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  const applicantName = `${user.firstName} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName}`;
  page.drawText('Applicant Information', {
    x: margin + 10,
    y: y - 20,
    size: 11,
    color: HEADER_COLOR,
    font: helveticaBold,
  });

  page.drawText(`Name: ${applicantName}`, {
    x: margin + 10,
    y: y - 35,
    size: 10,
    color: TEXT_DARK,
  });

  page.drawText(`Email: ${user.email}`, {
    x: margin + 10,
    y: y - 48,
    size: 10,
    color: TEXT_DARK,
  });

  page.drawText(`Grade Level: ${admission.gradeLevel}`, {
    x: margin + 10,
    y: y - 61,
    size: 10,
    color: TEXT_DARK,
  });

  y -= 110;

  // Application status
  const statusColor =
    admission.status === 'Accepted'
      ? rgb(0.09, 0.64, 0.29)
      : admission.status === 'Rejected'
        ? rgb(0.94, 0.28, 0.28)
        : rgb(0.93, 0.68, 0.12);

  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: width - 2 * margin,
    height: 60,
    color: rgb(0.97, 0.98, 1),
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  page.drawText('Application Status', {
    x: margin + 10,
    y: y - 20,
    size: 11,
    color: HEADER_COLOR,
    font: helveticaBold,
  });

  page.drawText(`Status: ${admission.status}`, {
    x: margin + 10,
    y: y - 35,
    size: 11,
    color: statusColor,
    font: helveticaBold,
  });

  page.drawText(
    `Submitted: ${new Date(admission.submittedAt).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' })}`,
    {
      x: margin + 10,
      y: y - 48,
      size: 10,
      color: TEXT_DARK,
    }
  );

  y -= 90;

  // Application period
  page.drawRectangle({
    x: margin,
    y: y - 50,
    width: width - 2 * margin,
    height: 50,
    color: rgb(0.97, 0.98, 1),
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  page.drawText('Application Period', {
    x: margin + 10,
    y: y - 20,
    size: 11,
    color: HEADER_COLOR,
    font: helveticaBold,
  });

  const yearDisplay = academicYear?.year || 'N/A';
  const semesterDisplay = semester?.semester || 'N/A';
  page.drawText(`Year: ${yearDisplay} | Semester: ${semesterDisplay}`, {
    x: margin + 10,
    y: y - 35,
    size: 10,
    color: TEXT_DARK,
  });

  y -= 70;

  // Footer info
  page.drawText(
    'Please keep this receipt for your records. You can track your application status online using your tracking ID above.',
    {
      x: margin,
      y: y,
      size: 9,
      color: TEXT_LIGHT,
    }
  );

  addFooter(page, 1);

  return pdf;
}

export async function savePdfToBuffer(pdf) {
  return await pdf.save();
}
