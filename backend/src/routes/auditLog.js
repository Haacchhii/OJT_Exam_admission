import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { getAuditLogs } from '../controllers/auditLog.js';

const router = Router();

// Only administrators can view audit logs
router.get('/', authenticate, authorize('administrator'), getAuditLogs);

export default router;
