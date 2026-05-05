/**
 * Email service for sending notifications
 * TODO: Implement with actual SMTP provider (SendGrid, AWS SES, etc.)
 */

import nodemailer from 'nodemailer';
import { formatManilaDateTime } from '../utils/timezone.js';

// Create a transporter (configure with your email service)
// This is a stub configuration - update with real SMTP settings
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  } : undefined,
});

/**
 * Send schedule closed notification email
 * @param {Object} options
 * @param {string} options.to - Email address(es) to send to
 * @param {string} options.examTitle - Title of the exam
 * @param {string} options.scheduledDate - Date the exam was scheduled for
 * @param {string} options.startTime - Start time of the exam
 * @param {string} options.closedAt - When the schedule was closed
 * @param {string} options.closureReason - 'manual' or 'auto_expired'
 * @param {string} options.closedByName - Name of user who closed it (or 'System')
 * @returns {Promise}
 */
export async function sendScheduleClosedEmail({
  to,
  examTitle,
  scheduledDate,
  startTime,
  closedAt,
  closureReason,
  closedByName,
}) {
  if (!to) {
    console.warn('[emailService] No recipient email provided for schedule closure notification');
    return;
  }

  const reasonText = closureReason === 'auto_expired'
    ? 'the scheduled end date was reached'
    : 'it was manually closed by an administrator';

  const subject = `[GoldenKey] Exam Schedule Closed: ${examTitle}`;
  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #c41e3a; margin-bottom: 20px;">Exam Schedule Closed</h2>
          
          <p style="margin-bottom: 15px;">
            The following exam schedule has been closed:
          </p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Exam:</strong> ${examTitle}</p>
            <p style="margin: 5px 0;"><strong>Scheduled Date:</strong> ${scheduledDate}${startTime ? ` at ${startTime}` : ''}</p>
            <p style="margin: 5px 0;"><strong>Closed At:</strong> ${formatManilaDateTime(closedAt)}</p>
            <p style="margin: 5px 0;"><strong>Closed By:</strong> ${closedByName || 'System'}</p>
            <p style="margin: 5px 0;"><strong>Reason:</strong> This schedule was closed because ${reasonText}.</p>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            Please contact your administrator if you have any questions about this closure.
          </p>
          
          <p style="color: #999; font-size: 11px; margin-top: 10px;">
            This is an automated notification from GoldenKey. Please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Exam Schedule Closed

The following exam schedule has been closed:

Exam: ${examTitle}
Scheduled Date: ${scheduledDate}${startTime ? ` at ${startTime}` : ''}
Closed At: ${formatManilaDateTime(closedAt)}
Closed By: ${closedByName || 'System'}
Reason: This schedule was closed because ${reasonText}.

Please contact your administrator if you have any questions about this closure.
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@goldenkey.com',
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.log('[emailService] Schedule closed email sent:', {
      to,
      examTitle,
      messageId: info.messageId,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[emailService] Failed to send schedule closed email:', {
      to,
      examTitle,
      error: error.message,
    });
    // Don't throw - email failures should not block schedule closure
    return { success: false, error: error.message };
  }
}

/**
 * Send exam submitted notification (placeholder for future use)
 */
export async function sendExamSubmittedEmail({ to, studentName, examTitle }) {
  // TODO: Implement exam submitted notification
  console.log('[emailService] Exam submitted email stub called for:', { to, studentName, examTitle });
}

/**
 * Send admission status changed notification (placeholder for future use)
 */
export async function sendAdmissionStatusChangedEmail({ to, studentName, newStatus }) {
  // TODO: Implement admission status change notification
  console.log('[emailService] Admission status changed email stub called for:', { to, studentName, newStatus });
}

export default {
  sendScheduleClosedEmail,
  sendExamSubmittedEmail,
  sendAdmissionStatusChangedEmail,
};
