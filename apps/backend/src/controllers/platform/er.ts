// Going to a hospital emergency unit by your own means (no ambulance):
// the patient picks a nearby hospital that is open for emergencies, the hospital accepts and gets ready,
// and sees the patient approaching until they arrive.
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { notify, getIo } from '../../services/notify';
import { str, num, uid, patientOf } from './util';
import { nearestUnlistedHospitals } from './facilities';

export const ER_SERVICES = ['General emergency', 'Trauma / accidents', 'Maternity / labour', 'Cardiac', 'Stroke', 'Paediatric', 'Surgery', 'ICU', 'Burns', 'Blood bank', 'X-ray / CT scan', 'Dialysis', 'Poisoning / toxicology', 'Mental health crisis'];
/** Which service a type of emergency needs (used to rank hospitals that can handle it). */
const NEEDS: Record<string, string> = { ACCIDENT: 'Trauma / accidents', MATERNITY: 'Maternity / labour', CARDIAC: 'Cardiac', STROKE: 'Stroke', CHILD: 'Paediatric', BURN: 'Burns', POISONING: 'Poisoning / toxicology', BREATHING: 'ICU', MENTAL: 'Mental health crisis' };
const TYPES = ['MEDICAL', 'ACCIDENT', 'MATERNITY', 'CARDIAC', 'STROKE', 'BREATHING', 'CHILD', 'BURN', 'POISONING', 'MENTAL'];
const TRANSPORT = ['CAR', 'TAXI', 'BIKE', 'WALK', 'OTHER'];
const OPEN = ['REQUESTED', 'ACCEPTED'];

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Rough driving time: roads ~30% longer than a straight line, ~30 km/h in town. */
const etaMin = (d: number, transport = 'CAR') => Math.max(1, Math.round(((d * 1.3) / (transport === 'WALK' ? 5 : transport === 'BIKE' ? 25 : 30)) * 60));
const emit = (userId: string, evt: string, data: any) => getIo()?.to(`user:${userId}`).emit(evt, data);

/** GET /api/er/hospitals?lat&lng&type - hospitals with emergency care near the patient, best first. */
export async function nearbyHospitals(req: Request, res: Response) {
  const lat = num(req.query.lat), lng = num(req.query.lng);
  if (lat === undefined || lng === undefined) throw ApiError.badRequest('Your location is needed to find the nearest hospitals');
  const type = String(req.query.type || 'MEDICAL').toUpperCase();
  const need = NEEDS[type];
  const list = await prisma.institutionProfile.findMany({
    where: { emergencyCare: true, lat: { not: null }, lng: { not: null }, user: { isActive: true, verificationStatus: 'VERIFIED' } },
    select: { id: true, userId: true, name: true, type: true, phone: true, address: true, city: true, lat: true, lng: true, bedsAvailable: true, bedsTotal: true, rating: true, erOpen: true, erDoctorsOnDuty: true, erNursesOnDuty: true, erServices: true, erUpdatedAt: true, user: { select: { avatarUrl: true } } },
  });
  const since = new Date(Date.now() - 6 * 3600e3);
  const busy = await prisma.erArrival.groupBy({ by: ['institutionId'], where: { status: { in: OPEN }, createdAt: { gte: since } }, _count: true });
  const incoming = new Map(busy.map((b) => [b.institutionId, b._count]));
  const out = list.map((h) => {
    const d = km({ lat, lng }, { lat: h.lat!, lng: h.lng! });
    const handles = need ? h.erServices.includes(need) : true;
    return {
      ...h, avatarUrl: h.user.avatarUrl, user: undefined,
      distanceKm: Math.round(d * 10) / 10, etaMinutes: etaMin(d), handlesType: handles, needs: need || null,
      incoming: incoming.get(h.id) || 0,
      staffed: h.erDoctorsOnDuty > 0 || h.erNursesOnDuty > 0,
    };
  }).filter((h) => h.distanceKm <= 80);
  // Open first, then those that handle this emergency, then staffed, then nearest.
  out.sort((a, b) => Number(b.erOpen) - Number(a.erOpen) || Number(b.handlesType) - Number(a.handlesType) || Number(b.staffed) - Number(a.staffed) || a.distanceKm - b.distanceKm);
  res.json(out.slice(0, 15));
}

