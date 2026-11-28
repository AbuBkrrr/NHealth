import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { planFor, Payable } from '../../services/splits';
import { enabledGateways, initialize, Gateway } from '../../services/gateways';
import { uid } from './util';

/**
 * POST /api/payments/card { payableType, payableId, gateway, returnUrl }
 * Card / transfer / USSD checkout where the gateway splits the money at payment time:
 * each payee's share goes straight to their bank (Paystack / Flutterwave subaccount) and N-Health keeps
 * its commission + booking fee. Payees without a subaccount are paid through the normal payout schedule.
 */
export async function startCardPayment(req: Request, res: Response) {
  const payableType = String(req.body.payableType || '') as Payable;
  const payableId = String(req.body.payableId || '');
  if (!['APPOINTMENT', 'PHARMACY_ORDER', 'LAB_TEST', 'NURSE_REQUEST', 'DONATION'].includes(payableType) || !payableId) throw ApiError.badRequest('Choose what to pay for');
  const live = enabledGateways().filter((g) => g === 'paystack' || g === 'flutterwave');
  const gateway = (live.includes(req.body.gateway) ? req.body.gateway : live[0]) as Gateway;
  if (!gateway) throw ApiError.badRequest('Card payments are not configured yet - pay with coins');
  const paid = await prisma.payment.findFirst({ where: { payableType: payableType as any, payableId, status: 'CONFIRMED' } });
  if (paid) throw ApiError.conflict('This item is already paid');
  const plan = await planFor(payableType, payableId, uid(req)).catch((e) => { throw new ApiError(e.status || 400, e.message); });
  const settled: Record<string, boolean> = {};
  const split = { paystack: [] as { subaccount: string; amount: number }[], flutterwave: [] as { id: string; amount: number }[] };
  for (const p of plan.payees) {
    if (p.amount <= 0) continue;
    if (gateway === 'paystack' && p.bank?.paystackSubaccount) { split.paystack.push({ subaccount: p.bank.paystackSubaccount, amount: p.amount }); settled[p.userId] = true; }
    if (gateway === 'flutterwave' && p.bank?.flutterwaveSubaccount) { split.flutterwave.push({ id: p.bank.flutterwaveSubaccount, amount: p.amount }); settled[p.userId] = true; }
  }
  // N-Health never holds a provider's or hospital's money: the gateway must settle every share to their own account.
  if (plan.payees.some((p) => p.amount > 0 && !settled[p.userId])) {
    throw ApiError.conflict(payableType === 'DONATION'
      ? 'The hospital can\'t receive card payments yet. Pay by bank transfer to the hospital\'s account instead.'
      : 'This provider can\'t receive card payments yet. Choose cash (pay at the service) instead.');
  }
  const user = await prisma.user.findUnique({ where: { id: uid(req) } });
  const internalRef = 'PY-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const returnUrl = (typeof req.body.returnUrl === 'string' && /^https?:\/\//.test(req.body.returnUrl) ? req.body.returnUrl : env.appUrl + '/') + '?paid=' + internalRef;
  await prisma.paymentGatewayLog.create({ data: {
    userId: uid(req), gateway, internalRef, gatewayRef: 'pending', amount: plan.total, currency: 'NGN', status: 'pending', purpose: 'direct_payment',
    requestPayload: { payableType, payableId, plan, settled } as any,
  } });
  const checkout = await initialize(gateway, { reference: internalRef, amount: plan.total, currency: 'NGN', email: user!.email, name: user!.name, callbackUrl: returnUrl, split, description: 'N-Health ' + payableType.replace('_', ' ').toLowerCase() });
  res.json({ internalRef, gateway, amount: plan.total, breakdown: { providerShares: plan.payees.map((p) => ({ role: p.role, amount: p.amount, direct: !!settled[p.userId] })), platform: plan.platformAmount }, ...checkout });
}

/**
 * Reward coins on part of a bill.
 *  GET    /api/coins/bill?payableType&payableId  -> what is applied, the bill, what is left to pay, my coins
 *  POST   /api/coins/bill { payableType, payableId, coins }  -> apply coins (the rest is paid by card or cash)
 *  DELETE /api/coins/bill { payableType, payableId }         -> take the coins back before paying
 */
async function billFor(req: Request, payableType: string, payableId: string) {
  const { resolvePayable } = await import('../paymentController');
  const p = await prisma.patientProfile.findUnique({ where: { userId: uid(req) } });
  if (!p) throw ApiError.notFound('Patient profile not found');
  return (await resolvePayable(payableType, payableId, p.id)).amount;
}
export async function coinPartStatus(req: Request, res: Response) {
  const payableType = String(req.query.payableType || ''), payableId = String(req.query.payableId || '');
  const { getRedemption } = await import('../../services/coinParts');
  const { COIN_VALUE_NGN } = await import('../../services/coins');
  const total = await billFor(req, payableType, payableId);
  const r = await getRedemption(payableType, payableId);
  const ledger = await prisma.creditLedger.findUnique({ where: { userId: uid(req) } });
  const applied = r ? Number(r.amount) : 0;
  const { coinCap } = await import('../../services/coinParts');
  const lim = await coinCap(payableType, payableId, total);
  res.json({ maxCoins: Math.floor(lim.cap / COIN_VALUE_NGN), coinNote: lim.note || null, total, applied, appliedCoins: r?.coins || 0, remaining: Math.round((total - applied) * 100) / 100, balanceCoins: Math.floor(Number(ledger?.balance || 0) / COIN_VALUE_NGN), coinValue: COIN_VALUE_NGN });
}
export async function applyCoinPart(req: Request, res: Response) {
  const { applyCoins } = await import('../../services/coinParts');
  const payableType = String(req.body?.payableType || ''), payableId = String(req.body?.payableId || '');
  const total = await billFor(req, payableType, payableId);
  res.status(201).json(await applyCoins(uid(req), payableType, payableId, Number(req.body?.coins), total));
}
export async function removeCoinPart(req: Request, res: Response) {
  const { getRedemption, returnCoins } = await import('../../services/coinParts');
  const payableType = String(req.body?.payableType || ''), payableId = String(req.body?.payableId || '');
  const r = await getRedemption(payableType, payableId);
  if (!r || r.userId !== uid(req)) throw ApiError.notFound('No coins applied to this bill');
  if (await prisma.payment.findFirst({ where: { payableType: payableType as any, payableId, status: { in: ['PENDING', 'CONFIRMED'] } } })) throw ApiError.conflict('This bill is already being paid');
  await returnCoins(payableType, payableId, 'removed from the bill');
  res.json({ ok: true });
}
