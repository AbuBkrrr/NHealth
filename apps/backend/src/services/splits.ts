import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { http } from './http';
import { getFinance } from './settings';

/**
 * Who gets paid for a service, and how much.
 *
 * A provider's net (gross - platform commission) goes to the provider, unless they are ACTIVE staff of an
 * institution: then `staffSharePercent` of it goes to the institution and the rest to the provider.
 * The platform keeps the commission plus any patient booking fee.
 */
export type Payable = 'APPOINTMENT' | 'PHARMACY_ORDER' | 'LAB_TEST' | 'NURSE_REQUEST' | 'EMERGENCY';
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Payee {
  userId: string;
  role: 'PROVIDER' | 'INSTITUTION';
  amount: number;
  bank?: { bankCode: string; bankName: string; accountNumber: string; accountName: string; paystackSubaccount: string | null; flutterwaveSubaccount: string | null } | null;
}
export interface SplitPlan { total: number; gross: number; commissionRate: number; commission: number; patientFee: number; platformAmount: number; payees: Payee[]; providerUserId: string }

/** Institution an active staff provider belongs to (first ACTIVE affiliation). */
export async function institutionFor(providerUserId: string) {
  const staff = await prisma.institutionStaff.findFirst({ where: { userId: providerUserId, status: 'ACTIVE' }, include: { institution: true }, orderBy: { joinedAt: 'asc' } });
  return staff?.institution ?? null;
}

/** Splits a provider's net between the provider and (if affiliated) their institution. */
export async function payeesFor(providerUserId: string, net: number): Promise<{ userId: string; role: 'PROVIDER' | 'INSTITUTION'; amount: number }[]> {
  const inst = await institutionFor(providerUserId);
  if (!inst || inst.userId === providerUserId || net <= 0) return [{ userId: providerUserId, role: 'PROVIDER', amount: r2(net) }];
  const pct = Math.min(100, Math.max(0, inst.staffSharePercent));
  const instAmt = r2((net * pct) / 100);
  const out: { userId: string; role: 'PROVIDER' | 'INSTITUTION'; amount: number }[] = [];
  if (instAmt > 0) out.push({ userId: inst.userId, role: 'INSTITUTION', amount: instAmt });
  if (r2(net - instAmt) > 0) out.push({ userId: providerUserId, role: 'PROVIDER', amount: r2(net - instAmt) });
  return out;
}

/** Resolves amounts and payees for a patient-owned payable. Amounts come from the database only. */
export async function planFor(type: Payable, id: string, patientUserId: string): Promise<SplitPlan> {
  const p = await prisma.patientProfile.findUnique({ where: { userId: patientUserId } });
  if (!p) throw Object.assign(new Error('Patient profile not found'), { status: 404 });
  let total = 0, gross = 0, providerUserId = '';
  if (type === 'APPOINTMENT') {
    const a = await prisma.appointment.findUnique({ where: { id }, include: { doctor: true } });
    if (!a || a.patientId !== p.id) throw Object.assign(new Error('Appointment not found'), { status: 404 });
    gross = Number(a.fee) || Number(a.doctor.consultationFee);
    total = Number(a.fee) ? Number(a.fee) + Number(a.serviceFee) : gross;
    providerUserId = a.doctor.userId;
  } else if (type === 'PHARMACY_ORDER') {
    const o = await prisma.pharmacyOrder.findUnique({ where: { id }, include: { pharmacy: true } });
    if (!o || o.patientId !== p.id) throw Object.assign(new Error('Order not found'), { status: 404 });
    total = gross = Number(o.total); providerUserId = o.pharmacy.userId;
  } else if (type === 'LAB_TEST') {
    const t = await prisma.labTest.findUnique({ where: { id }, include: { lab: true } });
    if (!t || t.patientId !== p.id) throw Object.assign(new Error('Lab test not found'), { status: 404 });
    total = gross = Number(t.fee); providerUserId = t.lab.userId;
  } else if (type === 'NURSE_REQUEST') {
    const n = await prisma.nurseRequest.findUnique({ where: { id }, include: { nurse: true } });
    if (!n || n.patientId !== p.id) throw Object.assign(new Error('Request not found'), { status: 404 });
    if (!n.nurse) throw Object.assign(new Error('A nurse must accept the request before payment'), { status: 409 });
    total = gross = Number(n.fee) || Number(n.nurse.hourlyRate) * (n.durationHours || 1); providerUserId = n.nurse.userId;
  } else {
    throw Object.assign(new Error('Direct payment is not available for this item'), { status: 400 });
  }
  if (!(total > 0)) throw Object.assign(new Error('Nothing to pay for this item'), { status: 400 });
  const fin = await getFinance();
  const commissionRate = fin.commission[type] ?? 0;
  const commission = r2((gross * commissionRate) / 100);
  const patientFee = r2(Math.max(0, total - gross));
  const shares = await payeesFor(providerUserId, r2(gross - commission));
  const banks = await prisma.bankAccount.findMany({ where: { userId: { in: shares.map((s) => s.userId) }, isPrimary: true } });
  const payees: Payee[] = shares.map((s) => {
    const b = banks.find((x) => x.userId === s.userId);
    return { ...s, bank: b ? { bankCode: b.bankCode, bankName: b.bankName, accountNumber: b.accountNumber, accountName: b.verifiedName || b.accountName, paystackSubaccount: b.paystackSubaccount, flutterwaveSubaccount: b.flutterwaveSubaccount } : null };
  });
  return { total: r2(total), gross: r2(gross), commissionRate, commission, patientFee, platformAmount: r2(total - payees.reduce((a, b) => a + b.amount, 0)), payees, providerUserId };
}

