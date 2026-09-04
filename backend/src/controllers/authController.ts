import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { signToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { Role } from '@prisma/client';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.nativeEnum(Role),
  // Role-specific fields, validated loosely here and used to create the profile row.
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
      // Admins have no role-specific profile table - just the User row itself.
      return undefined;
  }
}

export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);

  if (data.role === 'ADMIN') {
    throw ApiError.forbidden('Admin accounts cannot self-register - ask a super admin to create one.');
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw ApiError.conflict('Email already registered. Please login to continue.');

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      phone: data.phone,
      role: data.role,
    },
  });

  await createRoleProfile(user.id, data.role, data.profile ?? {});

  const token = signToken({ userId: user.id, role: user.role, isSuperAdmin: user.isSuperAdmin });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, isSuperAdmin: user.isSuperAdmin, avatarUrl: user.avatarUrl, phone: user.phone },
  });
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  const token = signToken({ userId: user.id, role: user.role, isSuperAdmin: user.isSuperAdmin });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, isSuperAdmin: user.isSuperAdmin, avatarUrl: user.avatarUrl, phone: user.phone },
  });
}

export async function me(req: Request, res: Response) {
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
}
