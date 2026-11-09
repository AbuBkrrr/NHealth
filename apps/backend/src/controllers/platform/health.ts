import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { uid, str, date, patientOf, ensureOwner } from './util';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** GET /api/health/timeline - every medical event for the patient, newest first. */
export async function timeline(req: Request, res: Response) {
  const p = await patientOf(uid(req));
  const [appts, rx, labs, orders, emerg, vacc, docs] = await Promise.all([
    prisma.appointment.findMany({ where: { patientId: p.id }, include: { doctor: { include: { user: { select: { name: true } } } } }, orderBy: { scheduledAt: 'desc' }, take: 100 }),
    prisma.prescription.findMany({ where: { patientId: p.id }, include: { doctor: { include: { user: { select: { name: true } } } } }, orderBy: { issuedAt: 'desc' }, take: 100 }),
    prisma.labTest.findMany({ where: { patientId: p.id }, include: { lab: true, result: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.pharmacyOrder.findMany({ where: { patientId: p.id }, include: { pharmacy: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.emergencyRequest.findMany({ where: { patientId: p.id }, orderBy: { requestedAt: 'desc' }, take: 50 }),
    prisma.vaccination.findMany({ where: { userId: uid(req) }, orderBy: { givenAt: 'desc' } }),
    prisma.healthDocument.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' } }),
  ]);
  const ev = [
    ...appts.map((a) => ({ type: 'appointment', id: a.id, at: a.scheduledAt, title: `Consultation - Dr. ${a.doctor.user.name}`, sub: a.diagnosis || a.reason || a.doctor.specialty, status: a.status })),
    ...rx.map((r) => ({ type: 'prescription', id: r.id, at: r.issuedAt, title: `Prescription - Dr. ${r.doctor.user.name}`, sub: (r.medications as any[]).map((m) => m.name).join(', '), status: r.status })),
    ...labs.map((l) => ({ type: 'lab', id: l.id, at: l.createdAt, title: `${l.testType} - ${l.lab.labName}`, sub: l.result ? 'Result available' : '', status: l.status })),
    ...orders.map((o) => ({ type: 'order', id: o.id, at: o.createdAt, title: `Pharmacy order - ${o.pharmacy.pharmacyName}`, sub: (o.items as any[]).map((i) => i.name).join(', '), status: o.status })),
    ...emerg.map((e) => ({ type: 'emergency', id: e.id, at: e.requestedAt, title: 'Emergency request', sub: e.notes || e.type, status: e.status })),
    ...vacc.map((v) => ({ type: 'vaccination', id: v.id, at: v.givenAt || v.createdAt, title: `Vaccine - ${v.vaccine}`, sub: v.dose || '', status: v.nextDueAt ? 'Next due ' + v.nextDueAt.toISOString().slice(0, 10) : 'DONE' })),
    ...docs.map((d) => ({ type: 'document', id: d.id, at: d.createdAt, title: d.title, sub: d.category, status: 'FILE', url: d.fileUrl })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  res.json(ev);
}

// ---------- Medication reminders ----------
export async function listReminders(req: Request, res: Response) {
  res.json(await prisma.medicationReminder.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' } }));
}
function reminderData(b: any) {
  const times = Array.isArray(b.times) ? b.times.filter((t: string) => HHMM.test(t)).slice(0, 8) : [];
  if (!times.length) throw ApiError.badRequest('Add at least one time like 08:00');
  return { medication: str(b.medication, 120)!, dosage: str(b.dosage, 120), times, startDate: date(b.startDate) || new Date(), endDate: date(b.endDate), refillAt: date(b.refillAt), familyMemberId: str(b.familyMemberId), prescriptionId: str(b.prescriptionId), isActive: b.isActive !== false };
}
export async function createReminder(req: Request, res: Response) {
  if (!str(req.body.medication)) throw ApiError.badRequest('Medication name is required');
  res.status(201).json(await prisma.medicationReminder.create({ data: { userId: uid(req), ...reminderData(req.body) } }));
}
export async function updateReminder(req: Request, res: Response) {
  await ensureOwner(await prisma.medicationReminder.findUnique({ where: { id: req.params.id } }), uid(req), 'Reminder');
  res.json(await prisma.medicationReminder.update({ where: { id: req.params.id }, data: reminderData(req.body) }));
}
export async function logDose(req: Request, res: Response) {
  const r = await ensureOwner(await prisma.medicationReminder.findUnique({ where: { id: req.params.id } }), uid(req), 'Reminder');
  const log = Array.isArray(r.takenLog) ? (r.takenLog as any[]) : [];
  log.unshift({ at: new Date().toISOString(), status: req.body.status === 'skipped' ? 'skipped' : 'taken' });
  res.json(await prisma.medicationReminder.update({ where: { id: r.id }, data: { takenLog: log.slice(0, 200) } }));
}
export async function deleteReminder(req: Request, res: Response) {
  await prisma.medicationReminder.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  res.json({ ok: true });
}

// ---------- Family members ----------
const famData = (b: any) => ({ name: str(b.name, 120)!, relationship: str(b.relationship, 40) || 'Other', dateOfBirth: date(b.dateOfBirth), gender: str(b.gender, 20), bloodType: str(b.bloodType, 5), genotype: str(b.genotype, 5), allergies: str(b.allergies, 500), conditions: str(b.conditions, 500) });
export async function listFamily(req: Request, res: Response) { res.json(await prisma.familyMember.findMany({ where: { ownerId: uid(req) }, orderBy: { createdAt: 'asc' } })); }
export async function addFamily(req: Request, res: Response) {
  if (!str(req.body.name)) throw ApiError.badRequest('Name is required');
  if ((await prisma.familyMember.count({ where: { ownerId: uid(req) } })) >= 15) throw ApiError.badRequest('Maximum 15 family members');
  res.status(201).json(await prisma.familyMember.create({ data: { ownerId: uid(req), ...famData(req.body) } }));
}
export async function updateFamily(req: Request, res: Response) {
  await ensureOwner(await prisma.familyMember.findUnique({ where: { id: req.params.id } }), uid(req), 'Family member');
  res.json(await prisma.familyMember.update({ where: { id: req.params.id }, data: famData(req.body) }));
}
export async function deleteFamily(req: Request, res: Response) { await prisma.familyMember.deleteMany({ where: { id: req.params.id, ownerId: uid(req) } }); res.json({ ok: true }); }

// ---------- Vaccinations ----------
const vacData = (b: any) => ({ vaccine: str(b.vaccine, 120)!, dose: str(b.dose, 60), givenAt: date(b.givenAt), nextDueAt: date(b.nextDueAt), provider: str(b.provider, 120), notes: str(b.notes, 500), familyMemberId: str(b.familyMemberId) });
export async function listVaccinations(req: Request, res: Response) { res.json(await prisma.vaccination.findMany({ where: { userId: uid(req) }, orderBy: { givenAt: 'desc' } })); }
export async function addVaccination(req: Request, res: Response) {
  if (!str(req.body.vaccine)) throw ApiError.badRequest('Vaccine name is required');
  res.status(201).json(await prisma.vaccination.create({ data: { userId: uid(req), ...vacData(req.body) } }));
}
export async function deleteVaccination(req: Request, res: Response) { await prisma.vaccination.deleteMany({ where: { id: req.params.id, userId: uid(req) } }); res.json({ ok: true }); }

// ---------- Health documents ----------
export async function listDocuments(req: Request, res: Response) { res.json(await prisma.healthDocument.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' } })); }
export async function addDocument(req: Request, res: Response) {
  if (!str(req.body.title) || !str(req.body.fileUrl, 2000)) throw ApiError.badRequest('Title and file are required');
  res.status(201).json(await prisma.healthDocument.create({ data: { userId: uid(req), title: str(req.body.title, 200)!, category: str(req.body.category, 30) || 'OTHER', fileUrl: str(req.body.fileUrl, 2000)!, fileId: str(req.body.fileId, 300), mimeType: str(req.body.mimeType, 100) } }));
}
export async function deleteDocument(req: Request, res: Response) { await prisma.healthDocument.deleteMany({ where: { id: req.params.id, userId: uid(req) } }); res.json({ ok: true }); }

// ---------- Emergency medical ID ----------
/** GET /api/health/emergency-card - creates the share token on first use. */
export async function myEmergencyCard(req: Request, res: Response) {
  let p = await patientOf(uid(req));
  if (!p.emergencyCardToken) p = await prisma.patientProfile.update({ where: { id: p.id }, data: { emergencyCardToken: crypto.randomBytes(12).toString('base64url') } });
  res.json({ token: p.emergencyCardToken });
}
export async function rotateEmergencyCard(req: Request, res: Response) {
  const p = await patientOf(uid(req));
  const u = await prisma.patientProfile.update({ where: { id: p.id }, data: { emergencyCardToken: crypto.randomBytes(12).toString('base64url') } });
  res.json({ token: u.emergencyCardToken });
}
/** GET /api/public/emergency-card/:token - what a first responder sees after scanning the QR. Minimal data only. */
export async function publicEmergencyCard(req: Request, res: Response) {
  const p = await prisma.patientProfile.findUnique({ where: { emergencyCardToken: req.params.token }, include: { user: { select: { name: true, isActive: true, deletedAt: true } } } });
  if (!p || !p.user.isActive || p.user.deletedAt) throw ApiError.notFound('Card not found');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ name: p.user.name, bloodType: p.bloodType, genotype: p.genotype, allergies: p.allergies, chronicConditions: p.chronicConditions, currentMedications: p.currentMedications,
    emergencyContact: p.emergencyContact, emergencyPhone: p.emergencyPhone, organDonor: !!(await prisma.organDonorRegistration.findFirst({ where: { userId: p.userId, status: 'ACTIVE' } })) });
}
