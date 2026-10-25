import { Router } from 'express';
import { visualizerController } from '../controllers/visualizerController.js';
import { authenticate } from '../middleware/auth.js';
import { requireCodeVisualizationEntitlement } from '../middleware/subscriptionAuth.js';

const router = Router();

// Public / Authenticated: Browse and retrieve sample codes
router.get('/samples', visualizerController.getSamples);
router.get('/samples/:sampleId', visualizerController.getSampleById);

// Authenticated: Check visualization entitlement status
router.get('/status', authenticate, visualizerController.getStatus);

// Premium Entitlement Gated: Generate genuine execution trace
router.post(
  '/trace',
  authenticate,
  requireCodeVisualizationEntitlement(),
  visualizerController.generateTrace
);

export default router;
