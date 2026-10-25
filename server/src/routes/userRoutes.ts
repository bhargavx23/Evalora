import { Router } from 'express';
import { getUsers } from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';

const router = Router();

router.get('/', authenticate, requireRoles('platform_admin', 'college_admin'), getUsers);

export default router;
