import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';

// ============================================================
// GET OR CREATE LEDGER
// ============================================================
export async function getOrCreateLedger(userId: string) {
  let ledger = await prisma.creditLedger.findUnique({ where: { userId } });
  if (!ledger) {
    ledger = await prisma.creditLedger.create({ data: { userId } });
  }
  return ledger;
}

// ============================================================
// GET BALANCE
// ============================================================
export async function getBalance(userId: string): Promise<number> {
  const ledger = await getOrCreateLedger(userId);
  return Number(ledger.balance);
}

// ============================================================
// PURCHASE CREDITS
// ============================================================
export async function purchaseCredits(
  userId: string,
  amount: number,
  reference: string,
  description: string,
  metadata?: Record<string, any>
) {
  if (amount <= 0) throw ApiError.badRequest('Amount must be positive');

  return prisma.$transaction(async (tx) => {
    const ledger = await tx.creditLedger.findUnique({ where: { userId } });
    if (!ledger) throw ApiError.notFound('Ledger not found');

    const existing = await tx.creditTransaction.findUnique({ where: { reference } });
    if (existing) {
      console.log('Duplicate reference ' + reference + ' - returning existing');
      return existing;
    }

    const newBalance = Number(ledger.balance) + amount;

    await tx.creditLedger.update({
      where: { userId },
      data: { balance: newBalance, lastTransactionId: reference },
    });

    const txn = await tx.creditTransaction.create({
      data: {
        ledgerId: ledger.id,
        userId,
        type: 'purchase',
        amount,
        balanceAfter: newBalance,
        description,
        reference,
        metadata: metadata || {},
        status: 'completed',
      },
    });

    console.log('Credits purchased: N' + amount + ' for user ' + userId + ' - new balance N' + newBalance);
    return txn;
  });
}

// ============================================================
// SPEND CREDITS
// ============================================================
export async function spendCredits(
  userId: string,
  amount: number,
  reference: string,
  description: string,
  metadata?: Record<string, any>
) {
  if (amount <= 0) throw ApiError.badRequest('Amount must be positive');

  return prisma.$transaction(async (tx) => {
    const ledger = await tx.creditLedger.findUnique({ where: { userId } });
    if (!ledger) throw ApiError.notFound('Ledger not found');

    const existing = await tx.creditTransaction.findUnique({ where: { reference } });
    if (existing) {
      console.log('Duplicate spend reference ' + reference + ' - returning existing');
      return existing;
    }

    if (Number(ledger.balance) < amount) {
      throw ApiError.badRequest(
        'Insufficient credits. Available: N' + Number(ledger.balance).toLocaleString() + ', Required: N' + amount.toLocaleString()
      );
    }

    const newBalance = Number(ledger.balance) - amount;

    await tx.creditLedger.update({
      where: { userId },
      data: { balance: newBalance, lastTransactionId: reference },
    });

    const txn = await tx.creditTransaction.create({
      data: {
        ledgerId: ledger.id,
        userId,
        type: 'spend',
        amount: -amount,
        balanceAfter: newBalance,
        description,
        reference,
        metadata: metadata || {},
        status: 'completed',
      },
    });

    console.log('Credits spent: N' + amount + ' for user ' + userId + ' - new balance N' + newBalance);
    return txn;
  });
}

// ============================================================
// REFUND CREDITS
// ============================================================
export async function refundCredits(
  userId: string,
  amount: number,
  reference: string,
  description: string,
  metadata?: Record<string, any>
) {
  if (amount <= 0) throw ApiError.badRequest('Amount must be positive');

  return prisma.$transaction(async (tx) => {
    const ledger = await tx.creditLedger.findUnique({ where: { userId } });
    if (!ledger) throw ApiError.notFound('Ledger not found');

    const existing = await tx.creditTransaction.findUnique({ where: { reference } });
    if (existing) return existing;

    const newBalance = Number(ledger.balance) + amount;

    await tx.creditLedger.update({
      where: { userId },
      data: { balance: newBalance, lastTransactionId: reference },
    });

    const txn = await tx.creditTransaction.create({
      data: {
        ledgerId: ledger.id,
        userId,
        type: 'refund',
        amount,
        balanceAfter: newBalance,
        description,
        reference,
        metadata: metadata || {},
        status: 'completed',
      },
    });

    console.log('Credits refunded: N' + amount + ' for user ' + userId + ' - new balance N' + newBalance);
    return txn;
  });
}

// ============================================================
// TRANSACTION HISTORY
// ============================================================
export async function getTransactionHistory(userId: string, limit = 50) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
