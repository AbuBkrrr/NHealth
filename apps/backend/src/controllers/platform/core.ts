import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { enabledGateways } from '../../services/gateways';
import { SUPPORTED_CURRENCIES, ratesPerNgn } from '../../services/currency';
import { DIDIT_CONFIGURED } from '../../services/didit';
import { vapidPublicKey, notify } from '../../services/notify';
import { storeFile, parseDataUri } from '../../services/storage';
import { distanceKm } from '../../utils/geo';
import { getFinance } from '../../services/settings';
import { str, num, uid, page } from './util';

/** GET /api/config - public runtime configuration for the apps. */
export async function config(_req: Request, res: Response) {
  const fin = await getFinance();
  res.json({
    cashEnabled: fin.cashEnabled, commission: fin.commission,
    gateways: enabledGateways(), escrow: !!process.env.PAYSCROW_API_KEY, kyc: DIDIT_CONFIGURED(), vapidPublicKey: vapidPublicKey(),
    currencies: SUPPORTED_CURRENCIES, rates: await ratesPerNgn(), baseCurrency: 'NGN', serviceFeePercent: fin.patientServiceFeePercent,
    posTaxPercent: fin.posTaxPercent, emergencyMinBalance: env.raw.EMERGENCY_MIN_BALANCE, googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    emergencyNumbers: { NG: ['112', '767', '199'], GH: ['112', '193'], KE: ['999', '112'], ZA: ['10177', '112'], US: ['911'], GB: ['999', '112'], DEFAULT: ['112'] },
  });
}

/** POST /api/uploads { dataUri, folder, private } -> { url } */
export async function upload(req: Request, res: Response) {
  const folder = ['avatars', 'documents', 'health', 'chat', 'invoices', 'campaigns', 'lab-results', 'kyc'].includes(req.body.folder) ? req.body.folder : 'misc';
  const { buf, mime } = parseDataUri(req.body.dataUri);
  const f = await storeFile(buf, mime, `${folder}/${uid(req)}`, !!req.body.private || ['documents', 'health', 'kyc', 'lab-results'].includes(folder));
  res.status(201).json(f);
}

