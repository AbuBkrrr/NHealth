// Paying part of a bill with reward coins: the coins come off the bill and the rest is paid by card or cash.
// N-Health funds the coin part (reward coins are its marketing cost), so the provider still earns their full share:
//  - card: the gateway settles the provider's share of what the patient paid; N-Health credits the rest to their balance
//  - cash: the provider collects the reduced amount; N-Health credits the coin part to their balance
// The coins go back to the patient if the bill is cancelled before the service.
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { COIN_VALUE_NGN } from './coins';
import { getOrCreateLedger, spendCredits, refundCredits } from './creditsService';

export const COIN_PAYABLES = ['APPOINTMENT', 'PHARMACY_ORDER', 'LAB_TEST', 'NURSE_REQUEST'];

/** Naira value of the coins applied to a bill (0 if none). */
export async function coinCredit(payableType: string, payableId: string): Promise<number> {
  const r = await prisma.coinRedemption.findUnique({ where: { payableType_payableId: { payableType, payableId } } });
  return r && r.status === 'ACTIVE' ? Number(r.amount) : 0;
}

export async function getRedemption(payableType: string, payableId: string) {
  const r = await prisma.coinRedemption.findUnique({ where: { payableType_payableId: { payableType, payableId } } });
  return r && r.status === 'ACTIVE' ? r : null;
}

/**
 * Applies `coins` to a bill the patient hasn't paid yet. `billTotal` is the full bill from the database.
 * Leaves at least ₦1 to pay by card or cash (to use coins for the whole bill, pay with coins instead).
 */
export async function applyCoins(userId: string, payableType: string, payableId: string, coins: number, billTotal: number) {
  if (!COIN_PAYABLES.includes(payableType)) throw ApiError.badRequest('Coins can\'t be used for this');
  coins = Math.floor(Number(coins));
  if (!(coins >= 1)) throw ApiError.badRequest('Choose how many coins to use');
  if (await prisma.payment.findFirst({ where: { payableType: payableType as any, payableId, status: { in: ['PENDING', 'CONFIRMED'] } } })) throw ApiError.conflict('This bill is already being paid');
  if (await getRedemption(payableType, payableId)) throw ApiError.conflict('Coins are already applied to this bill');
  const amount = coins * COIN_VALUE_NGN;
  if (amount >= billTotal) throw ApiError.badRequest('That covers the whole bill: choose "Use my reward coins" to pay it all with coins');
  await getOrCreateLedger(userId);
  const ledger = await prisma.creditLedger.findUnique({ where: { userId } });
  if (!ledger || Number(ledger.balance) < amount) throw ApiError.badRequest('You don\'t have that many coins');
  const reference = 'CP-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  await spendCredits(userId, amount, reference, `Coins used on a ${payableType.replace('_', ' ').toLowerCase()}`, { payableType, payableId, coins });
  // A cancelled earlier redemption for the same bill is reused (one row per bill).
  await prisma.coinRedemption.upsert({
    where: { payableType_payableId: { payableType, payableId } },
    create: { userId, payableType, payableId, amount, coins, reference },
    update: { userId, amount, coins, reference, status: 'ACTIVE' },
  });
  return { coins, amount, remaining: Math.round((billTotal - amount) * 100) / 100 };
}

/** Gives the coins back (patient changed their mind before paying, or the bill was cancelled). Idempotent. */
export async function returnCoins(payableType: string, payableId: string, reason: string) {
  const r = await getRedemption(payableType, payableId);
  if (!r) return null;
  const claimed = await prisma.coinRedemption.updateMany({ where: { id: r.id, status: 'ACTIVE' }, data: { status: 'REFUNDED' } });
  if (!claimed.count) return null;
  await refundCredits(r.userId, Number(r.amount), 'RF-' + r.reference, 'Coins returned: ' + reason, { payableType, payableId });
  return r;
}
