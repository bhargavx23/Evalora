import { Router } from 'express';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/departmentController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = Router();

router.get('/', optionalAuthenticate, getDepartments);
router.post('/', authenticate, requireRoles('college_admin', 'platform_admin'), createDepartment);
router.put('/:id', authenticate, requireRoles('college_admin', 'platform_admin'), updateDepartment);
router.delete('/:id', authenticate, requireRoles('college_admin', 'platform_admin'), deleteDepartment);

export default router;
