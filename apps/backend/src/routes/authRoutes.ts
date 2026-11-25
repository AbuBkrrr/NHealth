import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { authLimiter, otpLimiter } from '../middleware/rateLimit';
import {
  register, login, me, googleAuth, forgotPassword, verifyResetCode, resetPassword, switchRole, updateProfile,
  changePassword, logoutAll, sendVerifyEmail, confirmVerifyEmail, sendVerifyPhone, confirmVerifyPhone,
} from '../controllers/authController';

const router = Router();

router.post('/register', authLimiter, asyncHandler(register));
router.post('/login', authLimiter, asyncHandler(login));
router.get('/me', requireAuth, asyncHandler(me));
router.post('/google', authLimiter, asyncHandler(googleAuth));
router.post('/forgot-password', otpLimiter, asyncHandler(forgotPassword));
router.post('/verify-reset-code', otpLimiter, asyncHandler(verifyResetCode));
router.post('/reset-password', otpLimiter, asyncHandler(resetPassword));
router.post('/switch-role', requireAuth, asyncHandler(switchRole));
router.patch('/profile', requireAuth, asyncHandler(updateProfile));
router.post('/change-password', requireAuth, authLimiter, asyncHandler(changePassword));
router.post('/logout-all', requireAuth, asyncHandler(logoutAll));
router.post('/verify-email/send', requireAuth, otpLimiter, asyncHandler(sendVerifyEmail));
router.post('/verify-email/confirm', requireAuth, otpLimiter, asyncHandler(confirmVerifyEmail));
router.post('/verify-phone/send', requireAuth, otpLimiter, asyncHandler(sendVerifyPhone));
router.post('/verify-phone/confirm', requireAuth, otpLimiter, asyncHandler(confirmVerifyPhone));

export default router;
