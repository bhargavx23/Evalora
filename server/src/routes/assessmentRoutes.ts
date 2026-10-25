import { Router } from 'express';
import {
  getAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  publishAssessment,
  startAttempt,
  autosaveAnswer,
  recordIntegrityEvent,
  submitAttempt,
  getAssessmentAttempts,
  getLiveMonitoring,
  getSimilarityReport
} from '../controllers/assessmentController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = Router();

// List and detail
router.get('/', authenticate, getAssessments);
router.get('/:id', authenticate, getAssessmentById);

// Faculty creation and management
router.post('/', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), createAssessment);
router.put('/:id', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), updateAssessment);
router.post('/:id/publish', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), publishAssessment);

// Student test-taking
router.post('/:id/start', authenticate, requireRoles('student'), startAttempt);
router.post('/:id/autosave', authenticate, requireRoles('student'), autosaveAnswer);
router.post('/:id/integrity-event', authenticate, requireRoles('student'), recordIntegrityEvent);
router.post('/:id/submit', authenticate, requireRoles('student'), submitAttempt);

// Faculty monitoring & grading
router.get('/:id/attempts', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), getAssessmentAttempts);
router.get('/:id/live-monitor', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), getLiveMonitoring);
router.get('/:id/similarity', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), getSimilarityReport);

export default router;
