import { Router } from 'express';
import {
  getDomains,
  getDomainBySlug,
  getDomainProgress,
  startDomainPractice,
  submitDomainPractice,
  runDomainCode,
  evaluateDomainCode,
  submitDomainProject,
  submitDomainAssessment,
  getTopicContent,
  submitTopicExercise,
  getModuleAssignment,
  submitModuleAssignment,
  saveDomainWorkspace,
  getDomainWorkspace,
  getAdminDomains,
  createAdminDomain,
  updateAdminDomain,
  toggleAdminDomainStatus,
  getWorkspaceDatasets,
  getWorkspaceSchema
} from '../controllers/domainController.js';
import { handleVisualizeCode } from '../controllers/codeVisualizerController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireDomainSubscription, requireCodeVisualizationEntitlement } from '../middleware/subscriptionAuth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = Router();

// 1. Domain Exploration (Public or Authenticated with subscription badge)
router.get('/', optionalAuthenticate, getDomains);

// 2. Admin Domain Management
router.get(
  '/admin/all',
  authenticate,
  requireRoles('platform_admin', 'college_admin'),
  getAdminDomains
);
router.post(
  '/admin/create',
  authenticate,
  requireRoles('platform_admin', 'college_admin'),
  createAdminDomain
);
router.put(
  '/admin/:slug',
  authenticate,
  requireRoles('platform_admin', 'college_admin'),
  updateAdminDomain
);
router.patch(
  '/admin/:slug/status',
  authenticate,
  requireRoles('platform_admin', 'college_admin'),
  toggleAdminDomainStatus
);

// 3. Subscription-Gated Student Domain Endpoints
router.get(
  '/:slug',
  authenticate,
  requireDomainSubscription(),
  getDomainBySlug
);

router.get(
  '/:slug/progress',
  authenticate,
  requireDomainSubscription(),
  getDomainProgress
);

// 4. Topic Lessons & Hands-On Exercises
router.get(
  '/:slug/modules/:moduleId/topics/:topic/content',
  authenticate,
  requireDomainSubscription(),
  getTopicContent
);

router.post(
  '/:slug/modules/:moduleId/topics/:topic/exercises/:exerciseId/submit',
  authenticate,
  requireDomainSubscription(),
  submitTopicExercise
);

// 5. Mandatory Module Assignment & Pass-to-Unlock
router.get(
  '/:slug/modules/:moduleId/assignment',
  authenticate,
  requireDomainSubscription(),
  getModuleAssignment
);

router.post(
  '/:slug/modules/:moduleId/assignment/submit',
  authenticate,
  requireDomainSubscription(),
  submitModuleAssignment
);

// 6. Persistent Coding Workspaces
router.post(
  '/:slug/workspace/save',
  authenticate,
  requireDomainSubscription(),
  saveDomainWorkspace
);

router.get(
  '/:slug/workspace/:workspaceKey',
  authenticate,
  requireDomainSubscription(),
  getDomainWorkspace
);

router.get(
  '/:slug/datasets',
  authenticate,
  requireDomainSubscription(),
  getWorkspaceDatasets
);

router.get(
  '/:slug/schema',
  authenticate,
  requireDomainSubscription(),
  getWorkspaceSchema
);

// 7. Practice Sessions & Sandbox Execution
router.post(
  '/:slug/practice/start',
  authenticate,
  requireDomainSubscription(),
  startDomainPractice
);

router.post(
  '/:slug/practice/:sessionId/submit',
  authenticate,
  requireDomainSubscription(),
  submitDomainPractice
);

router.post(
  '/:slug/coding/run',
  authenticate,
  requireDomainSubscription(),
  runDomainCode
);

router.post(
  '/:slug/coding/evaluate',
  authenticate,
  requireDomainSubscription(),
  evaluateDomainCode
);

router.post(
  '/:slug/projects/:projectId/submit',
  authenticate,
  requireDomainSubscription(),
  submitDomainProject
);

router.post(
  '/:slug/assessments/:assessmentId/submit',
  authenticate,
  requireDomainSubscription(),
  submitDomainAssessment
);

// 8. Premium Step-by-Step Code Visualization
router.post(
  '/:slug/visualize',
  authenticate,
  requireCodeVisualizationEntitlement(),
  handleVisualizeCode
);

router.post(
  '/visualize',
  authenticate,
  requireCodeVisualizationEntitlement(),
  handleVisualizeCode
);

export default router;
