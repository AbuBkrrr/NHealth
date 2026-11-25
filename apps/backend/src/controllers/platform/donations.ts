import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { notify } from '../../services/notify';
import { payWithCoins } from '../../services/checkout';
import { distanceKm } from '../../utils/geo';
import { uid, str, num, date, patientOf } from './util';

const TYPES = ['FUND', 'PATIENT_CASE', 'BLOOD', 'ORGAN'];

/** GET /api/donations/campaigns?type=BLOOD&lat&lng */
export async function listCampaigns(req: Request, res: Response) {
  const where: any = { status: req.query.status === 'all' ? undefined : 'ACTIVE' };
  if (req.query.mine === '1') { delete where.status; where.organizerId = uid(req); }
  const type = str(req.query.type)?.toUpperCase();
  if (type && TYPES.includes(type)) where.type = type;
  if (req.query.bloodType) where.bloodType = String(req.query.bloodType);
  const items = await prisma.donationCampaign.findMany({ where, orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }], take: 100,
    include: { institution: { select: { name: true } }, organizer: { select: { name: true, verificationStatus: true } } } });
  const lat = num(req.query.lat), lng = num(req.query.lng);
  res.json(items.map((c) => ({ ...c, distanceKm: lat !== undefined && lng !== undefined && c.lat != null && c.lng != null ? Math.round(distanceKm(lat, lng, c.lat, c.lng) * 10) / 10 : null })));
}
export async function getCampaign(req: Request, res: Response) {
  const c = await prisma.donationCampaign.findUnique({ where: { id: req.params.id }, include: { institution: { select: { name: true, phone: true, address: true } }, organizer: { select: { name: true, phone: true, email: true } },
    donations: { where: { status: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, take: 20, select: { amount: true, anonymous: true, message: true, createdAt: true, patient: { select: { user: { select: { name: true } } } } } } } });
  if (!c) throw ApiError.notFound('Campaign not found');
  const donations = c.donations.map((d) => ({ amount: d.amount, message: d.message, createdAt: d.createdAt, donor: d.anonymous ? 'Anonymous' : d.patient.user.name }));
  res.json({ ...c, donations });
}
/** POST /api/donations/campaigns - anyone can request; goes live after admin review (fraud protection). */
export async function createCampaign(req: Request, res: Response) {
  const b = req.body || {};
  const type = String(b.type || '').toUpperCase();
  if (!TYPES.includes(type)) throw ApiError.badRequest('Type must be FUND, PATIENT_CASE, BLOOD or ORGAN');
  if (!str(b.title) || !str(b.description)) throw ApiError.badRequest('Title and description are required');
  if ((type === 'FUND' || type === 'PATIENT_CASE') && !(num(b.goalAmount)! > 0)) throw ApiError.badRequest('Set a goal amount');
  const inst = await prisma.institutionProfile.findUnique({ where: { userId: uid(req) } });
  const c = await prisma.donationCampaign.create({ data: {
    type, title: str(b.title, 160)!, description: str(b.description, 5000)!, beneficiaryName: str(b.beneficiaryName, 120), organizerId: uid(req), institutionId: inst?.id,
    goalAmount: num(b.goalAmount) || 0, currency: str(b.currency, 3)?.toUpperCase() || 'NGN', bloodType: str(b.bloodType, 5), organ: str(b.organ, 40), unitsNeeded: num(b.unitsNeeded),
    urgency: ['NORMAL', 'URGENT', 'CRITICAL'].includes(b.urgency) ? b.urgency : 'NORMAL', location: str(b.location, 300), lat: num(b.lat), lng: num(b.lng),
    contactName: str(b.contactName, 120), contactPhone: str(b.contactPhone, 30), contactEmail: str(b.contactEmail, 120), imageUrl: str(b.imageUrl, 2000), deadline: date(b.deadline),
    status: inst ? 'ACTIVE' : 'PENDING_REVIEW',
  } });
  res.status(201).json(c);
}
/** POST /api/donations/campaigns/:id/donate { amount, anonymous, message } - pays with coins and updates progress. */
export async function donate(req: Request, res: Response) {
  const amount = Number(req.body.amount);
  if (!(amount >= 100)) throw ApiError.badRequest('Minimum donation is 100');
  const c = await prisma.donationCampaign.findUnique({ where: { id: req.params.id } });
  if (!c || c.status !== 'ACTIVE' || !['FUND', 'PATIENT_CASE'].includes(c.type)) throw ApiError.badRequest('This campaign is not accepting money');
  const p = await patientOf(uid(req));
  const d = await prisma.donation.create({ data: { patientId: p.id, campaign: c.title, campaignId: c.id, amount, anonymous: !!req.body.anonymous, message: str(req.body.message, 300), currency: c.currency, reference: 'DN-' + crypto.randomBytes(6).toString('hex') } });
  await payWithCoins(uid(req), 'DONATION', d.id);
  res.status(201).json(await prisma.donationCampaign.findUnique({ where: { id: c.id } }));
}

// ---------- Blood / organ pledges ----------
/** POST /api/donations/eligibility - WHO-style quick screen for whole-blood donation. Not a diagnosis. */
export async function bloodEligibility(req: Request, res: Response) {
  const b = req.body || {};
  const reasons: string[] = [];
  const age = num(b.age), weight = num(b.weight), hb = num(b.hemoglobin);
  if (age === undefined || age < 18 || age > 65) reasons.push('Donors must be 18-65 years old');
  if (weight === undefined || weight < 50) reasons.push('Minimum weight is 50 kg');
  if (hb !== undefined && hb < (b.gender === 'female' ? 12.5 : 13)) reasons.push('Haemoglobin is below the safe level');
  if (b.recentIllness) reasons.push('Wait until 14 days after recovering from illness');
  if (b.recentTattoo) reasons.push('Wait 6-12 months after a tattoo or piercing');
  if (b.pregnant) reasons.push('Not eligible during pregnancy or within 6 months after delivery');
  const p = await prisma.patientProfile.findUnique({ where: { userId: uid(req) } });
  if (p?.lastBloodDonationAt && Date.now() - p.lastBloodDonationAt.getTime() < 56 * 86400_000) reasons.push('At least 8 weeks are required between whole-blood donations');
  res.json({ eligible: reasons.length === 0, reasons, bloodType: p?.bloodType || null });
}
export async function createPledge(req: Request, res: Response) {
  const type = String(req.body.type || '').toUpperCase();
  if (!['BLOOD', 'ORGAN'].includes(type)) throw ApiError.badRequest('Type must be BLOOD or ORGAN');
  const campaign = req.body.campaignId ? await prisma.donationCampaign.findUnique({ where: { id: String(req.body.campaignId) }, include: { organizer: true } }) : null;
  const center = req.body.centerId ? await prisma.donationCenter.findUnique({ where: { id: String(req.body.centerId) } }) : null;
  const p = await prisma.donorPledge.create({ data: { donorId: uid(req), type, campaignId: campaign?.id, centerId: center?.id, centerName: center?.name || str(req.body.centerName, 160) || campaign?.location, scheduledAt: date(req.body.scheduledAt), eligibility: req.body.eligibility ?? undefined } });
  if (campaign) {
    await prisma.donationCampaign.update({ where: { id: campaign.id }, data: { unitsPledged: { increment: 1 } } });
    const donor = await prisma.user.findUnique({ where: { id: uid(req) }, select: { name: true, phone: true } });
    await notify(campaign.organizerId, 'donation', `New ${type.toLowerCase()} donor 🩸`, `${donor?.name} pledged for "${campaign.title}"${p.scheduledAt ? ' on ' + p.scheduledAt.toISOString().slice(0, 16) : ''}. Contact: ${donor?.phone || 'via messages'}.`, { email: true, data: { pledgeId: p.id } });
  }
  // The donor sees who requested and how to reach them.
  res.status(201).json({ ...p, contact: campaign ? { name: campaign.contactName || campaign.organizer.name, phone: campaign.contactPhone || campaign.organizer.phone, email: campaign.contactEmail || campaign.organizer.email, location: campaign.location, organizerUserId: campaign.organizerId } : center ? { name: center.name, phone: center.phone, location: center.address } : null });
}
export async function myPledges(req: Request, res: Response) {
  res.json(await prisma.donorPledge.findMany({ where: { donorId: uid(req) }, orderBy: { createdAt: 'desc' }, include: { campaign: { select: { title: true, contactName: true, contactPhone: true, location: true, organizerId: true } } } }));
}
export async function updatePledge(req: Request, res: Response) {
  const pl = await prisma.donorPledge.findUnique({ where: { id: req.params.id }, include: { campaign: true } });
  const me = uid(req);
  if (!pl || (pl.donorId !== me && pl.campaign?.organizerId !== me)) throw ApiError.notFound('Pledge not found');
  const status = String(req.body.status || '').toUpperCase();
  if (!['CANCELLED', 'COMPLETED', 'SCHEDULED'].includes(status)) throw ApiError.badRequest('Invalid status');
  const u = await prisma.donorPledge.update({ where: { id: pl.id }, data: { status, scheduledAt: date(req.body.scheduledAt) ?? undefined } });
  if (status === 'COMPLETED' && pl.type === 'BLOOD') await prisma.patientProfile.updateMany({ where: { userId: pl.donorId }, data: { lastBloodDonationAt: new Date(), isBloodDonor: true } });
  if (status === 'COMPLETED') await notify(pl.donorId, 'donation', 'Thank you, hero ❤️', 'Your donation was recorded. You just helped save a life.');
  res.json(u);
}
export async function campaignPledges(req: Request, res: Response) {
  const c = await prisma.donationCampaign.findUnique({ where: { id: req.params.id } });
  if (!c || c.organizerId !== uid(req)) throw ApiError.notFound('Campaign not found');
  res.json(await prisma.donorPledge.findMany({ where: { campaignId: c.id }, orderBy: { createdAt: 'desc' }, include: { donor: { select: { id: true, name: true, phone: true, email: true } } } }));
}

// ---------- Organ donor registry ----------
export async function getOrganRegistration(req: Request, res: Response) {
  res.json(await prisma.organDonorRegistration.findUnique({ where: { userId: uid(req) } }));
}
export async function registerOrganDonor(req: Request, res: Response) {
  const organs = Array.isArray(req.body.organs) ? req.body.organs.map((o: any) => String(o).slice(0, 30)).slice(0, 12) : [];
  if (!organs.length) throw ApiError.badRequest('Choose at least one organ or tissue');
  if (!req.body.consent) throw ApiError.badRequest('Consent is required');
  const data = { organs, livingDonor: !!req.body.livingDonor, nextOfKinName: str(req.body.nextOfKinName, 120), nextOfKinPhone: str(req.body.nextOfKinPhone, 30), status: 'ACTIVE', consentAt: new Date() };
  const r = await prisma.organDonorRegistration.upsert({ where: { userId: uid(req) }, create: { userId: uid(req), donorCardNo: 'OD-' + crypto.randomBytes(4).toString('hex').toUpperCase(), ...data }, update: data });
  await notify(uid(req), 'donation', 'Organ donor registration ✅', `You are registered. Donor card ${r.donorCardNo}. Tell your family about your decision.`);
  res.status(201).json(r);
}
export async function withdrawOrganDonor(req: Request, res: Response) {
  await prisma.organDonorRegistration.updateMany({ where: { userId: uid(req) }, data: { status: 'WITHDRAWN' } });
  res.json({ ok: true });
}
export async function listCenters(req: Request, res: Response) {
  const lat = num(req.query.lat), lng = num(req.query.lng);
  const where: any = { isActive: true };
  if (req.query.type) where.type = { in: [String(req.query.type).toUpperCase(), 'BOTH'] };
  const items = await prisma.donationCenter.findMany({ where, take: 200 });
  res.json(items.map((c) => ({ ...c, distanceKm: lat !== undefined && lng !== undefined && c.lat != null && c.lng != null ? Math.round(distanceKm(lat, lng, c.lat, c.lng) * 10) / 10 : null }))
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)));
}
export async function listInsurancePlans(_req: Request, res: Response) {
  res.json(await prisma.insurancePlan.findMany({ where: { isActive: true }, orderBy: { monthlyPremium: 'asc' } }));
}
/** POST /api/insurance/policies/:id/pay - pays the first premium with coins and activates it. */
export async function payPremium(req: Request, res: Response) {
  res.status(201).json(await payWithCoins(uid(req), 'INSURANCE_POLICY', req.params.id));
}
