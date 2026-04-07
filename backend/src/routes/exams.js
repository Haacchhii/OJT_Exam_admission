import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createExamSchema, updateExamSchema, createScheduleSchema, updateScheduleSchema, bulkDeleteSchema, saveDraftSchema, examsQuerySchema, schedulesQuerySchema, registrationsQuerySchema, createRegistrationSchema, examReadinessQuerySchema } from '../utils/schemas.js';
import * as ctrl from '../controllers/exams.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(authenticate);

// ─── Schedules (MUST be before /:id to avoid param capture) ───
router.get('/schedules',           validateQuery(schedulesQuerySchema), ctrl.getSchedules);
router.get('/schedules/available', ctrl.getAvailableSchedules);
router.post('/schedules/notice',   authorize(ROLES.APPLICANT), ctrl.notifyNoSchedule);
router.post('/schedules',          authorize(ROLES.ADMIN, ROLES.TEACHER), validate(createScheduleSchema), ctrl.createSchedule);
router.put('/schedules/:id',       authorize(ROLES.ADMIN, ROLES.TEACHER), validate(updateScheduleSchema), ctrl.updateSchedule);
router.delete('/schedules/:id',    authorize(ROLES.ADMIN, ROLES.TEACHER), ctrl.deleteSchedule);

// ─── Registrations (MUST be before /:id to avoid param capture) ───
router.get('/registrations',       authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), validateQuery(registrationsQuerySchema), ctrl.getRegistrations);
router.get('/readiness',           authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), validateQuery(examReadinessQuerySchema), ctrl.getReadiness);
router.get('/registrations/mine-summary', authorize(ROLES.APPLICANT), ctrl.getMyRegistrationSummary);
router.get('/registrations/mine',  authorize(ROLES.APPLICANT), ctrl.getMyRegistrations);
router.post('/registrations',      authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.APPLICANT), validate(createRegistrationSchema), ctrl.createRegistration);
router.patch('/registrations/:id/start', authorize(ROLES.APPLICANT), ctrl.startExam);
router.patch('/registrations/:id/save-draft', authorize(ROLES.APPLICANT), validate(saveDraftSchema), ctrl.saveDraftAnswers);
router.delete('/registrations/:id', authorize(ROLES.APPLICANT), ctrl.cancelRegistration);

// ─── Exams CRUD ────────────────────────────────────
router.get('/',     validateQuery(examsQuerySchema), ctrl.getExams);
router.post('/bulk-delete', authorize(ROLES.ADMIN, ROLES.TEACHER), validate(bulkDeleteSchema), ctrl.bulkDeleteExams);
router.post('/:id/clone',  authorize(ROLES.ADMIN, ROLES.TEACHER), ctrl.cloneExam);
router.get('/:id',  authorize(ROLES.ADMIN, ROLES.TEACHER, ROLES.REGISTRAR), ctrl.getExam);
router.get('/:id/student', authorize(ROLES.APPLICANT), ctrl.getExamForStudent);
router.get('/:id/review',  authorize(ROLES.APPLICANT), ctrl.getExamForReview);
router.post('/',    authorize(ROLES.ADMIN, ROLES.TEACHER), validate(createExamSchema), ctrl.createExam);
router.put('/:id',  authorize(ROLES.ADMIN, ROLES.TEACHER), validate(updateExamSchema), ctrl.updateExam);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.TEACHER), ctrl.deleteExam);

export default router;
