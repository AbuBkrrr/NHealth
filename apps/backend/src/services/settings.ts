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
