import { Router } from 'express';
import {
  validatePracticeSelection,
  generatePractice,
  getPracticeSession,
  savePracticeAnswer,
  submitPractice,
  getPracticeResult,
  getPracticeHistory,
  getSkillProfile,
  getPracticeReportData,
  downloadPracticeReportPdf
} from '../controllers/practiceController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = Router();

router.post('/validate-selection', authenticate, requireRoles('student'), validatePracticeSelection);
router.post('/generate', authenticate, requireRoles('student'), generatePractice);
router.post('/create', authenticate, requireRoles('student'), generatePractice);
router.get('/history', authenticate, requireRoles('student'), getPracticeHistory);
router.get('/skill-profile', authenticate, requireRoles('student'), getSkillProfile);

router.get('/:id', authenticate, requireRoles('student', 'platform_admin'), getPracticeSession);
router.post('/:id/answer', authenticate, requireRoles('student'), savePracticeAnswer);
router.post('/:id/submit', authenticate, requireRoles('student'), submitPractice);
router.get('/:id/result', authenticate, requireRoles('student', 'platform_admin'), getPracticeResult);
router.get('/:id/report/data', authenticate, getPracticeReportData);
router.get('/:id/report/pdf', authenticate, downloadPracticeReportPdf);

export default router;
