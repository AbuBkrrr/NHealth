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
import { issueOtp, checkOtp } from '../services/otp';
import { sendEmail } from '../services/email';
import { sendSms } from '../services/sms';
import { notify } from '../services/notify';
import { invalidateUserState } from '../middleware/auth';

const PROVIDER_ROLES = ['DOCTOR', 'PHARMACY', 'LAB', 'AMBULANCE', 'NURSE', 'INSTITUTION'];
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

/** Public, safe user payload returned by every auth endpoint. */
function publicUser(user: any, role: string, roles: string[]) {
  return {
    id: user.id, email: user.email, name: user.name, role, roles, isSuperAdmin: user.isSuperAdmin,
    avatarUrl: user.avatarUrl, phone: user.phone, country: user.country, currency: user.currency, locale: user.locale,
    timezone: user.timezone, kycStatus: user.kycStatus, verificationStatus: user.verificationStatus,
    emailVerified: !!user.emailVerifiedAt, phoneVerified: !!user.phoneVerifiedAt, referralCode: user.referralCode,
  };
}

function tokenFor(user: any, role: string) {
  return signToken({ userId: user.id, role: role as any, isSuperAdmin: user.isSuperAdmin, tv: user.tokenVersion ?? 0 } as any, env.jwtSecret, env.jwtExpiresIn);
}

const makeReferralCode = () => 'NH' + crypto.randomBytes(4).toString('hex').toUpperCase();

async function sendEmailVerification(userId: string, email: string) {
  const code = await issueOtp(email, 'email_verify', userId);
  await sendEmail(email, 'Verify your email', 'Verify your email', `Your N-Health verification code is <b style="font-size:20px;letter-spacing:3px">${code}</b>. It expires in 10 minutes.`);
}


const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.nativeEnum(Role),
  profile: z.record(z.any()).optional(),
  country: z.string().length(2).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  acceptTerms: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
  referralCode: z.string().optional(),
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
    case 'INSTITUTION':
      return prisma.institutionProfile.create({
        data: {
          userId,
          name: profile.name ?? profile.institutionName ?? '',
          type: profile.type ?? 'HOSPITAL',
          licenseNumber: profile.licenseNumber ?? '',
          email: profile.email,
          phone: profile.phone,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          country: profile.country ?? 'NG',
          lat: profile.lat,
          lng: profile.lng,
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
  if (u.institutionProfile) roles.push('INSTITUTION');
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
      institutionProfile: true,
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

  const existing = await getUserWithProfiles({ email: data.email.toLowerCase() });

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
    if (PROVIDER_ROLES.includes(data.role) && existing.verificationStatus === 'UNVERIFIED') {
      await prisma.user.update({ where: { id: existing.id }, data: { verificationStatus: 'PENDING' } });
    }
    user = existing;
  } else {
    if (data.acceptTerms === false) throw ApiError.badRequest('You must accept the Terms of Service and Privacy Policy');
    const passwordHash = await bcrypt.hash(String(data.password), 12);
    const referrer = data.referralCode ? await prisma.user.findUnique({ where: { referralCode: data.referralCode.toUpperCase() } }) : null;
    user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        phone: data.phone,
        role: data.role,
        country: data.country?.toUpperCase() ?? 'NG',
        currency: data.currency?.toUpperCase() ?? 'NGN',
        timezone: data.timezone ?? 'Africa/Lagos',
        locale: data.locale ?? 'en',
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
        marketingOptIn: !!data.marketingOptIn,
        referralCode: makeReferralCode(),
        referredById: referrer?.id,
        verificationStatus: PROVIDER_ROLES.includes(data.role) ? 'PENDING' : 'UNVERIFIED',
      },
    });
    await createRoleProfile(user.id, data.role, data.profile ?? {});
    await sendEmailVerification(user.id, user.email).catch(() => null);
    await notify(user.id, 'system', 'Welcome to N-Health 🎉', PROVIDER_ROLES.includes(data.role)
      ? 'Complete identity verification and upload your licence to start receiving patients.'
      : 'Complete your health profile and verify your identity to unlock all services.');
  }

  const fullUser = await getUserWithProfiles({ id: user.id });
  const roles = buildRolesArray(fullUser!);
  const activeRole = existing ? data.role : user.role;
  res.status(201).json({ token: tokenFor(fullUser, activeRole), user: publicUser(fullUser, activeRole, roles) });
}

