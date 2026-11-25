import { prisma } from '../config/prisma';

/** Converts a local wall-clock time in `tz` to a UTC Date (handles DST via Intl offset lookup). */
export function zonedToUtc(dateStr: string, time: string, tz: string): Date {
  const guess = new Date(`${dateStr}T${time}:00Z`);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

function localDow(dateStr: string) { return new Date(dateStr + 'T12:00:00Z').getUTCDay(); }

export interface Slot { start: string; end: string; available: boolean; }

/**
 * Bookable slots for a provider on `dateStr` (YYYY-MM-DD, in the provider rule's timezone), built from weekly
 * rules minus blocked periods and existing non-cancelled appointments. Past slots are excluded.
 */
export async function slotsFor(userId: string, dateStr: string): Promise<Slot[]> {
  const rules = await prisma.availabilityRule.findMany({ where: { userId, isActive: true, dayOfWeek: localDow(dateStr) } });
  if (!rules.length) return [];
  const dayStart = zonedToUtc(dateStr, '00:00', rules[0].timezone);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const [blocks, doctor] = await Promise.all([
    prisma.availabilityBlock.findMany({ where: { userId, startAt: { lt: dayEnd }, endAt: { gt: dayStart } } }),
    prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  const appts = doctor ? await prisma.appointment.findMany({
    where: { doctorId: doctor.id, status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }, scheduledAt: { gte: new Date(dayStart.getTime() - 4 * 3600_000), lt: dayEnd } },
    select: { scheduledAt: true, durationMin: true },
  }) : [];
  const now = Date.now();
  const out: Slot[] = [];
  for (const r of rules) {
    let t = zonedToUtc(dateStr, r.startTime, r.timezone).getTime();
    const end = zonedToUtc(dateStr, r.endTime, r.timezone).getTime();
    const step = r.slotMinutes * 60_000;
    for (; t + step <= end; t += step) {
      const s = t, e = t + step;
      const busy = blocks.some((b) => b.startAt.getTime() < e && b.endAt.getTime() > s)
        || appts.some((a) => a.scheduledAt.getTime() < e && a.scheduledAt.getTime() + a.durationMin * 60_000 > s);
      if (s > now) out.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString(), available: !busy });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** True when `at` is the start of a free slot (or the provider has no rules configured - open booking). */
export async function isBookable(userId: string, at: Date): Promise<boolean> {
  const hasRules = await prisma.availabilityRule.count({ where: { userId, isActive: true } });
  if (!hasRules) return at.getTime() > Date.now();
  const rule = await prisma.availabilityRule.findFirst({ where: { userId, isActive: true } });
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: rule!.timezone }).format(at);
  const slots = await slotsFor(userId, dateStr);
  return slots.some((s) => s.available && new Date(s.start).getTime() === at.getTime());
}

/** Days in the next `days` that have at least one free slot (for the calendar dots). */
export async function daysWithSlots(userId: string, fromStr: string, days = 31): Promise<string[]> {
  const res: string[] = [];
  const base = new Date(fromStr + 'T12:00:00Z');
  for (let i = 0; i < days; i++) {
    const d = new Date(base.getTime() + i * 86400_000).toISOString().slice(0, 10);
    const s = await slotsFor(userId, d);
    if (s.some((x) => x.available)) res.push(d);
  }
  return res;
}
