import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import * as ctrl from '../controllers/academicYears.js';

const router = Router();
router.use(authenticate);

// Read — all authenticated employees can read
router.get('/',           authorize('administrator', 'registrar', 'teacher'), ctrl.getAcademicYears);
router.get('/active',     authorize('administrator', 'registrar', 'teacher'), ctrl.getActiveAcademicYear);
router.get('/semesters',  authorize('administrator', 'registrar', 'teacher'), ctrl.getSemesters);

// Write — administrator only
router.post('/',                    authorize('administrator'), ctrl.createAcademicYear);
router.put('/:id',                  authorize('administrator'), ctrl.updateAcademicYear);
router.delete('/:id',               authorize('administrator'), ctrl.deleteAcademicYear);
router.post('/semesters',           authorize('administrator'), ctrl.createSemester);
router.put('/semesters/:id',        authorize('administrator'), ctrl.updateSemester);
router.delete('/semesters/:id',     authorize('administrator'), ctrl.deleteSemester);

export default router;
