// Health jobs and shifts ("gigs"): verified providers post, health workers apply, employers hire.
// Pay is real money paid by the employer outside N-Health, so it is stated in naira (not coins).
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { notify } from '../../services/notify';
import { str, num, uid, date } from './util';

export const PROFESSIONS: Record<string, { label: string; licence?: string }> = {
  DOCTOR: { label: 'Doctor / medical officer', licence: 'MDCN' },
  SPECIALIST: { label: 'Consultant / specialist doctor', licence: 'MDCN' },
  NURSE: { label: 'Nurse', licence: 'NMCN' },
  MIDWIFE: { label: 'Midwife', licence: 'NMCN' },
  PHARMACIST: { label: 'Pharmacist', licence: 'PCN' },
  PHARMACY_TECHNICIAN: { label: 'Pharmacy technician', licence: 'PCN' },
  LAB_SCIENTIST: { label: 'Medical laboratory scientist', licence: 'MLSCN' },
  LAB_TECHNICIAN: { label: 'Laboratory technician', licence: 'MLSCN' },
  PHLEBOTOMIST: { label: 'Phlebotomist / sample collector' },
  RADIOGRAPHER: { label: 'Radiographer', licence: 'RRBN' },
  SONOGRAPHER: { label: 'Sonographer', licence: 'RRBN' },
  PHYSIOTHERAPIST: { label: 'Physiotherapist', licence: 'MRTB' },
  DENTIST: { label: 'Dentist', licence: 'MDCN' },
  OPTOMETRIST: { label: 'Optometrist', licence: 'ODORBN' },
  ANAESTHETIST: { label: 'Anaesthetist' },
  NUTRITIONIST: { label: 'Dietitian / nutritionist', licence: 'IDCN' },
  HEALTH_RECORDS: { label: 'Health records officer', licence: 'HRORBN' },
  CHW: { label: 'Community health worker', licence: 'CHPRBN' },
  CARE_ASSISTANT: { label: 'Care assistant / caregiver' },
  PARAMEDIC: { label: 'Paramedic / EMT' },
  AMBULANCE_DRIVER: { label: 'Ambulance driver' },
  SALES_ASSISTANT: { label: 'Pharmacy sales / dispensing assistant' },
  DISPATCH_RIDER: { label: 'Dispatch rider (deliveries / samples)' },
  RECEPTIONIST: { label: 'Receptionist / front desk / cashier' },
  ADMIN_STAFF: { label: 'Administrator / manager' },
};
/** What each kind of provider can recruit for (the role dropdown). */
export const HIRES: Record<string, string[]> = {
  INSTITUTION: ['DOCTOR', 'SPECIALIST', 'NURSE', 'MIDWIFE', 'PHARMACIST', 'PHARMACY_TECHNICIAN', 'LAB_SCIENTIST', 'LAB_TECHNICIAN', 'RADIOGRAPHER', 'SONOGRAPHER', 'PHYSIOTHERAPIST', 'DENTIST', 'OPTOMETRIST', 'ANAESTHETIST', 'NUTRITIONIST', 'HEALTH_RECORDS', 'CHW', 'CARE_ASSISTANT', 'PARAMEDIC', 'AMBULANCE_DRIVER', 'RECEPTIONIST', 'ADMIN_STAFF'],
  PHARMACY: ['PHARMACIST', 'PHARMACY_TECHNICIAN', 'SALES_ASSISTANT', 'DISPATCH_RIDER', 'RECEPTIONIST', 'ADMIN_STAFF'],
  LAB: ['LAB_SCIENTIST', 'LAB_TECHNICIAN', 'RADIOGRAPHER', 'SONOGRAPHER', 'PHLEBOTOMIST', 'SPECIALIST', 'DISPATCH_RIDER', 'RECEPTIONIST', 'ADMIN_STAFF'],
  AMBULANCE: ['PARAMEDIC', 'NURSE', 'DOCTOR', 'AMBULANCE_DRIVER', 'RECEPTIONIST'],
  DOCTOR: ['DOCTOR', 'NURSE', 'MIDWIFE', 'PHARMACIST', 'LAB_TECHNICIAN', 'CARE_ASSISTANT', 'RECEPTIONIST'],
  NURSE: ['NURSE', 'MIDWIFE', 'CARE_ASSISTANT'],
};
export const EXPERIENCE: Record<string, string> = { ANY: 'Any experience', ENTRY: 'Entry level / fresh graduate (0-1 yr)', JUNIOR: 'Junior (1-3 yrs)', MID: 'Mid-level (3-5 yrs)', SENIOR: 'Senior (5-10 yrs)', CONSULTANT: 'Consultant / expert (10+ yrs)' };
export const TYPES: Record<string, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time', LOCUM: 'Locum / one-off shifts', CONTRACT: 'Contract', INTERNSHIP: 'Internship / housemanship' };
export const SHIFTS: Record<string, string> = { DAY: 'Day', NIGHT: 'Night', WEEKEND: 'Weekend', ON_CALL: 'On call', ROTATING: 'Rotating' };
export const PERIODS: Record<string, string> = { HOUR: 'per hour', SHIFT: 'per shift', DAY: 'per day', MONTH: 'per month', YEAR: 'per year' };
export const BENEFITS = ['Accommodation', 'Transport / allowance', 'Meals', 'Health insurance (HMO)', 'Pension', 'Training / CPD', 'Call allowance', 'Leave allowance', '13th month'];
const STATUSES = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'NOT_SELECTED'];
const ORG_ROLES = Object.keys(HIRES);

