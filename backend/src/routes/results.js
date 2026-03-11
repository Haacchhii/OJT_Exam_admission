import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { resultsQuerySchema, essaysQuerySchema, scoreEssaySchema } from '../utils/schemas.js';
import * as ctrl from '../controllers/results.js';

const router = Router();
router.use(authenticate);

// Student scoped
router.get('/mine', authorize('applicant'), ctrl.getMyResult);

// Essay review
router.get('/essays',             authorize('administrator', 'registrar', 'teacher'), validateQuery(essaysQuerySchema), ctrl.getEssayAnswers);
router.patch('/essays/:id/score', authorize('administrator', 'teacher'), validate(scoreEssaySchema), ctrl.scoreEssay);

// Submit exam answers (graded server-side)
router.post('/submit', authorize('applicant'), ctrl.submitExam);

// General
router.get('/',                       authorize('administrator', 'registrar', 'teacher'), validateQuery(resultsQuerySchema), ctrl.getResults);
router.get('/answers/:registrationId', authorize('administrator', 'registrar', 'teacher', 'applicant'), ctrl.getSubmittedAnswers);
router.get('/:registrationId',       authorize('administrator', 'registrar', 'teacher', 'applicant'), ctrl.getResult);

export default router;