// ---------- Notifications ----------
export async function listNotifications(req: Request, res: Response) {
  const { take, skip } = page(req);
  const where: any = { userId: uid(req) };
  if (req.query.unread === '1') where.readAt = null;
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.notification.count({ where: { userId: uid(req), readAt: null } }),
  ]);
  res.json({ items, unread });
}
export async function readNotification(req: Request, res: Response) {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: uid(req) }, data: { readAt: new Date() } });
  res.json({ ok: true });
}
export async function readAllNotifications(req: Request, res: Response) {
  await prisma.notification.updateMany({ where: { userId: uid(req), readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true });
}
export async function pushSubscribe(req: Request, res: Response) {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw ApiError.badRequest('Invalid push subscription');
  await prisma.pushSubscription.upsert({ where: { endpoint }, create: { userId: uid(req), endpoint, p256dh: keys.p256dh, auth: keys.auth }, update: { userId: uid(req), p256dh: keys.p256dh, auth: keys.auth } });
  res.status(201).json({ ok: true });
}
export async function pushUnsubscribe(req: Request, res: Response) {
  await prisma.pushSubscription.deleteMany({ where: { userId: uid(req), endpoint: String(req.body?.endpoint || '') } });
  res.json({ ok: true });
}

// ---------- Directory (providers & facilities search) ----------
const ROLE_ICON: Record<string, string> = { DOCTOR: '👨‍⚕️', NURSE: '👩‍⚕️', PHARMACY: '💊', LAB: '🔬', AMBULANCE: '🚑', INSTITUTION: '🏥' };

function flatten(u: any) {
  const d = u.doctorProfile, n = u.nurseProfile, p = u.pharmacyProfile, l = u.labProfile, a = u.ambulanceProfile, i = u.institutionProfile;
  const base = { userId: u.id, role: u.role, name: u.name, avatarUrl: u.avatarUrl, icon: ROLE_ICON[u.role] || '👤', verified: u.verificationStatus === 'VERIFIED', phone: u.phone, email: u.email };
  if (d) return { ...base, profileId: d.id, title: d.specialty, location: d.hospital || d.city || '', city: d.city, fee: Number(d.consultationFee), rating: d.rating, reviewCount: d.reviewCount, experience: d.yearsExperience, qualifications: d.qualifications, languages: d.languages, bio: d.bio, lat: d.lat, lng: d.lng, homeVisit: d.homeVisit, institutionId: d.institutionId };
  if (n) return { ...base, profileId: n.id, title: n.specialty || 'General Nursing', location: n.city || '', city: n.city, fee: Number(n.hourlyRate), rating: n.rating, reviewCount: n.reviewCount, experience: n.yearsExperience, bio: n.bio, available: n.isAvailable, lat: n.lat, lng: n.lng };
  if (p) return { ...base, profileId: p.id, name: p.pharmacyName || u.name, title: 'Pharmacy', location: p.address || '', city: p.city, rating: p.rating, reviewCount: p.reviewCount, hours: p.operatingHours, homeDelivery: p.homeDelivery, lat: p.lat, lng: p.lng };
  if (l) return { ...base, profileId: l.id, name: l.labName || u.name, title: 'Diagnostic Lab', location: l.address || '', city: l.city, rating: l.rating, reviewCount: l.reviewCount, hours: l.operatingHours, homeCollection: l.homeCollection, lat: l.lat, lng: l.lng };
  if (a) return { ...base, profileId: a.id, name: a.operatorName || u.name, title: (a.vehicleType || 'Ambulance') + ' • ' + a.vehicleNumber, location: '', fee: Number(a.baseFee), rating: a.rating, available: a.isAvailable, lat: a.currentLat, lng: a.currentLng };
  if (i) return { ...base, profileId: i.id, name: i.name || u.name, title: i.type, location: [i.address, i.city, i.state].filter(Boolean).join(', '), city: i.city, rating: i.rating, reviewCount: i.reviewCount, beds: i.bedsAvailable, emergencyCare: i.emergencyCare, description: i.description, lat: i.lat, lng: i.lng };
  return base;
}

/** GET /api/directory?type=DOCTOR&q=&city=&lat=&lng=&verified=1&sort=rating|distance|fee */
export async function directory(req: Request, res: Response) {
  const type = str(req.query.type)?.toUpperCase();
  const q = str(req.query.q, 80);
  const where: any = { isActive: true, deletedAt: null, role: type && type !== 'ALL' ? type : { in: Object.keys(ROLE_ICON) } };
  if (req.query.verified === '1') where.verificationStatus = 'VERIFIED';
  if (q) where.OR = [
    { name: { contains: q, mode: 'insensitive' } },
    { doctorProfile: { specialty: { contains: q, mode: 'insensitive' } } },
    { doctorProfile: { hospital: { contains: q, mode: 'insensitive' } } },
    { nurseProfile: { specialty: { contains: q, mode: 'insensitive' } } },
    { pharmacyProfile: { pharmacyName: { contains: q, mode: 'insensitive' } } },
    { labProfile: { labName: { contains: q, mode: 'insensitive' } } },
    { institutionProfile: { name: { contains: q, mode: 'insensitive' } } },
  ];
  const users = await prisma.user.findMany({
    where, take: 200,
    include: { doctorProfile: true, nurseProfile: true, pharmacyProfile: true, labProfile: true, ambulanceProfile: true, institutionProfile: true },
  });
  const lat = num(req.query.lat), lng = num(req.query.lng);
  const city = str(req.query.city)?.toLowerCase();
  let items: any[] = users.map(flatten).filter((x: any) => !city || String(x.city || x.location || '').toLowerCase().includes(city));
  if (lat !== undefined && lng !== undefined) items = items.map((x) => ({ ...x, distanceKm: x.lat != null && x.lng != null ? Math.round(distanceKm(lat, lng, x.lat, x.lng) * 10) / 10 : null }));
  const sort = str(req.query.sort);
  items.sort((a, b) => sort === 'distance' ? (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)
    : sort === 'fee' ? (a.fee ?? 1e12) - (b.fee ?? 1e12)
    : (Number(b.verified) - Number(a.verified)) || (b.rating ?? 0) - (a.rating ?? 0));
  res.json(items.slice(0, 100));
}

/** GET /api/directory/:userId - provider detail with reviews and (for institutions) departments. */
export async function directoryDetail(req: Request, res: Response) {
  const u = await prisma.user.findFirst({
    where: { id: req.params.userId, isActive: true, deletedAt: null },
    include: { doctorProfile: true, nurseProfile: true, pharmacyProfile: true, labProfile: { include: { catalog: { where: { isActive: true } } } }, ambulanceProfile: true,
      institutionProfile: { include: { departments: true, doctors: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } } } },
  });
  if (!u || !ROLE_ICON[u.role]) throw ApiError.notFound('Provider not found');
  const reviews = await prisma.review.findMany({ where: { targetId: u.id }, orderBy: { createdAt: 'desc' }, take: 20, include: { author: { select: { name: true, avatarUrl: true } } } });
  res.json({ ...flatten(u), reviews, catalog: (u as any).labProfile?.catalog, departments: (u as any).institutionProfile?.departments, doctors: (u as any).institutionProfile?.doctors });
}

