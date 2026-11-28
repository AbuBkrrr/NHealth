import { prisma } from '../config/prisma';
import { env } from '../config/env';

/**
 * Platform fees & payout policy, editable by super admins (Admin → Fees & payouts).
 * Stored in PlatformSetting under key "finance"; missing fields fall back to these defaults.
 */
export interface FinanceSettings {
  /** % the platform keeps from each completed service, per service type. */
  commission: Record<'APPOINTMENT' | 'PHARMACY_ORDER' | 'LAB_TEST' | 'NURSE_REQUEST' | 'EMERGENCY', number>;
  /** % booking fee added on top for patients (appointments). */
  patientServiceFeePercent: number;
  /** POS tax % for pharmacy walk-in sales. */
  posTaxPercent: number;
  /** Allow patients to pay providers in cash. */
  cashEnabled: boolean;
  /** Provider can't take new cash jobs once they owe more than this (₦). */
  cashDebtLimit: number;
  /** Automatic payout schedule. */
  payoutSchedule: 'DAILY' | 'WEEKLY' | 'MANUAL';
  /** 0 = Sunday … 6 = Saturday (weekly). */
  payoutDay: number;
  /** Hour of day (Africa/Lagos) payouts run. */
  payoutHour: number;
  /** Smallest balance paid out automatically (₦). */
  minPayout: number;
  /** Bank transfer provider for payouts. */
  payoutGateway: 'paystack' | 'flutterwave' | 'manual';
  /** Earnings become payable this many hours after the service completes (dispute window). */
  holdHours: number;
}

export const DEFAULT_FINANCE: FinanceSettings = {
  commission: { APPOINTMENT: 15, PHARMACY_ORDER: 5, LAB_TEST: 10, NURSE_REQUEST: 15, EMERGENCY: 10 },
  patientServiceFeePercent: env.raw.SERVICE_FEE_PERCENT,
  posTaxPercent: env.raw.POS_TAX_PERCENT,
  cashEnabled: true,
  cashDebtLimit: 20000,
  payoutSchedule: 'WEEKLY',
  payoutDay: 1,
  payoutHour: 10,
  minPayout: 1000,
  payoutGateway: 'paystack',
  holdHours: 24,
};

let cache: { at: number; v: FinanceSettings } | null = null;

export async function getFinance(): Promise<FinanceSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.v;
  const row = await prisma.platformSetting.findUnique({ where: { key: 'finance' } }).catch(() => null);
  const saved = (row?.value as Partial<FinanceSettings>) || {};
  const v: FinanceSettings = { ...DEFAULT_FINANCE, ...saved, commission: { ...DEFAULT_FINANCE.commission, ...(saved.commission || {}) } };
  cache = { at: Date.now(), v };
  return v;
}

const clampPct = (n: unknown, d: number) => (Number.isFinite(Number(n)) ? Math.min(100, Math.max(0, Number(n))) : d);
const clampNum = (n: unknown, d: number, min = 0, max = 1e9) => (Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Number(n))) : d);

/** Validates and saves a partial update. */
export async function saveFinance(patch: any, adminId: string): Promise<FinanceSettings> {
  const cur = await getFinance();
  const c = patch?.commission || {};
  const next: FinanceSettings = {
    commission: {
      APPOINTMENT: clampPct(c.APPOINTMENT, cur.commission.APPOINTMENT),
      PHARMACY_ORDER: clampPct(c.PHARMACY_ORDER, cur.commission.PHARMACY_ORDER),
      LAB_TEST: clampPct(c.LAB_TEST, cur.commission.LAB_TEST),
      NURSE_REQUEST: clampPct(c.NURSE_REQUEST, cur.commission.NURSE_REQUEST),
      EMERGENCY: clampPct(c.EMERGENCY, cur.commission.EMERGENCY),
    },
    patientServiceFeePercent: clampPct(patch?.patientServiceFeePercent, cur.patientServiceFeePercent),
    posTaxPercent: clampPct(patch?.posTaxPercent, cur.posTaxPercent),
    cashEnabled: typeof patch?.cashEnabled === 'boolean' ? patch.cashEnabled : cur.cashEnabled,
    cashDebtLimit: clampNum(patch?.cashDebtLimit, cur.cashDebtLimit),
    payoutSchedule: ['DAILY', 'WEEKLY', 'MANUAL'].includes(patch?.payoutSchedule) ? patch.payoutSchedule : cur.payoutSchedule,
    payoutDay: Math.round(clampNum(patch?.payoutDay, cur.payoutDay, 0, 6)),
    payoutHour: Math.round(clampNum(patch?.payoutHour, cur.payoutHour, 0, 23)),
    minPayout: clampNum(patch?.minPayout, cur.minPayout, 100),
    payoutGateway: ['paystack', 'flutterwave', 'manual'].includes(patch?.payoutGateway) ? patch.payoutGateway : cur.payoutGateway,
    holdHours: Math.round(clampNum(patch?.holdHours, cur.holdHours, 0, 720)),
  };
  await prisma.platformSetting.upsert({ where: { key: 'finance' }, create: { key: 'finance', value: next as any, updatedById: adminId }, update: { value: next as any, updatedById: adminId } });
  cache = null;
  return next;
}

