import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { upload } from '../middleware/upload.js';
import { verifyMime } from '../middleware/verifyMime.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createAdmissionSchema, updateStatusSchema, bulkUpdateStatusSchema, bulkDeleteSchema, reviewDocumentSchema, admissionsQuerySchema, admissionsStatsQuerySchema } from '../utils/schemas.js';
import { writeLimiter } from '../middleware/rateLimits.js';
import * as ctrl from '../controllers/admissions.js';
import { previewDocument, extractDocument, getExtractionJobStatus } from '../controllers/documentPreview.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

// Document preview handles its own auth (Authorization header)
router.get('/:id/documents/:docId/preview', previewDocument);

router.use(authenticate);

// Student scoped
router.get('/mine',  ctrl.getMyAdmission);
router.get('/stats', authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), validateQuery(admissionsStatsQuerySchema), ctrl.getStats);
router.get('/dashboard-summary', authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), ctrl.getDashboardSummary);
router.get('/reports-summary', authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), ctrl.getReportsSummary);

// Tracking (search by tracking ID — any authenticated user)
router.get('/track/:trackingId', ctrl.trackApplication);

// CRUD
router.get('/',      authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.TEACHER), validateQuery(admissionsQuerySchema), ctrl.getAdmissions);
router.get('/:id',   authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.APPLICANT), ctrl.getAdmission);  // ownership checked in controller
router.post('/',     authorize(ROLES.APPLICANT), writeLimiter, validate(createAdmissionSchema), ctrl.createAdmission);

// Documents upload — ownership checked in controller
router.post('/:id/documents', authorize(ROLES.ADMIN, ROLES.REGISTRAR, ROLES.APPLICANT), upload.array('documents', 10), verifyMime, ctrl.uploadDocuments);

// Document download — ownership checked in controller
router.get('/:id/documents/:docId/download', ctrl.downloadDocument);

// Document OCR / text extraction — ownership checked in controller
router.post('/:id/documents/:docId/extract', authorize(ROLES.ADMIN, ROLES.REGISTRAR), extractDocument);
router.get('/:id/documents/:docId/extract/:jobId', authorize(ROLES.ADMIN, ROLES.REGISTRAR), getExtractionJobStatus);

// Document review (accept/reject)
router.patch('/:id/documents/:docId/review', authorize(ROLES.ADMIN, ROLES.REGISTRAR), validate(reviewDocumentSchema), ctrl.reviewDocument);

// Bulk operations (MUST come before /:id to avoid param capture)
router.patch('/bulk-status',  authorize(ROLES.ADMIN, ROLES.REGISTRAR), validate(bulkUpdateStatusSchema), ctrl.bulkUpdateStatus);
router.post('/bulk-delete',   authorize(ROLES.ADMIN, ROLES.REGISTRAR), validate(bulkDeleteSchema), ctrl.bulkDeleteAdmissions);
router.patch('/:id/status',  authorize(ROLES.ADMIN, ROLES.REGISTRAR), validate(updateStatusSchema), ctrl.updateStatus);

export default router;
