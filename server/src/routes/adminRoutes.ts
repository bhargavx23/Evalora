import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import {
  getAdminOverview,
  getAdminUsers,
  getAdminUserDetail,
  updateAdminUserStatus,
  deleteAdminUser,
  getAdminOrganizations,
  toggleAdminOrganizationStatus,
  deleteAdminOrganization,
  getAdminQuestions,
  createAdminQuestion,
  updateAdminQuestion,
  deleteAdminQuestion,
  getAdminPracticeConfig,
  getAdminAssessments,
  toggleAdminAssessmentStatus,
  getAdminPayments,
  getAdminAuditLogs
} from '../controllers/adminController.js';
import {
  getAdminPlans,
  createAdminPlan,
  updateAdminPlan,
  toggleAdminPlanStatus
} from '../controllers/paymentController.js';

const router = Router();

// All admin routes strictly enforce authentication and administrator privileges server-side
router.use(authenticate, requireAdmin);

// Overview metrics
router.get('/overview', getAdminOverview);

// User Management
router.get('/users', getAdminUsers);
router.get('/users/:id', getAdminUserDetail);
router.patch('/users/:id/status', updateAdminUserStatus);
router.delete('/users/:id', deleteAdminUser);

// Organization Management
router.get('/organizations', getAdminOrganizations);
router.patch('/organizations/:id/status', toggleAdminOrganizationStatus);
router.delete('/organizations/:id', deleteAdminOrganization);

// Question Bank Management
router.get('/questions', getAdminQuestions);
router.post('/questions', createAdminQuestion);
router.put('/questions/:id', updateAdminQuestion);
router.delete('/questions/:id', deleteAdminQuestion);

// Practice Engine Controls
router.get('/practice/config', getAdminPracticeConfig);

// Assessment Management
router.get('/assessments', getAdminAssessments);
router.patch('/assessments/:id/status', toggleAdminAssessmentStatus);

// Payments & Blockchain Inspection
router.get('/payments', getAdminPayments);

// Premium Plan Management (strictly < 9 ALGO)
router.get('/plans', getAdminPlans);
router.post('/plans', createAdminPlan);
router.put('/plans/:id', updateAdminPlan);
router.patch('/plans/:id/status', toggleAdminPlanStatus);

// Audit Trail
router.get('/audit-logs', getAdminAuditLogs);

export default router;