const pick = <T extends string>(v: any, allowed: Record<string, any> | string[], dflt: T): T => {
  const k = String(v ?? '').toUpperCase();
  return (Array.isArray(allowed) ? allowed.includes(k) : k in allowed) ? (k as T) : dflt;
};
const open = { status: 'OPEN', OR: [{ deadline: null }, { deadline: { gte: new Date() } }] };

/** GET /api/gigs/options - dropdown lists (roles per kind of provider, experience, types, shifts, pay periods, benefits). */
export async function options(_req: Request, res: Response) {
  res.json({ professions: PROFESSIONS, hires: HIRES, experience: EXPERIENCE, types: TYPES, shifts: SHIFTS, periods: PERIODS, benefits: BENEFITS });
}

async function orgOf(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, include: { institutionProfile: true, pharmacyProfile: true, labProfile: true, ambulanceProfile: true, doctorProfile: true, nurseProfile: true } });
  if (!u) throw ApiError.unauthorized();
  const p: any = u.institutionProfile || u.pharmacyProfile || u.labProfile || u.ambulanceProfile || u.doctorProfile || u.nurseProfile || {};
  const name = u.institutionProfile?.name || u.pharmacyProfile?.pharmacyName || u.labProfile?.labName || u.ambulanceProfile?.operatorName || (u.role === 'DOCTOR' ? 'Dr. ' + u.name + (u.doctorProfile?.hospital ? ' • ' + u.doctorProfile.hospital : '') : u.name);
  return { user: u, name, state: p.state || null, city: p.city || null, address: p.address || null, lat: p.lat ?? p.currentLat ?? null, lng: p.lng ?? p.currentLng ?? null };
}

