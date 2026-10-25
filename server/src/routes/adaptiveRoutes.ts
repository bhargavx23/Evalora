import { Router } from 'express';
import {
  getAdaptiveRecommendations,
  getAdaptiveProfile,
  updateAdaptivePreferences,
  startAdaptiveSession,
  getSchedulerJobHistory,
  triggerSchedulerJob
} from '../controllers/adaptiveController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = Router();

// Student Adaptive Recommendations & Profile
router.get('/recommendations', authenticate, getAdaptiveRecommendations);
router.get('/profile', authenticate, getAdaptiveProfile);
router.put('/preferences', authenticate, updateAdaptivePreferences);
router.post('/start-session', authenticate, startAdaptiveSession);

// 48-Hour Scheduler Visibility & Admin Trigger
router.get('/jobs', authenticate, getSchedulerJobHistory);
router.post(
  '/trigger-job',
  authenticate,
  requireRoles('platform_admin', 'college_admin', 'admin', 'student'),
  triggerSchedulerJob
);

export default router;
