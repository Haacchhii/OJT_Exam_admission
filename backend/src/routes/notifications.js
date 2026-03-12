import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createNotificationSchema, notificationsQuerySchema } from '../utils/schemas.js';
import { writeLimiter } from '../middleware/rateLimits.js';
import * as ctrl from '../controllers/notifications.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(authenticate);

router.post('/',                      authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), writeLimiter, validate(createNotificationSchema), ctrl.createNotification);
router.get('/:userId',               validateQuery(notificationsQuerySchema), ctrl.getNotifications);
router.get('/:userId/unread-count',  ctrl.getUnreadCount);
router.patch('/:id/read',            ctrl.markRead);
router.patch('/:userId/read-all',    ctrl.markAllRead);

export default router;
