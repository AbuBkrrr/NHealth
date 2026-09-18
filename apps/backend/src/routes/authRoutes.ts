import { Router } from 'express';
import { register, login, me } from '../controllers/authController';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { register, login, forgotPassword, verifyResetCode, resetPassword } from '../controllers/authController';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', requireAuth, asyncHandler(me));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/verify-reset-code', asyncHandler(verifyResetCode));
router.post('/reset-password', asyncHandler(resetPassword));
export default router;
