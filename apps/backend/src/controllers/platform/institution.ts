import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { notify } from '../../services/notify';
import { sendEmail } from '../../services/email';
import { env } from '../../config/env';
import { uid, str, num, date } from './util';

async function inst(req: Request) {
  const i = await prisma.institutionProfile.findUnique({ where: { userId: uid(req) } });
  if (!i) throw ApiError.notFound('Institution profile not found');
  return i;
}

export async function getInstitution(req: Request, res: Response) {
  const i = await prisma.institutionProfile.findUnique({ where: { userId: uid(req) }, include: { departments: true } });
  if (!i) throw ApiError.notFound('Institution profile not found');
  res.json(i);
}
export async function updateInstitution(req: Request, res: Response) {
  const i = await inst(req); const b = req.body || {};
  const data: any = {};
  for (const k of ['name', 'type', 'licenseNumber', 'email', 'phone', 'address', 'city', 'state', 'country', 'description']) if (b[k] !== undefined) data[k] = str(b[k], 1000) ?? null;
  for (const k of ['bedsTotal', 'bedsAvailable']) if (b[k] !== undefined) data[k] = Math.max(0, Math.round(num(b[k]) || 0));
  for (const k of ['lat', 'lng']) if (b[k] !== undefined) data[k] = num(b[k]) ?? null;
  if (typeof b.emergencyCare === 'boolean') data.emergencyCare = b.emergencyCare;
  res.json(await prisma.institutionProfile.update({ where: { id: i.id }, data }));
}

/** GET /api/institution/stats - dashboard figures. */
export async function institutionStats(req: Request, res: Response) {
  const i = await inst(req);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [departments, staff, doctors, admitted, admissionsToday, dischargesToday, outpatientsToday, depts, apptsToday, patientsTotal] = await Promise.all([
    prisma.department.count({ where: { institutionId: i.id } }),
    prisma.institutionStaff.count({ where: { institutionId: i.id, status: 'ACTIVE' } }),
    prisma.institutionStaff.count({ where: { institutionId: i.id, status: 'ACTIVE', staffRole: 'DOCTOR' } }),
    prisma.institutionPatient.count({ where: { institutionId: i.id, status: 'ADMITTED' } }),
    prisma.institutionPatient.count({ where: { institutionId: i.id, admittedAt: { gte: start } } }),
    prisma.institutionPatient.count({ where: { institutionId: i.id, dischargedAt: { gte: start } } }),
    prisma.institutionPatient.count({ where: { institutionId: i.id, status: 'OUTPATIENT', createdAt: { gte: start } } }),
    prisma.department.findMany({ where: { institutionId: i.id }, select: { beds: true, bedsOccupied: true } }),
    prisma.appointment.count({ where: { institutionId: i.id, scheduledAt: { gte: start, lt: new Date(start.getTime() + 86400_000) } } }),
    prisma.institutionPatient.count({ where: { institutionId: i.id } }),
  ]);
  const beds = i.bedsTotal || depts.reduce((s, d) => s + d.beds, 0);
  const occupied = depts.reduce((s, d) => s + d.bedsOccupied, 0) || admitted;
  res.json({ departments, staff, doctors, beds, bedsAvailable: Math.max(0, beds - occupied), occupancy: beds ? Math.round((occupied / beds) * 100) : 0, admitted, admissionsToday, dischargesToday, outpatientsToday, appointmentsToday: apptsToday, patientsTotal });
}

// ---------- Departments ----------
export async function listDepartments(req: Request, res: Response) {
  const i = await inst(req);
  res.json(await prisma.department.findMany({ where: { institutionId: i.id }, orderBy: { name: 'asc' }, include: { _count: { select: { staff: true, patients: true } } } }));
}
const deptData = (b: any) => ({ name: str(b.name, 120)!, headName: str(b.headName, 120), headUserId: str(b.headUserId), description: str(b.description, 1000), beds: Math.max(0, Math.round(num(b.beds) || 0)), bedsOccupied: Math.max(0, Math.round(num(b.bedsOccupied) || 0)) });
export async function createDepartment(req: Request, res: Response) {
  const i = await inst(req);
  if (!str(req.body.name)) throw ApiError.badRequest('Department name is required');
  res.status(201).json(await prisma.department.create({ data: { institutionId: i.id, ...deptData(req.body) } }));
}
export async function updateDepartment(req: Request, res: Response) {
  const i = await inst(req);
  const d = await prisma.department.findUnique({ where: { id: req.params.id } });
  if (!d || d.institutionId !== i.id) throw ApiError.notFound('Department not found');
  res.json(await prisma.department.update({ where: { id: d.id }, data: deptData({ ...d, ...req.body }) }));
}
export async function deleteDepartment(req: Request, res: Response) {
  const i = await inst(req);
  await prisma.department.deleteMany({ where: { id: req.params.id, institutionId: i.id } });
  res.json({ ok: true });
}