/** GET /api/er/unlisted?lat&lng - nearest hospitals not yet on N-Health (no alert possible: call before going). */
export async function unlistedHospitals(req: Request, res: Response) {
  const lat = num(req.query.lat), lng = num(req.query.lng);
  if (lat === undefined || lng === undefined) throw ApiError.badRequest('Your location is needed');
  res.json(await nearestUnlistedHospitals(lat, lng));
}

function patientCard(p: any) {
  const age = p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 86400e3)) : null;
  return { name: p.user.name, phone: p.user.phone, gender: p.gender, age, bloodType: p.bloodType, genotype: p.genotype, allergies: p.allergies, chronicConditions: p.chronicConditions, currentMedications: p.currentMedications, emergencyContact: p.emergencyContact, emergencyPhone: p.emergencyPhone, avatarUrl: p.user.avatarUrl };
}
const withPatient = { patient: { include: { user: { select: { name: true, phone: true, avatarUrl: true } } } } } as const;
const forHospital = (a: any) => ({ ...a, patient: patientCard(a.patient), distanceKm: a.lat != null ? Math.round(km({ lat: a.lat, lng: a.lng }, a.hosp) * 10) / 10 : null, hosp: undefined });
const hospitalSelect = { id: true, userId: true, name: true, phone: true, address: true, city: true, lat: true, lng: true } as const;

/** POST /api/er/arrivals - patient tells a hospital they are coming. */
export async function createArrival(req: Request, res: Response) {
  const p = await patientOf(uid(req));
  const b = req.body || {};
  const lat = num(b.lat), lng = num(b.lng);
  if (lat === undefined || lng === undefined) throw ApiError.badRequest('Your location is needed');
  const h = await prisma.institutionProfile.findUnique({ where: { id: String(b.institutionId || '') }, include: { user: { select: { isActive: true, verificationStatus: true } } } });
  if (!h || !h.emergencyCare || !h.user.isActive || h.user.verificationStatus !== 'VERIFIED') throw ApiError.notFound('Hospital not found');
  if (!h.erOpen) throw ApiError.conflict(`${h.name} is not taking emergency patients right now. Please choose another hospital.`);
  // One active trip at a time: close any earlier open one (the patient chose another hospital).
  const open = await prisma.erArrival.findMany({ where: { patientId: p.id, status: { in: OPEN } }, include: { institution: { select: { userId: true } } } });
  for (const o of open) {
    await prisma.erArrival.update({ where: { id: o.id }, data: { status: 'CANCELLED', closedAt: new Date() } });
    emit(o.institution.userId, 'er:updated', { id: o.id, status: 'CANCELLED' });
  }
  const type = TYPES.includes(String(b.type).toUpperCase()) ? String(b.type).toUpperCase() : 'MEDICAL';
  const transport = TRANSPORT.includes(String(b.transport).toUpperCase()) ? String(b.transport).toUpperCase() : 'CAR';
  const d = h.lat != null && h.lng != null ? km({ lat, lng }, { lat: h.lat, lng: h.lng }) : null;
  const a = await prisma.erArrival.create({
    data: { patientId: p.id, institutionId: h.id, type, transport, notes: str(b.notes, 500), forSomeoneElse: b.forSomeoneElse === true, startLat: lat, startLng: lng, lat, lng, locatedAt: new Date(), etaMinutes: d != null ? etaMin(d, transport) : null, contactPhone: str(b.contactPhone, 30) },
    include: withPatient,
  });
  const payload = forHospital({ ...a, hosp: { lat: h.lat ?? lat, lng: h.lng ?? lng } });
  emit(h.userId, 'er:new', payload);
  const who = payload.patient.name + (a.forSomeoneElse ? ' (for someone else)' : '');
  await notify(h.userId, 'emergency', '🚨 Emergency patient coming in', `${who} - ${type.toLowerCase()} - about ${a.etaMinutes ?? '?'} min away by ${transport.toLowerCase()}. Accept so they know you are ready.`, { sms: true, push: true, data: { erId: a.id } });
  // Staff on the hospital's emergency roster also hear about it.
  const staff = await prisma.institutionStaff.findMany({ where: { institutionId: h.id, status: 'ACTIVE', staffRole: { in: ['DOCTOR', 'NURSE'] }, userId: { not: null } }, select: { userId: true } });
  await Promise.all(staff.map((s) => notify(s.userId!, 'emergency', `🚨 Incoming at ${h.name}`, `${type.toLowerCase()} emergency, about ${a.etaMinutes ?? '?'} min away.`, { data: { erId: a.id } }).catch(() => null)));
  res.status(201).json(await arrivalForPatient(a.id));
}