function gigData(b: any, role: string) {
  const profession = String(b.profession || '').toUpperCase();
  if (!PROFESSIONS[profession]) throw ApiError.badRequest('Choose who you are recruiting');
  if (!HIRES[role]?.includes(profession)) throw ApiError.badRequest(`A ${role.toLowerCase()} account cannot recruit for ${PROFESSIONS[profession].label.toLowerCase()}`);
  const description = str(b.description, 4000);
  if (!description || description.length < 20) throw ApiError.badRequest('Describe the job (at least a sentence or two)');
  const payMin = num(b.payMin), payMax = num(b.payMax);
  if (payMin !== undefined && payMax !== undefined && payMax < payMin) throw ApiError.badRequest('Maximum pay must be more than minimum pay');
  if ((payMin ?? 0) < 0 || (payMax ?? 0) < 0) throw ApiError.badRequest('Pay cannot be negative');
  return {
    profession, title: str(b.title, 120) || PROFESSIONS[profession].label, specialty: str(b.specialty, 120) ?? null,
    positions: Math.max(1, Math.min(500, Math.round(num(b.positions) || 1))),
    experience: pick(b.experience, EXPERIENCE, 'ANY'), employmentType: pick(b.employmentType, TYPES, 'FULL_TIME'),
    shifts: (Array.isArray(b.shifts) ? b.shifts : []).map((s: any) => String(s).toUpperCase()).filter((s: string) => s in SHIFTS),
    hoursPerWeek: num(b.hoursPerWeek) !== undefined ? Math.max(1, Math.min(168, Math.round(num(b.hoursPerWeek)!))) : null,
    startDate: date(b.startDate) ?? null, endDate: date(b.endDate) ?? null, deadline: date(b.deadline) ?? null,
    payMin: payMin ?? null, payMax: payMax ?? null, payPeriod: pick(b.payPeriod, PERIODS, 'MONTH'), payNegotiable: b.payNegotiable === true,
    licenseRequired: b.licenseRequired !== false, qualifications: str(b.qualifications, 1000) ?? null,
    benefits: (Array.isArray(b.benefits) ? b.benefits : []).map(String).filter((x: string) => BENEFITS.includes(x)),
    description, urgent: b.urgent === true,
  };
}

/** POST /api/gigs - a verified provider posts a job. */
export async function createGig(req: Request, res: Response) {
  const org = await orgOf(uid(req));
  if (!ORG_ROLES.includes(org.user.role)) throw ApiError.forbidden('Only hospitals, clinics, pharmacies, diagnostic centers, ambulance services and practices can post jobs');
  const b = req.body || {};
  const data = gigData(b, org.user.role);
  const gig = await prisma.gig.create({ data: {
    ...data, posterId: org.user.id, orgName: org.name, orgType: org.user.role,
    state: str(b.state, 40) || org.state, city: str(b.city, 80) || org.city, address: str(b.address, 300) || org.address, lat: org.lat, lng: org.lng,
  } });
  // Alert health workers who are open to work in this profession and this state.
  const people = await prisma.workProfile.findMany({
    where: { profession: gig.profession, openToWork: true, alerts: true, userId: { not: org.user.id }, ...(gig.state ? { OR: [{ states: { isEmpty: true } }, { states: { has: gig.state } }] } : {}) },
    select: { userId: true }, take: 300,
  });
  const where = [gig.city, gig.state].filter(Boolean).join(', ');
  await Promise.all(people.map((p) => notify(p.userId, 'gig', `${gig.urgent ? '⚡ Urgent: ' : '💼 '}${gig.title}`, `${gig.orgName}${where ? ' in ' + where : ''} needs ${gig.positions > 1 ? gig.positions + ' people' : 'someone'} (${TYPES[gig.employmentType].toLowerCase()}). Tap to see and apply.`, { push: true, data: { gigId: gig.id } }).catch(() => null)));
  res.status(201).json({ ...gig, alerted: people.length });
}

const publicGig = (g: any) => ({ ...g, reports: undefined, views: undefined, professionLabel: PROFESSIONS[g.profession]?.label, licence: PROFESSIONS[g.profession]?.licence, typeLabel: TYPES[g.employmentType], experienceLabel: EXPERIENCE[g.experience], periodLabel: PERIODS[g.payPeriod] });
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, rad = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * rad) / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(((bLng - aLng) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** GET /api/gigs?profession=&state=&type=&shift=&q=&lat=&lng= - open jobs. */
export async function listGigs(req: Request, res: Response) {
  const where: any = { ...open, AND: [] as any[] };
  const prof = str(req.query.profession)?.toUpperCase(); if (prof && PROFESSIONS[prof]) where.profession = prof;
  const state = str(req.query.state, 40); if (state) where.state = state;
  const type = str(req.query.type)?.toUpperCase(); if (type && TYPES[type]) where.employmentType = type;
  const shift = str(req.query.shift)?.toUpperCase(); if (shift && SHIFTS[shift]) where.shifts = { has: shift };
  const q = str(req.query.q, 80); if (q) where.AND.push({ OR: [{ title: { contains: q, mode: 'insensitive' } }, { orgName: { contains: q, mode: 'insensitive' } }, { specialty: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }] });
  if (!where.AND.length) delete where.AND;
  const lat = num(req.query.lat), lng = num(req.query.lng);
  const [gigs, mine] = await Promise.all([
    prisma.gig.findMany({ where, orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }], take: 200 }),
    prisma.gigApplication.findMany({ where: { applicantId: uid(req) }, select: { gigId: true, status: true } }),
  ]);
  const applied = new Map(mine.map((a) => [a.gigId, a.status]));
  let out = gigs.map((g) => ({ ...publicGig(g), myStatus: applied.get(g.id) || null, distanceKm: lat !== undefined && lng !== undefined && g.lat != null && g.lng != null ? Math.round(km(lat, lng, g.lat, g.lng!) * 10) / 10 : null }));
  if (req.query.sort === 'distance') out = out.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  res.json(out.slice(0, 100));
}

