import { Router } from 'express';
import { requireAuth, requireRole, requireSuperAdmin } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { authLimiter, otpLimiter } from '../middleware/rateLimit';
import {
  register, login, me, googleAuth, forgotPassword, verifyResetCode, resetPassword, switchRole, updateProfile,
  changePassword, logoutAll, sendVerifyEmail, confirmVerifyEmail, sendVerifyPhone, confirmVerifyPhone, acceptConsents,
  verify2fa, resend2fa, twoFactorStatus, setup2fa, enable2fa, disable2fa, regenBackupCodes, getSecurity, putSecurity,
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
router.post('/consents', requireAuth, asyncHandler(acceptConsents));
// Two-step verification
router.post('/2fa/verify', authLimiter, asyncHandler(verify2fa));
router.post('/2fa/resend', otpLimiter, asyncHandler(resend2fa));
router.get('/2fa', requireAuth, asyncHandler(twoFactorStatus));
router.post('/2fa/setup', requireAuth, otpLimiter, asyncHandler(setup2fa));
router.post('/2fa/enable', requireAuth, otpLimiter, asyncHandler(enable2fa));
router.post('/2fa/disable', requireAuth, otpLimiter, asyncHandler(disable2fa));
router.post('/2fa/backup-codes', requireAuth, otpLimiter, asyncHandler(regenBackupCodes));
router.get('/security', requireAuth, requireRole('ADMIN'), requireSuperAdmin, asyncHandler(getSecurity));
router.put('/security', requireAuth, requireRole('ADMIN'), requireSuperAdmin, asyncHandler(putSecurity));
router.post('/verify-phone/confirm', requireAuth, otpLimiter, asyncHandler(confirmVerifyPhone));

export default router;
