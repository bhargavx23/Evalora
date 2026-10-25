import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { analyzeResume, deleteAvatar, deleteResume, downloadResume, getAvatar, getStudentProfile, updateStudentProfile, uploadAvatar, uploadResume } from '../controllers/profileController.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype));
  }
});
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype))
});

router.use(authenticate);
router.get('/', getStudentProfile);
router.put('/', updateStudentProfile);
router.post('/avatar', avatarUpload.single('avatar'), uploadAvatar);
router.get('/avatar/:key', getAvatar);
router.delete('/avatar', deleteAvatar);
router.post('/resume', upload.single('resume'), uploadResume);
router.get('/resume/file', downloadResume);
router.delete('/resume', deleteResume);
router.post('/resume/analyze', analyzeResume);

export default router;
