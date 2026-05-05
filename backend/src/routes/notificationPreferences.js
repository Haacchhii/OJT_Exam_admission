import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/notificationPreferences.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getNotificationPreferences);
router.put('/', ctrl.updateNotificationPreferences);

export default router;
