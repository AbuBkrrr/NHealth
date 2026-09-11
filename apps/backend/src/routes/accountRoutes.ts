import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { avatarUpload, uploadAvatar, updateAccount } from '../controllers/accountController';

const router = Router();

router.use(requireAuth);

// Any authenticated role can update their own profile photo or basic account info.
router.post('/avatar', avatarUpload, asyncHandler(uploadAvatar));
router.patch('/', asyncHandler(updateAccount));

export default router;
