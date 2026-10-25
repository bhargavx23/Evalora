import { Router } from 'express';
import { runCustomCode, evaluateCode, getSubmissionById } from '../controllers/submissionController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/run', authenticate, runCustomCode);
router.post('/evaluate', authenticate, evaluateCode);
router.get('/:id', authenticate, getSubmissionById);

export default router;
