import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { resultsQuerySchema, essaysQuerySchema, scoreEssaySchema } from '../utils/schemas.js';
import * as ctrl from '../controllers/results.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(authenticate);

// Student scoped
router.get('/mine', authorize(ROLES.APPLICANT), ctrl.getMyResult);

// Essay review
router.get('/essays',             authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), validateQuery(essaysQuerySchema), ctrl.getEssayAnswers);
router.patch('/essays/:id/score', authorize(ROLES.ADMIN, ROLES.TEACHER), validate(scoreEssaySchema), ctrl.scoreEssay);

// Submit exam answers (graded server-side)
router.post('/submit', authorize(ROLES.APPLICANT), ctrl.submitExam);

// General
router.get('/',                       authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), validateQuery(resultsQuerySchema), ctrl.getResults);
router.get('/employee-summary',      authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), ctrl.getEmployeeSummary);
router.get('/analytics/:examId',      authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), ctrl.getQuestionAnalytics);
router.get('/answers/:registrationId', authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER, ROLES.APPLICANT), ctrl.getSubmittedAnswers);
router.get('/:registrationId',       authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER, ROLES.APPLICANT), ctrl.getResult);

export default router;
