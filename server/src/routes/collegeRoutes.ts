import { Router } from 'express';
import { getColleges, getCollegeById, createCollege, updateCollege, toggleCollegeStatus } from '../controllers/collegeController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = Router();

// Public / optional auth for registration dropdown
router.get('/', optionalAuthenticate, getColleges);
router.get('/:id', optionalAuthenticate, getCollegeById);

// Platform admin only
router.post('/', authenticate, requireRoles('platform_admin'), createCollege);
router.put('/:id', authenticate, requireRoles('platform_admin', 'college_admin'), updateCollege);
router.patch('/:id/toggle-status', authenticate, requireRoles('platform_admin'), toggleCollegeStatus);

export default router;
