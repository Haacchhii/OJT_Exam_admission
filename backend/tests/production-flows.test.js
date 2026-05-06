import { beforeAll, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';
import env from '../src/config/env.js';
import prisma from '../src/config/db.js';

vi.mock('../src/utils/email.js', () => ({
  sendAdmissionSubmittedEmail: vi.fn().mockResolvedValue({ ok: true }),
  sendAdmissionStatusEmail: vi.fn().mockResolvedValue({ ok: true }),
  sendExamResultEmail: vi.fn().mockResolvedValue({ ok: true }),
  sendWelcomeEmail: vi.fn().mockResolvedValue({ ok: true }),
  sendVerificationEmail: vi.fn().mockResolvedValue({ ok: true }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

function buildAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function authedGet(token, path) {
  return request(app)
    .get(path)
    .set('Authorization', `Bearer ${token}`);
}

async function authedPatch(token, path, body) {
  return request(app)
    .patch(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

async function authedPost(token, path, body) {
  return request(app)
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

function buildExamAnswers(exam) {
  const answers = {};
  for (const question of exam.questions || []) {
    if (question.questionType === 'essay') {
      answers[String(question.id)] = 'Calculus helps model change in science, engineering, and economics.';
      continue;
    }
    if (question.questionType === 'identification') {
      answers[String(question.id)] = question.identificationAnswer || '';
      continue;
    }
    const correctChoice = (question.choices || []).find((choice) => choice.isCorrect);
    if (correctChoice) {
      answers[String(question.id)] = correctChoice.id;
    }
  }
  return answers;
}

describe('production flow hardening', () => {
  let registrarToken;
  let teacherToken;
  let mariaToken;
  let juanToken;
  let acceptedAdmission;
  let doneRegistration;
  let doneStudentEmail;
  let startedRegistration;
  let startedStudentEmail;
  let startedExam;
  let startedEssayAnswer;

  beforeAll(async () => {
    const registrarUser = await prisma.user.findFirst({
      where: { role: 'registrar', deletedAt: null, status: 'Active' },
      select: { id: true, email: true, role: true, status: true, emailVerified: true, mustChangePassword: true, tokenVersion: true },
    });
    expect(registrarUser).toBeTruthy();
    registrarToken = buildAuthToken(registrarUser);

    const teacherUser = await prisma.user.findFirst({
      where: { role: 'teacher', deletedAt: null, status: 'Active' },
      select: { id: true, email: true, role: true, status: true, emailVerified: true, mustChangePassword: true, tokenVersion: true },
    });
    expect(teacherUser).toBeTruthy();
    teacherToken = buildAuthToken(teacherUser);

    doneRegistration = await prisma.examRegistration.findFirst({
      where: { status: 'done' },
      include: {
        user: {
          select: { id: true, role: true, status: true, emailVerified: true, mustChangePassword: true, tokenVersion: true, email: true },
        },
        schedule: {
          include: {
            exam: {
              include: {
                questions: {
                  include: { choices: true },
                  orderBy: { orderNum: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    expect(doneRegistration).toBeTruthy();
    doneStudentEmail = doneRegistration.userEmail;
    mariaToken = buildAuthToken(doneRegistration.user || await prisma.user.findFirst({
      where: { email: doneStudentEmail },
      select: { id: true, email: true, role: true, status: true, emailVerified: true, mustChangePassword: true, tokenVersion: true },
    }));

    startedRegistration = await prisma.examRegistration.findFirst({
      where: { status: 'started' },
      include: {
        user: {
          select: { id: true, role: true, status: true, emailVerified: true, mustChangePassword: true, tokenVersion: true, email: true },
        },
        schedule: {
          include: {
            exam: {
              include: {
                questions: {
                  include: { choices: true },
                  orderBy: { orderNum: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    expect(startedRegistration).toBeTruthy();
    startedStudentEmail = startedRegistration.userEmail;
    juanToken = buildAuthToken(startedRegistration.user || await prisma.user.findFirst({
      where: { email: startedStudentEmail },
      select: { id: true, email: true, role: true, status: true, emailVerified: true, mustChangePassword: true, tokenVersion: true },
    }));
    startedExam = startedRegistration.schedule?.exam;
    expect(startedExam).toBeTruthy();

    const startedApplicant = startedRegistration.user || await prisma.user.findFirst({
      where: { email: startedRegistration.userEmail },
      select: { id: true, email: true, role: true, status: true, emailVerified: true, mustChangePassword: true, tokenVersion: true },
    });
    expect(startedApplicant).toBeTruthy();

    const smokeExam = await prisma.exam.create({
      data: {
        title: `Production Flow Smoke Exam ${Date.now()}`,
        gradeLevel: 'Grade 7',
        durationMinutes: 60,
        passingScore: 50,
        isActive: true,
        createdById: teacherUser.id,
        questions: {
          create: [
            {
              questionText: '2 + 2 = ?',
              questionType: 'mc',
              points: 5,
              orderNum: 1,
              choices: {
                create: [
                  { choiceText: '3', isCorrect: false, orderNum: 1 },
                  { choiceText: '4', isCorrect: true, orderNum: 2 },
                  { choiceText: '5', isCorrect: false, orderNum: 3 },
                  { choiceText: '6', isCorrect: false, orderNum: 4 },
                ],
              },
            },
            {
              questionText: 'Explain why learning matters.',
              questionType: 'essay',
              points: 10,
              orderNum: 2,
            },
          ],
        },
      },
      include: { questions: { include: { choices: true }, orderBy: { orderNum: 'asc' } } },
    });

    const now = Date.now();
    const smokeSchedule = await prisma.examSchedule.create({
      data: {
        examId: smokeExam.id,
        scheduledDate: new Date(now).toISOString().slice(0, 10),
        startTime: '09:00',
        endTime: '10:00',
        examWindowStartAt: new Date(now - 5 * 60 * 1000),
        examWindowEndAt: new Date(now + 60 * 60 * 1000),
        maxSlots: 20,
        slotsTaken: 1,
        venue: 'QA Lab',
      },
    });

    startedRegistration = await prisma.examRegistration.create({
      data: {
        trackingId: `GK-EXM-SMOKE-${Date.now()}`,
        userEmail: startedApplicant.email,
        userId: startedApplicant.id,
        scheduleId: smokeSchedule.id,
        status: 'started',
        startedAt: new Date(now - 10 * 60 * 1000),
      },
      include: {
        user: {
          select: { id: true, email: true, role: true, status: true, emailVerified: true, mustChangePassword: true, tokenVersion: true },
        },
        schedule: {
          include: {
            exam: {
              include: {
                questions: {
                  include: { choices: true },
                  orderBy: { orderNum: 'asc' },
                },
              },
            },
          },
        },
      },
    });
    startedStudentEmail = startedRegistration.userEmail;
    juanToken = buildAuthToken(startedRegistration.user || startedApplicant);
    startedExam = startedRegistration.schedule?.exam;
    expect(startedExam).toBeTruthy();

    acceptedAdmission = await prisma.admission.findFirst({
      where: { status: 'Accepted' },
    });
    expect(acceptedAdmission).toBeTruthy();
  });

  it('loads admissions and rejects invalid status transitions', async () => {
    const listRes = await authedGet(registrarToken, '/api/admissions?page=1&limit=5');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    const updateRes = await authedPatch(
      registrarToken,
      `/api/admissions/${acceptedAdmission.id}/status`,
      { status: 'Submitted' }
    );

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.code).toBe('VALIDATION_ERROR');
    expect(updateRes.body.error).toMatch(/not allowed/i);
  });

  it('submits a started exam and rejects duplicate submissions', async () => {
    const now = Date.now();
    await prisma.examSchedule.update({
      where: { id: startedRegistration.scheduleId },
      data: {
        examWindowStartAt: new Date(now - 5 * 60 * 1000),
        examWindowEndAt: new Date(now + 60 * 60 * 1000),
      },
    });
    await prisma.examRegistration.update({
      where: { id: startedRegistration.id },
      data: {
        startedAt: new Date(now - 10 * 60 * 1000),
        status: 'started',
      },
    });

    const answers = buildExamAnswers(startedExam);

    const submitRes = await authedPost(juanToken, '/api/results/submit', {
      registrationId: startedRegistration.id,
      answers,
    });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.essayReviewed).toBe(false);
    expect(typeof submitRes.body.totalScore).toBe('number');

    const duplicateRes = await authedPost(juanToken, '/api/results/submit', {
      registrationId: startedRegistration.id,
      answers,
    });

    expect(duplicateRes.status).toBe(400);
    expect(duplicateRes.body.code).toBe('VALIDATION_ERROR');
    expect(duplicateRes.body.error).toMatch(/already submitted/i);
  });

  it('scores essays and finalizes the result', async () => {
    startedEssayAnswer = await prisma.essayAnswer.findFirst({
      where: { registrationId: startedRegistration.id },
    });
    expect(startedEssayAnswer).toBeTruthy();

    const scoreRes = await authedPatch(
      teacherToken,
      `/api/results/essays/${startedEssayAnswer.id}/score`,
      { points: startedEssayAnswer.maxPoints, comment: 'Clear and complete.' }
    );

    expect(scoreRes.status).toBe(200);
    expect(scoreRes.body.scored).toBe(true);

    const result = await prisma.examResult.findUnique({
      where: { registrationId: startedRegistration.id },
    });
    expect(result).toBeTruthy();
    expect(result.essayReviewed).toBe(true);
    expect(result.totalScore).toBeGreaterThan(0);
  });

  it('exports PDFs and returns clean errors for missing exports', async () => {
    const pdfRes = await authedGet(mariaToken, `/api/results/${doneRegistration.id}/export-pdf`);
    expect(pdfRes.status).toBe(200);
    expect(String(pdfRes.headers['content-type'] || '')).toContain('application/pdf');

    const missingRes = await authedGet(teacherToken, '/api/results/999999/export-pdf');
    expect(missingRes.status).toBe(404);
    expect(missingRes.body.code).toBe('NOT_FOUND');
    expect(missingRes.body.error).toMatch(/not found/i);
  });
});
