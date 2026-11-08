import { prisma } from '../config/prisma';
import { getOrCreateLedger, purchaseCredits } from './creditsService';
import { verify, Gateway } from './gateways';
import { notify } from './notify';

const REFERRAL_REWARD = Number(process.env.REFERRAL_REWARD || 500);

/**
 * Credits a pending top-up exactly once, only after the gateway has confirmed the amount.
 * Safe to call from both the browser-return path and the webhook path (idempotent on internalRef).
 */
export async function settleCreditPurchase(internalRef: string, verified?: { amount: number; currency: string; gatewayRef: string; raw?: any }) {
  const log = await prisma.paymentGatewayLog.findUnique({ where: { internalRef } });
  if (!log || !log.userId) return { ok: false, reason: 'unknown_reference' as const };
  if (log.status === 'success') return { ok: true, already: true, log };

  const v = verified ?? (await verify(log.gateway as Gateway, internalRef).then((r) => (r.success ? r : null)).catch(() => null));
  if (!v) return { ok: false, reason: 'not_paid' as const };
  if (v.currency !== log.currency || v.amount + 0.001 < Number(log.amount)) {
    await prisma.paymentGatewayLog.update({ where: { id: log.id }, data: { status: 'failed', responsePayload: (v.raw ?? v) as any } });
    return { ok: false, reason: 'amount_mismatch' as const };
  }

  // Claim the log atomically so concurrent webhook + confirm calls can't both credit.
  const claimed = await prisma.paymentGatewayLog.updateMany({ where: { id: log.id, status: 'pending' }, data: { status: 'processing' } });
  if (claimed.count === 0) return { ok: true, already: true, log };

  await getOrCreateLedger(log.userId);
  const txn = await purchaseCredits(log.userId, Number(log.amount), internalRef, 'Coins top-up via ' + log.gateway, { gateway: log.gateway, gatewayRef: v.gatewayRef });
  await prisma.paymentGatewayLog.update({ where: { id: log.id }, data: { status: 'success', gatewayRef: v.gatewayRef, responsePayload: (v.raw ?? undefined) as any } });
  await notify(log.userId, 'payment', 'Coins added 💰', `${log.currency} ${Number(log.amount).toLocaleString()} has been added to your balance.`, { email: true, data: { internalRef } });

  // Referral reward on the referee's first successful top-up (closed-loop coins, not cash).
  const user = await prisma.user.findUnique({ where: { id: log.userId }, select: { referredById: true } });
  if (user?.referredById) {
    const prior = await prisma.paymentGatewayLog.count({ where: { userId: log.userId, status: 'success', purpose: 'credit_purchase' } });
    if (prior === 1 && REFERRAL_REWARD > 0) {
      await getOrCreateLedger(user.referredById);
      await purchaseCredits(user.referredById, REFERRAL_REWARD, 'REF-' + log.userId, 'Referral reward', { referee: log.userId }).catch(() => null);
      await notify(user.referredById, 'payment', 'Referral reward 🎁', `You earned ${REFERRAL_REWARD} coins because a friend joined N-Health.`);
    }
  }
  return { ok: true, txn, log };
}
