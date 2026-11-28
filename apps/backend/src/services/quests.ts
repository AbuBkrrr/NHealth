// Health quests: the way people earn reward coins (the same model as Muslim Pro's Quests and Stars).
// Coins are never sold. They're earned by doing things that are good for your health and for N-Health's community,
// then used towards care on N-Health or donated to the partner NGO. N-Health funds both from its marketing budget.
// Each completed quest is a coin transaction with a unique reference (QUEST-<key>-<period>-<user>), so it can only
// be rewarded once per period, and the server checks every condition itself.
import { prisma } from '../config/prisma';
import { grantRewardCoins, COIN_VALUE_NGN } from './coins';

export type QuestKey = 'checkin' | 'read' | 'profile' | 'email' | 'phone' | 'identity' | 'reminder' | 'vaccine' | 'checkup' | 'blood';
export interface QuestDef { key: QuestKey; title: string; hint: string; icon: string; repeat: 'daily' | 'once' | 'each'; go?: string }

export const QUESTS: QuestDef[] = [
  { key: 'checkin', title: 'Daily check-in', hint: 'Open N-Health and check in once a day', icon: '📅', repeat: 'daily' },
  { key: 'read', title: 'Read a health article', hint: 'Read any article for at least 20 seconds', icon: '📖', repeat: 'daily', go: '/articles' },
  { key: 'profile', title: 'Complete your health profile', hint: 'Add your blood group, genotype and an emergency contact', icon: '🩺', repeat: 'once', go: '/profile' },
  { key: 'email', title: 'Confirm your email', hint: 'So we can reach you about your care', icon: '✉️', repeat: 'once', go: '/settings' },
  { key: 'phone', title: 'Confirm your phone', hint: 'Get alerts and codes on WhatsApp', icon: '📱', repeat: 'once', go: '/settings' },
  { key: 'identity', title: 'Verify your identity', hint: 'Keeps you and providers safe', icon: '🪪', repeat: 'once', go: '/kyc' },
  { key: 'reminder', title: 'Set a medication reminder', hint: 'Never miss a dose', icon: '💊', repeat: 'once', go: '/patient/records?tab=reminders' },
  { key: 'vaccine', title: 'Record a vaccination', hint: 'Keep your vaccine card on your phone', icon: '💉', repeat: 'once', go: '/patient/records?tab=vaccines' },
  { key: 'checkup', title: 'Have a check-up', hint: 'Complete an appointment with a doctor on N-Health', icon: '👨‍⚕️', repeat: 'once', go: '/patient/appointments?tab=book' },
  { key: 'blood', title: 'Donate blood', hint: 'Each completed blood donation you pledged on N-Health', icon: '🩸', repeat: 'each', go: '/patient/donations' },
];

export interface QuestSettings { enabled: boolean; dailyCap: number; coins: Record<QuestKey, number> }
export const DEFAULT_QUESTS: QuestSettings = {
  enabled: true,
  dailyCap: 20, // most coins anyone can earn from quests in a day (one-off and blood quests count too)
  coins: { checkin: 1, read: 1, profile: 5, email: 2, phone: 2, identity: 10, reminder: 2, vaccine: 2, checkup: 5, blood: 20 },
};

let cache: { at: number; v: QuestSettings } | null = null;
export async function getQuestSettings(): Promise<QuestSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.v;
  const row = await prisma.platformSetting.findUnique({ where: { key: 'quests' } }).catch(() => null);
  const saved = (row?.value as Partial<QuestSettings>) || {};
  const v = { ...DEFAULT_QUESTS, ...saved, coins: { ...DEFAULT_QUESTS.coins, ...(saved.coins || {}) } };
  cache = { at: Date.now(), v };
  return v;
}
export async function saveQuestSettings(patch: any, adminId: string) {
  const cur = await getQuestSettings();
  const coins = { ...cur.coins };
  for (const q of QUESTS) if (Number.isFinite(Number(patch?.coins?.[q.key]))) coins[q.key] = Math.max(0, Math.min(1000, Math.round(Number(patch.coins[q.key]))));
  const next: QuestSettings = {
    enabled: typeof patch?.enabled === 'boolean' ? patch.enabled : cur.enabled,
    dailyCap: Number.isFinite(Number(patch?.dailyCap)) ? Math.max(0, Math.min(10000, Math.round(Number(patch.dailyCap)))) : cur.dailyCap,
    coins,
  };
  await prisma.platformSetting.upsert({ where: { key: 'quests' }, create: { key: 'quests', value: next as any, updatedById: adminId }, update: { value: next as any, updatedById: adminId } });
  cache = null;
  return next;
}

/** Africa/Lagos calendar day, e.g. 2026-11-28. */
const lagosDay = (d = new Date()) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);
const ref = (key: string, period: string, userId: string) => `QUEST-${key}-${period}-${userId}`;

/** Completed blood donations not yet rewarded (each one earns the blood quest). */
async function bloodPledges(userId: string) {
  return prisma.donorPledge.findMany({ where: { donorId: userId, type: 'BLOOD', status: 'COMPLETED' }, select: { id: true }, orderBy: { createdAt: 'asc' } });
}

