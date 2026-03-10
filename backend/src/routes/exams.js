import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { createExamSchema, createScheduleSchema, bulkDeleteSchema } from '../utils/schemas.js';
import * as ctrl from '../controllers/exams.js';

const router = Router();
router.use(authenticate);

// ─── Schedules (MUST be before /:id to avoid param capture) ───
router.get('/schedules',           ctrl.getSchedules);
router.get('/schedules/available', ctrl.getAvailableSchedules);
router.post('/schedules',          authorize('administrator', 'teacher'), validate(createScheduleSchema), ctrl.createSchedule);
router.put('/schedules/:id',       authorize('administrator', 'teacher'), ctrl.updateSchedule);
router.delete('/schedules/:id',    authorize('administrator', 'teacher'), ctrl.deleteSchedule);

// ─── Registrations (MUST be before /:id to avoid param capture) ───
router.get('/registrations',       authorize('administrator', 'registrar', 'teacher'), ctrl.getRegistrations);
router.get('/registrations/mine',  authorize('applicant'), ctrl.getMyRegistrations);
router.post('/registrations',      authorize('administrator', 'registrar', 'applicant'), ctrl.createRegistration);
router.patch('/registrations/:id/start', authorize('applicant'), ctrl.startExam);

// ─── Exams CRUD ────────────────────────────────────
router.get('/',     ctrl.getExams);
router.post('/bulk-delete', authorize('administrator', 'teacher'), validate(bulkDeleteSchema), ctrl.bulkDeleteExams);
router.get('/:id',  authorize('administrator', 'teacher'), ctrl.getExam);
router.get('/:id/student', authorize('applicant'), ctrl.getExamForStudent);
router.get('/:id/review',  authorize('applicant'), ctrl.getExamForReview);
router.post('/',    authorize('administrator', 'teacher'), validate(createExamSchema), ctrl.createExam);
router.put('/:id',  authorize('administrator', 'teacher'), ctrl.updateExam);
router.delete('/:id', authorize('administrator', 'teacher'), ctrl.deleteExam);

export default router;