// ---------- Staff (enrol providers) ----------
export async function listStaff(req: Request, res: Response) {
  const i = await inst(req);
  res.json(await prisma.institutionStaff.findMany({ where: { institutionId: i.id }, orderBy: { createdAt: 'desc' }, include: { department: { select: { name: true } }, user: { select: { id: true, avatarUrl: true, verificationStatus: true } } } }));
}
export async function inviteStaff(req: Request, res: Response) {
  const i = await inst(req);
  const email = str(req.body.email, 160)?.toLowerCase(), name = str(req.body.name, 120);
  if (!email || !name) throw ApiError.badRequest('Name and email are required');
  const role = ['DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_SCIENTIST', 'ADMIN', 'OTHER'].includes(req.body.staffRole) ? req.body.staffRole : 'OTHER';
  const user = await prisma.user.findUnique({ where: { email } });
  const s = await prisma.institutionStaff.upsert({
    where: { institutionId_email: { institutionId: i.id, email } },
    create: { institutionId: i.id, email, name, phone: str(req.body.phone, 30), staffRole: role, title: str(req.body.title, 80), departmentId: str(req.body.departmentId), userId: user?.id },
    update: { name, phone: str(req.body.phone, 30), staffRole: role, title: str(req.body.title, 80), departmentId: str(req.body.departmentId), userId: user?.id },
  });
  if (user) await notify(user.id, 'system', `Invitation from ${i.name}`, `You were invited to join ${i.name} as ${role.toLowerCase().replace('_', ' ')}. Accept in Profile → Affiliations.`, { email: true, data: { staffId: s.id } });
  else await sendEmail(email, `Join ${i.name} on N-Health`, `You're invited to ${i.name}`, `Create your free N-Health account with this email at <a href="${env.appUrl}">${env.appUrl}</a> to join as ${role.toLowerCase().replace('_', ' ')}.`);
  res.status(201).json(s);
}
export async function updateStaff(req: Request, res: Response) {
  const i = await inst(req);
  const s = await prisma.institutionStaff.findUnique({ where: { id: req.params.id } });
  if (!s || s.institutionId !== i.id) throw ApiError.notFound('Staff member not found');
  const status = ['INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT'].includes(req.body.status) ? req.body.status : undefined;
  const u = await prisma.institutionStaff.update({ where: { id: s.id }, data: { status, departmentId: req.body.departmentId !== undefined ? str(req.body.departmentId) ?? null : undefined, title: str(req.body.title, 80) } });
  if (status === 'LEFT' && s.userId) await prisma.doctorProfile.updateMany({ where: { userId: s.userId, institutionId: i.id }, data: { institutionId: null } });
  res.json(u);
}
/** GET /api/institution/affiliations - invitations for the logged-in provider. */
export async function myAffiliations(req: Request, res: Response) {
  const u = await prisma.user.findUnique({ where: { id: uid(req) } });
  res.json(await prisma.institutionStaff.findMany({ where: { OR: [{ userId: uid(req) }, { email: u!.email }] }, include: { institution: { select: { id: true, name: true, type: true, city: true } }, department: { select: { name: true } } } }));
}
export async function respondAffiliation(req: Request, res: Response) {
  const u = await prisma.user.findUnique({ where: { id: uid(req) } });
  const s = await prisma.institutionStaff.findUnique({ where: { id: req.params.id }, include: { institution: true } });
  if (!s || (s.userId !== u!.id && s.email !== u!.email)) throw ApiError.notFound('Invitation not found');
  const accept = !!req.body.accept;
  const upd = await prisma.institutionStaff.update({ where: { id: s.id }, data: { status: accept ? 'ACTIVE' : 'LEFT', userId: u!.id, joinedAt: accept ? new Date() : null } });
  if (accept) await prisma.doctorProfile.updateMany({ where: { userId: u!.id }, data: { institutionId: s.institutionId, hospital: s.institution.name } });
  await notify(s.institution.userId, 'system', `Staff ${accept ? 'joined' : 'declined'}`, `${u!.name} ${accept ? 'accepted' : 'declined'} your invitation.`);
  res.json(upd);
}