/** Whether the condition for a quest is met right now (the server checks; the app only asks). */
async function conditionMet(key: QuestKey, userId: string): Promise<{ ok: boolean; period: string }> {
  const today = lagosDay();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true, phoneVerifiedAt: true, kycStatus: true, verificationStatus: true, role: true, patientProfile: { select: { id: true, bloodType: true, genotype: true, emergencyPhone: true } } } });
  if (!u) return { ok: false, period: 'once' };
  switch (key) {
    case 'checkin': case 'read': return { ok: true, period: today };
    case 'profile': { const p = u.patientProfile; return { ok: !!(p?.bloodType && p?.genotype && p?.emergencyPhone), period: 'once' }; }
    case 'email': return { ok: !!u.emailVerifiedAt, period: 'once' };
    case 'phone': return { ok: !!u.phoneVerifiedAt, period: 'once' };
    case 'identity': return { ok: u.kycStatus === 'APPROVED' || (u.role !== 'PATIENT' && u.verificationStatus === 'VERIFIED'), period: 'once' };
    case 'reminder': return { ok: (await prisma.medicationReminder.count({ where: { userId } })) > 0, period: 'once' };
    case 'vaccine': return { ok: (await prisma.vaccination.count({ where: { userId } })) > 0, period: 'once' };
    case 'checkup': return { ok: !!u.patientProfile && (await prisma.appointment.count({ where: { patientId: u.patientProfile.id, status: 'COMPLETED' } })) > 0, period: 'once' };
    case 'blood': {
      for (const p of await bloodPledges(userId)) if (!(await prisma.creditTransaction.findUnique({ where: { reference: ref('blood', p.id, userId) } }))) return { ok: true, period: p.id };
      return { ok: false, period: 'each' };
    }
  }
}

async function earnedToday(userId: string) {
  const start = new Date(lagosDay() + 'T00:00:00+01:00');
  const r = await prisma.creditTransaction.aggregate({ where: { userId, type: 'reward', reference: { startsWith: 'QUEST-' }, createdAt: { gte: start } }, _sum: { amount: true } });
  return Number(r._sum.amount || 0) / COIN_VALUE_NGN;
}

/** Consecutive daily check-ins up to today (or yesterday, if today's isn't done yet). */
async function checkinStreak(userId: string) {
  const rows = await prisma.creditTransaction.findMany({ where: { userId, reference: { startsWith: 'QUEST-checkin-' } }, select: { reference: true }, orderBy: { createdAt: 'desc' }, take: 400 });
  const days = new Set(rows.map((r) => r.reference.slice('QUEST-checkin-'.length, 'QUEST-checkin-'.length + 10)));
  let streak = 0;
  const d = new Date();
  if (!days.has(lagosDay(d))) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(lagosDay(d))) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
  return streak;
}

/** The quest board for one person. */
export async function questBoard(userId: string) {
  const s = await getQuestSettings();
  const role = (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role;
  const list = QUESTS.filter((q) => s.coins[q.key] > 0 && (role === 'PATIENT' || ['checkin', 'read', 'email', 'phone', 'identity'].includes(q.key)));
  const quests = [];
  for (const q of list) {
    const c = await conditionMet(q.key, userId);
    const done = c.period === 'each' ? false : !!(await prisma.creditTransaction.findUnique({ where: { reference: ref(q.key, c.period, userId) } }));
    const doneCount = q.repeat === 'each' ? await prisma.creditTransaction.count({ where: { userId, reference: { startsWith: `QUEST-${q.key}-` } } }) : undefined;
    quests.push({ ...q, coins: s.coins[q.key], done: q.repeat === 'each' ? false : done, claimable: c.ok && !done, doneCount });
  }
  return { enabled: s.enabled, dailyCap: s.dailyCap, earnedToday: await earnedToday(userId), streak: await checkinStreak(userId), quests };
}

/** Claims a quest's coins if its condition is met, it wasn't claimed for this period, and the daily cap allows. */
export async function claimQuest(userId: string, key: string) {
  const s = await getQuestSettings();
  const q = QUESTS.find((x) => x.key === key);
  if (!s.enabled) throw Object.assign(new Error('Quests are paused'), { status: 400 });
  if (!q || !(s.coins[q.key] > 0)) throw Object.assign(new Error('Unknown quest'), { status: 404 });
  const c = await conditionMet(q.key, userId);
  if (!c.ok) throw Object.assign(new Error(`Not done yet: ${q.hint.toLowerCase()}`), { status: 400 });
  const left = s.dailyCap - (await earnedToday(userId));
  if (left <= 0) throw Object.assign(new Error('You reached today\'s coin limit. Come back tomorrow!'), { status: 429 });
  const coins = Math.min(s.coins[q.key], left);
  const txn = await grantRewardCoins(userId, coins, ref(q.key, c.period, userId), `Quest: ${q.title}`, { quest: q.key, period: c.period });
  if (!txn) throw Object.assign(new Error('Already claimed'), { status: 409 });
  return { coins, quest: q.key, streak: q.key === 'checkin' ? await checkinStreak(userId) : undefined };
}
