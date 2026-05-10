import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate, validateParams } from '../middleware/validate.js';
import { questionTemplateSchema, templateIdParamSchema } from '../utils/schemas.js';
import * as ctrl from '../controllers/questionTemplate.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

// Warmup ping endpoint — no auth required, returns instantly
router.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true });
});

router.use(authenticate);

// Question Templates - CRUD operations for reusable question bank
router.get('/', authorize(ROLES.TEACHER), ctrl.getQuestionTemplates);
router.post('/', authorize(ROLES.TEACHER), validate(questionTemplateSchema), ctrl.saveQuestionTemplate);
router.delete('/:templateId', authorize(ROLES.TEACHER), validateParams(templateIdParamSchema), ctrl.deleteQuestionTemplate);

export default router;
