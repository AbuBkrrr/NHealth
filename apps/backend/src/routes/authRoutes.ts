import { Router } from 'express';
import {
  register,
  login,
  me,
  googleAuth,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} from '../controllers/authController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', asyncHandler(me));
router.post('/google', asyncHandler(googleAuth));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/verify-reset-code', asyncHandler(verifyResetCode));
router.post('/reset-password', asyncHandler(resetPassword));

export default router;
