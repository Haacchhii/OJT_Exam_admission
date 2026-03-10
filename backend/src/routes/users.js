import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import * as ctrl from '../controllers/users.js';

const router = Router();

// All user routes require auth
router.use(authenticate);

router.get('/',              authorize('administrator', 'registrar', 'teacher'), ctrl.getUsers);
router.get('/by-email/:email', authorize('administrator', 'registrar', 'teacher'), ctrl.getUserByEmail);
router.get('/:id',          authorize('administrator'), ctrl.getUser);
router.post('/',            authorize('administrator'), ctrl.createUser);
router.put('/:id',          authorize('administrator'), ctrl.updateUser);
router.delete('/:id',       authorize('administrator'), ctrl.deleteUser);

export default router;