async function arrivalForPatient(id: string) {
  const a = await prisma.erArrival.findUnique({ where: { id }, include: { institution: { select: { ...hospitalSelect, erDoctorsOnDuty: true, erNursesOnDuty: true, bedsAvailable: true } } } });
  return a;
}

/** GET /api/er/arrivals - the patient's trips (latest first). */
export async function myArrivals(req: Request, res: Response) {
  const p = await patientOf(uid(req));
  res.json(await prisma.erArrival.findMany({ where: { patientId: p.id }, orderBy: { createdAt: 'desc' }, take: 10, include: { institution: { select: { ...hospitalSelect, erDoctorsOnDuty: true, erNursesOnDuty: true, bedsAvailable: true } } } }));
}

async function ownArrival(req: Request) {
  const p = await patientOf(uid(req));
  const a = await prisma.erArrival.findUnique({ where: { id: req.params.id }, include: { institution: { select: hospitalSelect } } });
  if (!a || a.patientId !== p.id) throw ApiError.notFound('Request not found');
  return a;
}

/** POST /api/er/arrivals/:id/location - the patient's position on the way (shown to the hospital). */
export async function patientLocation(req: Request, res: Response) {
  const a = await ownArrival(req);
  if (!OPEN.includes(a.status)) return res.json({ ok: true });
  const lat = num(req.body?.lat), lng = num(req.body?.lng);
  if (lat === undefined || lng === undefined) throw ApiError.badRequest('lat and lng are required');
  const h = a.institution;
  const d = h.lat != null && h.lng != null ? km({ lat, lng }, { lat: h.lat, lng: h.lng }) : null;
  const etaMinutes = d != null ? etaMin(d, a.transport) : a.etaMinutes;
  await prisma.erArrival.update({ where: { id: a.id }, data: { lat, lng, locatedAt: new Date(), etaMinutes } });
  emit(h.userId, 'er:location', { id: a.id, lat, lng, etaMinutes, distanceKm: d != null ? Math.round(d * 10) / 10 : null, at: Date.now() });
  res.json({ ok: true, etaMinutes });
}

/** POST /api/er/arrivals/:id/cancel - patient no longer coming (or chose another hospital). */
export async function cancelArrival(req: Request, res: Response) {
  const a = await ownArrival(req);
  if (!OPEN.includes(a.status)) throw ApiError.conflict('This request is already closed');
  await prisma.erArrival.update({ where: { id: a.id }, data: { status: 'CANCELLED', closedAt: new Date() } });
  emit(a.institution.userId, 'er:updated', { id: a.id, status: 'CANCELLED' });
  await notify(a.institution.userId, 'emergency', 'Emergency patient not coming', 'The patient cancelled their emergency arrival.', { data: { erId: a.id } });
  res.json({ ok: true });
}

/** POST /api/er/arrivals/:id/arrived - patient says they are at the hospital. */
export async function patientArrived(req: Request, res: Response) {
  const a = await ownArrival(req);
  if (!OPEN.includes(a.status)) throw ApiError.conflict('This request is already closed');
  await prisma.erArrival.update({ where: { id: a.id }, data: { status: 'ARRIVED', arrivedAt: new Date() } });
  emit(a.institution.userId, 'er:updated', { id: a.id, status: 'ARRIVED' });
  await notify(a.institution.userId, 'emergency', '🚨 Emergency patient at the door', 'The patient says they have arrived.', { push: true, data: { erId: a.id } });
  res.json({ ok: true });
}

// ------------------------------------------------------------------ hospital side
async function myInst(req: Request) {
  const i = await prisma.institutionProfile.findUnique({ where: { userId: uid(req) } });
  if (!i) throw ApiError.notFound('Institution profile not found');
  return i;
}

/** GET /api/institution/er - emergency board settings + patients on their way / recently arrived. */
export async function hospitalBoard(req: Request, res: Response) {
  const i = await myInst(req);
  const since = new Date(Date.now() - 24 * 3600e3);
  const list = await prisma.erArrival.findMany({
    where: { institutionId: i.id, OR: [{ status: { in: OPEN } }, { createdAt: { gte: since } }] },
    orderBy: { createdAt: 'desc' }, take: 50, include: withPatient,
  });
  const hosp = { lat: i.lat ?? 0, lng: i.lng ?? 0 };
  res.json({
    settings: { erOpen: i.erOpen, emergencyCare: i.emergencyCare, erDoctorsOnDuty: i.erDoctorsOnDuty, erNursesOnDuty: i.erNursesOnDuty, erServices: i.erServices, bedsAvailable: i.bedsAvailable, bedsTotal: i.bedsTotal, erUpdatedAt: i.erUpdatedAt, hasLocation: i.lat != null && i.lng != null, lat: i.lat, lng: i.lng },
    services: ER_SERVICES,
    arrivals: list.map((a) => forHospital({ ...a, hosp })),
  });
}