// ---------- Reviews ----------
export async function createReview(req: Request, res: Response) {
  const rating = Math.round(Number(req.body.rating));
  if (!(rating >= 1 && rating <= 5)) throw ApiError.badRequest('Rating must be 1-5');
  const contextType = String(req.body.contextType || '');
  const contextId = String(req.body.contextId || '');
  const me = uid(req);
  // The reviewer must have actually received a completed service from the target.
  let targetId: string | undefined;
  if (contextType === 'APPOINTMENT') {
    const a = await prisma.appointment.findUnique({ where: { id: contextId }, include: { patient: true, doctor: true } });
    if (a?.patient.userId === me && a.status === 'COMPLETED') targetId = a.doctor.userId;
  } else if (contextType === 'PHARMACY_ORDER') {
    const o = await prisma.pharmacyOrder.findUnique({ where: { id: contextId }, include: { patient: true, pharmacy: true } });
    if (o?.patient.userId === me && o.status === 'DELIVERED') targetId = o.pharmacy.userId;
  } else if (contextType === 'LAB_TEST') {
    const t = await prisma.labTest.findUnique({ where: { id: contextId }, include: { patient: true, lab: true } });
    if (t?.patient.userId === me && t.status === 'COMPLETED') targetId = t.lab.userId;
  } else if (contextType === 'NURSE_REQUEST') {
    const n = await prisma.nurseRequest.findUnique({ where: { id: contextId }, include: { patient: true, nurse: true } });
    if (n?.patient.userId === me && n.status === 'COMPLETED' && n.nurse) targetId = n.nurse.userId;
  } else if (contextType === 'EMERGENCY') {
    const e = await prisma.emergencyRequest.findUnique({ where: { id: contextId }, include: { patient: true, ambulance: true } });
    if (e?.patient.userId === me && e.status === 'COMPLETED' && e.ambulance) targetId = e.ambulance.userId;
  }
  if (!targetId) throw ApiError.badRequest('You can review a provider after a completed service');
  const review = await prisma.review.create({ data: { authorId: me, targetId, rating, comment: str(req.body.comment, 1000), contextType, contextId } });
  const agg = await prisma.review.aggregate({ where: { targetId }, _avg: { rating: true }, _count: true });
  const avg = Math.round((agg._avg.rating || 0) * 10) / 10, cnt = agg._count;
  await Promise.all([
    prisma.doctorProfile.updateMany({ where: { userId: targetId }, data: { rating: avg, reviewCount: cnt } }),
    prisma.nurseProfile.updateMany({ where: { userId: targetId }, data: { rating: avg, reviewCount: cnt } }),
    prisma.pharmacyProfile.updateMany({ where: { userId: targetId }, data: { rating: avg, reviewCount: cnt } }),
    prisma.labProfile.updateMany({ where: { userId: targetId }, data: { rating: avg, reviewCount: cnt } }),
    prisma.ambulanceProfile.updateMany({ where: { userId: targetId }, data: { rating: avg } }),
  ]);
  await notify(targetId, 'system', `New ${rating}⭐ review`, review.comment ? review.comment.slice(0, 100) : 'A patient rated your service.');
  res.status(201).json(review);
}
export async function listReviews(req: Request, res: Response) {
  res.json(await prisma.review.findMany({ where: { targetId: req.params.userId }, orderBy: { createdAt: 'desc' }, take: 50, include: { author: { select: { name: true, avatarUrl: true } } } }));
}

