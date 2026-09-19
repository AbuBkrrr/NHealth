import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { signToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { Role } from '@nhealth/shared-types';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';


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
          specialtyId: profile.specialtyId,
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
          specialtyId: profile.specialtyId,
          hourlyRate: profile.hourlyRate ?? 0,
        },
      });
    case 'ADMIN':
      // Admins have no role-specific profile table - just the User row itself.
      return undefined;
  }
}

/** Returns a list of role strings the user actually has profiles for. */
function buildRolesArray(u: any): string[] {
  const roles: string[] = [];
  if (u.patientProfile) roles.push('PATIENT');
  if (u.doctorProfile) roles.push('DOCTOR');
  if (u.pharmacyProfile) roles.push('PHARMACY');
  if (u.labProfile) roles.push('LAB');
  if (u.ambulanceProfile) roles.push('AMBULANCE');
  if (u.nurseProfile) roles.push('NURSE');
  if (u.isSuperAdmin || u.role === 'ADMIN') roles.push('ADMIN');
  return roles;
}

/** Helper: fetch a user with all role profiles attached. */
async function getUserWithProfiles(where: any) {
  return prisma.user.findUnique({
    where,
    include: {
      patientProfile: true,
      doctorProfile: true,
      pharmacyProfile: true,
      labProfile: true,
      ambulanceProfile: true,
      nurseProfile: true,
    },
  });
}

export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);

  if (data.role === 'ADMIN') {
    throw ApiError.forbidden('Admin accounts cannot self-register - ask a super admin to create one.');
  }

  const existing = await getUserWithProfiles({ email: data.email });

  let user;

  if (existing) {
    // Email exists — verify password first
    const valid = await bcrypt.compare(String(data.password), existing.passwordHash);
    if (!valid) {
      throw ApiError.conflict('This email is registered. Sign in instead, or use a different email.');
    }

    // Check if the requested role profile already exists
    const requestedProfile =
      data.role === 'PATIENT' ? existing.patientProfile :
      data.role === 'DOCTOR' ? existing.doctorProfile :
      data.role === 'PHARMACY' ? existing.pharmacyProfile :
      data.role === 'LAB' ? existing.labProfile :
      data.role === 'AMBULANCE' ? existing.ambulanceProfile :
      data.role === 'NURSE' ? existing.nurseProfile : null;

    if (requestedProfile) {
      throw ApiError.conflict('You already have a ' + data.role.toLowerCase() + ' account with this email.');
    }

    // Business rule: patient + 1 provider per email
    const hasPatient = !!existing.patientProfile;
    const hasProvider = !!(
      existing.doctorProfile || existing.pharmacyProfile ||
      existing.labProfile || existing.ambulanceProfile || existing.nurseProfile
    );

    if (data.role === 'PATIENT' && hasPatient) {
      throw ApiError.conflict('Patient profile already exists for this email.');
    }
    if (data.role !== 'PATIENT' && hasProvider) {
      throw ApiError.conflict('You already have a provider profile. Only one provider role allowed per email.');
    }
    if (data.role !== 'PATIENT' && !hasPatient) {
      // Optional: enforce patient-first, or just allow. Currently allowed.
    }

    // Attach the new profile to the existing user
    await createRoleProfile(existing.id, data.role, data.profile ?? {});
    user = existing;
  } else {
    // New email — create fresh user
    const passwordHash = await bcrypt.hash(String(data.password), 12);
    user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        phone: data.phone,
        role: data.role,
      },
    });
    await createRoleProfile(user.id, data.role, data.profile ?? {});
  }

  // Refetch with all profiles to build roles array
  const fullUser = await getUserWithProfiles({ id: user.id });
  const roles = buildRolesArray(fullUser!);

  const token = signToken(
    { userId: user.id, role: user.role, isSuperAdmin: user.isSuperAdmin },
    env.jwtSecret,
    env.jwtExpiresIn
  );

  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roles,
      isSuperAdmin: user.isSuperAdmin,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
    },
  });
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await getUserWithProfiles({ email: data.email });
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const valid = await bcrypt.compare(String(data.password), user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  const roles = buildRolesArray(user);

  const token = signToken(
    { userId: user.id, role: user.role, isSuperAdmin: user.isSuperAdmin },
    env.jwtSecret,
    env.jwtExpiresIn
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      roles,
      isSuperAdmin: user.isSuperAdmin,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
    },
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
  const roles = buildRolesArray(user);
  res.json({ ...safeUser, roles });
}

/** Switch active role for the current user (returns a new token). */
export async function switchRole(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'Role is required' });

  const user = await getUserWithProfiles({ id: userId });
  if (!user) throw ApiError.notFound('User not found');

  const roles = buildRolesArray(user);
  if (!roles.includes(role)) {
    return res.status(403).json({ error: 'You do not have a ' + role.toLowerCase() + ' profile.' });
  }

  const token = signToken(
    { userId: user.id, role: role as any, isSuperAdmin: user.isSuperAdmin },
    env.jwtSecret,
    env.jwtExpiresIn
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      roles,
      isSuperAdmin: user.isSuperAdmin,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
    },
  });
}


// ============================================================
// PASSWORD RESET
// ============================================================
// Store OTPs in memory (use Redis in production)
const resetCodes = new Map<string, { code: string; expiresAt: number }>();

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return 200 to prevent user enumeration
  if (!user) {
    return res.json({ message: 'If that email exists, a code has been sent.' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  resetCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

  // TODO: Send email with the code
  console.log('\u{1F4E7} Password reset code for ' + email + ': ' + code);

  return res.json({ message: 'If that email exists, a code has been sent.' });
}

export async function verifyResetCode(req: Request, res: Response) {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });

  const entry = resetCodes.get(email);
  if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }

  return res.json({ message: 'Code verified' });
}

export async function resetPassword(req: Request, res: Response) {
  const { email, code, password } = req.body;
  if (!email || !code || !password) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const entry = resetCodes.get(email);
  if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { email }, data: { passwordHash: hashedPassword } });
  resetCodes.delete(email);

  return res.json({ message: 'Password reset successful' });
}


// ============================================================
// GOOGLE SIGN-IN
// ============================================================
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function googleAuth(req: Request, res: Response) {
  const { credential, role = 'PATIENT' } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing credential' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid token' });

    const { email, name, picture } = payload;

    let user = await getUserWithProfiles({ email });

    if (!user) {
      // Auto-register with Google
      const createdUser = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          passwordHash: 'GOOGLE_OAUTH_' + Math.random().toString(36),
          avatarUrl: picture,
          role: role as any,
        },
      });

      // Create the corresponding profile
      await createRoleProfile(createdUser.id, role as any, {}).catch(() => {});

      user = await getUserWithProfiles({ id: createdUser.id });
    }

    const roles = buildRolesArray(user!);
    const token = signToken(
      { userId: user!.id, role: user!.role, isSuperAdmin: user!.isSuperAdmin },
      env.jwtSecret,
      env.jwtExpiresIn
    );

    return res.json({
      token,
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: user!.role,
        roles,
        isSuperAdmin: user!.isSuperAdmin,
        avatarUrl: user!.avatarUrl,
        phone: user!.phone,
      },
    });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(401).json({ error: 'Google authentication failed' });
  }
}