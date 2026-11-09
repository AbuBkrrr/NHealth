import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { getFinance, saveFinance } from '../../services/settings';
import { balanceOf, payoutProvider, runPayouts, markPayout, adjust } from '../../services/earnings';
import { listBanks, resolveAccount, paystackRecipient, gatewayReady } from '../../services/transfers';
import { initialize, enabledGateways, Gateway } from '../../services/gateways';
import { uid, str, num } from './util';
import { ensureSubaccounts } from '../../services/splits';

/** Next scheduled payout time (ISO) for display. */
function nextPayout(fin: Awaited<ReturnType<typeof getFinance>>) {
  if (fin.payoutSchedule === 'MANUAL') return null;
  const now = new Date();
  for (let i = 0; i < 9; i++) {
    const d = new Date(now.getTime() + i * 86400_000);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d).map((x) => [x.type, x.value]));
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    const at = new Date(`${p.year}-${p.month}-${p.day}T${String(fin.payoutHour).padStart(2, '0')}:00:00+01:00`);
    if (at > now && (fin.payoutSchedule === 'DAILY' || dow === fin.payoutDay)) return at.toISOString();
  }
  return null;
}

// ======================= Provider =======================

/** GET /api/earnings - balance, ledger, payouts, cash to collect, policy. */
export async function myEarnings(req: Request, res: Response) {
  const me = uid(req);
  const fin = await getFinance();
  const [bal, entries, payouts, bank, cashDue] = await Promise.all([
    balanceOf(me),
    prisma.providerLedgerEntry.findMany({ where: { providerUserId: me }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.payout.findMany({ where: { providerUserId: me }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.bankAccount.findFirst({ where: { userId: me, isPrimary: true } }),
    prisma.payment.findMany({ where: { providerUserId: me, method: 'CASH', status: 'PENDING' }, orderBy: { createdAt: 'desc' }, include: { payer: { select: { name: true, phone: true } } } }),
  ]);
  const weekStart = new Date(Date.now() - 7 * 86400_000);
  const week = entries.filter((e) => e.createdAt > weekStart);
  const sum = (arr: typeof entries, types: string[]) => arr.filter((e) => types.includes(e.type)).reduce((s, e) => s + Number(e.amount), 0);
  res.json({
    ...bal,
    thisWeek: { earned: sum(week, ['EARNING']), commission: -sum(week, ['COMMISSION', 'CASH_COMMISSION']), cashCollected: week.filter((e) => e.type === 'CASH_COMMISSION').reduce((s, e) => s + Number(e.gross || 0), 0) },
    entries, payouts, cashDue,
    bank: bank ? { bankName: bank.bankName, bankCode: bank.bankCode, accountNumber: bank.accountNumber, accountName: bank.verifiedName || bank.accountName, verified: bank.isVerified, directSettlement: !!(bank.paystackSubaccount || bank.flutterwaveSubaccount) } : null,
    policy: { commission: fin.commission, payoutSchedule: fin.payoutSchedule, payoutDay: fin.payoutDay, payoutHour: fin.payoutHour, minPayout: fin.minPayout, holdHours: fin.holdHours, cashEnabled: fin.cashEnabled, cashDebtLimit: fin.cashDebtLimit, nextPayoutAt: nextPayout(fin) },
    settleGateways: enabledGateways().filter((g) => g === 'paystack' || g === 'flutterwave'),
  });
}

/** GET /api/earnings/banks - bank list from the payout gateway. */
export async function payoutBanks(_req: Request, res: Response) {
  const fin = await getFinance();
  const g = gatewayReady(fin.payoutGateway) ? fin.payoutGateway : gatewayReady('paystack') ? 'paystack' : gatewayReady('flutterwave') ? 'flutterwave' : null;
  if (!g) return res.json([]);
  res.json(await listBanks(g as any));
}

/** POST /api/earnings/bank { bankCode, accountNumber } - verifies the account name with the bank before saving. */
export async function setPayoutBank(req: Request, res: Response) {
  const me = uid(req);
  const bankCode = str(req.body.bankCode, 20), accountNumber = str(req.body.accountNumber, 20);
  if (!bankCode || !accountNumber || !/^\d{10}$/.test(accountNumber)) throw ApiError.badRequest('Choose a bank and enter a 10-digit account number');
  const fin = await getFinance();
  const g = gatewayReady(fin.payoutGateway) ? fin.payoutGateway : gatewayReady('paystack') ? 'paystack' : gatewayReady('flutterwave') ? 'flutterwave' : null;
  const user = await prisma.user.findUnique({ where: { id: me } });
  let verifiedName: string | undefined; let recipientCode: string | undefined;
  if (g) {
    verifiedName = await resolveAccount(g as any, accountNumber, bankCode);
    if (g === 'paystack') recipientCode = await paystackRecipient(verifiedName, accountNumber, bankCode).catch(() => undefined);
  } else if (env.nodeEnv === 'production') throw ApiError.badRequest('Bank verification is not configured yet');
  const bankName = str(req.body.bankName, 120) || bankCode;
  await prisma.bankAccount.updateMany({ where: { userId: me }, data: { isPrimary: false } });
  const acct = await prisma.bankAccount.upsert({
    where: { userId_accountNumber: { userId: me, accountNumber } },
    create: { userId: me, bankCode, bankName, accountNumber, accountName: verifiedName || str(req.body.accountName, 120) || user!.name, verifiedName, recipientCode, isPrimary: true, isVerified: !!verifiedName },
    update: { bankCode, bankName, accountName: verifiedName || str(req.body.accountName, 120) || user!.name, verifiedName, recipientCode, isPrimary: true, isVerified: !!verifiedName },
  });
  // Bank changed -> old subaccounts point at the old account; recreate them for split settlements.
  await prisma.bankAccount.update({ where: { id: acct.id }, data: { paystackSubaccount: null, flutterwaveSubaccount: null } });
  if (acct.isVerified) await ensureSubaccounts(acct.id);
  const fresh = await prisma.bankAccount.findUnique({ where: { id: acct.id } });
  res.json({ bankName: acct.bankName, accountNumber: acct.accountNumber, accountName: acct.accountName, verified: acct.isVerified, directSettlement: !!(fresh?.paystackSubaccount || fresh?.flutterwaveSubaccount) });
}

/** POST /api/earnings/cash-out - instant payout of the available balance (once per 24h). */
export async function cashOut(req: Request, res: Response) {
  const me = uid(req);
  const recent = await prisma.payout.count({ where: { providerUserId: me, createdAt: { gt: new Date(Date.now() - 24 * 3600_000) }, status: { not: 'FAILED' } } });
  if (recent) throw ApiError.badRequest('You can cash out once every 24 hours');
  const r: any = await payoutProvider(me, { initiatedById: me });
  if (r.skipped) throw ApiError.badRequest(r.skipped);
  res.json(r.payout);
}

/** POST /api/earnings/settle { amount, gateway } - provider pays what they owe from cash commissions (Bolt "pay balance"). */
export async function settleDebt(req: Request, res: Response) {
  const me = uid(req);
  const bal = await balanceOf(me);
  const amount = Math.round(Math.min(bal.owed, num(req.body.amount) ?? bal.owed));
  if (bal.owed <= 0) throw ApiError.badRequest('You have no balance to settle');
  if (amount < 100) throw ApiError.badRequest('Minimum settlement is 100');
  const live = enabledGateways().filter((g) => g === 'paystack' || g === 'flutterwave');
  const gateway = (live.includes(req.body.gateway) ? req.body.gateway : live[0]) as Gateway;
  if (!gateway) throw ApiError.badRequest('Online payment is not configured yet');
  const user = await prisma.user.findUnique({ where: { id: me } });
  const internalRef = 'ST-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  await prisma.paymentGatewayLog.create({ data: { userId: me, gateway, internalRef, gatewayRef: 'pending', amount, currency: 'NGN', status: 'pending', purpose: 'provider_settlement' } });
  const returnUrl = (typeof req.body.returnUrl === 'string' && /^https?:\/\//.test(req.body.returnUrl) ? req.body.returnUrl : env.appUrl + '/') + '?settle=' + internalRef;
  const checkout = await initialize(gateway, { reference: internalRef, amount, currency: 'NGN', email: user!.email, name: user!.name, callbackUrl: returnUrl });
  res.json({ internalRef, amount, gateway, ...checkout });
}

// ======================= Super admin =======================

export async function getFinanceSettings(_req: Request, res: Response) { res.json(await getFinance()); }
export async function updateFinanceSettings(req: Request, res: Response) {
  const v = await saveFinance(req.body || {}, uid(req));
  await prisma.adminAuditLog.create({ data: { actorId: uid(req), action: 'FINANCE_SETTINGS_UPDATE', targetType: 'PlatformSetting', targetId: 'finance', detail: JSON.stringify(v).slice(0, 1000) } });
  res.json(v);
}

/** GET /api/admin-ops/balances - every provider with a non-zero ledger. */
export async function providerBalances(_req: Request, res: Response) {
  const rows = await prisma.providerLedgerEntry.groupBy({ by: ['providerUserId'], _sum: { amount: true } });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.providerUserId) } }, select: { id: true, name: true, role: true, email: true, bankAccounts: { where: { isPrimary: true }, select: { bankName: true, accountNumber: true, isVerified: true } } } });
  const out = await Promise.all(users.map(async (u) => ({ provider: u, ...(await balanceOf(u.id)) })));
  res.json(out.sort((a, b) => b.balance - a.balance));
}

