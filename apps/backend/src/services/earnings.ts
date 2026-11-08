import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { getFinance } from './settings';
import { notify } from './notify';
import { sendTransfer, gatewayReady, PayoutGateway } from './transfers';

type Source = 'APPOINTMENT' | 'PHARMACY_ORDER' | 'LAB_TEST' | 'NURSE_REQUEST' | 'EMERGENCY' | 'POS_SALE';
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Inserts a ledger entry once per (provider, type, source). Returns false if it already existed. */
async function entry(data: Prisma.ProviderLedgerEntryUncheckedCreateInput): Promise<boolean> {
  try { await prisma.providerLedgerEntry.create({ data }); return true; }
  catch (e: any) { if (e?.code === 'P2002') return false; throw e; }
}

/** Is the underlying service finished (earnings only accrue for delivered services)? */
async function completedSource(type: Source, id: string): Promise<{ done: boolean; providerUserId?: string; gross?: number }> {
  switch (type) {
    case 'APPOINTMENT': {
      const a = await prisma.appointment.findUnique({ where: { id }, include: { doctor: { select: { userId: true } } } });
      return { done: a?.status === 'COMPLETED', providerUserId: a?.doctor.userId, gross: a ? Number(a.fee) || undefined : undefined };
    }
    case 'PHARMACY_ORDER': {
      const o = await prisma.pharmacyOrder.findUnique({ where: { id }, include: { pharmacy: { select: { userId: true } } } });
      return { done: o?.status === 'DELIVERED', providerUserId: o?.pharmacy.userId, gross: o ? Number(o.total) : undefined };
    }
    case 'LAB_TEST': {
      const t = await prisma.labTest.findUnique({ where: { id }, include: { lab: { select: { userId: true } } } });
      return { done: t?.status === 'COMPLETED', providerUserId: t?.lab.userId, gross: t ? Number(t.fee) : undefined };
    }
    case 'NURSE_REQUEST': {
      const n = await prisma.nurseRequest.findUnique({ where: { id }, include: { nurse: { select: { userId: true } } } });
      return { done: n?.status === 'COMPLETED', providerUserId: n?.nurse?.userId };
    }
    case 'EMERGENCY': {
      const e = await prisma.emergencyRequest.findUnique({ where: { id }, include: { ambulance: { select: { userId: true } } } });
      return { done: e?.status === 'COMPLETED', providerUserId: e?.ambulance?.userId };
    }
    default:
      return { done: false };
  }
}

/**
 * Posts provider earnings for a completed, paid service. Idempotent - safe to call from every
 * completion and payment-confirmation path.
 *  - IN_APP (coins): +gross EARNING, -commission COMMISSION  → paid out on schedule
 *  - CASH: provider already holds the money → -commission CASH_COMMISSION (debt)
 *  - ESCROW (PayScrow): settled directly to the provider's bank → informational entry only
 */
