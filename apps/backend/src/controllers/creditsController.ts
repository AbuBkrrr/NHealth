import { Request, Response } from 'express';
import crypto from 'crypto';
import { getBalance, getTransactionHistory } from '../services/creditsService';
import { settleCreditPurchase } from '../services/creditSettlement';
import { enabledGateways, initialize, Gateway } from '../services/gateways';
import { env } from '../config/env';
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
// GET /api/credits/gateways - which top-up gateways are live
// ============================================================
export async function gateways(_req: Request, res: Response) {
  res.json({ gateways: enabledGateways(), currency: 'NGN' });
}

// ============================================================
// POST /api/credits/purchase/initiate
// Creates a pending log and a hosted checkout. Coins are only added after the gateway confirms.
// ============================================================
export async function initiatePurchase(req: Request, res: Response) {
  const userId = req.user!.userId;
  const amount = Number(req.body.amount);
  const gateway = String(req.body.gateway || '').toLowerCase() as Gateway;
  const currency = String(req.body.currency || 'NGN').toUpperCase();

  if (!Number.isFinite(amount) || amount < 100) throw ApiError.badRequest('Minimum top-up is 100');
  if (amount > 500000) throw ApiError.badRequest('Maximum single top-up is 500,000');
  const live = enabledGateways();
  if (!live.includes(gateway)) throw ApiError.badRequest('Choose one of: ' + (live.join(', ') || 'no gateway configured yet'));

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');

  const internalRef = 'CR-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const callbackUrl = (req.body.returnUrl && /^https?:\/\//.test(req.body.returnUrl) ? req.body.returnUrl : env.appUrl) + (String(req.body.returnUrl || '').includes('?') ? '&' : '?') + 'topup=' + internalRef;

  const log = await prisma.paymentGatewayLog.create({
    data: { userId, gateway, internalRef, gatewayRef: 'pending', amount, currency, status: 'pending', purpose: 'credit_purchase' },
  });

  let checkout: any = {};
  if (gateway === 'paystack' || gateway === 'flutterwave') {
    checkout = await initialize(gateway, { reference: internalRef, amount, currency, email: user.email, name: user.name, callbackUrl });
    await prisma.paymentGatewayLog.update({ where: { id: log.id }, data: { requestPayload: { callbackUrl } as any } });
  }

  res.json({ internalRef, logId: log.id, amount, currency, gateway, userEmail: user.email, userName: user.name, ...checkout });
}

// ============================================================
// POST /api/credits/purchase/confirm
// Re-verifies the payment with the gateway's API. The client cannot grant itself coins.
// ============================================================
export async function confirmPurchase(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { internalRef } = req.body;
  const log = await prisma.paymentGatewayLog.findFirst({ where: { internalRef, userId } });
  if (!log) throw ApiError.notFound('Payment reference not found');

  const result = await settleCreditPurchase(internalRef);
  if (!result.ok) {
    const msg = result.reason === 'amount_mismatch' ? 'Paid amount does not match the top-up amount' : 'Payment not confirmed by the gateway yet';
    return res.status(402).json({ error: msg, status: 'pending' });
  }
  res.json({ message: result.already ? 'Already confirmed' : 'Credits added', transaction: (result as any).txn, balance: await getBalance(userId) });
}
