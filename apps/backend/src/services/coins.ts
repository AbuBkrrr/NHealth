// Coins: N-Health's closed-loop credits. Inside the app every amount is kept in naira; people see coins.
// 1 coin = COIN_VALUE_NGN naira (default 10). Coins are spent only on N-Health services and products: they are
// never withdrawn, transferred between people, or exchanged for cash.
import { prisma } from '../config/prisma';
import { getOrCreateLedger } from './creditsService';
import { notify } from './notify';

export const COIN_VALUE_NGN = Math.max(1, Number(process.env.COIN_VALUE_NGN || 10));
/** Coins earned by the person who invited a new user (once the new user confirms their email or phone). */
export const INVITE_REWARD_COINS = Math.max(0, Number(process.env.INVITE_REWARD_COINS ?? 1));

export const toCoins = (amountNgn: number) => Number(amountNgn || 0) / COIN_VALUE_NGN;
/** "500 coins" / "1 coin" / "7.5 coins" for messages to patients. */
export function coinsText(amountNgn: number) {
  const c = toCoins(amountNgn);
  return c.toLocaleString('en-NG', { maximumFractionDigits: Math.abs(c) < 100 && c % 1 ? 1 : 0 }) + (Math.abs(c) === 1 ? ' coin' : ' coins');
}

/** Adds reward coins once per reference (idempotent). Amount in coins. */
export async function grantRewardCoins(userId: string, coins: number, reference: string, description: string, metadata: Record<string, unknown> = {}) {
  const amount = coins * COIN_VALUE_NGN;
  if (amount <= 0) return null;
  await getOrCreateLedger(userId);
  return prisma.$transaction(async (tx) => {
    if (await tx.creditTransaction.findUnique({ where: { reference } })) return null; // already rewarded
    const ledger = await tx.creditLedger.findUnique({ where: { userId } });
    if (!ledger) return null;
    const balanceAfter = Number(ledger.balance) + amount;
    await tx.creditLedger.update({ where: { userId }, data: { balance: balanceAfter, lastTransactionId: reference } });
    return tx.creditTransaction.create({ data: { ledgerId: ledger.id, userId, type: 'reward', amount, balanceAfter, description, reference, metadata: metadata as any, status: 'completed' } });
  });
}

/**
 * Rewards whoever invited this user, the first time the user confirms their email or phone
 * (so fake sign-ups do not earn coins). Safe to call more than once.
 */
export async function rewardInviter(newUserId: string) {
  if (INVITE_REWARD_COINS <= 0) return;
  const u = await prisma.user.findUnique({ where: { id: newUserId }, select: { name: true, referredById: true, emailVerifiedAt: true, phoneVerifiedAt: true } });
  if (!u?.referredById || (!u.emailVerifiedAt && !u.phoneVerifiedAt)) return;
  const inviter = await prisma.user.findUnique({ where: { id: u.referredById }, select: { id: true, isActive: true, deletedAt: true } });
  if (!inviter || !inviter.isActive || inviter.deletedAt) return;
  const first = (u.name || 'A friend').split(' ')[0];
  const txn = await grantRewardCoins(inviter.id, INVITE_REWARD_COINS, 'INVITE-' + newUserId, `Invite reward: ${first} joined N-Health`, { invitee: newUserId });
  if (txn) await notify(inviter.id, 'payment', '🎁 Invite reward', `${first} joined N-Health with your invite. ${INVITE_REWARD_COINS} coin${INVITE_REWARD_COINS === 1 ? '' : 's'} added to your balance.`, { data: { invitee: newUserId } }).catch(() => null);
}
