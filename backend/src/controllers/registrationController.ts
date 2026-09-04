// User registration controller - improved: shared prisma, phone normalization, upsert specializations
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ProviderType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { findOrCreateSpecialization, validateSpecializationId } from '../services/specializationService';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const jwtSecret = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
const jwtExpires = process.env.JWT_EXPIRES_IN || '7d';

const validRoles = ['PATIENT', 'DOCTOR', 'NURSE', 'PHARMACY', 'LAB', 'AMBULANCE'];

/**
 * POST /api/auth/register
 * Register a new user (atomic creation of user + role profile)
 */
export async function registerUser(req: Request, res: Response) {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      specialty, // free-text specialty (optional)
      specialtyId, // optional FK
      profile = {}, // role-specific profile attributes
    } = req.body;

    // Basic validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password, role' });
    }

    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, and numbers',
      });
    }

    // Normalize & validate phone if provided
    let normalizedPhone: string | undefined;
    if (phone) {
      const parsed = parsePhoneNumberFromString(String(phone));
      if (!parsed || !parsed.isValid()) {
        return res.status(400).json({ error: 'Invalid phone number format. Use international format e.g. +234...' });
      }
      normalizedPhone = parsed.number; // E.164
    }

    // Check uniqueness of email and phone (email uniqueness already enforced in schema)
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) return res.status(409).json({ error: 'Email already registered' });

    if (normalizedPhone) {
      const existingByPhone = await prisma.user.findFirst({ where: { phone: normalizedPhone } });
      if (existingByPhone) return res.status(409).json({ error: 'Phone number already registered' });
    }

    // Handle specialty lookups for DOCTOR and NURSE
    let resolvedSpecialtyId: string | null = null;
    if (role === 'DOCTOR' || role === 'NURSE') {
      const expectedType: ProviderType = role === 'DOCTOR' ? 'DOCTOR' : 'NURSE';

      if (specialtyId) {
        // Validate provided FK
        const ok = await validateSpecializationId(specialtyId, expectedType);
        if (!ok) return res.status(400).json({ error: 'Invalid specialtyId or mismatched type' });
        resolvedSpecialtyId = specialtyId;
      } else if (specialty) {
        // Find or create specialization
        const spec = await findOrCreateSpecialization(specialty, expectedType);
        if (spec) resolvedSpecialtyId = spec.id;
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and role profile in a transaction for atomicity
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          phone: normalizedPhone,
          passwordHash: hashedPassword,
          role: role as any,
          name,
          isActive: true,
        },
      });

      // Create role-specific profile
      if (role === 'PATIENT') {
        await tx.patientProfile.create({
          data: {
            userId: user.id,
            dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth) : undefined,
            bloodType: profile.bloodType,
            genotype: profile.genotype,
            nhisNumber: profile.nhisNumber,
            allergies: profile.allergies,
            address: profile.address,
            emergencyContact: profile.emergencyContact,
            emergencyPhone: profile.emergencyPhone,
          },
        });
      } else if (role === 'DOCTOR') {
        await tx.doctorProfile.create({
          data: {
            userId: user.id,
            specialty: specialty || profile.specialty || '',
            specialtyId: resolvedSpecialtyId,
            licenseNumber: profile.licenseNumber || '',
            hospital: profile.hospital,
            bio: profile.bio,
            consultationFee: profile.consultationFee ?? 0,
            yearsExperience: profile.yearsExperience ?? 0,
            lat: profile.lat,
            lng: profile.lng,
          },
        });
      } else if (role === 'NURSE') {
        await tx.nurseProfile.create({
          data: {
            userId: user.id,
            licenseNumber: profile.licenseNumber || '',
            specialty: specialty || profile.specialty || '',
            specialtyId: resolvedSpecialtyId,
            hourlyRate: profile.hourlyRate ?? 0,
            isAvailable: profile.isAvailable ?? true,
          },
        });
      } else if (role === 'PHARMACY') {
        await tx.pharmacyProfile.create({
          data: {
            userId: user.id,
            pharmacyName: profile.pharmacyName || name,
            licenseNumber: profile.licenseNumber || '',
            address: profile.address,
            operatingHours: profile.operatingHours,
            lat: profile.lat,
            lng: profile.lng,
          },
        });
      } else if (role === 'LAB') {
        await tx.labProfile.create({
          data: {
            userId: user.id,
            labName: profile.labName || name,
            licenseNumber: profile.licenseNumber || '',
            address: profile.address,
            lat: profile.lat,
            lng: profile.lng,
          },
        });
      } else if (role === 'AMBULANCE') {
        await tx.ambulanceProfile.create({
          data: {
            userId: user.id,
            vehicleNumber: profile.vehicleNumber || '',
            licenseNumber: profile.licenseNumber || '',
            currentLat: profile.currentLat,
            currentLng: profile.currentLng,
            isAvailable: profile.isAvailable ?? true,
          },
        });
      }

      return user;
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: created.id, email: created.email, role: created.role } as any,
      jwtSecret as any,
      { expiresIn: jwtExpires } as any
    );

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: created.id,
        email: created.email,
        name: created.name,
        role: created.role,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);

    // Map Prisma unique constraint or other DB errors to user-friendly responses
    if (err?.code === 'P2002') {
      const meta = err?.meta || {};
      const target = Array.isArray(meta?.target) ? meta.target.join(',') : meta?.target;
      return res.status(409).json({ error: `Unique constraint failed: ${target}` });
    }

    return res.status(500).json({ error: 'Registration failed' });
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

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      } as any,
      jwtSecret as any,
      { expiresIn: jwtExpires } as any
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
export async function verifyEmail(_req: Request, res: Response) {
  res.status(200).json({ message: 'Email verification not implemented yet' });
}

/**
 * POST /api/auth/resend-verification
 * Placeholder - email verification not implemented yet
 */
export async function resendVerificationEmail(_req: Request, res: Response) {
  res.status(200).json({ message: 'Email verification not implemented yet' });
}

/**
 * POST /api/auth/forgot-password
 * Placeholder - password reset not implemented yet
 */
export async function forgotPassword(_req: Request, res: Response) {
  res.status(200).json({ message: 'Password reset not implemented yet' });
}

/**
 * POST /api/auth/reset-password
 * Placeholder - password reset not implemented yet
 */
export async function resetPassword(_req: Request, res: Response) {
  res.status(200).json({ message: 'Password reset not implemented yet' });
}