/** GET /api/gigs/:id */
export async function getGig(req: Request, res: Response) {
  const g = await prisma.gig.findUnique({ where: { id: req.params.id } });
  if (!g) throw ApiError.notFound('Job not found');
  const me = uid(req);
  const isPoster = g.posterId === me;
  if (!isPoster && g.status !== 'OPEN' && g.status !== 'FILLED') throw ApiError.notFound('This job is no longer available');
  if (!isPoster) await prisma.gig.update({ where: { id: g.id }, data: { views: { increment: 1 } } });
  const myApplication = await prisma.gigApplication.findUnique({ where: { gigId_applicantId: { gigId: g.id, applicantId: me } } });
  const count = isPoster ? await prisma.gigApplication.count({ where: { gigId: g.id, status: { not: 'WITHDRAWN' } } }) : undefined;
  res.json({ ...publicGig(g), views: isPoster ? g.views : undefined, isPoster, myApplication, applicants: count, closed: g.status !== 'OPEN' || (g.deadline != null && g.deadline < new Date()) });
}

async function ownGig(req: Request) {
  const g = await prisma.gig.findUnique({ where: { id: req.params.id } });
  if (!g || g.posterId !== uid(req)) throw ApiError.notFound('Job not found');
  return g;
}

/** PATCH /api/gigs/:id - edit, pause, mark filled or close. */
export async function updateGig(req: Request, res: Response) {
  const g = await ownGig(req);
  const b = req.body || {};
  const data: any = {};
  if (b.status !== undefined) { const s = String(b.status).toUpperCase(); if (!['OPEN', 'PAUSED', 'FILLED', 'CLOSED'].includes(s)) throw ApiError.badRequest('Invalid status'); if (s === 'OPEN' && g.reports >= 5) throw ApiError.forbidden('This job is under review after reports. Contact support.'); data.status = s; }
  if (b.profession !== undefined || b.description !== undefined) Object.assign(data, gigData({ ...g, payMin: g.payMin == null ? undefined : Number(g.payMin), payMax: g.payMax == null ? undefined : Number(g.payMax), ...b }, g.orgType));
  for (const k of ['state', 'city', 'address']) if (b[k] !== undefined) data[k] = str(b[k], 300) ?? null;
  const updated = await prisma.gig.update({ where: { id: g.id }, data });
  if (data.status && ['FILLED', 'CLOSED'].includes(data.status) && g.status === 'OPEN') {
    // Applicants still waiting are told the job is no longer open.
    const waiting = await prisma.gigApplication.findMany({ where: { gigId: g.id, status: { in: ['APPLIED', 'SHORTLISTED', 'INTERVIEW'] } } });
    await prisma.gigApplication.updateMany({ where: { id: { in: waiting.map((w) => w.id) } }, data: { status: 'NOT_SELECTED' } });
    await Promise.all(waiting.map((w) => notify(w.applicantId, 'gig', 'Job update', `${g.title} at ${g.orgName} is no longer open. Thank you for applying - keep an eye on Health jobs for new openings.`, { data: { gigId: g.id } }).catch(() => null)));
  }
  res.json(updated);
}

