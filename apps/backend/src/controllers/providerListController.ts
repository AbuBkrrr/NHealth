import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// ============================================================
// GET /api/providers/list
// Returns all registered providers with the info needed for booking
// ============================================================
export async function listProviders(req: Request, res: Response) {
  const { type, search } = req.query;

  const where: any = { isActive: true };

  // Filter by role if provided
  if (type && type !== 'ALL') {
    where.role = String(type).toUpperCase();
  }

  // Search by name
  if (search) {
    where.name = { contains: String(search), mode: 'insensitive' };
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      doctorProfile: true,
      pharmacyProfile: true,
      labProfile: true,
      ambulanceProfile: true,
      nurseProfile: true,
    },
    take: 100,
  });

  // Map to a flat structure the frontend can use
  const providers = users.map((u) => {
    let icon = '👤';
    let specialty = '';
    let location = '';
    let fee = 0;
    let rating = 4.5;
    let experience = 5;

    if (u.doctorProfile) {
      icon = '👨‍⚕️';
      specialty = u.doctorProfile.specialty;
      location = u.doctorProfile.hospital || 'Lagos';
      fee = Number(u.doctorProfile.consultationFee) || 15000;
      rating = u.doctorProfile.rating || 4.5;
      experience = u.doctorProfile.yearsExperience || 5;
    } else if (u.pharmacyProfile) {
      icon = '💊';
      specialty = 'Retail Pharmacy';
      location = u.pharmacyProfile.address || 'Lagos';
    } else if (u.labProfile) {
      icon = '🔬';
      specialty = 'Diagnostics';
      location = u.labProfile.address || 'Lagos';
    } else if (u.ambulanceProfile) {
      icon = '🚑';
      specialty = 'Emergency Transport';
      location = 'Lagos';
    } else if (u.nurseProfile) {
      icon = '👩‍⚕️';
      specialty = u.nurseProfile.specialty || 'General Nursing';
      location = 'Lagos';
      fee = Number(u.nurseProfile.hourlyRate) || 8000;
    }

    return {
      id: u.id,           // ← real backend user ID
      userId: u.id,       // alias for consistency
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      avatarUrl: u.avatarUrl,
      icon,
      specialty,
      location,
      fee,
      rating,
      experience,
      online: true, // TODO: track lastSeen
    };
  });

  res.json(providers);
}