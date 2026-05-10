import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createAcademicYearSchema, updateAcademicYearSchema, createSemesterSchema, updateSemesterSchema, semestersQuerySchema } from '../utils/schemas.js';
import { writeLimiter } from '../middleware/rateLimits.js';
import * as ctrl from '../controllers/academicYears.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.use(authenticate);

// Read — all authenticated employees can read
router.get('/',           authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), ctrl.getAcademicYears);
router.get('/active',     authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER, ROLES.APPLICANT), ctrl.getActiveAcademicYear);
router.get('/semesters',  authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), validateQuery(semestersQuerySchema), ctrl.getSemesters);

// Write — administrator only
router.post('/',                    authorize(ROLES.ADMIN), writeLimiter, validate(createAcademicYearSchema), ctrl.createAcademicYear);
router.put('/:id',                  authorize(ROLES.ADMIN), writeLimiter, validate(updateAcademicYearSchema), ctrl.updateAcademicYear);
router.delete('/:id',               authorize(ROLES.ADMIN), writeLimiter, ctrl.deleteAcademicYear);
router.post('/semesters',           authorize(ROLES.ADMIN), writeLimiter, validate(createSemesterSchema), ctrl.createSemester);
router.put('/semesters/:id',        authorize(ROLES.ADMIN), writeLimiter, validate(updateSemesterSchema), ctrl.updateSemester);
router.delete('/semesters/:id',     authorize(ROLES.ADMIN), writeLimiter, ctrl.deleteSemester);

export default router;
