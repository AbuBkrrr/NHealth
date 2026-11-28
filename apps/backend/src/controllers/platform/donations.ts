import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { notify } from '../../services/notify';
import { settleDonation } from '../../services/checkout';
import { distanceKm } from '../../utils/geo';
import { donationReceiver } from '../../services/splits';
import { getDonationPartner } from '../../services/settings';
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
  const c = await prisma.donationCampaign.findUnique({ where: { id: req.params.id }, include: { institution: { select: { name: true, phone: true, address: true, userId: true } }, organizer: { select: { name: true, phone: true, email: true } },
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
  const own = await prisma.institutionProfile.findUnique({ where: { userId: uid(req) } });
  // Money raised goes straight to the treating hospital (never through N-Health), so money campaigns need one.
  let inst = own;
  if (!own && b.hospitalId) inst = await prisma.institutionProfile.findFirst({ where: { id: String(b.hospitalId), user: { verificationStatus: 'VERIFIED', isActive: true } } });
  const ngo = await getDonationPartner();
  if ((type === 'FUND' || type === 'PATIENT_CASE') && !inst && !ngo.enabled) throw ApiError.badRequest('Choose the hospital treating the patient: donations are paid straight to the hospital');
  const c = await prisma.donationCampaign.create({ data: {
    type, title: str(b.title, 160)!, description: str(b.description, 5000)!, beneficiaryName: str(b.beneficiaryName, 120), organizerId: uid(req), institutionId: inst?.id,
    goalAmount: num(b.goalAmount) || 0, currency: str(b.currency, 3)?.toUpperCase() || 'NGN', bloodType: str(b.bloodType, 5), organ: str(b.organ, 40), unitsNeeded: num(b.unitsNeeded),
    urgency: ['NORMAL', 'URGENT', 'CRITICAL'].includes(b.urgency) ? b.urgency : 'NORMAL', location: str(b.location, 300), lat: num(b.lat), lng: num(b.lng),
    contactName: str(b.contactName, 120), contactPhone: str(b.contactPhone, 30), contactEmail: str(b.contactEmail, 120), imageUrl: str(b.imageUrl, 2000), deadline: date(b.deadline),
    status: own ? 'ACTIVE' : 'PENDING_REVIEW',
  } });
  if (inst && !own) await notify(inst.userId, 'donation', 'Fundraising for one of your patients', `"${c.title}" was created for a patient at your hospital. Donations are paid straight to ${ngo.enabled ? ngo.name + ' (our registered NGO partner)' : 'your hospital\'s account'}. N-Health will review it before it goes live.`, { email: true, data: { campaignId: c.id } });
  res.status(201).json(c);
}
/**
 * POST /api/donations/campaigns/:id/donate { amount, anonymous, message }
 * Records the donation and returns how to pay the hospital directly: by card (the gateway settles 100% to the
 * hospital's account) or by bank transfer to the hospital, which then confirms receipt. N-Health never holds the money.
 */
export async function donate(req: Request, res: Response) {
  const amount = Math.round(Number(req.body.amount));
  if (!(amount >= 100)) throw ApiError.badRequest('Minimum donation is ₦100');
  const c = await prisma.donationCampaign.findUnique({ where: { id: req.params.id }, include: { institution: true } });
  if (!c || c.status !== 'ACTIVE' || !['FUND', 'PATIENT_CASE'].includes(c.type)) throw ApiError.badRequest('This campaign is not accepting money');
  const rcv = await donationReceiver(c);
  if (!rcv) throw ApiError.badRequest('This campaign has no receiving hospital yet');
  const p = await patientOf(uid(req));
  const d = await prisma.donation.create({ data: { patientId: p.id, campaign: c.title, campaignId: c.id, amount, anonymous: !!req.body.anonymous, message: str(req.body.message, 300), currency: c.currency, reference: 'DN-' + crypto.randomBytes(6).toString('hex') } });
  res.status(201).json({
    donationId: d.id, reference: d.reference, amount, receiver: { kind: rcv.kind, name: rcv.name, regNumber: rcv.regNumber || null }, hospital: c.institution?.name || null,
    card: !!(rcv.paystackSubaccount || rcv.flutterwaveSubaccount),
    bank: rcv.accountNumber ? { bankName: rcv.bankName, accountNumber: rcv.accountNumber, accountName: rcv.accountName } : null,
  });
}

/** GET /api/donations/campaigns/:id/transfers - the receiving hospital sees bank-transfer donations to confirm. */
export async function pendingTransfers(req: Request, res: Response) {
  const c = await prisma.donationCampaign.findUnique({ where: { id: req.params.id }, include: { institution: true } });
  if (!c || ((req as any).user?.role !== 'ADMIN' && c.institution?.userId !== uid(req) && c.organizerId !== uid(req))) throw ApiError.notFound('Campaign not found');
  res.json(await prisma.donation.findMany({ where: { campaignId: c.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 200,
    select: { id: true, amount: true, reference: true, anonymous: true, createdAt: true, patient: { select: { user: { select: { name: true } } } } } }));
}

/** POST /api/donations/:donationId/received - the hospital confirms a bank transfer reached its account. */
export async function confirmTransfer(req: Request, res: Response) {
  const d = await prisma.donation.findUnique({ where: { id: req.params.donationId } });
  const c = d?.campaignId ? await prisma.donationCampaign.findUnique({ where: { id: d.campaignId }, include: { institution: true } }) : null;
  const admin = (req as any).user?.role === 'ADMIN';
  if (!d || !c || (!admin && c.institution?.userId !== uid(req))) throw ApiError.notFound('Donation not found');
  // With an NGO partner, transfers land in the NGO's account, so N-Health staff confirm them from the NGO's statement.
  if (!admin && (await getDonationPartner()).enabled) throw ApiError.forbidden('Donations go to our NGO partner; N-Health confirms them');
  if (d.status !== 'PENDING') throw ApiError.conflict('Already confirmed');
  await settleDonation(d.id);
  const donor = await prisma.patientProfile.findUnique({ where: { id: d.patientId } });
  if (donor) await notify(donor.userId, 'donation', 'Thank you ❤️', `${(await donationReceiver(c))?.name || 'The receiver'} confirmed your donation of ₦${Number(d.amount).toLocaleString()} for "${c.title}".`);
  res.json({ ok: true });
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
/**
 * POST /api/insurance/plans/:id/enrol { memberCount, note } - N-Health passes the request to the HMO, which enrols the
 * patient and collects the premium itself (selling or administering health plans needs NHIA accreditation).
 */
export async function requestEnrolment(req: Request, res: Response) {
  const plan = await prisma.insurancePlan.findFirst({ where: { id: req.params.id, isActive: true } });
  if (!plan) throw ApiError.notFound('Plan not found');
  const p = await patientOf(uid(req));
  const members = Math.max(1, Math.min(20, Math.round(num(req.body.memberCount) || 1)));
  const open = await prisma.insurancePolicy.findFirst({ where: { patientId: p.id, planId: plan.id, status: 'REQUESTED' } });
  const policy = open || await prisma.insurancePolicy.create({ data: {
    patientId: p.id, planId: plan.id, provider: plan.provider, memberCount: members, status: 'REQUESTED',
    policyNumber: 'REQ-' + Date.now().toString(36).toUpperCase(), premiumAmount: Number(plan.monthlyPremium) * members, coverageDetails: str(req.body.note, 500),
  } });
  const u = await prisma.user.findUnique({ where: { id: uid(req) }, select: { name: true, phone: true, email: true } });
  const { getInsuranceBroker } = await import('../../services/settings');
  const broker = await getInsuranceBroker();
  const who = `${u?.name} (${[u?.phone, u?.email].filter(Boolean).join(', ')})`;
  const what = `${plan.name} by ${plan.provider} for ${members} ${members > 1 ? 'people' : 'person'}${policy.coverageDetails ? '. Note: ' + policy.coverageDetails : ''}`;
  if (broker.enabled) {
    // Our licensed broker partner advises the patient and arranges the cover; N-Health only passes the request on.
    const { sendEmail } = await import('../../services/email');
    const { escapeHtml } = await import('../../services/notify');
    await sendEmail(broker.email, `New health insurance request: ${plan.name}`, 'New enrolment request from N-Health',
      `${escapeHtml(who)} asked to join <b>${escapeHtml(what)}</b>.<br>Reference: ${policy.policyNumber}.<br>Please contact them to advise and arrange the cover. The patient agreed to share these details with you.`);
  }
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, 'insurance', 'Insurance enrolment request', `${who} wants ${what}. ${broker.enabled ? 'Sent to ' + broker.name + '.' : 'Pass it to the HMO or broker.'}`, { email: true, data: { policyId: policy.id } })));
  const by = broker.enabled ? broker.name + ', our licensed insurance broker partner,' : plan.provider;
  await notify(uid(req), 'insurance', 'Request sent', `${by} will contact you to complete enrolment. You pay for cover directly; N-Health never collects premiums.`);
  res.status(201).json(policy);
}
/** Premiums are paid to the HMO, not through N-Health. */
export async function payPremium(_req: Request, _res: Response) {
  throw ApiError.badRequest('Premiums are paid directly to the HMO. Use "Request enrolment" and the HMO will contact you.');
}

/** GET/PUT /api/admin-ops/donation-partner - the registered NGO that receives donations. */
export async function getPartner(_req: Request, res: Response) { res.json(await getDonationPartner()); }
export async function putPartner(req: Request, res: Response) {
  const { saveDonationPartner } = await import('../../services/settings');
  try { res.json(await saveDonationPartner(req.body || {}, uid(req))); } catch (e: any) { throw new ApiError(e.status || 400, e.message); }
}
/** GET /api/admin-ops/donations/pending - bank-transfer donations waiting to be confirmed against the receiver's statement. */
export async function adminPendingDonations(_req: Request, res: Response) {
  res.json(await prisma.donation.findMany({ where: { status: 'PENDING', campaignId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 500,
    select: { id: true, amount: true, reference: true, createdAt: true, campaign: true, campaignId: true, patient: { select: { user: { select: { name: true, email: true } } } } } }));
}

/** GET/PUT /api/admin-ops/insurance-broker - the licensed broker that receives enrolment requests. */
export async function getBroker(_req: Request, res: Response) { const { getInsuranceBroker } = await import('../../services/settings'); res.json(await getInsuranceBroker()); }
export async function putBroker(req: Request, res: Response) {
  const { saveInsuranceBroker } = await import('../../services/settings');
  try { res.json(await saveInsuranceBroker(req.body || {}, uid(req))); } catch (e: any) { throw new ApiError(e.status || 400, e.message); }
}
