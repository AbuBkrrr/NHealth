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
  profile: z.record(z.any()).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  role: z.string().optional(),
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

// ============================================================
// REGISTER
// ============================================================
export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);

  if (data.role === 'ADMIN') {
    throw ApiError.forbidden('Admin accounts cannot self-register - ask a super admin to create one.');
  }

  const existing = await getUserWithProfiles({ email: data.email });

  let user;

  if (existing) {
    const valid = await bcrypt.compare(String(data.password), existing.passwordHash);
    if (!valid) {
      throw ApiError.conflict('This email is registered. Sign in instead, or use a different email.');
    }

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

    await createRoleProfile(existing.id, data.role, data.profile ?? {});
    user = existing;
  } else {
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

// ============================================================
// LOGIN
// ============================================================
export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await getUserWithProfiles({ email: data.email });
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const valid = await bcrypt.compare(String(data.password), user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  const roles = buildRolesArray(user);

  // Resolve the requested login role
  let activeRole = user.role;
  if (data.role) {
    const requested = String(data.role).toUpperCase();

    if (requested === 'PROVIDER') {
      // Pick the user's first provider role (DOCTOR, PHARMACY, LAB, AMBULANCE, NURSE)
      const providerRoles = ['DOCTOR', 'PHARMACY', 'LAB', 'AMBULANCE', 'NURSE'];
      const found = roles.find(r => providerRoles.includes(r));
      if (found) {
        activeRole = found as any;
      } else {
        throw ApiError.forbidden('This account has no provider profile. Please sign up as a provider first.');
      }
    } else if (roles.includes(requested)) {
      activeRole = requested as any;
    }
  } else if (roles.length > 0 && !roles.includes(user.role)) {
    activeRole = roles[0] as any;
  }

  const token = signToken(
    { userId: user.id, role: activeRole, isSuperAdmin: user.isSuperAdmin },
    env.jwtSecret,
    env.jwtExpiresIn
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: activeRole,
      roles,
      isSuperAdmin: user.isSuperAdmin,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
    },
  });
}

// ============================================================
// ME
// ============================================================
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

// ============================================================
// SWITCH ROLE
// ============================================================
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
const resetCodes = new Map<string, { code: string; expiresAt: number }>();

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.json({ message: 'If that email exists, a code has been sent.' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  resetCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

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
      // Auto-register with Google — only supports PATIENT self-registration.
      // Provider signups must go through email registration to collect license/specialty.
      const finalRole = (role === 'PROVIDER') ? 'PATIENT' : role;

      const createdUser = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          passwordHash: 'GOOGLE_OAUTH_' + Math.random().toString(36),
          avatarUrl: picture,
          role: finalRole as any,
        },
      });

      await createRoleProfile(createdUser.id, finalRole as any, {}).catch(() => {});

      user = await getUserWithProfiles({ id: createdUser.id });
    }

    const roles = buildRolesArray(user!);

    // If user picked "PROVIDER" and has a provider profile, use it
    let activeRole = user!.role;
    const requestedRole = String(role).toUpperCase();
    if (requestedRole === 'PROVIDER') {
      const providerRoles = ['DOCTOR', 'PHARMACY', 'LAB', 'AMBULANCE', 'NURSE'];
      const found = roles.find(r => providerRoles.includes(r));
      if (found) activeRole = found as any;
    } else if (roles.includes(requestedRole)) {
      activeRole = requestedRole as any;
    }

    const token = signToken(
      { userId: user!.id, role: activeRole, isSuperAdmin: user!.isSuperAdmin },
      env.jwtSecret,
      env.jwtExpiresIn
    );

    return res.json({
      token,
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: activeRole,
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


// ============================================================
// UPDATE PROFILE
// ============================================================
export async function updateProfile(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { name, phone, address, height, weight, bloodType, genotype } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patientProfile: true },
  });
  if (!user) throw ApiError.notFound('User not found');

  // Update User table (name, phone)
  const userUpdate: any = {};
  if (name) userUpdate.name = name;
  if (phone) userUpdate.phone = phone;
  if (Object.keys(userUpdate).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: userUpdate });
  }

  // Update PatientProfile
  if (user.patientProfile) {
    const profileUpdate: any = {};
    if (address !== undefined) profileUpdate.address = address;
    if (height !== undefined) profileUpdate.height = height;
    if (weight !== undefined) profileUpdate.weight = weight;

    // Blood group change limit (2 max)
    if (bloodType && bloodType !== user.patientProfile.bloodType) {
      const changesUsed = (user.patientProfile as any).bloodTypeChanges || 0;
      if (changesUsed >= 2) {
        return res.status(403).json({ error: 'Blood group change limit reached (2 changes allowed)' });
      }
      profileUpdate.bloodType = bloodType;
      profileUpdate.bloodTypeChanges = changesUsed + 1;
    }

    // Genotype change limit (2 max)
    if (genotype && genotype !== user.patientProfile.genotype) {
      const changesUsed = (user.patientProfile as any).genotypeChanges || 0;
      if (changesUsed >= 2) {
        return res.status(403).json({ error: 'Genotype change limit reached (2 changes allowed)' });
      }
      profileUpdate.genotype = genotype;
      profileUpdate.genotypeChanges = changesUsed + 1;
    }

    if (Object.keys(profileUpdate).length > 0) {
      await prisma.patientProfile.update({
        where: { userId },
        data: profileUpdate,
      });
    }
  }

  // Return updated user
  const updated = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      patientProfile: true,
      doctorProfile: true,
      pharmacyProfile: true,
      labProfile: true,
      ambulanceProfile: true,
      nurseProfile: true,
    },
  });

  const { passwordHash, ...safe } = updated!;
  res.json(safe);
}