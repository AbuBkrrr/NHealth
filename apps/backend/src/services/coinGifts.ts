// "Help someone pay for care": a person offers some of their reward coins towards another person's care.
// The coins NEVER enter the recipient's balance (that would make coins transferable stored value, which needs a CBN
// licence). The recipient applies the offer to one of their own unpaid bills; the provider is paid for that part by
// N-Health, exactly like any coin payment. Anything not used, declined, cancelled or expired goes back to the sender.
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { COIN_VALUE_NGN } from './coins';
import { getOrCreateLedger, spendCredits, refundCredits } from './creditsService';
import { coinCap, COIN_PAYABLES } from './coinParts';
import { notify } from './notify';

const OFFER_DAYS = 7;
const DAILY_LIMIT_COINS = 500; // most coins one person can offer per day (fraud control)
const first = (n?: string | null) => (n || 'Someone').split(' ')[0];
const mask = (s?: string | null, keep = 3) => (s ? s.slice(0, keep) + '•••' + s.slice(-2) : null);

/** Finds an N-Health member by phone, email, N-Health ID (invite code) or user ID, and returns a confirmable profile. */
export async function findRecipient(meId: string, q: string) {
  q = String(q || '').trim();
  if (q.length < 4) throw ApiError.badRequest('Enter their phone number, email, N-Health ID or user ID');
  const digits = q.replace(/\D/g, '');
  const phones = digits.length >= 10 ? [q, '0' + digits.slice(-10), '+234' + digits.slice(-10), '234' + digits.slice(-10)] : [];
  const u = await prisma.user.findFirst({
    where: { isActive: true, deletedAt: null, OR: [{ email: q.toLowerCase() }, { referralCode: q.toUpperCase() }, { id: q }, ...phones.map((p) => ({ phone: p }))] },
    select: { id: true, name: true, avatarUrl: true, phone: true, email: true, role: true, referralCode: true, createdAt: true, kycStatus: true, emailVerifiedAt: true, phoneVerifiedAt: true },
  });
  if (!u) throw ApiError.notFound('No N-Health member found. Check the details and try again.');
  if (u.id === meId) throw ApiError.badRequest('That is you. Use your coins on your own bills from the payment screen.');
  if (u.role !== 'PATIENT') throw ApiError.badRequest('Coins can only help patients pay for care');
  const [user, domain] = (u.email || '').split('@');
  return {
    id: u.id, name: u.name, avatarUrl: u.avatarUrl, nhealthId: u.referralCode,
    phone: mask(u.phone, 4), email: user ? mask(user, 2) + '@' + domain : null,
    memberSince: u.createdAt, identityVerified: u.kycStatus === 'APPROVED', contactConfirmed: !!(u.emailVerifiedAt || u.phoneVerifiedAt),
  };
}

