import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import * as ctrl from '../controllers/notificationPreferences.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getNotificationPreferences);
router.put('/', ctrl.updateNotificationPreferences);
router.get('/role-defaults', ctrl.getRoleNotificationDefaults);
router.put('/role-defaults', authorize(ROLES.ADMIN), ctrl.updateRoleNotificationDefaults);

export default router;
