import { prisma } from '../config/prisma';

/** Currencies supported for display and (where the gateway allows) for charging. NGN is the settlement base. */
export const SUPPORTED_CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP', 'EUR', 'XOF', 'EGP', 'UGX', 'TZS', 'RWF'];
const FALLBACK: Record<string, number> = { NGN: 1, USD: 0.00065, GBP: 0.00051, EUR: 0.0006, GHS: 0.0098, KES: 0.084, ZAR: 0.012, XOF: 0.39, EGP: 0.032, UGX: 2.4, TZS: 1.7, RWF: 0.92 };

export async function ratesPerNgn(): Promise<Record<string, number>> {
  const rows = await prisma.currencyRate.findMany().catch(() => []);
  const out = { ...FALLBACK };
  rows.forEach((r) => { out[r.code] = Number(r.perNgn); });
  return out;
}