// ============================================================
// LOGIN
// ============================================================
export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await getUserWithProfiles({ email: data.email.toLowerCase() });
  if (!user || user.deletedAt) throw ApiError.unauthorized('Invalid email or password');
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw ApiError.forbidden(`Too many failed attempts. Try again after ${user.lockedUntil.toISOString()} or reset your password.`);
  }

  const valid = await bcrypt.compare(String(data.password), user.passwordHash).catch(() => false);
  if (!valid) {
    const fails = user.failedLogins + 1;
    await prisma.user.update({ where: { id: user.id }, data: {
      failedLogins: fails >= MAX_FAILED_LOGINS ? 0 : fails,
      lockedUntil: fails >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined,
    } });
    throw ApiError.unauthorized('Invalid email or password');
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });

  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  const roles = buildRolesArray(user);

  // Resolve the requested login role
  let activeRole = user.role;
  if (data.role) {
    const requested = String(data.role).toUpperCase();

    if (requested === 'PROVIDER') {
      // Pick the user's first provider role (DOCTOR, PHARMACY, LAB, AMBULANCE, NURSE)
      const providerRoles = PROVIDER_ROLES;
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

  res.json({ token: tokenFor(user, activeRole), user: publicUser(user, activeRole, roles) });
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
      institutionProfile: true,
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  const { passwordHash, failedLogins, lockedUntil, tokenVersion, ...safeUser } = user as any;
  const roles = buildRolesArray(user);
  res.json({ ...safeUser, roles, activeRole: req.user!.role, emailVerified: !!user.emailVerifiedAt, phoneVerified: !!user.phoneVerifiedAt });
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

  res.json({ token: tokenFor(user, role), user: publicUser(user, role, roles) });
}

// ============================================================
// PASSWORD RESET
// ============================================================
// Codes are 6 digits, stored hashed in the database, valid 10 minutes, max 5 attempts.
export async function forgotPassword(req: Request, res: Response) {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.deletedAt) {
    const code = await issueOtp(email, 'password_reset', user.id);
    await sendEmail(email, 'Reset your N-Health password', 'Password reset code',
      `Use this code to reset your password: <b style="font-size:20px;letter-spacing:3px">${code}</b><br>It expires in 10 minutes. If you didn't request this, you can ignore this email.`);
    if (user.phone) await sendSms(user.phone, `Your N-Health password reset code is ${code}. Expires in 10 min. Never share it.`);
  }
  return res.json({ message: 'If that email exists, a code has been sent.' });
}

export async function verifyResetCode(req: Request, res: Response) {
  const email = String(req.body.email || '').toLowerCase().trim();
  const { code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });
  if (!(await checkOtp(email, 'password_reset', code, false))) return res.status(400).json({ error: 'Invalid or expired code' });
  return res.json({ message: 'Code verified' });
}

export async function resetPassword(req: Request, res: Response) {
  const email = String(req.body.email || '').toLowerCase().trim();
  const { code, password } = req.body;
  if (!email || !code || !password) return res.status(400).json({ error: 'Missing fields' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!(await checkOtp(email, 'password_reset', code, true))) return res.status(400).json({ error: 'Invalid or expired code' });
  const passwordHash = await bcrypt.hash(String(password), 12);
  const u = await prisma.user.update({ where: { email }, data: { passwordHash, tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } });
  invalidateUserState(u.id);
  await notify(u.id, 'system', 'Password changed', 'Your password was reset. If this was not you, contact support immediately.', { email: true });
  return res.json({ message: 'Password reset successful' });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) throw ApiError.badRequest('New password must be at least 8 characters');
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) throw ApiError.notFound('User not found');
  const isGoogleOnly = user.passwordHash.startsWith('GOOGLE_OAUTH_');
  if (!isGoogleOnly && !(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) throw ApiError.unauthorized('Current password is incorrect');
  const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(String(newPassword), 12), tokenVersion: { increment: 1 } } });
  invalidateUserState(user.id);
  res.json({ message: 'Password changed', token: tokenFor(updated, req.user!.role) });
}

/** Revokes every issued token for this account. */
export async function logoutAll(req: Request, res: Response) {
  await prisma.user.update({ where: { id: req.user!.userId }, data: { tokenVersion: { increment: 1 } } });
  invalidateUserState(req.user!.userId);
  res.json({ message: 'Signed out on all devices' });
}

