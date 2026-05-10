import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validateQuery } from '../middleware/validate.js';
import { auditLogQuerySchema } from '../utils/schemas.js';
import { getAuditLogs } from '../controllers/auditLog.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

// Warmup ping endpoint — no auth required, returns instantly
router.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Only administrators can view audit logs
router.get('/', authenticate, authorize(ROLES.ADMIN), validateQuery(auditLogQuerySchema), getAuditLogs);

export default router;
