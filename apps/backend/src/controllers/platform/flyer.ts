// Provider flyers: a public page for each provider (opened by scanning the provider's N-Health flyer)
// and the data N-Health uses to draw the flyer. Only public business details are exposed here.
import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { str, uid } from './util';

const ROLES = ['DOCTOR', 'NURSE', 'PHARMACY', 'LAB', 'AMBULANCE', 'INSTITUTION'];
const ROLE_LABEL: Record<string, string> = { DOCTOR: 'Doctor', NURSE: 'Nurse', PHARMACY: 'Pharmacy', LAB: 'Diagnostic center', AMBULANCE: 'Ambulance service', INSTITUTION: 'Hospital / clinic' };

async function publicProfile(userId: string) {
  const u = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null, role: { in: ROLES as any } },
    include: {
      doctorProfile: true, nurseProfile: true, pharmacyProfile: true, ambulanceProfile: true,
      labProfile: { include: { catalog: { where: { isActive: true }, orderBy: { name: 'asc' }, take: 8, select: { name: true, price: true } } } },
      institutionProfile: { include: { departments: { take: 8, select: { name: true } } } },
    },
  });
  if (!u) return null;
  const d = u.doctorProfile, n = u.nurseProfile, p = u.pharmacyProfile, l = u.labProfile, a = u.ambulanceProfile, i = u.institutionProfile;
  const base = { id: u.id, role: u.role, roleLabel: ROLE_LABEL[u.role], avatarUrl: u.avatarUrl, verified: u.verificationStatus === 'VERIFIED', referralCode: u.referralCode };
  // What the flyer and page list as services, and the action patients take.
  if (d) return { ...base, name: 'Dr. ' + u.name, title: d.specialty || 'Doctor', place: d.hospital, city: d.city, state: d.state, rating: d.rating, reviews: d.reviewCount, fee: Number(d.consultationFee) || null,
    services: ['Book a consultation', d.homeVisit ? 'Home visits' : null, 'Video or in-person', 'Prescriptions and test requests'].filter(Boolean), action: 'Book an appointment' };
  if (n) return { ...base, name: 'Nurse ' + u.name, title: n.specialty || 'Nursing care', city: n.city, state: n.state, rating: n.rating, reviews: n.reviewCount, fee: Number(n.hourlyRate) || null,
    services: ['Home nursing care', 'Wound care and injections', 'Elderly and post-operative care'], action: 'Request home care' };
  if (p) return { ...base, name: p.pharmacyName || u.name, title: 'Pharmacy', address: p.address, city: p.city, state: p.state, rating: p.rating, reviews: p.reviewCount, hours: p.operatingHours,
    services: ['Order medicines online', p.homeDelivery ? 'Home delivery' : 'Quick pick-up', 'Prescriptions filled', 'Pay with N-Health coins'], action: 'Order medicines' };
  if (l) return { ...base, name: l.labName || u.name, title: 'Diagnostic center', address: l.address, city: l.city, state: l.state, rating: l.rating, reviews: l.reviewCount, hours: l.operatingHours,
    services: [...(l.catalog || []).slice(0, 4).map((c) => c.name), l.homeCollection ? 'Home sample collection' : 'Results on your phone'].slice(0, 5), tests: l.catalog.map((c) => ({ name: c.name, price: Number(c.price) })), action: 'Book a test' };
  if (a) return { ...base, name: a.operatorName || u.name, title: (a.vehicleType || 'Ambulance') + ' service', rating: a.rating,
    services: ['24/7 emergency response', 'Live tracking to your door', 'Patient transfers'], action: 'Save for emergencies' };
  if (i) return { ...base, name: i.name || u.name, title: i.type ? i.type.charAt(0) + i.type.slice(1).toLowerCase() : 'Hospital', address: i.address, city: i.city, state: i.state, rating: i.rating, reviews: i.reviewCount,
    services: [i.emergencyCare ? '24-hour emergency care' : null, ...(i.departments || []).slice(0, 4).map((x) => x.name), 'Book doctors online'].filter(Boolean).slice(0, 5), action: 'Book a visit' };
  return { ...base, name: u.name, title: ROLE_LABEL[u.role], services: [], action: 'Open' };
}

/** GET /api/public/providers/:id - a provider's public page (no sign-in needed). */
export async function getPublic(req: Request, res: Response) {
  const p = await publicProfile(req.params.id);
  if (!p) throw ApiError.notFound('This provider is not on N-Health');
  res.json({ ...p, referralCode: undefined });
}

/** POST /api/public/providers/:id/visit { deviceId, source } - counts flyer scans (no personal data). */
export async function recordVisit(req: Request, res: Response) {
  const exists = await prisma.user.count({ where: { id: req.params.id, role: { in: ROLES as any } } });
  if (!exists) return res.json({ ok: false });
  const device = str(req.body?.deviceId, 80);
  const deviceKey = device ? crypto.createHash('sha256').update('pp:' + device).digest('hex').slice(0, 32) : null;
  // One visit per device per hour, so refreshing the page does not inflate the count.
  if (deviceKey && (await prisma.providerPageVisit.count({ where: { providerId: req.params.id, deviceKey, createdAt: { gte: new Date(Date.now() - 3600e3) } } }))) return res.json({ ok: true });
  await prisma.providerPageVisit.create({ data: { providerId: req.params.id, deviceKey, source: req.body?.source === 'flyer' ? 'flyer' : 'link' } });
  res.json({ ok: true });
}

/** GET /api/flyer/me - what my flyer shows, my flyer link and how often it was scanned. */
export async function myFlyer(req: Request, res: Response) {
  const p = await publicProfile(uid(req));
  if (!p) throw ApiError.forbidden('Flyers are for providers');
  const since = new Date(Date.now() - 30 * 86400e3);
  const [scans, last30, devices, joined] = await Promise.all([
    prisma.providerPageVisit.count({ where: { providerId: p.id, source: 'flyer' } }),
    prisma.providerPageVisit.count({ where: { providerId: p.id, source: 'flyer', createdAt: { gte: since } } }),
    prisma.providerPageVisit.findMany({ where: { providerId: p.id, deviceKey: { not: null } }, distinct: ['deviceKey'], select: { deviceKey: true } }),
    prisma.user.count({ where: { referredById: p.id } }),
  ]);
  res.json({ ...p, stats: { scans, last30, people: devices.length, joined } });
}
