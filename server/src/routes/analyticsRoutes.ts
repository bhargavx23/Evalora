import { Router } from 'express';
import {
  getStudentAnalytics,
  getBatchAnalytics,
  getQuestionAnalytics,
  getPlatformAnalytics
} from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = Router();

router.get('/student', authenticate, requireRoles('student'), getStudentAnalytics);
router.get('/batch', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), getBatchAnalytics);
router.get('/questions', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), getQuestionAnalytics);
router.get('/platform', authenticate, requireRoles('platform_admin'), getPlatformAnalytics);

export default router;
