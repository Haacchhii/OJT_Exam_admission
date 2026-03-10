import { Router } from 'express';
import * as ctrl from '../controllers/auth.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login',           ctrl.login);
router.post('/register',        ctrl.register);
router.post('/forgot-password',  ctrl.forgotPassword);
router.post('/reset-password',   ctrl.resetPassword);
router.get('/me',               authenticate, ctrl.getMe);

export default router;