/**
 * The registered NGO that receives money donations (Admin → Donation campaigns → Donation partner).
 * When enabled, every money donation is paid straight into the NGO's own account (card split or bank transfer):
 * N-Health never holds donated money. The hospital on a campaign is shown as the beneficiary.
 */
export interface DonationPartner {
  enabled: boolean;
  name: string;
  regNumber: string; // CAC incorporated trustees (IT) number
  email: string;
  website: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  paystackSubaccount: string; // ACCT_xxx, created in the Paystack dashboard for the NGO's account
  flutterwaveSubaccount: string; // RS_xxx
}
const EMPTY_PARTNER: DonationPartner = { enabled: false, name: '', regNumber: '', email: '', website: '', bankName: '', accountNumber: '', accountName: '', paystackSubaccount: '', flutterwaveSubaccount: '' };
let partnerCache: { at: number; v: DonationPartner } | null = null;

export async function getDonationPartner(): Promise<DonationPartner> {
  if (partnerCache && Date.now() - partnerCache.at < 30_000) return partnerCache.v;
  const row = await prisma.platformSetting.findUnique({ where: { key: 'donation_partner' } }).catch(() => null);
  const v = { ...EMPTY_PARTNER, ...((row?.value as Partial<DonationPartner>) || {}) };
  partnerCache = { at: Date.now(), v };
  return v;
}

export async function saveDonationPartner(patch: any, adminId: string): Promise<DonationPartner> {
  const cur = await getDonationPartner();
  const s = (k: keyof DonationPartner, max = 160) => (typeof patch?.[k] === 'string' ? String(patch[k]).trim().slice(0, max) : (cur[k] as string));
  const next: DonationPartner = {
    enabled: typeof patch?.enabled === 'boolean' ? patch.enabled : cur.enabled,
    name: s('name'), regNumber: s('regNumber', 40), email: s('email'), website: s('website', 200), bankName: s('bankName', 80),
    accountNumber: s('accountNumber', 20).replace(/\D/g, ''), accountName: s('accountName'), paystackSubaccount: s('paystackSubaccount', 40), flutterwaveSubaccount: s('flutterwaveSubaccount', 40),
  };
  if (next.enabled && (!next.name || !(next.accountNumber || next.paystackSubaccount || next.flutterwaveSubaccount))) {
    throw Object.assign(new Error('Add the NGO\'s name and its bank account (or payment subaccount) before switching it on'), { status: 400 });
  }
  await prisma.platformSetting.upsert({ where: { key: 'donation_partner' }, create: { key: 'donation_partner', value: next as any, updatedById: adminId }, update: { value: next as any, updatedById: adminId } });
  partnerCache = null;
  return next;
}

/**
 * The licensed insurance broker that receives patients' "Request enrolment" requests (Admin → Catalogs & rates).
 * When switched on, each request is emailed to the broker, who advises the patient and arranges cover with the
 * insurer/HMO; N-Health only passes the request on (with the patient's consent) and never collects premiums.
 */
export interface InsuranceBroker { enabled: boolean; name: string; email: string; phone: string; licence: string }
const EMPTY_BROKER: InsuranceBroker = { enabled: false, name: '', email: '', phone: '', licence: '' };
let brokerCache: { at: number; v: InsuranceBroker } | null = null;
export async function getInsuranceBroker(): Promise<InsuranceBroker> {
  if (brokerCache && Date.now() - brokerCache.at < 30_000) return brokerCache.v;
  const row = await prisma.platformSetting.findUnique({ where: { key: 'insurance_broker' } }).catch(() => null);
  const v = { ...EMPTY_BROKER, ...((row?.value as Partial<InsuranceBroker>) || {}) };
  brokerCache = { at: Date.now(), v };
  return v;
}
export async function saveInsuranceBroker(patch: any, adminId: string): Promise<InsuranceBroker> {
  const cur = await getInsuranceBroker();
  const s = (k: keyof InsuranceBroker, max = 160) => (typeof patch?.[k] === 'string' ? String(patch[k]).trim().slice(0, max) : (cur[k] as string));
  const next: InsuranceBroker = { enabled: typeof patch?.enabled === 'boolean' ? patch.enabled : cur.enabled, name: s('name'), email: s('email').toLowerCase(), phone: s('phone', 30), licence: s('licence', 60) };
  if (next.enabled && (!next.name || !/^\S+@\S+\.\S+$/.test(next.email))) throw Object.assign(new Error('Add the broker\'s name and email before switching it on'), { status: 400 });
  await prisma.platformSetting.upsert({ where: { key: 'insurance_broker' }, create: { key: 'insurance_broker', value: next as any, updatedById: adminId }, update: { value: next as any, updatedById: adminId } });
  brokerCache = null;
  return next;
}