/** Creates the Paystack / Flutterwave split subaccounts for a saved bank account (idempotent, best-effort). */
export async function ensureSubaccounts(bankAccountId: string) {
  const b = await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, include: { user: true } });
  if (!b) return;
  const name = (b.verifiedName || b.accountName || b.user.name).slice(0, 100);
  const fin = await getFinance();
  const defaultPct = Math.max(...Object.values(fin.commission));
  const data: any = {};
  if (env.raw.PAYSTACK_SECRET_KEY && !b.paystackSubaccount) {
    try {
      const r = await http.post('https://api.paystack.co/subaccount', {
        business_name: name, settlement_bank: b.bankCode, account_number: b.accountNumber, percentage_charge: defaultPct,
        description: `N-Health ${b.user.role.toLowerCase()} ${b.userId}`, primary_contact_email: b.user.email,
      }, { headers: { Authorization: `Bearer ${env.raw.PAYSTACK_SECRET_KEY}` } });
      data.paystackSubaccount = r.data.data.subaccount_code;
    } catch (e: any) { console.error('[subaccount:paystack]', e?.response?.data || e?.message); }
  }
  if (env.raw.FLUTTERWAVE_SECRET_KEY && !b.flutterwaveSubaccount) {
    try {
      const r = await http.post('https://api.flutterwave.com/v3/subaccounts', {
        account_bank: b.bankCode, account_number: b.accountNumber, business_name: name, business_email: b.user.email,
        business_mobile: b.user.phone || '08000000000', country: 'NG', split_type: 'percentage', split_value: defaultPct / 100,
      }, { headers: { Authorization: `Bearer ${env.raw.FLUTTERWAVE_SECRET_KEY}` } });
      data.flutterwaveSubaccount = r.data.data.subaccount_id;
    } catch (e: any) { console.error('[subaccount:flutterwave]', e?.response?.data || e?.message); }
  }
  if (Object.keys(data).length) await prisma.bankAccount.update({ where: { id: b.id }, data });
}

/** N-Health's own settlement account (used for the platform's share of PayScrow escrow settlements). */
export function platformAccount() {
  const R = process.env;
  if (!R.PLATFORM_BANK_CODE || !R.PLATFORM_ACCOUNT_NUMBER) return null;
  return { bankCode: R.PLATFORM_BANK_CODE, accountNumber: R.PLATFORM_ACCOUNT_NUMBER, accountName: R.PLATFORM_ACCOUNT_NAME || 'N-Health' };
}