// ---------- Patients (enrolment, admission, discharge) ----------
export async function listInstPatients(req: Request, res: Response) {
  const i = await inst(req);
  const where: any = { institutionId: i.id };
  if (req.query.status) where.status = String(req.query.status).toUpperCase();
  if (req.query.q) where.OR = [{ name: { contains: String(req.query.q), mode: 'insensitive' } }, { mrn: { contains: String(req.query.q), mode: 'insensitive' } }];
  res.json(await prisma.institutionPatient.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { department: { select: { name: true } } } }));
}
export async function enrolPatient(req: Request, res: Response) {
  const i = await inst(req);
  const name = str(req.body.name, 120);
  if (!name) throw ApiError.badRequest('Patient name is required');
  const email = str(req.body.email, 160)?.toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const status = ['OUTPATIENT', 'ADMITTED'].includes(req.body.status) ? req.body.status : 'OUTPATIENT';
  const p = await prisma.institutionPatient.create({ data: {
    institutionId: i.id, userId: user?.id, name, email, phone: str(req.body.phone, 30), mrn: str(req.body.mrn, 40) || 'MRN-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    departmentId: str(req.body.departmentId), status, bed: str(req.body.bed, 20), admittedAt: status === 'ADMITTED' ? new Date() : null, notes: str(req.body.notes, 2000),
  } });
  if (status === 'ADMITTED' && p.departmentId) await prisma.department.update({ where: { id: p.departmentId }, data: { bedsOccupied: { increment: 1 } } }).catch(() => null);
  if (user) await notify(user.id, 'system', `Registered at ${i.name}`, `Your medical record number is ${p.mrn}.`);
  res.status(201).json(p);
}
export async function updateInstPatient(req: Request, res: Response) {
  const i = await inst(req);
  const p = await prisma.institutionPatient.findUnique({ where: { id: req.params.id } });
  if (!p || p.institutionId !== i.id) throw ApiError.notFound('Patient not found');
  const status = ['OUTPATIENT', 'ADMITTED', 'DISCHARGED', 'REFERRED'].includes(req.body.status) ? req.body.status : p.status;
  const data: any = { status, bed: str(req.body.bed, 20) ?? p.bed, notes: str(req.body.notes, 2000) ?? p.notes, departmentId: req.body.departmentId !== undefined ? str(req.body.departmentId) ?? null : p.departmentId };
  if (status === 'ADMITTED' && p.status !== 'ADMITTED') { data.admittedAt = date(req.body.admittedAt) || new Date(); data.dischargedAt = null; }
  if (status === 'DISCHARGED' && p.status !== 'DISCHARGED') data.dischargedAt = new Date();
  const u = await prisma.institutionPatient.update({ where: { id: p.id }, data });
  if (p.status !== 'ADMITTED' && status === 'ADMITTED' && u.departmentId) await prisma.department.update({ where: { id: u.departmentId }, data: { bedsOccupied: { increment: 1 } } }).catch(() => null);
  if (p.status === 'ADMITTED' && status !== 'ADMITTED' && p.departmentId) await prisma.department.updateMany({ where: { id: p.departmentId, bedsOccupied: { gt: 0 } }, data: { bedsOccupied: { decrement: 1 } } });
  if (p.userId && status !== p.status) await notify(p.userId, 'system', `${i.name}: ${status.toLowerCase()}`, `Your status at ${i.name} is now ${status.toLowerCase()}.`);
  res.json(u);
}
/** GET /api/institution/reports?days=30 - trend data for the reports screen. */
export async function institutionReports(req: Request, res: Response) {
  const i = await inst(req);
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const since = new Date(Date.now() - days * 86400_000);
  const [patients, appts, depts] = await Promise.all([
    prisma.institutionPatient.findMany({ where: { institutionId: i.id, createdAt: { gte: since } }, select: { createdAt: true, status: true, admittedAt: true, dischargedAt: true, departmentId: true } }),
    prisma.appointment.findMany({ where: { institutionId: i.id, scheduledAt: { gte: since } }, select: { scheduledAt: true, status: true, fee: true } }),
    prisma.department.findMany({ where: { institutionId: i.id }, select: { id: true, name: true, beds: true, bedsOccupied: true } }),
  ]);
  const byDay: Record<string, { admissions: number; discharges: number; outpatients: number; appointments: number }> = {};
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const bump = (d: Date | null, f: keyof (typeof byDay)[string]) => { if (!d) return; const k = key(d); byDay[k] = byDay[k] || { admissions: 0, discharges: 0, outpatients: 0, appointments: 0 }; byDay[k][f]++; };
  patients.forEach((p) => { bump(p.admittedAt, 'admissions'); bump(p.dischargedAt, 'discharges'); if (p.status === 'OUTPATIENT') bump(p.createdAt, 'outpatients'); });
  appts.forEach((a) => bump(a.scheduledAt, 'appointments'));
  const stays = patients.filter((p) => p.admittedAt && p.dischargedAt).map((p) => (p.dischargedAt!.getTime() - p.admittedAt!.getTime()) / 86400_000);
  res.json({
    days, series: Object.entries(byDay).sort().map(([d, v]) => ({ date: d, ...v })),
    avgLengthOfStayDays: stays.length ? Math.round((stays.reduce((a, b) => a + b, 0) / stays.length) * 10) / 10 : 0,
    appointmentRevenue: appts.filter((a) => a.status === 'COMPLETED').reduce((s, a) => s + Number(a.fee), 0),
    departments: depts.map((d) => ({ ...d, occupancy: d.beds ? Math.round((d.bedsOccupied / d.beds) * 100) : 0, patients: patients.filter((p) => p.departmentId === d.id).length })),
  });
}
