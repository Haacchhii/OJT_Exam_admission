import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema, bulkDeleteSchema } from '../utils/schemas.js';
import * as ctrl from '../controllers/users.js';

const router = Router();

// All user routes require auth
router.use(authenticate);

router.get('/',              authorize('administrator', 'registrar', 'teacher'), ctrl.getUsers);
router.get('/by-email/:email', authorize('administrator', 'registrar', 'teacher'), ctrl.getUserByEmail);
router.post('/bulk-delete',  authorize('administrator'), validate(bulkDeleteSchema), ctrl.bulkDeleteUsers);
router.get('/:id',          authorize('administrator'), ctrl.getUser);
router.post('/',            authorize('administrator'), validate(createUserSchema), ctrl.createUser);
router.put('/:id',          authorize('administrator'), validate(updateUserSchema), ctrl.updateUser);
router.delete('/:id',       authorize('administrator'), ctrl.deleteUser);

export default router;
