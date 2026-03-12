import nodemailer from 'nodemailer';
import env from '../config/env.js';
import { SCHOOL_NAME } from './constants.js';

const appUrl = env.APP_URL;

// ─── Transporter ──────────────────────────────────────────────────────────────
// If SMTP_HOST is set, use generic SMTP. Otherwise fall back to Gmail service
// (SMTP_USER = gmail address, SMTP_PASS = Google App Password).
// If neither is configured, emails are printed to the console in development
// so the app never crashes while unconfigured.

function createTransporter() {
  if (!env.SMTP_USER && !env.SMTP_HOST) {
    // No email provider configured — return a "preview" transport (console only)
    return null;
  }

  if (env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }

  // Gmail shorthand
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

const transporter = createTransporter();

/**
 * Send an email. Always resolves — never throws — so callers can fire-and-forget.
 * @param {{ to: string, subject: string, html: string }} opts
 */
export async function sendEmail({ to, subject, html }) {
  if (!transporter) {
    if (env.NODE_ENV !== 'production') {
      console.log(`\n[EMAIL — not configured, printing to console]\nTo: ${to}\nSubject: ${subject}\n`);
    }
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${SCHOOL_NAME}" <${env.SMTP_FROM || env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    // Log but don't propagate — email failure must never break the main flow
    console.error('[Email] Failed to send:', err.message);
  }
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function wrap(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { margin:0; padding:0; background:#f4f6f9; font-family:'Helvetica Neue',Arial,sans-serif; }
    .wrapper { max-width:600px; margin:32px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#1a3a2a 0%,#2d5a3d 100%); padding:32px 40px; text-align:center; }
    .header-icon { width:48px; height:48px; background:linear-gradient(135deg,#d4a017,#f0c040); border-radius:12px; display:inline-flex; align-items:center; justify-content:center; margin-bottom:12px; }
    .school-name { color:#f0c040; font-size:20px; font-weight:700; letter-spacing:1px; margin:0; }
    .school-sub { color:rgba(255,255,255,.6); font-size:12px; margin:4px 0 0; }
    .body { padding:36px 40px; }
    .title { font-size:22px; font-weight:700; color:#1a3a2a; margin:0 0 8px; }
    .subtitle { font-size:14px; color:#6b7280; margin:0 0 24px; }
    p { font-size:14px; color:#374151; line-height:1.7; margin:0 0 16px; }
    .highlight-box { background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:16px 20px; margin:20px 0; }
    .highlight-box.warning { background:#fffbeb; border-color:#fcd34d; }
    .highlight-box.danger  { background:#fef2f2; border-color:#fca5a5; }
    .highlight-box.info    { background:#eff6ff; border-color:#93c5fd; }
    .highlight-box strong  { font-size:13px; color:#1a3a2a; display:block; margin-bottom:6px; }
    .highlight-box span    { font-size:14px; color:#374151; }
    .btn { display:inline-block; padding:12px 28px; background:linear-gradient(135deg,#1a3a2a,#2d5a3d); color:#ffffff!important; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600; margin:8px 0 24px; }
    .step { display:flex; align-items:flex-start; gap:12px; margin-bottom:16px; }
    .step-num { width:28px; height:28px; background:#1a3a2a; color:#f0c040; border-radius:50%; font-weight:700; font-size:13px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }
    .badge-green  { background:#dcfce7; color:#166534; }
    .badge-red    { background:#fee2e2; color:#991b1b; }
    .badge-amber  { background:#fef9c3; color:#854d0e; }
    .badge-blue   { background:#dbeafe; color:#1e40af; }
    .divider { border:none; border-top:1px solid #e5e7eb; margin:24px 0; }
    .footer { background:#f9fafb; padding:20px 40px; text-align:center; }
    .footer p { font-size:12px; color:#9ca3af; margin:0; line-height:1.6; }
    .footer a { color:#1a3a2a; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="school-name">&#127775; GOLDEN KEY</div>
      <div class="school-sub">Integrated School of St. Joseph</div>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      <p>This is an automated email from ${SCHOOL_NAME}.<br/>
      Please do not reply to this email. For inquiries, contact the registrar's office.<br/>
      &copy; ${new Date().getFullYear()} ${SCHOOL_NAME}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── 1. Welcome — on registration ─────────────────────────────────────────────
export function sendWelcomeEmail({ to, firstName }) {
  return sendEmail({
    to,
    subject: `Welcome to ${SCHOOL_NAME}!`,
    html: wrap(`
      <h2 class="title">Welcome, ${firstName}! 👋</h2>
      <p class="subtitle">Your account has been created successfully.</p>
      <p>We're excited to have you here. To complete your enrollment journey, here's what to do next:</p>
      <div class="step">
        <span class="step-num">&#10003;</span>
        <div><strong>Create your account</strong><br/><span style="color:#6b7280;font-size:13px;">Done! You're all set.</span></div>
      </div>
      <div class="step">
        <span class="step-num">2</span>
        <div><strong>Book your entrance exam</strong><br/><span style="color:#6b7280;font-size:13px;">Visit the Exam page to choose a schedule and take the entrance exam online.</span></div>
      </div>
      <div class="step">
        <span class="step-num">3</span>
        <div><strong>Submit your admission application</strong><br/><span style="color:#6b7280;font-size:13px;">Once you pass, fill out the admission form and upload the required documents.</span></div>
      </div>
      <a class="btn" href="${appUrl}/#/login">Go to the Portal</a>
      <p style="font-size:13px;color:#9ca3af;">If you didn't create this account, please ignore this email.</p>
    `),
  });
}

// ─── 2. Exam booking confirmation ─────────────────────────────────────────────
export function sendExamBookingEmail({ to, firstName, examTitle, scheduleDate, scheduleTime, trackingId }) {
  return sendEmail({
    to,
    subject: `Exam Booking Confirmed — ${examTitle}`,
    html: wrap(`
      <h2 class="title">Exam Booking Confirmed ✅</h2>
      <p class="subtitle">Your slot has been reserved.</p>
      <p>Hi ${firstName}, your entrance exam slot has been successfully booked. Here are your details:</p>
      <div class="highlight-box info">
        <strong>Exam Details</strong>
        <span><b>Exam:</b> ${examTitle}</span><br/>
        <span><b>Date:</b> ${scheduleDate}</span><br/>
        <span><b>Time:</b> ${scheduleTime}</span><br/>
        <span><b>Booking Reference:</b> ${trackingId}</span>
      </div>
      <p>Please make sure to log in on time. The exam will be available in the <b>Exam</b> section of your student portal.</p>
      <a class="btn" href="${appUrl}/#/student/exam">View My Exam</a>
      <p style="font-size:13px;color:#6b7280;">If you need to cancel or reschedule, please contact the registrar's office before your scheduled date.</p>
    `),
  });
}

// ─── 3. Exam result ───────────────────────────────────────────────────────────
export function sendExamResultEmail({ to, firstName, examTitle, score, maxPossible, percentage, passed }) {
  const badge = passed
    ? '<span class="badge badge-green">PASSED</span>'
    : '<span class="badge badge-red">FAILED</span>';
  const boxClass = passed ? '' : 'danger';
  return sendEmail({
    to,
    subject: `Your Exam Results — ${examTitle}`,
    html: wrap(`
      <h2 class="title">Your Exam Results Are In 📋</h2>
      <p class="subtitle">Here is your performance summary.</p>
      <p>Hi ${firstName}, your entrance exam results for <b>${examTitle}</b> are now available.</p>
      <div class="highlight-box ${boxClass}">
        <strong>Result Summary</strong>
        <span><b>Score:</b> ${score} / ${maxPossible} &nbsp; (${percentage}%)</span><br/>
        <span><b>Outcome:</b> ${badge}</span>
      </div>
      ${passed
        ? `<p>Congratulations! You passed the entrance exam. You can now proceed to submit your <b>Admission Application</b> through the portal.</p>
           <a class="btn" href="${appUrl}/#/student/admission">Submit Admission Application</a>`
        : `<p>Unfortunately, you did not meet the passing score for this exam. Please contact the registrar's office if you have questions about re-examination options.</p>
           <a class="btn" href="${appUrl}/#/student">Go to Portal</a>`
      }
    `),
  });
}

// ─── 4. Admission submitted confirmation ──────────────────────────────────────
export function sendAdmissionSubmittedEmail({ to, firstName, trackingId, gradeLevel }) {
  return sendEmail({
    to,
    subject: `Admission Application Received — Tracking ID: ${trackingId}`,
    html: wrap(`
      <h2 class="title">Admission Application Received 📬</h2>
      <p class="subtitle">We have received your application and will review it shortly.</p>
      <p>Hi ${firstName}, thank you for submitting your admission application for <b>${gradeLevel}</b>. Here is your confirmation:</p>
      <div class="highlight-box info">
        <strong>Application Details</strong>
        <span><b>Tracking ID:</b> ${trackingId}</span><br/>
        <span><b>Grade Level:</b> ${gradeLevel}</span><br/>
        <span><b>Status:</b> <span class="badge badge-amber">Submitted</span></span>
      </div>
      <p>You will receive an email notification as your application progresses through each stage of the review process. You can also check your status anytime in the student portal.</p>
      <a class="btn" href="${appUrl}/#/student">Track My Application</a>
    `),
  });
}

// ─── 5. Admission status update ───────────────────────────────────────────────
const STATUS_CONFIG = {
  'Under Screening': {
    badge: '<span class="badge badge-blue">Under Screening</span>',
    boxClass: 'info',
    heading: 'Application Under Screening 🔎',
    subtitle: 'Your documents are being reviewed.',
    body: 'Our admissions team has started screening your application and submitted documents. We will notify you when the evaluation is complete.',
    cta: null,
  },
  'Under Evaluation': {
    badge: '<span class="badge badge-amber">Under Evaluation</span>',
    boxClass: 'warning',
    heading: 'Application Under Evaluation 📝',
    subtitle: 'Your application is being evaluated.',
    body: 'Your application has passed initial screening and is now being evaluated by our admissions committee. You will be notified of the final decision soon.',
    cta: null,
  },
  'Accepted': {
    badge: '<span class="badge badge-green">Accepted</span>',
    boxClass: '',
    heading: 'Congratulations — Application Accepted! 🎉',
    subtitle: `Welcome to ${SCHOOL_NAME}!`,
    body: 'We are thrilled to inform you that your admission application has been <b>accepted</b>. Please visit the registrar\'s office or contact us to complete the enrollment process.',
    cta: `<a class="btn" href="${appUrl}/#/student">Go to Portal</a>`,
  },
  'Rejected': {
    badge: '<span class="badge badge-red">Not Accepted</span>',
    boxClass: 'danger',
    heading: 'Application Status Update',
    subtitle: 'A decision has been made on your application.',
    body: 'After careful review of your application, we regret to inform you that we are unable to offer you admission at this time. Please contact the registrar\'s office for more information about future opportunities.',
    cta: null,
  },
};

export function sendAdmissionStatusEmail({ to, firstName, trackingId, status, notes }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return Promise.resolve(); // unknown status, skip

  return sendEmail({
    to,
    subject: `Admission Update: ${status} — ${trackingId}`,
    html: wrap(`
      <h2 class="title">${cfg.heading}</h2>
      <p class="subtitle">${cfg.subtitle}</p>
      <p>Hi ${firstName}, your admission application status has been updated.</p>
      <div class="highlight-box ${cfg.boxClass}">
        <strong>Application Update</strong>
        <span><b>Tracking ID:</b> ${trackingId}</span><br/>
        <span><b>New Status:</b> ${cfg.badge}</span>
        ${notes ? `<br/><span><b>Note from Registrar:</b> ${notes}</span>` : ''}
      </div>
      <p>${cfg.body}</p>
      ${cfg.cta || `<a class="btn" href="${appUrl}/#/student">View My Application</a>`}
    `),
  });
}
