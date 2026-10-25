import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  getPaymentPlans,
  createPaymentIntent,
  verifyPayment,
  getPaymentHistory,
  getPaymentById,
  getPaymentReceiptData,
  downloadPaymentReceiptPdf,
  getUserSubscriptionStatus,
  getAdminTransactions,
  getAdminPlans,
  createAdminPlan,
  updateAdminPlan,
  toggleAdminPlanStatus
} from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = Router();

const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment requests. Please try again shortly.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Public / authenticated plan information
router.get('/plans', getPaymentPlans);

// Authenticated student/user payment flows & subscription status
router.get('/subscription/status', authenticate, getUserSubscriptionStatus);
router.post('/create-intent', authenticate, paymentRateLimiter, createPaymentIntent);
router.post('/verify', authenticate, paymentRateLimiter, verifyPayment);
router.get('/history', authenticate, getPaymentHistory);

// Admin plan management (platform_admin, college_admin)
router.get(
  '/admin/plans',
  authenticate,
  requireRoles('platform_admin', 'college_admin'),
  getAdminPlans
);
router.post(
  '/admin/plans',
  authenticate,
  requireRoles('platform_admin', 'college_admin'),
  createAdminPlan
);
router.put(
  '/admin/plans/:id',
  authenticate,
  requireRoles('platform_admin', 'college_admin'),
  updateAdminPlan
);
router.patch(
  '/admin/plans/:id/status',
  authenticate,
  requireRoles('platform_admin', 'college_admin'),
  toggleAdminPlanStatus
);

// Admin transaction inspection
router.get(
  '/admin/transactions',
  authenticate,
  requireRoles('platform_admin', 'college_admin'),
  getAdminTransactions
);

// Payment Receipt access & PDF download
router.get('/receipt/:id', authenticate, getPaymentReceiptData);
router.get('/receipt/:id/pdf', authenticate, downloadPaymentReceiptPdf);

// Single payment / intent lookup (owner or admin)
router.get('/:id', authenticate, getPaymentById);

export default router;
