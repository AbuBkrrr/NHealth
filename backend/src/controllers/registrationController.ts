// User registration controller with email verification
// File: backend/src/controllers/registrationController.ts

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// Email configuration (use SendGrid, AWS SES, or similar in production)
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || '',
  },
});

/**
 * POST /api/auth/register
 * Register a new user with email verification
 */
export async function registerUser(req: Request, res: Response) {
  try {
    const { firstName, lastName, email, phone, password, role, providerType } = req.body;

    // ========== VALIDATION ==========
    if (!firstName || !lastName || !email || !phone || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength (min 8 chars, 1 upper, 1 lower, 1 number)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, and numbers',
      });
    }

    // Validate role
    const validRoles = ['PATIENT', 'DOCTOR', 'NURSE', 'PHARMACY', 'LAB', 'AMBULANCE'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // ========== CHECK IF USER EXISTS ==========
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // ========== HASH PASSWORD ==========
    const hashedPassword = await bcrypt.hash(password, 10);

    // ========== CREATE USER ==========
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role as any,
        firstName,
        lastName,
        phone,
        isEmailVerified: false,
        emailVerificationToken: generateVerificationToken(),
      },
    });

    // ========== SEND VERIFICATION EMAIL ==========
    await sendVerificationEmail(user.email, user.emailVerificationToken!);

    // ========== GENERATE JWT TOKEN ==========
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful! Please verify your email.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

/**
 * POST /api/auth/verify-email
 * Verify user email with token
 */
export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    // Find user with verification token
    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Update user email verified status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
      },
    });

    res.json({ message: 'Email verified successfully!' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
}

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
export async function resendVerificationEmail(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new verification token
    const newToken = generateVerificationToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: newToken },
    });

    // Send verification email
    await sendVerificationEmail(user.email, newToken);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
}

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If email exists, password reset link sent' });
    }

    // Generate reset token
    const resetToken = generateVerificationToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetToken },
    });

    // Send reset email
    await sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: 'Password reset link sent to email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset' });
  }
}

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, and numbers',
      });
    }

    // Find user with reset token
    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
      },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
}

// ========== HELPER FUNCTIONS ==========

/**
 * Generate random verification token
 */
function generateVerificationToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Send email verification link
 */
async function sendVerificationEmail(email: string, token: string) {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your N-Health Email Address',
    html: `
      <h2>Welcome to N-Health!</h2>
      <p>Please verify your email address to complete registration.</p>
      <a href="${verificationLink}" style="background-color: #1A73E8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Verify Email
      </a>
      <p>Or copy this link: ${verificationLink}</p>
      <p>This link expires in 24 hours.</p>
    `,
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send verification email to ${email}:`, error);
    throw error;
  }
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Reset Your N-Health Password',
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}" style="background-color: #1A73E8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Reset Password
      </a>
      <p>Or copy this link: ${resetLink}</p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${email}:`, error);
    throw error;
  }
}
