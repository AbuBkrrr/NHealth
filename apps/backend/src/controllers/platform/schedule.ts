import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { slotsFor, daysWithSlots } from '../../services/availability';
import { uid, str, date } from './util';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** GET /api/availability/me */
export async function myAvailability(req: Request, res: Response) {
  const [rules, blocks] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { userId: uid(req) }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] }),
    prisma.availabilityBlock.findMany({ where: { userId: uid(req), endAt: { gt: new Date() } }, orderBy: { startAt: 'asc' } }),
  ]);
  res.json({ rules, blocks });
}

/** PUT /api/availability/me { rules: [{dayOfWeek,startTime,endTime,slotMinutes}], timezone } - replaces the weekly schedule. */
export async function setAvailability(req: Request, res: Response) {
  const rules = Array.isArray(req.body.rules) ? req.body.rules : [];
  const timezone = str(req.body.timezone, 60) || 'Africa/Lagos';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw ApiError.badRequest('Invalid timezone'); }
  const clean = rules.map((r: any) => {
    const d = Number(r.dayOfWeek), slot = Math.min(240, Math.max(10, Number(r.slotMinutes) || 30));
    if (!(d >= 0 && d <= 6) || !HHMM.test(r.startTime) || !HHMM.test(r.endTime) || r.startTime >= r.endTime) throw ApiError.badRequest('Each rule needs a day (0-6) and a valid start/end time');
    return { userId: uid(req), dayOfWeek: d, startTime: r.startTime, endTime: r.endTime, slotMinutes: slot, timezone };
  });
  await prisma.$transaction([prisma.availabilityRule.deleteMany({ where: { userId: uid(req) } }), prisma.availabilityRule.createMany({ data: clean })]);
  if (clean[0]) await prisma.doctorProfile.updateMany({ where: { userId: uid(req) }, data: { slotMinutes: clean[0].slotMinutes } });
  res.json(await prisma.availabilityRule.findMany({ where: { userId: uid(req) } }));
}

export async function addBlock(req: Request, res: Response) {
  const startAt = date(req.body.startAt), endAt = date(req.body.endAt);
  if (!startAt || !endAt || endAt <= startAt) throw ApiError.badRequest('Provide a valid start and end');
  res.status(201).json(await prisma.availabilityBlock.create({ data: { userId: uid(req), startAt, endAt, reason: str(req.body.reason, 200) } }));
}
export async function removeBlock(req: Request, res: Response) {
  await prisma.availabilityBlock.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  res.json({ ok: true });
}

/** GET /api/availability/:userId/slots?date=YYYY-MM-DD */
export async function providerSlots(req: Request, res: Response) {
  const d = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw ApiError.badRequest('date must be YYYY-MM-DD');
  const hasRules = await prisma.availabilityRule.count({ where: { userId: req.params.userId, isActive: true } });
  res.json({ date: d, configured: hasRules > 0, slots: await slotsFor(req.params.userId, d) });
}
/** GET /api/availability/:userId/days?from=YYYY-MM-DD */
export async function providerDays(req: Request, res: Response) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from)) ? String(req.query.from) : new Date().toISOString().slice(0, 10);
  res.json({ from, days: await daysWithSlots(req.params.userId, from, Math.min(62, Number(req.query.days) || 35)) });
}