export async function sendVerifyEmail(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.emailVerifiedAt) return res.json({ message: 'Email already verified' });
  await sendEmailVerification(user.id, user.email);
  res.json({ message: 'Verification code sent' });
}

export async function confirmVerifyEmail(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (!(await checkOtp(user.email, 'email_verify', String(req.body.code || ''), true))) throw ApiError.badRequest('Invalid or expired code');
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  res.json({ message: 'Email verified' });
}

export async function sendVerifyPhone(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user?.phone) throw ApiError.badRequest('Add a phone number to your profile first');
  const code = await issueOtp(user.phone, 'phone_verify', user.id);
  await sendSms(user.phone, `Your N-Health verification code is ${code}. Expires in 10 min.`);
  res.json({ message: 'Verification code sent by SMS' });
}

export async function confirmVerifyPhone(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user?.phone) throw ApiError.badRequest('No phone number on file');
  if (!(await checkOtp(user.phone, 'phone_verify', String(req.body.code || ''), true))) throw ApiError.badRequest('Invalid or expired code');
  await prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
  res.json({ message: 'Phone verified' });
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
          emailVerifiedAt: new Date(),
          termsAcceptedAt: new Date(),
          privacyAcceptedAt: new Date(),
          referralCode: makeReferralCode(),
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
      const providerRoles = PROVIDER_ROLES;
      const found = roles.find(r => providerRoles.includes(r));
      if (found) activeRole = found as any;
    } else if (roles.includes(requestedRole)) {
      activeRole = requestedRole as any;
    }

    if (!user!.isActive || user!.deletedAt) return res.status(403).json({ error: 'This account has been deactivated' });
    await prisma.user.update({ where: { id: user!.id }, data: { lastLoginAt: new Date(), emailVerifiedAt: user!.emailVerifiedAt ?? new Date() } });
    return res.json({ token: tokenFor(user, activeRole), user: publicUser(user, activeRole, roles) });
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
  const b = req.body || {};

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patientProfile: true },
  });
  if (!user) throw ApiError.notFound('User not found');

  // Update User table (name, phone)
  const userUpdate: any = {};
  if (name) userUpdate.name = name;
  if (phone) userUpdate.phone = phone;
  if (phone && phone !== user.phone) userUpdate.phoneVerifiedAt = null;
  for (const k of ['country', 'currency', 'locale', 'timezone']) if (typeof b[k] === 'string' && b[k]) userUpdate[k] = k === 'country' || k === 'currency' ? b[k].toUpperCase() : b[k];
  if (b.notificationPrefs && typeof b.notificationPrefs === 'object') userUpdate.notificationPrefs = b.notificationPrefs;
  if (typeof b.marketingOptIn === 'boolean') userUpdate.marketingOptIn = b.marketingOptIn;
  if (Object.keys(userUpdate).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: userUpdate });
  }

  // Update PatientProfile
  if (user.patientProfile) {
    const profileUpdate: any = {};
    if (address !== undefined) profileUpdate.address = address;
    if (height !== undefined) profileUpdate.height = height;
    if (weight !== undefined) profileUpdate.weight = weight;
    // KYC & health information used by providers and insurers
    const text = ['gender', 'maritalStatus', 'occupation', 'city', 'state', 'country', 'allergies', 'chronicConditions', 'currentMedications',
      'disabilities', 'surgeries', 'familyHistory', 'alcohol', 'emergencyContact', 'emergencyPhone', 'nhisNumber', 'nationalIdType'];
    for (const k of text) if (b[k] !== undefined) profileUpdate[k] = b[k] === '' ? null : String(b[k]);
    if (b.nationalIdNumber) profileUpdate.nationalIdLast4 = String(b.nationalIdNumber).slice(-4);
    if (b.dateOfBirth !== undefined) profileUpdate.dateOfBirth = b.dateOfBirth ? new Date(b.dateOfBirth) : null;
    if (typeof b.smoker === 'boolean') profileUpdate.smoker = b.smoker;
    if (typeof b.isBloodDonor === 'boolean') profileUpdate.isBloodDonor = b.isBloodDonor;
    if (typeof b.insuranceShareConsent === 'boolean') profileUpdate.insuranceShareConsent = b.insuranceShareConsent;

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
      institutionProfile: true,
    },
  });

  const { passwordHash, failedLogins, lockedUntil, tokenVersion, ...safe } = updated as any;
  res.json(safe);
}