/** GET /api/gigs/mine/posted - my job posts with applicant counts. */
export async function myPosted(req: Request, res: Response) {
  const gigs = await prisma.gig.findMany({ where: { posterId: uid(req) }, orderBy: { createdAt: 'desc' }, take: 100 });
  const counts = await prisma.gigApplication.groupBy({ by: ['gigId', 'status'], where: { gigId: { in: gigs.map((g) => g.id) } }, _count: true });
  res.json(gigs.map((g) => {
    const c = counts.filter((x) => x.gigId === g.id);
    const n = (s: string) => c.find((x) => x.status === s)?._count || 0;
    return { ...publicGig(g), views: g.views, applicants: c.filter((x) => x.status !== 'WITHDRAWN').reduce((a, x) => a + x._count, 0), newApplicants: n('APPLIED'), hired: n('HIRED') };
  }));
}

/** GET /api/gigs/:id/applicants - who applied (contact details shown once shortlisted). */
export async function applicants(req: Request, res: Response) {
  const g = await ownGig(req);
  const apps = await prisma.gigApplication.findMany({ where: { gigId: g.id, status: { not: 'WITHDRAWN' } }, orderBy: { createdAt: 'asc' } });
  const users = await prisma.user.findMany({ where: { id: { in: apps.map((a) => a.applicantId) } }, select: { id: true, name: true, avatarUrl: true, email: true, phone: true, role: true, kycStatus: true, verificationStatus: true } });
  const profiles = await prisma.workProfile.findMany({ where: { userId: { in: apps.map((a) => a.applicantId) } } });
  res.json(apps.map((a) => {
    const u = users.find((x) => x.id === a.applicantId)!;
    const p = profiles.find((x) => x.userId === a.applicantId);
    const contact = a.status !== 'APPLIED' && a.status !== 'NOT_SELECTED';
    return {
      ...a, applicant: { id: u.id, name: u.name, avatarUrl: u.avatarUrl, idVerified: u.kycStatus === 'APPROVED', providerVerified: u.verificationStatus === 'VERIFIED' && ['DOCTOR', 'NURSE'].includes(u.role), email: contact ? u.email : undefined, phone: contact ? u.phone : undefined },
      profile: p ? { profession: p.profession, professionLabel: PROFESSIONS[p.profession]?.label, specialty: p.specialty, licenseBody: p.licenseBody, licenseNumber: p.licenseNumber, yearsExperience: p.yearsExperience, skills: p.skills, summary: p.summary, cvUrl: p.cvUrl, expectedPay: p.expectedPay, payPeriod: p.payPeriod } : null,
    };
  }));
}

const STATUS_MSG: Record<string, string> = {
  SHORTLISTED: 'You have been shortlisted 🎉', INTERVIEW: 'You are invited to an interview 📅', OFFERED: 'You have a job offer 🎉',
  HIRED: 'You got the job 🎉', NOT_SELECTED: 'Application update',
};
/** PATCH /api/gigs/applications/:id { status, employerNote } - move an applicant along. */
export async function decideApplication(req: Request, res: Response) {
  const a = await prisma.gigApplication.findUnique({ where: { id: req.params.id }, include: { gig: true } });
  if (!a || a.gig.posterId !== uid(req)) throw ApiError.notFound('Application not found');
  if (a.status === 'WITHDRAWN') throw ApiError.conflict('The applicant withdrew');
  const status = String(req.body?.status || '').toUpperCase();
  if (!STATUSES.includes(status) || status === 'APPLIED') throw ApiError.badRequest('Invalid status');
  const note = str(req.body?.employerNote, 1000);
  const updated = await prisma.gigApplication.update({ where: { id: a.id }, data: { status, employerNote: note ?? a.employerNote } });
  const body = status === 'NOT_SELECTED'
    ? `${a.gig.orgName} has filled ${a.gig.title} with another candidate. Thank you for applying.`
    : `${a.gig.orgName} - ${a.gig.title}.${note ? ' "' + note + '"' : ''} Open N-Health to reply.`;
  await notify(a.applicantId, 'gig', STATUS_MSG[status], body, { push: true, whatsapp: ['INTERVIEW', 'OFFERED', 'HIRED'].includes(status), data: { gigId: a.gigId } });
  if (status === 'HIRED') {
    const hired = await prisma.gigApplication.count({ where: { gigId: a.gigId, status: 'HIRED' } });
    if (hired >= a.gig.positions && a.gig.status === 'OPEN') await prisma.gig.update({ where: { id: a.gigId }, data: { status: 'FILLED' } });
  }
  res.json(updated);
}