export async function listPayouts(req: Request, res: Response) {
  const where: any = {};
  if (req.query.status) where.status = String(req.query.status);
  res.json(await prisma.payout.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300, include: { provider: { select: { name: true, role: true, email: true } } } }));
}
export async function runPayoutsNow(req: Request, res: Response) {
  if (req.body?.providerUserId) {
    const r: any = await payoutProvider(String(req.body.providerUserId), { initiatedById: uid(req), force: true });
    if (r.skipped) throw ApiError.badRequest(r.skipped);
    return res.json([r]);
  }
  res.json(await runPayouts(uid(req)));
}
/** Marks a manual/pending payout as paid (bank transfer done outside the app) or failed. */
export async function setPayoutStatus(req: Request, res: Response) {
  const p = await prisma.payout.findUnique({ where: { id: req.params.id } });
  if (!p) throw ApiError.notFound('Payout not found');
  const status = String(req.body.status || '').toUpperCase();
  if (!['PAID', 'FAILED'].includes(status)) throw ApiError.badRequest('Status must be PAID or FAILED');
  const r = await markPayout(p.reference, status as any, str(req.body.note, 300));
  await prisma.adminAuditLog.create({ data: { actorId: uid(req), action: 'PAYOUT_' + status, targetType: 'Payout', targetId: p.id, detail: str(req.body.note, 300) } });
  res.json(r);
}
export async function adjustBalance(req: Request, res: Response) {
  const amount = num(req.body.amount);
  const description = str(req.body.description, 200);
  if (!amount || !description || !req.body.providerUserId) throw ApiError.badRequest('Provider, amount and description are required');
  await adjust(String(req.body.providerUserId), amount, description, uid(req));
  await prisma.adminAuditLog.create({ data: { actorId: uid(req), action: 'LEDGER_ADJUST', targetType: 'User', targetId: String(req.body.providerUserId), detail: `${amount} ${description}` } });
  res.json({ ok: true });
}
export async function providerLedger(req: Request, res: Response) {
  res.json({ ...(await balanceOf(req.params.userId)), entries: await prisma.providerLedgerEntry.findMany({ where: { providerUserId: req.params.userId }, orderBy: { createdAt: 'desc' }, take: 300 }) });
}

