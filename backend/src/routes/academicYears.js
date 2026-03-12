import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import * as ctrl from '../controllers/academicYears.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(authenticate);

// Read — all authenticated employees can read
router.get('/',           authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), ctrl.getAcademicYears);
router.get('/active',     authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), ctrl.getActiveAcademicYear);
router.get('/semesters',  authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), ctrl.getSemesters);

// Write — administrator only
router.post('/',                    authorize(ROLES.ADMIN), ctrl.createAcademicYear);
router.put('/:id',                  authorize(ROLES.ADMIN), ctrl.updateAcademicYear);
router.delete('/:id',               authorize(ROLES.ADMIN), ctrl.deleteAcademicYear);
router.post('/semesters',           authorize(ROLES.ADMIN), ctrl.createSemester);
router.put('/semesters/:id',        authorize(ROLES.ADMIN), ctrl.updateSemester);
router.delete('/semesters/:id',     authorize(ROLES.ADMIN), ctrl.deleteSemester);

export default router;