/** POST /api/gigs/:id/apply { coverNote, expectedPay, availableFrom } */
export async function apply(req: Request, res: Response) {
  const me = uid(req);
  const g = await prisma.gig.findUnique({ where: { id: req.params.id } });
  if (!g) throw ApiError.notFound('Job not found');
  if (g.posterId === me) throw ApiError.badRequest('You cannot apply to your own job');
  if (g.status !== 'OPEN' || (g.deadline && g.deadline < new Date())) throw ApiError.conflict('This job is no longer taking applications');
  const profile = await prisma.workProfile.findUnique({ where: { userId: me } });
  if (!profile) throw ApiError.badRequest('Set up your work profile first (profession, licence, experience) so employers can see who you are');
  const existing = await prisma.gigApplication.findUnique({ where: { gigId_applicantId: { gigId: g.id, applicantId: me } } });
  if (existing && existing.status !== 'WITHDRAWN') throw ApiError.conflict('You already applied for this job');
  const b = req.body || {};
  const data = { coverNote: str(b.coverNote, 2000) ?? null, expectedPay: num(b.expectedPay) ?? null, availableFrom: date(b.availableFrom) ?? null, status: 'APPLIED', employerNote: null };
  const a = existing ? await prisma.gigApplication.update({ where: { id: existing.id }, data }) : await prisma.gigApplication.create({ data: { ...data, gigId: g.id, applicantId: me } });
  const who = await prisma.user.findUnique({ where: { id: me }, select: { name: true } });
  await notify(g.posterId, 'gig', '📥 New applicant', `${who?.name || 'Someone'} (${PROFESSIONS[profile.profession]?.label || profile.profession}, ${profile.yearsExperience} yrs) applied for ${g.title}.`, { push: true, data: { gigId: g.id } });
  res.status(201).json(a);
}

/** POST /api/gigs/applications/:id/withdraw */
export async function withdraw(req: Request, res: Response) {
  const a = await prisma.gigApplication.findUnique({ where: { id: req.params.id } });
  if (!a || a.applicantId !== uid(req)) throw ApiError.notFound('Application not found');
  if (['HIRED', 'NOT_SELECTED'].includes(a.status)) throw ApiError.conflict('This application is closed');
  res.json(await prisma.gigApplication.update({ where: { id: a.id }, data: { status: 'WITHDRAWN' } }));
}

/** GET /api/gigs/applications/mine */
export async function myApplications(req: Request, res: Response) {
  const apps = await prisma.gigApplication.findMany({ where: { applicantId: uid(req) }, orderBy: { updatedAt: 'desc' }, include: { gig: true }, take: 100 });
  res.json(apps.map((a) => ({ ...a, gig: publicGig(a.gig) })));
}

/** POST /api/gigs/:id/report { reason } - flags a suspicious job (e.g. asking applicants for money). */
export async function report(req: Request, res: Response) {
  const g = await prisma.gig.findUnique({ where: { id: req.params.id } });
  if (!g) throw ApiError.notFound('Job not found');
  const reason = str(req.body?.reason, 500) || 'No reason given';
  const updated = await prisma.gig.update({ where: { id: g.id }, data: { reports: { increment: 1 }, ...(g.reports + 1 >= 5 && g.status === 'OPEN' ? { status: 'PAUSED' } : {}) } });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true }, take: 20 });
  await Promise.all(admins.map((x) => notify(x.id, 'gig', '🚩 Job reported', `"${g.title}" by ${g.orgName}: ${reason} (${updated.reports} report${updated.reports > 1 ? 's' : ''}).`, { data: { gigId: g.id } }).catch(() => null)));
  res.json({ ok: true });
}

