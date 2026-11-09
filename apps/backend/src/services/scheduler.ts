import { prisma } from '../config/prisma';
import { notify } from './notify';
import { getFinance } from './settings';
import { runPayouts } from './earnings';

/**
 * Lightweight in-process scheduler (runs every minute):
 * - appointment reminders 24h and 1h ahead
 * - medication reminders at their scheduled HH:MM (user's timezone)
 * - expiring pending payments
 * For multi-instance deployments only one instance should run it (SCHEDULER_DISABLED=1 on the others).
 */
export function startScheduler() {
  if (process.env.SCHEDULER_DISABLED === '1' || process.env.NODE_ENV === 'test') return;
  const tick = () => runOnce().catch((e) => console.error('[scheduler]', e));
  setInterval(tick, 60_000).unref();
  setTimeout(tick, 5_000).unref();
}

function hhmmIn(tz: string, d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d);
  } catch { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Lagos' }).format(d); }
}

export async function runOnce(now = new Date()) {
  // Appointment reminders (24h window and 1h window)
  const soon = await prisma.appointment.findMany({
    where: { status: 'CONFIRMED', reminderSentAt: null, scheduledAt: { gt: now, lt: new Date(now.getTime() + 24 * 3600_000) } },
    include: { patient: { select: { userId: true } }, doctor: { include: { user: { select: { name: true, id: true } } } } },
    take: 200,
  });
  for (const a of soon) {
    const when = a.scheduledAt.toISOString();
    await notify(a.patient.userId, 'appointment', 'Appointment reminder', `You have an appointment with Dr. ${a.doctor.user.name} at ${when}.`, { email: true, sms: true, data: { appointmentId: a.id, at: when } });
    await notify(a.doctor.user.id, 'appointment', 'Upcoming appointment', `Appointment scheduled at ${when}.`, { data: { appointmentId: a.id } });
    await prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } });
  }

  // Medication reminders
  const reminders = await prisma.medicationReminder.findMany({
    where: { isActive: true, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] },
    include: { user: { select: { timezone: true } } }, take: 5000,
  });
  for (const r of reminders) {
    const t = hhmmIn(r.user.timezone);
    if (Array.isArray(r.times) && (r.times as string[]).includes(t)) {
      await notify(r.userId, 'reminder', '💊 Medication reminder', `Time to take ${r.medication}${r.dosage ? ' (' + r.dosage + ')' : ''}.`, { data: { reminderId: r.id } });
    }
    if (r.refillAt && Math.abs(r.refillAt.getTime() - now.getTime()) < 30_000) {
      await notify(r.userId, 'reminder', 'Refill due', `Your ${r.medication} refill is due. Order from a pharmacy in the app.`, { email: true });
    }
  }

  // Expire stale pending payments
  await prisma.payment.updateMany({ where: { status: 'PENDING', expiresAt: { lt: now } }, data: { status: 'EXPIRED' } });

  await maybeRunPayouts(now);
}

/** Automatic provider payouts on the admin-configured schedule (Africa/Lagos time). Runs once per slot. */
async function maybeRunPayouts(now: Date) {
  const fin = await getFinance();
  if (fin.payoutSchedule === 'MANUAL') return;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map((p) => [p.type, p.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  if (Number(parts.hour) !== fin.payoutHour) return;
  if (fin.payoutSchedule === 'WEEKLY' && dow !== fin.payoutDay) return;
  const slot = `${parts.year}-${parts.month}-${parts.day}`;
  const claimed = await prisma.platformSetting.upsert({ where: { key: 'payoutRun:' + slot }, create: { key: 'payoutRun:' + slot, value: { startedAt: now.toISOString() } }, update: {} });
  if (new Date((claimed.value as any).startedAt).getTime() !== now.getTime()) return; // another tick/instance already ran this slot
  const results = await runPayouts();
  await prisma.platformSetting.update({ where: { key: 'payoutRun:' + slot }, data: { value: { startedAt: now.toISOString(), finishedAt: new Date().toISOString(), count: results.length } } });
  console.log(`[payouts] scheduled run ${slot}: ${results.length} providers processed`);
}
