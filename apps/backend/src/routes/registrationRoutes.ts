// Registration routes
// File: backend/src/routes/registrationRoutes.ts

import { Router } from 'express';
import {
  registerUser,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
} from '../controllers/registrationController';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 * Body: { firstName, lastName, email, phone, password, role, providerType? }
 */
router.post('/register', registerUser);

/**
 * POST /api/auth/verify-email
 * Verify email with token
 * Body: { token }
 */
router.post('/verify-email', verifyEmail);

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 * Body: { email }
 */
router.post('/resend-verification', resendVerificationEmail);

/**
 * POST /api/auth/forgot-password
 * Request password reset
 * Body: { email }
 */
router.post('/forgot-password', forgotPassword);

/**
 * POST /api/auth/reset-password
 * Reset password with token
 * Body: { token, newPassword }
 */
router.post('/reset-password', resetPassword);

export default router;
