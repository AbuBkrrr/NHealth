import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { signToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { Role } from '@prisma/client';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional().nullable(),
  role: z.nativeEnum(Role, { errorMap: () => ({ message: 'Invalid role' }) }),
  profile: z.record(z.any()).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/** Creates the role-specific profile row for a freshly registered user. */
async function createRoleProfile(userId: string, role: Role, profile: Record<string, any> = {}) {
  switch (role) {
    case 'PATIENT':
      return prisma.patientProfile.create({
        data: {
          userId,
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
    case 'DOCTOR':
      return prisma.doctorProfile.create({
        data: {
          userId,
          specialty: profile.specialty ?? 'General Practice',
          licenseNumber: profile.licenseNumber ?? '',
          hospital: profile.hospital,
          bio: profile.bio,
          consultationFee: profile.consultationFee ?? 0,
          yearsExperience: profile.yearsExperience ?? 0,
          lat: profile.lat,
          lng: profile.lng,
        },
      });
    case 'PHARMACY':
      return prisma.pharmacyProfile.create({
        data: {
          userId,
          pharmacyName: profile.pharmacyName ?? profile.name ?? '',
          licenseNumber: profile.licenseNumber ?? '',
          address: profile.address,
          operatingHours: profile.operatingHours,
          lat: profile.lat,
          lng: profile.lng,
        },
      });
    case 'LAB':
      return prisma.labProfile.create({
        data: {
          userId,
          labName: profile.labName ?? '',
          licenseNumber: profile.licenseNumber ?? '',
          address: profile.address,
          lat: profile.lat,
          lng: profile.lng,
        },
      });
    case 'AMBULANCE':
      return prisma.ambulanceProfile.create({
        data: {
          userId,
          vehicleNumber: profile.vehicleNumber ?? '',
          licenseNumber: profile.licenseNumber ?? '',
        },
      });
    case 'NURSE':
      return prisma.nurseProfile.create({
        data: {
          userId,
          licenseNumber: profile.licenseNumber ?? '',
          specialty: profile.specialty,
          hourlyRate: profile.hourlyRate ?? 0,
        },
      });
    case 'ADMIN':
      return undefined;
  }
}

export async function register(req: Request, res: Response) {
  try {
    console.log('📝 Register request:', JSON.stringify(req.body));
    const data = registerSchema.parse(req.body);
    console.log('✅ Validation passed');

    if (data.role === 'ADMIN') {
      throw ApiError.forbidden('Admin accounts cannot self-register');
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw ApiError.conflict('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        phone: data.phone || null,
        role: data.role,
      },
    });

    console.log('👤 User created:', user.id);
    await createRoleProfile(user.id, data.role, data.profile ?? {});
    console.log('📋 Profile created');

    const token = signToken({ userId: user.id, role: user.role, isSuperAdmin: user.isSuperAdmin });
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isSuperAdmin: user.isSuperAdmin, avatarUrl: user.avatarUrl, phone: user.phone },
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      return res.status(400).json({ error: 'Invalid input. Please check your details.', details: error.errors });
    }
    if (error instanceof ApiError) {
      console.error('API error:', error.message);
      return res.status(error.statusCode).json({ error: error.message });
    }
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Final error:', msg);
    res.status(500).json({ error: `Registration failed: ${msg}` });
  }
}

export async function login(req: Request, res: Response) {
  try {
    console.log('🔐 Login attempt:', req.body.email);
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      console.log('❌ Email not found:', data.email);
      return res.status(401).json({ error: 'Email not registered. Please sign up first.' });
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      console.log('❌ Invalid password for:', data.email);
      return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }

    if (!user.isActive) {
      console.log('❌ Account inactive:', data.email);
      return res.status(403).json({ error: 'Account is inactive.' });
    }

    const token = signToken({ userId: user.id, role: user.role, isSuperAdmin: user.isSuperAdmin });
    console.log('✅ Login successful:', data.email, 'Role:', user.role);
    res.status(200).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isSuperAdmin: user.isSuperAdmin, avatarUrl: user.avatarUrl, phone: user.phone },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      return res.status(400).json({ error: 'Invalid email or password format', details: error.errors });
    }
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error during login' });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        patientProfile: true,
        doctorProfile: true,
        pharmacyProfile: true,
        labProfile: true,
        ambulanceProfile: true,
        nurseProfile: true,
      },
    });
    if (!user) throw ApiError.notFound('User not found');
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to get user' });
  }
}
