import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import * as ctrl from '../controllers/questionTemplate.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(authenticate);

// Question Templates - CRUD operations for reusable question bank
router.get('/', authorize(ROLES.TEACHER), ctrl.getQuestionTemplates);
router.post('/', authorize(ROLES.TEACHER), ctrl.saveQuestionTemplate);
router.delete('/:templateId', authorize(ROLES.TEACHER), ctrl.deleteQuestionTemplate);

export default router;
