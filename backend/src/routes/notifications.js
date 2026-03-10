import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import * as ctrl from '../controllers/notifications.js';

const router = Router();
router.use(authenticate);

router.post('/',                      authorize('administrator', 'registrar', 'teacher'), ctrl.createNotification);
router.get('/:userId',               ctrl.getNotifications);
router.get('/:userId/unread-count',  ctrl.getUnreadCount);
router.patch('/:id/read',            ctrl.markRead);
router.patch('/:userId/read-all',    ctrl.markAllRead);

export default router;
