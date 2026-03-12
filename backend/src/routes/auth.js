import { Router } from 'express';
import * as ctrl from '../controllers/auth.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../utils/schemas.js';

const router = Router();

router.post('/login',           validate(loginSchema), ctrl.login);
router.post('/register',        validate(registerSchema), ctrl.register);
router.post('/verify-email',    ctrl.verifyEmail);
router.post('/resend-verification', ctrl.resendVerification);
router.post('/forgot-password',  validate(forgotPasswordSchema), ctrl.forgotPassword);
router.post('/reset-password',   validate(resetPasswordSchema), ctrl.resetPassword);
router.get('/me',               authenticate, ctrl.getMe);
router.patch('/profile',        authenticate, ctrl.updateProfile);

export default router;