// ---------- Referrals ----------
export async function listReferrals(req: Request, res: Response) {
  const me = uid(req);
  const [received, sent] = await Promise.all([
    prisma.referral.findMany({ where: { toId: me }, orderBy: { createdAt: 'desc' }, include: { from: { select: { id: true, name: true, role: true } } } }),
    prisma.referral.findMany({ where: { fromId: me }, orderBy: { createdAt: 'desc' }, include: { to: { select: { id: true, name: true, role: true } } } }),
  ]);
  const pids = [...new Set([...received, ...sent].map((r) => r.patientUserId))];
  const patients = await prisma.user.findMany({ where: { id: { in: pids } }, select: { id: true, name: true, phone: true } });
  const pm = Object.fromEntries(patients.map((p) => [p.id, p]));
  res.json({ received: received.map((r) => ({ ...r, patient: pm[r.patientUserId] })), sent: sent.map((r) => ({ ...r, patient: pm[r.patientUserId] })) });
}
export async function createReferral(req: Request, res: Response) {
  const toId = String(req.body.toId || ''), patientUserId = String(req.body.patientUserId || '');
  if (!toId || !patientUserId) throw ApiError.badRequest('Choose a provider and patient');
  const r = await prisma.referral.create({ data: { fromId: uid(req), toId, patientUserId, reason: str(req.body.reason, 1000) || 'Referral', appointmentId: str(req.body.appointmentId) } });
  await notify(toId, 'appointment', 'New referral', r.reason, { data: { referralId: r.id } });
  await notify(patientUserId, 'appointment', 'You have been referred', 'Your provider referred you for further care. Check Messages for details.', { data: { referralId: r.id } });
  res.status(201).json(r);
}
export async function respondReferral(req: Request, res: Response) {
  const status = String(req.body.status || '').toUpperCase();
  if (!['ACCEPTED', 'DECLINED', 'COMPLETED'].includes(status)) throw ApiError.badRequest('Invalid status');
  const r = await prisma.referral.findUnique({ where: { id: req.params.id } });
  if (!r || r.toId !== uid(req)) throw ApiError.notFound('Referral not found');
  const u = await prisma.referral.update({ where: { id: r.id }, data: { status } });
  await notify(r.fromId, 'appointment', 'Referral ' + status.toLowerCase(), 'Your referral was ' + status.toLowerCase() + '.');
  res.json(u);
}

