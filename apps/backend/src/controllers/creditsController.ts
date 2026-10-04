import { Request, Response } from 'express';
import { getBalance, getTransactionHistory, purchaseCredits } from '../services/creditsService';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';

// ============================================================
// GET /api/credits/balance
// ============================================================
export async function balance(req: Request, res: Response) {
  const userId = req.user!.userId;
  const bal = await getBalance(userId);
  res.json({ balance: bal, currency: 'NGN', type: 'credits' });
}

// ============================================================
// GET /api/credits/transactions
// ============================================================
export async function transactions(req: Request, res: Response) {
  const userId = req.user!.userId;
  const txns = await getTransactionHistory(userId, 100);
  res.json(txns);
}

// ============================================================
// POST /api/credits/purchase/initiate
// ============================================================
export async function initiatePurchase(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { amount, gateway } = req.body;

  if (!amount || amount < 100) {
    throw ApiError.badRequest('Minimum credit purchase is N100');
  }
  if (amount > 500000) {
    throw ApiError.badRequest('Maximum single purchase is N500,000');
  }
  if (!gateway || !['fincra', 'monnify', 'flutterwave'].includes(gateway)) {
    throw ApiError.badRequest('Invalid gateway. Choose fincra, monnify, or flutterwave');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');

  const internalRef = 'CR-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

  const log = await prisma.paymentGatewayLog.create({
    data: {
      userId,
      gateway,
      internalRef,
      gatewayRef: 'pending',
      amount,
      currency: 'NGN',
      status: 'pending',
      purpose: 'credit_purchase',
    },
  });

  res.json({
    internalRef,
    logId: log.id,
    amount,
    currency: 'NGN',
    gateway,
    userEmail: user.email,
    userName: user.name,
  });
}

// ============================================================
// POST /api/credits/purchase/confirm
// ============================================================
export async function confirmPurchase(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { internalRef, gatewayRef } = req.body;

  const log = await prisma.paymentGatewayLog.findFirst({
    where: { internalRef, userId },
  });
  if (!log) throw ApiError.notFound('Payment reference not found');
  if (log.status === 'success') {
    return res.json({ message: 'Already confirmed', balance: await getBalance(userId) });
  }

  const txn = await purchaseCredits(
    userId,
    Number(log.amount),
    internalRef,
    'Credit purchase via ' + log.gateway,
    { gateway: log.gateway, gatewayRef }
  );

  await prisma.paymentGatewayLog.update({
    where: { id: log.id },
    data: { status: 'success', gatewayRef: gatewayRef || log.gatewayRef },
  });

  res.json({
    message: 'Credits added',
    transaction: txn,
    balance: await getBalance(userId),
  });
}