export async function accrueForSource(type: Source, id: string) {
  const src = await completedSource(type, id);
  if (!src.done || !src.providerUserId) return null;
  const payment = await prisma.payment.findFirst({ where: { payableType: type as any, payableId: id, status: 'CONFIRMED' }, orderBy: { createdAt: 'desc' } });
  const escrow = payment ? null : await prisma.escrowTransaction.findFirst({ where: { purposeId: id, status: { in: ['in_escrow', 'completed', 'released'] } } });
  if (!payment && !escrow) return null;
  const fin = await getFinance();
  const rate = fin.commission[type as keyof typeof fin.commission] ?? 0;
  // Appointment payments include the patient booking fee, which is platform revenue - providers earn the consultation fee.
  const gross = round2(type === 'APPOINTMENT' && src.gross ? src.gross : Number(payment?.amount ?? escrow?.amount ?? 0));
  const commission = round2((gross * rate) / 100);
  const base = { providerUserId: src.providerUserId, sourceType: type, sourceId: id, gross, commissionRate: rate };
  const label = type.replace('_', ' ').toLowerCase();

  if (escrow && !payment) {
    await entry({ ...base, type: 'ESCROW_SETTLED', amount: 0, method: 'ESCROW', description: `Escrow-settled ${label} (paid to your bank by PayScrow)` });
    return { method: 'ESCROW', gross };
  }
  if (payment!.method === 'CASH') {
    // The provider also collected the patient booking fee (payment amount above their own fee) - that belongs to the platform.
    const collected = round2(Number(payment!.amount));
    const owed = round2(commission + Math.max(0, collected - gross));
    const fee = owed - commission;
    if (owed > 0 && await entry({ ...base, type: 'CASH_COMMISSION', amount: -owed, method: 'CASH', description: `Commission on cash ${label} (${rate}%)${fee > 0 ? ` + booking fee ${fee.toLocaleString()}` : ''}` })) {
      await notify(src.providerUserId, 'payment', 'Cash job recorded', `You collected ${collected.toLocaleString()} in cash. ${owed.toLocaleString()} (commission${fee > 0 ? ' + booking fee' : ''}) was deducted from your balance.`);
    }
    return { method: 'CASH', gross, commission: owed };
  }
  const created = await entry({ ...base, type: 'EARNING', amount: gross, method: 'IN_APP', description: `Earning: ${label}` });
  if (commission > 0) await entry({ ...base, type: 'COMMISSION', amount: -commission, method: 'IN_APP', description: `Platform commission (${rate}%)` });
  if (created) await notify(src.providerUserId, 'payment', 'Earning added 💰', `${round2(gross - commission).toLocaleString()} added to your balance for a ${label}.`);
  return { method: 'IN_APP', gross, commission };
}

/**
 * Charges the ambulance base fee when a trip completes: from the patient's coins when they have enough
 * (in-app), otherwise it is recorded as collected in cash by the crew. Then posts earnings.
 */
export async function settleEmergencyTrip(requestId: string) {
  const e = await prisma.emergencyRequest.findUnique({ where: { id: requestId }, include: { ambulance: true, patient: true } });
  if (!e?.ambulance || e.status !== 'COMPLETED') return null;
  const fee = Number(e.ambulance.baseFee || 0);
  const exists = await prisma.payment.findFirst({ where: { payableType: 'EMERGENCY', payableId: e.id, status: 'CONFIRMED' } });
  if (fee > 0 && !exists) {
    const reference = 'EM-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    const ledger = await prisma.creditLedger.findUnique({ where: { userId: e.patient.userId } });
    const inApp = !!ledger && Number(ledger.balance) >= fee;
    if (inApp) {
      const { spendCredits } = await import('./creditsService');
      await spendCredits(e.patient.userId, fee, reference, 'Ambulance trip', { emergencyId: e.id });
    }
    const now = new Date();
    await prisma.payment.create({ data: { payerId: e.patient.userId, payableType: 'EMERGENCY', payableId: e.id, amount: fee, method: inApp ? 'WALLET' : 'CASH', status: 'CONFIRMED', reference, providerUserId: e.ambulance.userId, expiresAt: now, confirmedAt: now } });
    await notify(e.patient.userId, 'payment', 'Ambulance fee', inApp ? `${fee.toLocaleString()} coins were paid for your ambulance trip.` : `Please pay the crew ${fee.toLocaleString()} for your ambulance trip.`);
  }
  return accrueForSource('EMERGENCY', e.id);
}

/** POS sale paid with the patient's coins: platform collected the money, pharmacy earns it less commission. */
export async function accruePosCoins(saleId: string, pharmacyUserId: string, total: number) {
  const fin = await getFinance();
  const rate = fin.commission.PHARMACY_ORDER;
  const commission = round2((total * rate) / 100);
  const base = { providerUserId: pharmacyUserId, sourceType: 'POS_SALE', sourceId: saleId, gross: total, commissionRate: rate };
  await entry({ ...base, type: 'EARNING', amount: total, method: 'IN_APP', description: 'POS sale paid with N-Health coins' });
  if (commission > 0) await entry({ ...base, type: 'COMMISSION', amount: -commission, method: 'IN_APP', description: `Platform commission (${rate}%)` });
}

