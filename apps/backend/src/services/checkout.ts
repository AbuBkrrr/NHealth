import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { getOrCreateLedger, spendCredits, refundCredits } from './creditsService';
import { resolvePayable } from '../controllers/paymentController';
import { notify } from './notify';
import { refund } from './gateways';
import { clawbackDirect } from './earnings';

type Payable = 'APPOINTMENT' | 'PHARMACY_ORDER' | 'LAB_TEST' | 'NURSE_REQUEST' | 'DONATION' | 'INSURANCE_POLICY' | 'EMERGENCY';

const ref = () => 'NH-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

/** Marks the underlying record as paid. */
export async function markPaid(type: Payable, id: string) {
  switch (type) {
    case 'APPOINTMENT': return prisma.appointment.update({ where: { id }, data: { paymentStatus: 'PAID' } });
    case 'PHARMACY_ORDER': return prisma.pharmacyOrder.update({ where: { id }, data: { paymentStatus: 'PAID', status: 'PROCESSING' } });
    case 'LAB_TEST': return prisma.labTest.update({ where: { id }, data: { paymentStatus: 'PAID' } });
    case 'DONATION': return settleDonation(id);
    case 'INSURANCE_POLICY': return prisma.insurancePolicy.update({ where: { id }, data: { status: 'ACTIVE', startedAt: new Date() } });
    default: return null;
  }
}

/** Adds a completed donation to its campaign's progress. */
export async function settleDonation(id: string) {
  const d = await prisma.donation.update({ where: { id }, data: { status: 'COMPLETED' } });
  if (d.campaignId) {
    const c = await prisma.donationCampaign.update({ where: { id: d.campaignId }, data: { raisedAmount: { increment: d.amount }, donorCount: { increment: 1 } } });
    if (Number(c.goalAmount) > 0 && Number(c.raisedAmount) >= Number(c.goalAmount) && c.status === 'ACTIVE') {
      await prisma.donationCampaign.update({ where: { id: c.id }, data: { status: 'COMPLETED' } });
    }
    await notify(c.organizerId, 'donation', 'New donation ❤️', `${d.anonymous ? 'Someone' : 'A donor'} gave ${c.currency} ${Number(d.amount).toLocaleString()} to "${c.title}".`, { data: { campaignId: c.id } });
  }
  return d;
}

/** Records the cash state of a payable: CASH_DUE when chosen, PAID_CASH when the provider confirms receipt. */
export async function markPaidCash(type: Payable, id: string, state: 'CASH_DUE' | 'PAID_CASH') {
  switch (type) {
    case 'APPOINTMENT': return prisma.appointment.update({ where: { id }, data: { paymentStatus: state } });
    case 'PHARMACY_ORDER': return prisma.pharmacyOrder.update({ where: { id }, data: { paymentStatus: state === 'PAID_CASH' ? 'PAID' : state } });
    case 'LAB_TEST': return prisma.labTest.update({ where: { id }, data: { paymentStatus: state } });
    default: return null;
  }
}

/** Pays for a patient-owned record with coins. The amount always comes from the database. */
export async function payWithCoins(userId: string, payableType: Payable, payableId: string) {
  const patient = await prisma.patientProfile.findUnique({ where: { userId } });
  if (!patient) throw ApiError.notFound('Patient profile not found');
  const already = await prisma.payment.findFirst({ where: { payableType: payableType as any, payableId, status: 'CONFIRMED' } });
  if (already) throw ApiError.conflict('This item is already paid');
  const { amount, providerUserId } = await resolvePayable(payableType, payableId, patient.id);
  if (amount <= 0) throw ApiError.badRequest('Nothing to pay for this item');
  await getOrCreateLedger(userId);
  const reference = ref();
  const ledger = await prisma.creditLedger.findUnique({ where: { userId } });
  if (!ledger || Number(ledger.balance) < amount) throw ApiError.badRequest(`Insufficient coins. You need ${amount.toLocaleString()} - top up first.`);
  await spendCredits(userId, amount, reference, `Payment for ${payableType.toLowerCase().replace('_', ' ')}`, { payableType, payableId });
  const now = new Date();
  const payment = await prisma.payment.create({
    data: { payerId: userId, payableType: payableType as any, payableId, amount, method: 'WALLET', status: 'CONFIRMED', reference, providerUserId,
      expiresAt: now, confirmedAt: now },
  });
  await markPaid(payableType, payableId);
  if (providerUserId) await notify(providerUserId, 'payment', 'Payment received 💳', `You received ${amount.toLocaleString()} coins for a ${payableType.toLowerCase().replace('_', ' ')}.`, { data: { paymentId: payment.id } });
  return payment;
}

/** Refunds a coin payment (e.g. cancellation before service). Idempotent per payment. */
export async function refundCoinPayment(payableType: Payable, payableId: string, reason: string) {
  const card = await prisma.payment.findFirst({ where: { payableType: payableType as any, payableId, status: 'CONFIRMED', method: 'CARD' } });
  if (card) return refundCardPayment(card, reason);
  const p = await prisma.payment.findFirst({ where: { payableType: payableType as any, payableId, status: 'CONFIRMED', method: 'WALLET' } });
  if (!p) return null;
  await refundCredits(p.payerId, Number(p.amount), 'RF-' + p.reference, 'Refund: ' + reason, { paymentId: p.id });
  await prisma.payment.update({ where: { id: p.id }, data: { status: 'CANCELLED' } });
  await notify(p.payerId, 'payment', 'Refund issued', `${Number(p.amount).toLocaleString()} coins were returned to your balance (${reason}).`);
  return p;
}

/** Refunds a direct (split) card payment through the gateway and claws the payees' shares back from their balances. */
async function refundCardPayment(p: { id: string; reference: string; payerId: string; amount: any; payableType: any; payableId: string }, reason: string) {
  const log = await prisma.paymentGatewayLog.findUnique({ where: { internalRef: p.reference } });
  const plan = (log?.requestPayload as any)?.plan;
  try {
    if (log) await refund(log.gateway as any, log.gatewayRef, Number(p.amount));
  } catch (e: any) {
    console.error('[refund]', e?.response?.data || e?.message);
    await notify(p.payerId, 'payment', 'Refund being processed', `Your refund of ${Number(p.amount).toLocaleString()} is being processed by our team (${reason}).`, { email: true });
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isSuperAdmin: true }, select: { id: true } });
    await Promise.all(admins.map((a) => notify(a.id, 'payment', 'Manual refund needed', `Card refund failed for payment ${p.reference}. Refund ${Number(p.amount).toLocaleString()} from the gateway dashboard.`, { email: true })));
  }
  if (plan) await clawbackDirect(p.payableType, p.payableId, plan, reason);
  await prisma.payment.update({ where: { id: p.id }, data: { status: 'CANCELLED' } });
  await notify(p.payerId, 'payment', 'Refund issued', `${Number(p.amount).toLocaleString()} is being refunded to your card/account (${reason}). Banks take 3-10 working days.`, { email: true });
  return p;
}
