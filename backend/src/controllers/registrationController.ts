// User registration controller - simplified for production
// File: backend/src/controllers/registrationController.ts

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function registerUser(req: Request, res: Response) {
  try {
    const { name, email, phone, password, role } = req.body;

    // ========== VALIDATION ==========
    if (!name || !email || !phone || !password || !role) {
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
        phone,
        passwordHash: hashedPassword,
        role: role as any,
        name,
        isActive: true,
      },
    });

    // ========== GENERATE JWT TOKEN ==========
    const jwtSecret = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Registration successful!',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

/**
 * POST /api/auth/login
 * Login user
 */
export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account inactive' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * GET /api/auth/me
 * Get current user
 */
export async function getCurrentUser(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
}

/**
 * POST /api/auth/verify-email
 * Placeholder - email verification not implemented yet
 */
export async function verifyEmail(req: Request, res: Response) {
  res.status(200).json({ message: 'Email verification not implemented yet' });
}

/**
 * POST /api/auth/resend-verification
 * Placeholder - email verification not implemented yet
 */
export async function resendVerificationEmail(req: Request, res: Response) {
  res.status(200).json({ message: 'Email verification not implemented yet' });
}

/**
 * POST /api/auth/forgot-password
 * Placeholder - password reset not implemented yet
 */
export async function forgotPassword(req: Request, res: Response) {
  res.status(200).json({ message: 'Password reset not implemented yet' });
}

/**
 * POST /api/auth/reset-password
 * Placeholder - password reset not implemented yet
 */
export async function resetPassword(req: Request, res: Response) {
  res.status(200).json({ message: 'Password reset not implemented yet' });
}