/** Balance breakdown. `available` excludes earnings still inside the hold (dispute) window. */
export async function balanceOf(providerUserId: string) {
  const fin = await getFinance();
  const since = new Date(Date.now() - fin.holdHours * 3600_000);
  const [all, recent, inFlight] = await Promise.all([
    prisma.providerLedgerEntry.aggregate({ where: { providerUserId }, _sum: { amount: true } }),
    prisma.providerLedgerEntry.aggregate({ where: { providerUserId, type: { in: ['EARNING', 'COMMISSION'] }, createdAt: { gt: since } }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { providerUserId, status: { in: ['PENDING', 'PROCESSING'] } }, _sum: { amount: true } }),
  ]);
  const balance = round2(Number(all._sum.amount || 0));
  const pending = Math.max(0, round2(Number(recent._sum.amount || 0)));
  const available = round2(Math.max(0, balance - pending));
  return { balance, pending, available, owed: balance < 0 ? round2(-balance) : 0, inFlight: round2(Number(inFlight._sum.amount || 0)) };
}

/** Whether a provider may take another cash job (Bolt blocks cash rides past a debt limit). */
export async function cashAllowed(providerUserId: string) {
  const fin = await getFinance();
  if (!fin.cashEnabled) return { ok: false, reason: 'Cash payments are not available' };
  const b = await balanceOf(providerUserId);
  if (b.owed > fin.cashDebtLimit) return { ok: false, reason: 'This provider can only accept in-app payment right now' };
  return { ok: true };
}

const ref = () => 'nhpo_' + Date.now().toString(36) + '_' + crypto.randomBytes(5).toString('hex');

/**
 * Pays a provider's available balance to their verified primary bank account.
 * Creates the Payout + a PAYOUT ledger debit atomically, then calls the transfer API.
 * A failed transfer is reversed back onto the balance.
 */
export async function payoutProvider(providerUserId: string, opts: { initiatedById?: string; force?: boolean } = {}) {
  const fin = await getFinance();
  const open = await prisma.payout.count({ where: { providerUserId, status: { in: ['PENDING', 'PROCESSING'] } } });
  if (open) return { skipped: 'A payout is already in progress' };
  const b = await balanceOf(providerUserId);
  if (b.available <= 0 || (!opts.force && b.available < fin.minPayout)) return { skipped: `Available balance below minimum payout (${fin.minPayout})` };
  const bank = await prisma.bankAccount.findFirst({ where: { userId: providerUserId, isPrimary: true } });
  if (!bank) return { skipped: 'No payout bank account' };
  const gateway: PayoutGateway | 'manual' = fin.payoutGateway !== 'manual' && gatewayReady(fin.payoutGateway) ? fin.payoutGateway : 'manual';
  const amount = b.available;
  const reference = ref();
  const payout = await prisma.$transaction(async (tx) => {
    const p = await tx.payout.create({ data: { providerUserId, amount, gateway, reference, status: gateway === 'manual' ? 'PENDING' : 'PROCESSING', bankName: bank.bankName, bankCode: bank.bankCode, accountNumber: bank.accountNumber, accountName: bank.verifiedName || bank.accountName, initiatedById: opts.initiatedById } });
    await tx.providerLedgerEntry.create({ data: { providerUserId, type: 'PAYOUT', amount: -amount, method: 'PAYOUT', payoutId: p.id, description: `Payout to ${bank.bankName} ••${bank.accountNumber.slice(-4)}`, createdById: opts.initiatedById } });
    return p;
  });
  if (gateway === 'manual') return { payout };
  const r = await sendTransfer(gateway, { reference, amount, accountNumber: bank.accountNumber, bankCode: bank.bankCode, accountName: bank.verifiedName || bank.accountName, recipientCode: gateway === 'paystack' ? bank.recipientCode : null, reason: 'N-Health earnings payout' });
  if (r.raw?.recipient?.recipient_code && !bank.recipientCode) await prisma.bankAccount.update({ where: { id: bank.id }, data: { recipientCode: r.raw.recipient.recipient_code } }).catch(() => null);
  if (!r.ok) { await markPayout(reference, 'FAILED', r.message); return { payout: { ...payout, status: 'FAILED', failureReason: r.message } }; }
  const upd = await prisma.payout.update({ where: { id: payout.id }, data: { transferCode: r.transferCode } });
  if (r.status === 'PAID') await markPayout(reference, 'PAID');
  return { payout: upd };
}

