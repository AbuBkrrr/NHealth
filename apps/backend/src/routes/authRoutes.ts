import { Router } from 'express';
import {
  register,
  login,
  me,
  googleAuth,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  switchRole,
} from '../controllers/authController';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', requireAuth, asyncHandler(me));
router.post('/google', asyncHandler(googleAuth));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/verify-reset-code', asyncHandler(verifyResetCode));
router.post('/reset-password', asyncHandler(resetPassword));
router.post('/switch-role', requireAuth, asyncHandler(switchRole));

export default router;