/** PATCH /api/institution/er - update the emergency board (open, staff on duty, beds, services). */
export async function updateBoard(req: Request, res: Response) {
  const i = await myInst(req); const b = req.body || {};
  const data: any = { erUpdatedAt: new Date() };
  if (typeof b.erOpen === 'boolean') data.erOpen = b.erOpen;
  if (typeof b.emergencyCare === 'boolean') data.emergencyCare = b.emergencyCare;
  for (const k of ['erDoctorsOnDuty', 'erNursesOnDuty', 'bedsAvailable']) if (b[k] !== undefined) data[k] = Math.max(0, Math.min(999, Math.round(num(b[k]) || 0)));
  if (Array.isArray(b.erServices)) data.erServices = b.erServices.map(String).filter((s: string) => ER_SERVICES.includes(s));
  res.json(await prisma.institutionProfile.update({ where: { id: i.id }, data, select: { erOpen: true, emergencyCare: true, erDoctorsOnDuty: true, erNursesOnDuty: true, erServices: true, bedsAvailable: true, erUpdatedAt: true } }));
}

/** POST /api/institution/er/:id/respond { accept: boolean, readyNote?, reason? } */
export async function respondArrival(req: Request, res: Response) {
  const i = await myInst(req);
  const a = await prisma.erArrival.findUnique({ where: { id: req.params.id }, include: { patient: { select: { userId: true } } } });
  if (!a || a.institutionId !== i.id) throw ApiError.notFound('Request not found');
  if (a.status !== 'REQUESTED' && !(a.status === 'ACCEPTED' && req.body?.accept === true)) throw ApiError.conflict(`This request is already ${a.status.toLowerCase()}`);
  const accept = req.body?.accept === true;
  const updated = await prisma.erArrival.update({
    where: { id: a.id },
    data: accept
      ? { status: 'ACCEPTED', acceptedAt: a.acceptedAt ?? new Date(), readyNote: str(req.body?.readyNote, 300) ?? a.readyNote, respondedBy: uid(req) }
      : { status: 'DECLINED', declineReason: str(req.body?.reason, 300) || 'The emergency unit is full right now', closedAt: new Date(), respondedBy: uid(req) },
  });
  emit(a.patient.userId, 'er:updated', { id: a.id, status: updated.status, readyNote: updated.readyNote, declineReason: updated.declineReason });
  if (accept) await notify(a.patient.userId, 'emergency', `✅ ${i.name} is ready for you`, updated.readyNote || 'The emergency team knows you are coming. Drive safely.', { sms: true, push: true, data: { erId: a.id } });
  else await notify(a.patient.userId, 'emergency', `${i.name} cannot take you now`, `${updated.declineReason}. Open N-Health to choose the next nearest hospital.`, { sms: true, push: true, data: { erId: a.id } });
  res.json(updated);
}

/** POST /api/institution/er/:id/status { status: ARRIVED | COMPLETED } */
export async function hospitalStatus(req: Request, res: Response) {
  const i = await myInst(req);
  const status = String(req.body?.status || '');
  if (!['ARRIVED', 'COMPLETED'].includes(status)) throw ApiError.badRequest('status must be ARRIVED or COMPLETED');
  const a = await prisma.erArrival.findUnique({ where: { id: req.params.id }, include: { patient: { select: { userId: true } } } });
  if (!a || a.institutionId !== i.id) throw ApiError.notFound('Request not found');
  if (['DECLINED', 'CANCELLED', 'COMPLETED'].includes(a.status)) throw ApiError.conflict(`This request is already ${a.status.toLowerCase()}`);
  const updated = await prisma.erArrival.update({ where: { id: a.id }, data: status === 'ARRIVED' ? { status, arrivedAt: a.arrivedAt ?? new Date() } : { status, closedAt: new Date() } });
  emit(a.patient.userId, 'er:updated', { id: a.id, status });
  res.json(updated);
}
