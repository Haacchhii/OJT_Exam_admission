import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema, bulkDeleteSchema, usersQuerySchema } from '../utils/schemas.js';
import { writeLimiter } from '../middleware/rateLimits.js';
import * as ctrl from '../controllers/users.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

// All user routes require auth
router.use(authenticate);

router.get('/',              authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), validateQuery(usersQuerySchema), ctrl.getUsers);
router.get('/by-email/:email', authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), ctrl.getUserByEmail);
router.post('/bulk-delete',  authorize(ROLES.ADMIN), validate(bulkDeleteSchema), ctrl.bulkDeleteUsers);
router.get('/:id',          authorize(ROLES.ADMIN), ctrl.getUser);
router.post('/',            authorize(ROLES.ADMIN), writeLimiter, validate(createUserSchema), ctrl.createUser);
router.put('/:id',          authorize(ROLES.ADMIN), writeLimiter, validate(updateUserSchema), ctrl.updateUser);
router.delete('/:id',       authorize(ROLES.ADMIN), writeLimiter, ctrl.deleteUser);

export default router;