// ---------- Articles & support ----------
export async function listArticles(req: Request, res: Response) {
  const where: any = {};
  if (req.query.category) where.category = String(req.query.category);
  res.json(await prisma.healthArticle.findMany({ where, orderBy: { publishedAt: 'desc' }, take: 50, select: { id: true, slug: true, title: true, summary: true, category: true, imageUrl: true, publishedAt: true } }));
}
export async function getArticle(req: Request, res: Response) {
  const a = await prisma.healthArticle.findUnique({ where: { slug: req.params.slug } });
  if (!a) throw ApiError.notFound('Article not found');
  res.json(a);
}
export async function createTicket(req: Request, res: Response) {
  const u = await prisma.user.findUnique({ where: { id: uid(req) } });
  const subject = str(req.body.subject, 200), message = str(req.body.message, 5000);
  if (!subject || !message) throw ApiError.badRequest('Subject and message are required');
  const t = await prisma.supportTicket.create({ data: { userId: u!.id, userName: u!.name, userEmail: u!.email, subject, message, category: str(req.body.category, 50) || 'general', priority: req.body.priority === 'high' ? 'high' : 'normal' } });
  res.status(201).json(t);
}
export async function myTickets(req: Request, res: Response) {
  res.json(await prisma.supportTicket.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' } }));
}

// ---------- Unified provider profile ----------
const PROFILE_FIELDS: Record<string, { model: string; text: string[]; nums: string[]; bools: string[] }> = {
  DOCTOR: { model: 'doctorProfile', text: ['specialty', 'hospital', 'bio', 'languages', 'qualifications', 'city', 'state', 'country', 'licenseNumber'], nums: ['consultationFee', 'yearsExperience', 'lat', 'lng', 'slotMinutes'], bools: ['homeVisit'] },
  NURSE: { model: 'nurseProfile', text: ['specialty', 'bio', 'city', 'state', 'licenseNumber'], nums: ['hourlyRate', 'yearsExperience', 'lat', 'lng'], bools: ['isAvailable'] },
  PHARMACY: { model: 'pharmacyProfile', text: ['pharmacyName', 'address', 'operatingHours', 'phone', 'city', 'state', 'country', 'licenseNumber'], nums: ['lat', 'lng'], bools: ['homeDelivery'] },
  LAB: { model: 'labProfile', text: ['labName', 'address', 'operatingHours', 'phone', 'city', 'state', 'country', 'licenseNumber'], nums: ['lat', 'lng'], bools: ['homeCollection', 'homeDelivery'] },
  AMBULANCE: { model: 'ambulanceProfile', text: ['vehicleNumber', 'operatorName', 'vehicleType', 'phone', 'licenseNumber'], nums: ['baseFee'], bools: ['isAvailable'] },
};
/** GET /api/provider-profile */
export async function getProviderProfile(req: Request, res: Response) {
  const f = PROFILE_FIELDS[req.user!.role];
  if (!f) throw ApiError.badRequest('Not a provider role');
  res.json(await (prisma as any)[f.model].findUnique({ where: { userId: uid(req) } }));
}
/** PATCH /api/provider-profile - whitelisted fields per role. Licence changes send the provider back to review. */
export async function updateProviderProfile(req: Request, res: Response) {
  const f = PROFILE_FIELDS[req.user!.role];
  if (!f) throw ApiError.badRequest('Not a provider role');
  const b = req.body || {}, data: any = {};
  f.text.forEach((k) => { if (b[k] !== undefined) data[k] = str(b[k], 2000) ?? (k === 'licenseNumber' || k === 'specialty' || k === 'pharmacyName' || k === 'labName' || k === 'vehicleNumber' ? '' : null); });
  f.nums.forEach((k) => { if (b[k] !== undefined) data[k] = num(b[k]) ?? null; });
  f.bools.forEach((k) => { if (typeof b[k] === 'boolean') data[k] = b[k]; });
  const before = await (prisma as any)[f.model].findUnique({ where: { userId: uid(req) } });
  const row = await (prisma as any)[f.model].update({ where: { userId: uid(req) }, data });
  if (data.licenseNumber !== undefined && before && before.licenseNumber !== data.licenseNumber) {
    await prisma.user.updateMany({ where: { id: uid(req), verificationStatus: 'VERIFIED' }, data: { verificationStatus: 'PENDING', verificationNote: 'Licence number changed - re-verification required' } });
  }
  res.json(row);
}
