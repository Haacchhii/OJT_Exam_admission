import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { upload } from '../middleware/upload.js';
import { verifyMime } from '../middleware/verifyMime.js';
import { validate } from '../middleware/validate.js';
import { createAdmissionSchema, updateStatusSchema, bulkUpdateStatusSchema, bulkDeleteSchema } from '../utils/schemas.js';
import * as ctrl from '../controllers/admissions.js';

const router = Router();
router.use(authenticate);

// Student scoped
router.get('/mine',  ctrl.getMyAdmission);
router.get('/stats', authorize('administrator', 'registrar', 'teacher'), ctrl.getStats);

// Tracking (search by tracking ID — any authenticated user)
router.get('/track/:trackingId', ctrl.trackApplication);

// CRUD
router.get('/',      authorize('administrator', 'registrar', 'teacher'), ctrl.getAdmissions);
router.get('/:id',   authorize('administrator', 'registrar', 'applicant'), ctrl.getAdmission);  // ownership checked in controller
router.post('/',     authorize('applicant'), validate(createAdmissionSchema), ctrl.createAdmission);

// Documents upload — ownership checked in controller
router.post('/:id/documents', authorize('administrator', 'registrar', 'applicant'), upload.array('documents', 10), verifyMime, ctrl.uploadDocuments);

// Bulk operations (MUST come before /:id to avoid param capture)
router.patch('/bulk-status',  authorize('administrator', 'registrar'), validate(bulkUpdateStatusSchema), ctrl.bulkUpdateStatus);
router.post('/bulk-delete',   authorize('administrator', 'registrar'), validate(bulkDeleteSchema), ctrl.bulkDeleteAdmissions);
router.patch('/:id/status',  authorize('administrator', 'registrar'), validate(updateStatusSchema), ctrl.updateStatus);

export default router;