/** The sender offers coins: they leave the sender's balance now and are returned if not used. */
export async function offerCoins(fromUserId: string, toUserId: string, coins: number, note?: string) {
  coins = Math.floor(Number(coins));
  if (!(coins >= 1)) throw ApiError.badRequest('Choose how many coins to offer');
  if (fromUserId === toUserId) throw ApiError.badRequest('You can\'t offer coins to yourself');
  const to = await prisma.user.findFirst({ where: { id: toUserId, isActive: true, deletedAt: null, role: 'PATIENT' }, select: { id: true, name: true, emailVerifiedAt: true, phoneVerifiedAt: true } });
  if (!to) throw ApiError.notFound('Recipient not found');
  if (!to.emailVerifiedAt && !to.phoneVerifiedAt) throw ApiError.badRequest(`${first(to.name)} needs to confirm their email or phone on N-Health first`);
  const since = new Date(Date.now() - 86400_000);
  const today = await prisma.coinSponsorship.aggregate({ where: { fromUserId, createdAt: { gte: since }, status: { not: 'CANCELLED' } }, _sum: { coins: true } });
  if ((today._sum.coins || 0) + coins > DAILY_LIMIT_COINS) throw ApiError.badRequest(`You can offer up to ${DAILY_LIMIT_COINS} coins a day`);
  await getOrCreateLedger(fromUserId);
  const ledger = await prisma.creditLedger.findUnique({ where: { userId: fromUserId } });
  if (!ledger || Number(ledger.balance) < coins * COIN_VALUE_NGN) throw ApiError.badRequest('You don\'t have that many coins');
  const reference = 'SP-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  await spendCredits(fromUserId, coins * COIN_VALUE_NGN, reference, `Coins offered towards ${first(to.name)}'s care`, { sponsorship: true, toUserId });
  const s = await prisma.coinSponsorship.create({ data: { fromUserId, toUserId, coins, reference, note: note ? String(note).slice(0, 140) : null, expiresAt: new Date(Date.now() + OFFER_DAYS * 86400_000) } });
  const from = await prisma.user.findUnique({ where: { id: fromUserId }, select: { name: true } });
  await notify(toUserId, 'payment', `🎁 ${first(from?.name)} offered you ${coins} coins`, `Use them towards one of your bills on N-Health within ${OFFER_DAYS} days.${s.note ? ' "' + s.note + '"' : ''}`, { data: { sponsorshipId: s.id } });
  return s;
}

/** Returns an offer's coins to the sender (declined, cancelled or expired). Idempotent. */
async function giveBack(id: string, status: 'DECLINED' | 'CANCELLED' | 'EXPIRED') {
  const s = await prisma.coinSponsorship.findUnique({ where: { id } });
  if (!s || s.status !== 'OFFERED') return null;
  const claimed = await prisma.coinSponsorship.updateMany({ where: { id, status: 'OFFERED' }, data: { status } });
  if (!claimed.count) return null;
  await refundCredits(s.fromUserId, s.coins * COIN_VALUE_NGN, 'RF-' + s.reference, `Offer ${status.toLowerCase()}: coins returned`, { sponsorshipId: id });
  if (status !== 'CANCELLED') await notify(s.fromUserId, 'payment', 'Coins returned', `${s.coins} coins you offered were ${status === 'DECLINED' ? 'declined' : 'not used in time'} and are back in your balance.`);
  return s;
}
export async function expireOffers(userIds: string[]) {
  const old = await prisma.coinSponsorship.findMany({ where: { status: 'OFFERED', expiresAt: { lt: new Date() }, OR: [{ fromUserId: { in: userIds } }, { toUserId: { in: userIds } }] }, select: { id: true } });
  for (const o of old) await giveBack(o.id, 'EXPIRED');
}
export async function cancelOffer(userId: string, id: string) {
  const s = await prisma.coinSponsorship.findUnique({ where: { id } });
  if (!s || s.fromUserId !== userId) throw ApiError.notFound('Offer not found');
  if (s.status !== 'OFFERED') throw ApiError.conflict('This offer was already ' + s.status.toLowerCase());
  return giveBack(id, 'CANCELLED');
}
export async function declineOffer(userId: string, id: string) {
  const s = await prisma.coinSponsorship.findUnique({ where: { id } });
  if (!s || s.toUserId !== userId) throw ApiError.notFound('Offer not found');
  if (s.status !== 'OFFERED') throw ApiError.conflict('This offer was already ' + s.status.toLowerCase());
  return giveBack(id, 'DECLINED');
}

/** The recipient's own unpaid bills the offer can pay towards. */
export async function billsForOffer(userId: string) {
  const p = await prisma.patientProfile.findUnique({ where: { userId } });
  if (!p) return [];
  const [appts, orders, tests, nurse] = await Promise.all([
    prisma.appointment.findMany({ where: { patientId: p.id, paymentStatus: 'UNPAID', status: { notIn: ['CANCELLED', 'COMPLETED'] } }, include: { doctor: { include: { user: { select: { name: true } } } } }, take: 20 }),
    prisma.pharmacyOrder.findMany({ where: { patientId: p.id, paymentStatus: { notIn: ['PAID', 'CASH_DUE'] }, status: 'PENDING' }, include: { pharmacy: { select: { pharmacyName: true } } }, take: 20 }),
    prisma.labTest.findMany({ where: { patientId: p.id, paymentStatus: 'UNPAID', status: { notIn: ['CANCELLED', 'COMPLETED'] } }, include: { lab: { select: { labName: true } } }, take: 20 }),
    prisma.nurseRequest.findMany({ where: { patientId: p.id, nurseId: { not: null }, status: 'ACCEPTED' }, include: { nurse: { include: { user: { select: { name: true } } } } }, take: 20 }),
  ]);
  const list = [
    ...appts.map((a) => ({ payableType: 'APPOINTMENT', payableId: a.id, title: 'Appointment with Dr. ' + a.doctor.user.name, total: Number(a.fee) ? Number(a.fee) + Number(a.serviceFee) : Number(a.doctor.consultationFee) })),
    ...orders.map((o) => ({ payableType: 'PHARMACY_ORDER', payableId: o.id, title: 'Order from ' + (o.pharmacy.pharmacyName || 'pharmacy'), total: Number(o.total) })),
    ...tests.map((t) => ({ payableType: 'LAB_TEST', payableId: t.id, title: t.testType + ' at ' + (t.lab.labName || 'diagnostic center'), total: Number(t.fee) })),
    ...nurse.map((n) => ({ payableType: 'NURSE_REQUEST', payableId: n.id, title: 'Home care by ' + (n.nurse?.user.name || 'nurse'), total: Number(n.fee) || Number(n.nurse?.hourlyRate || 0) * (n.durationHours || 1) })),
  ];
  const out = [];
  for (const b of list) {
    if (await prisma.payment.findFirst({ where: { payableType: b.payableType as any, payableId: b.payableId, status: { in: ['PENDING', 'CONFIRMED'] } } })) continue;
    if (await prisma.coinRedemption.findUnique({ where: { payableType_payableId: { payableType: b.payableType, payableId: b.payableId } } }).then((r) => r?.status === 'ACTIVE')) continue;
    const { cap, note } = await coinCap(b.payableType, b.payableId, b.total);
    if (cap > 0) out.push({ ...b, maxCoins: Math.floor(cap / COIN_VALUE_NGN), note: note || null });
  }
  return out;
}

/**
 * The recipient applies an offer to one of their own bills. Coins cover up to the bill (and, on pharmacy orders, only
 * the delivery fee and over-the-counter items); the recipient pays any rest by card or cash; unused coins go back.
 */
export async function useOffer(userId: string, id: string, payableType: string, payableId: string) {
  const s = await prisma.coinSponsorship.findUnique({ where: { id } });
  if (!s || s.toUserId !== userId) throw ApiError.notFound('Offer not found');
  if (s.status !== 'OFFERED' || s.expiresAt < new Date()) throw ApiError.conflict('This offer is no longer available');
  if (!COIN_PAYABLES.includes(payableType)) throw ApiError.badRequest('Choose one of your bills');
  const bill = (await billsForOffer(userId)).find((b) => b.payableType === payableType && b.payableId === payableId);
  if (!bill) throw ApiError.badRequest('This bill can\'t take coins (already paid, or coins already applied)');
  const offered = s.coins * COIN_VALUE_NGN;
  const usable = Math.min(offered, bill.maxCoins * COIN_VALUE_NGN, bill.total);
  const claimed = await prisma.coinSponsorship.updateMany({ where: { id, status: 'OFFERED' }, data: { status: 'USED', payableType, payableId, usedCoins: Math.round(usable / COIN_VALUE_NGN), usedAt: new Date() } });
  if (!claimed.count) throw ApiError.conflict('This offer is no longer available');
  if (usable >= bill.total) {
    // The offer covers the whole bill: it is paid with the sender's coins (refunds go back to the sender).
    const { markPaid } = await import('./checkout');
    const now = new Date();
    const payment = await prisma.payment.create({ data: { payerId: s.fromUserId, payableType: payableType as any, payableId, amount: bill.total, method: 'WALLET', status: 'CONFIRMED', reference: 'SPP-' + s.reference, providerUserId: null, expiresAt: now, confirmedAt: now } });
    await markPaid(payableType as any, payableId);
    void payment;
  } else {
    await prisma.coinRedemption.create({ data: { userId: s.fromUserId, payableType, payableId, amount: usable, coins: Math.round(usable / COIN_VALUE_NGN), reference: 'SPR-' + s.reference, sponsorshipId: s.id } });
  }
  if (offered > usable) await refundCredits(s.fromUserId, Math.round((offered - usable) * 100) / 100, 'RFU-' + s.reference, 'Unused coins from your offer', { sponsorshipId: id });
  const to = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  await notify(s.fromUserId, 'payment', '💚 Your coins helped', `${first(to?.name)} used ${Math.round(usable / COIN_VALUE_NGN)} of your coins towards their care.${offered > usable ? ' The rest are back in your balance.' : ''}`);
  return { usedCoins: Math.round(usable / COIN_VALUE_NGN), covered: usable, remaining: Math.max(0, Math.round((bill.total - usable) * 100) / 100), paidInFull: usable >= bill.total };
}

/** Offers I sent and offers waiting for me. */
export async function myOffers(userId: string) {
  await expireOffers([userId]);
  const rows = await prisma.coinSponsorship.findMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] }, orderBy: { createdAt: 'desc' }, take: 50 });
  const ids = [...new Set(rows.flatMap((r) => [r.fromUserId, r.toUserId]))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, avatarUrl: true } });
  const u = new Map(users.map((x) => [x.id, x]));
  return rows.map((r) => ({ ...r, direction: r.fromUserId === userId ? 'SENT' : 'RECEIVED', from: u.get(r.fromUserId), to: u.get(r.toUserId) }));
}