/** GET /api/admin-ops/revenue?days=30 - platform income: commissions + patient booking fees, and payouts. */
export async function revenue(req: Request, res: Response) {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const since = new Date(Date.now() - days * 86400_000);
  const [comm, cashComm, fees, payouts, topups, gmv] = await Promise.all([
    prisma.providerLedgerEntry.aggregate({ where: { type: 'COMMISSION', createdAt: { gte: since } }, _sum: { amount: true } }),
    prisma.providerLedgerEntry.aggregate({ where: { type: 'CASH_COMMISSION', createdAt: { gte: since } }, _sum: { amount: true } }),
    prisma.appointment.aggregate({ where: { status: 'COMPLETED', updatedAt: { gte: since } }, _sum: { serviceFee: true } }),
    prisma.payout.aggregate({ where: { status: 'PAID', paidAt: { gte: since } }, _sum: { amount: true }, _count: true }),
    prisma.paymentGatewayLog.aggregate({ where: { status: 'success', purpose: 'credit_purchase', createdAt: { gte: since } }, _sum: { amount: true } }),
    prisma.providerLedgerEntry.aggregate({ where: { type: { in: ['EARNING', 'CASH_COMMISSION'] }, method: { notIn: ['DIRECT', 'ESCROW'] }, commissionRate: { not: null }, createdAt: { gte: since } }, _sum: { gross: true } }),
  ]);
  const owedToProviders = await prisma.providerLedgerEntry.aggregate({ _sum: { amount: true } });
  // Platform share of card payments split at checkout, and of escrow settlements.
  const [direct, escrows] = await Promise.all([
    prisma.paymentGatewayLog.findMany({ where: { purpose: 'direct_payment', status: 'success', createdAt: { gte: since } }, select: { requestPayload: true, amount: true } }),
    prisma.escrowTransaction.findMany({ where: { fundedAt: { gte: since } }, select: { metadata: true, amount: true } }),
  ]);
  const directRevenue = direct.reduce((s2, d) => s2 + Number((d.requestPayload as any)?.plan?.commission || 0), 0);
  const escrowRevenue = escrows.reduce((s2, e) => s2 + Number((e.metadata as any)?.split?.commission || 0), 0);
  const directVolume = direct.reduce((s2, d) => s2 + Number(d.amount), 0) + escrows.reduce((s2, e) => s2 + Number(e.amount), 0);
  res.json({
    days, gmv: Number(gmv._sum.gross || 0) + directVolume, directRevenue, escrowRevenue,
    commissionInApp: -Number(comm._sum.amount || 0), commissionCash: -Number(cashComm._sum.amount || 0), patientFees: Number(fees._sum.serviceFee || 0),
    payoutsPaid: Number(payouts._sum.amount || 0), payoutCount: payouts._count, topups: Number(topups._sum.amount || 0),
    netProviderBalance: Number(owedToProviders._sum.amount || 0),
  });
}
