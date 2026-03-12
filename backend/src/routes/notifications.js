import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createNotificationSchema, notificationsQuerySchema } from '../utils/schemas.js';
import { writeLimiter } from '../middleware/rateLimits.js';
import * as ctrl from '../controllers/notifications.js';
import { ROLES } from '../utils/constants.js';
import { addClient } from '../utils/sse.js';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import prisma from '../config/db.js';

const router = Router();

// SSE stream — MUST be before authenticate middleware because EventSource
// cannot set Authorization headers; token is passed via query param instead.
router.get('/stream', async (req, res) => {
  // Try Authorization header first (normal requests), then query param (EventSource)
  let user = null;
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : req.query.token;
  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      const found = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (found && found.status === 'Active') {
        const { passwordHash, ...safeUser } = found;
        user = safeUser;
      }
    } catch { /* invalid token */ }
  }
  if (!user) return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  addClient(user.id, res);
});

// All other routes require standard Bearer token auth
router.use(authenticate);

router.post('/',                      authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), writeLimiter, validate(createNotificationSchema), ctrl.createNotification);
router.get('/:userId',               validateQuery(notificationsQuerySchema), ctrl.getNotifications);
router.get('/:userId/unread-count',  ctrl.getUnreadCount);
router.patch('/:id/read',            ctrl.markRead);
router.patch('/:userId/read-all',    ctrl.markAllRead);

export default router;
