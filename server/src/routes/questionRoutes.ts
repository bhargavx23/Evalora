import { Router } from 'express';
import {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  generateAIQuestions,
  getAIGenerationMetrics,
  approveQuestion
} from '../controllers/questionController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = Router();

router.get('/', authenticate, getQuestions);
router.get('/ai-metrics', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), getAIGenerationMetrics);
router.get('/:id', authenticate, getQuestionById);

// Faculty & Admin only
router.post('/', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), createQuestion);
router.put('/:id', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), updateQuestion);
router.delete('/:id', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), deleteQuestion);
router.post('/ai-generate', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), generateAIQuestions);
router.post('/:id/approve', authenticate, requireRoles('faculty', 'college_admin', 'platform_admin'), approveQuestion);

export default router;
