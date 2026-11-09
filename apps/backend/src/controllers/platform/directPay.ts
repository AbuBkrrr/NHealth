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
  if (!['APPOINTMENT', 'PHARMACY_ORDER', 'LAB_TEST', 'NURSE_REQUEST'].includes(payableType) || !payableId) throw ApiError.badRequest('Choose what to pay for');
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