// ------------------------------------------------------------------ work profile (health workers)
/** GET /api/work-profile - mine (pre-filled from a doctor/nurse profile the first time). */
export async function getWorkProfile(req: Request, res: Response) {
  const me = uid(req);
  const p = await prisma.workProfile.findUnique({ where: { userId: me } });
  if (p) return res.json(p);
  const u = await prisma.user.findUnique({ where: { id: me }, include: { doctorProfile: true, nurseProfile: true } });
  if (u?.doctorProfile) return res.json({ draft: true, profession: 'DOCTOR', specialty: u.doctorProfile.specialty, licenseBody: 'MDCN', licenseNumber: u.doctorProfile.licenseNumber, yearsExperience: u.doctorProfile.yearsExperience || 0 });
  if (u?.nurseProfile) return res.json({ draft: true, profession: 'NURSE', specialty: u.nurseProfile.specialty, licenseBody: 'NMCN', licenseNumber: u.nurseProfile.licenseNumber, yearsExperience: u.nurseProfile.yearsExperience || 0 });
  res.json(null);
}

/** PUT /api/work-profile */
export async function saveWorkProfile(req: Request, res: Response) {
  const b = req.body || {};
  const profession = String(b.profession || '').toUpperCase();
  if (!PROFESSIONS[profession]) throw ApiError.badRequest('Choose your profession');
  const data = {
    profession, specialty: str(b.specialty, 120) ?? null, licenseBody: str(b.licenseBody, 40) ?? PROFESSIONS[profession].licence ?? null, licenseNumber: str(b.licenseNumber, 60) ?? null,
    yearsExperience: Math.max(0, Math.min(60, Math.round(num(b.yearsExperience) || 0))), skills: str(b.skills, 1000) ?? null, summary: str(b.summary, 2000) ?? null,
    cvUrl: str(b.cvUrl, 500) ?? null, cvFileId: str(b.cvFileId, 300) ?? null,
    employmentTypes: (Array.isArray(b.employmentTypes) ? b.employmentTypes : []).map((s: any) => String(s).toUpperCase()).filter((s: string) => s in TYPES),
    states: (Array.isArray(b.states) ? b.states : []).map(String).slice(0, 37),
    expectedPay: num(b.expectedPay) ?? null, payPeriod: pick(b.payPeriod, PERIODS, 'MONTH'),
    openToWork: b.openToWork !== false, alerts: b.alerts !== false,
  };
  res.json(await prisma.workProfile.upsert({ where: { userId: uid(req) }, create: { ...data, userId: uid(req) }, update: data }));
}

// ------------------------------------------------------------------ admin
/** GET /api/admin-ops/gigs?status=&reported=1 */
export async function adminGigs(req: Request, res: Response) {
  const where: any = {};
  const s = str(req.query.status)?.toUpperCase(); if (s) where.status = s;
  if (req.query.reported === '1') where.reports = { gt: 0 };
  const [gigs, totals] = await Promise.all([
    prisma.gig.findMany({ where, orderBy: [{ reports: 'desc' }, { createdAt: 'desc' }], take: 200 }),
    prisma.gig.groupBy({ by: ['status'], _count: true }),
  ]);
  const [apps, hired, workers] = await Promise.all([prisma.gigApplication.count(), prisma.gigApplication.count({ where: { status: 'HIRED' } }), prisma.workProfile.count({ where: { openToWork: true } })]);
  res.json({ gigs: gigs.map((g) => ({ ...publicGig(g), views: g.views, reports: g.reports })), totals: Object.fromEntries(totals.map((t) => [t.status, t._count])), applications: apps, hired, workersOpenToWork: workers });
}
/** PATCH /api/admin-ops/gigs/:id { status } */
export async function adminUpdateGig(req: Request, res: Response) {
  const s = String(req.body?.status || '').toUpperCase();
  if (!['OPEN', 'PAUSED', 'CLOSED'].includes(s)) throw ApiError.badRequest('Invalid status');
  res.json(await prisma.gig.update({ where: { id: req.params.id }, data: { status: s, ...(s === 'OPEN' ? { reports: 0 } : {}) } }));
}