/** Applies a final transfer status (from webhook, gateway response or admin). Idempotent. */
export async function markPayout(reference: string, status: 'PAID' | 'FAILED' | 'REVERSED', reason?: string) {
  const p = await prisma.payout.findUnique({ where: { reference } });
  if (!p || ['PAID', 'FAILED', 'REVERSED', 'MANUAL'].includes(p.status) && !(p.status === 'PAID' && status === 'REVERSED')) return p;
  const upd = await prisma.payout.update({ where: { id: p.id }, data: { status, failureReason: reason ?? null, paidAt: status === 'PAID' ? new Date() : p.paidAt } });
  if (status === 'FAILED' || status === 'REVERSED') {
    await entry({ providerUserId: p.providerUserId, type: 'PAYOUT_REVERSAL', amount: Number(p.amount), method: 'PAYOUT', sourceType: 'PAYOUT', sourceId: p.id, payoutId: p.id, description: `Payout ${status.toLowerCase()} - returned to balance${reason ? ': ' + reason : ''}` });
    await notify(p.providerUserId, 'payment', 'Payout not completed', `Your payout of ${Number(p.amount).toLocaleString()} could not be completed and is back in your balance.${reason ? ' ' + reason : ''} Check your bank details.`, { email: true });
  } else {
    await notify(p.providerUserId, 'payment', 'Payout sent 🏦', `${Number(p.amount).toLocaleString()} was sent to ${p.bankName} ••${p.accountNumber.slice(-4)}.`, { email: true, sms: true });
  }
  return upd;
}

/** Runs payouts for every provider with an available balance (scheduler / admin "Run payouts"). */
export async function runPayouts(initiatedById?: string) {
  const rows = await prisma.providerLedgerEntry.groupBy({ by: ['providerUserId'], _sum: { amount: true } });
  const results: any[] = [];
  for (const r of rows) {
    if (Number(r._sum.amount || 0) <= 0) continue;
    const out = await payoutProvider(r.providerUserId, { initiatedById }).catch((e) => ({ error: e.message }));
    results.push({ providerUserId: r.providerUserId, ...out });
  }
  return results;
}

/** Records money a provider paid to clear a negative (cash commission) balance. */
export async function recordSettlement(providerUserId: string, amount: number, reference: string) {
  await entry({ providerUserId, type: 'SETTLEMENT', amount, method: 'IN_APP', sourceType: 'SETTLEMENT', sourceId: reference, description: 'Balance settlement payment' });
  await notify(providerUserId, 'payment', 'Balance settled ✅', `Thanks - ${amount.toLocaleString()} was applied to your N-Health balance.`);
}

/** Admin adjustment (bonus, correction, chargeback). */
export async function adjust(providerUserId: string, amount: number, description: string, adminId: string) {
  await prisma.providerLedgerEntry.create({ data: { providerUserId, type: 'ADJUSTMENT', amount, method: 'MANUAL', description, createdById: adminId } });
  await notify(providerUserId, 'payment', 'Balance adjusted', `${amount >= 0 ? '+' : ''}${amount.toLocaleString()} - ${description}`);
}
