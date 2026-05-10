import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { notificationPreferencesUpdateSchema, notificationRoleDefaultsUpdateSchema, notificationRoleDefaultsQuerySchema } from '../utils/schemas.js';
import * as ctrl from '../controllers/notificationPreferences.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getNotificationPreferences);
router.put('/', validate(notificationPreferencesUpdateSchema), ctrl.updateNotificationPreferences);
router.get('/role-defaults', validateQuery(notificationRoleDefaultsQuerySchema), ctrl.getRoleNotificationDefaults);
router.put('/role-defaults', authorize(ROLES.ADMIN), validate(notificationRoleDefaultsUpdateSchema), ctrl.updateRoleNotificationDefaults);

export default router;
