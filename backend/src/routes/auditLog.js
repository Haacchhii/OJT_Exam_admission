import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validateQuery } from '../middleware/validate.js';
import { auditLogQuerySchema } from '../utils/schemas.js';
import { getAuditLogs } from '../controllers/auditLog.js';

const router = Router();

// Only administrators can view audit logs
router.get('/', authenticate, authorize('administrator'), validateQuery(auditLogQuerySchema), getAuditLogs);

export default router;
