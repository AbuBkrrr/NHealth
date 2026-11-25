import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { notify } from '../../services/notify';
import { uid, str, num } from './util';

async function lab(req: Request) {
  const l = await prisma.labProfile.findUnique({ where: { userId: uid(req) } });
  if (!l) throw ApiError.notFound('Lab profile not found');
  return l;
}
const catData = (b: any) => ({ name: str(b.name, 160)!, code: str(b.code, 30), category: str(b.category, 60), price: num(b.price) ?? 0, currency: str(b.currency, 3)?.toUpperCase() || 'NGN',
  turnaroundHours: Math.max(1, Math.round(num(b.turnaroundHours) || 24)), sampleType: str(b.sampleType, 60), preparation: str(b.preparation, 500), isActive: b.isActive !== false });
export async function myCatalog(req: Request, res: Response) { const l = await lab(req); res.json(await prisma.labTestCatalog.findMany({ where: { labId: l.id }, orderBy: { name: 'asc' } })); }
export async function addCatalog(req: Request, res: Response) {
  const l = await lab(req);
  if (!str(req.body.name) || num(req.body.price) === undefined) throw ApiError.badRequest('Test name and price are required');
  res.status(201).json(await prisma.labTestCatalog.create({ data: { labId: l.id, ...catData(req.body) } }));
}
export async function updateCatalog(req: Request, res: Response) {
  const l = await lab(req);
  const c = await prisma.labTestCatalog.findUnique({ where: { id: req.params.id } });
  if (!c || c.labId !== l.id) throw ApiError.notFound('Test not found');
  res.json(await prisma.labTestCatalog.update({ where: { id: c.id }, data: catData({ ...c, price: Number(c.price), ...req.body }) }));
}
export async function deleteCatalog(req: Request, res: Response) { const l = await lab(req); await prisma.labTestCatalog.updateMany({ where: { id: req.params.id, labId: l.id }, data: { isActive: false } }); res.json({ ok: true }); }

/** GET /api/labs/catalog?q=CBC - search tests across all labs (patient booking). */
export async function searchCatalog(req: Request, res: Response) {
  const where: any = { isActive: true };
  if (req.query.q) where.name = { contains: String(req.query.q), mode: 'insensitive' };
  if (req.query.labId) where.labId = String(req.query.labId);
  res.json(await prisma.labTestCatalog.findMany({ where, take: 200, orderBy: { price: 'asc' }, include: { lab: { select: { id: true, labName: true, address: true, city: true, rating: true, homeCollection: true, userId: true } } } }));
}

/** POST /api/doctor-ops/lab-requests { patientId, labId, catalogId?, testType, notes } - doctor orders a test; the result returns to them. */
export async function doctorLabRequest(req: Request, res: Response) {
  const doc = await prisma.doctorProfile.findUnique({ where: { userId: uid(req) } });
  if (!doc) throw ApiError.forbidden('Only doctors can request lab tests');
  const patient = await prisma.patientProfile.findUnique({ where: { id: String(req.body.patientId) } });
  if (!patient) throw ApiError.notFound('Patient not found');
  const treats = await prisma.appointment.count({ where: { doctorId: doc.id, patientId: patient.id } });
  if (!treats) throw ApiError.forbidden('You can only order tests for your own patients');
  const l = await prisma.labProfile.findUnique({ where: { id: String(req.body.labId) } });
  if (!l) throw ApiError.notFound('Lab not found');
  const cat = req.body.catalogId ? await prisma.labTestCatalog.findUnique({ where: { id: String(req.body.catalogId) } }) : null;
  const test = await prisma.labTest.create({ data: { patientId: patient.id, labId: l.id, catalogId: cat?.id, testType: cat?.name || str(req.body.testType, 160) || 'Lab test', fee: cat?.price ?? undefined, requestedByDoctorId: doc.id, notes: str(req.body.notes, 1000) } });
  await notify(l.userId, 'lab', 'Doctor test request 🔬', `A doctor requested ${test.testType} for a patient.`, { data: { labTestId: test.id } });
  await notify(patient.userId, 'lab', 'Lab test ordered', `Your doctor ordered ${test.testType}. Pay and book a sample time in Labs.`, { data: { labTestId: test.id } });
  res.status(201).json(test);
}
/** GET /api/doctor-ops/lab-requests - tests this doctor ordered, with results. */
export async function doctorLabResults(req: Request, res: Response) {
  const doc = await prisma.doctorProfile.findUnique({ where: { userId: uid(req) } });
  if (!doc) throw ApiError.forbidden('Doctors only');
  res.json(await prisma.labTest.findMany({ where: { requestedByDoctorId: doc.id }, orderBy: { createdAt: 'desc' }, include: { result: true, lab: { select: { labName: true } }, patient: { include: { user: { select: { name: true } } } } } }));
}
/** GET /api/doctor-ops/stats - doctor dashboard numbers. */
export async function doctorStats(req: Request, res: Response) {
  const doc = await prisma.doctorProfile.findUnique({ where: { userId: uid(req) } });
  if (!doc) throw ApiError.forbidden('Doctors only');
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const [patients, requests, today, earnings, monthEarn] = await Promise.all([
    prisma.appointment.findMany({ where: { doctorId: doc.id }, distinct: ['patientId'], select: { patientId: true } }),
    prisma.appointment.count({ where: { doctorId: doc.id, status: 'PENDING' } }),
    prisma.appointment.count({ where: { doctorId: doc.id, scheduledAt: { gte: start, lt: new Date(start.getTime() + 86400_000) }, status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] } } }),
    prisma.payment.aggregate({ where: { providerUserId: uid(req), status: 'CONFIRMED' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { providerUserId: uid(req), status: 'CONFIRMED', confirmedAt: { gte: monthStart } }, _sum: { amount: true } }),
  ]);
  res.json({ patients: patients.length, requests, today, rating: doc.rating, reviewCount: doc.reviewCount, earnings: Number(earnings._sum.amount || 0), monthEarnings: Number(monthEarn._sum.amount || 0) });
}
