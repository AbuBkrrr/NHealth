import { env } from '../config/env';
import { http } from './http';

/**
 * Bank payouts to providers through Paystack Transfers or Flutterwave Transfers.
 * Both require the business account to have transfers enabled and a funded balance.
 * Paystack: disable "OTP for transfers" in Settings → Preferences so automated payouts don't stall.
 */
export type PayoutGateway = 'paystack' | 'flutterwave';

const ps = () => ({ headers: { Authorization: `Bearer ${env.raw.PAYSTACK_SECRET_KEY}` } });
const fw = () => ({ headers: { Authorization: `Bearer ${env.raw.FLUTTERWAVE_SECRET_KEY}` } });

export function gatewayReady(g: string): g is PayoutGateway {
  return (g === 'paystack' && !!env.raw.PAYSTACK_SECRET_KEY) || (g === 'flutterwave' && !!env.raw.FLUTTERWAVE_SECRET_KEY);
}

/** Nigerian bank list from the payout gateway (codes match what its transfer API expects). */
export async function listBanks(g: PayoutGateway): Promise<{ code: string; name: string }[]> {
  if (g === 'paystack') {
    const r = await http.get('https://api.paystack.co/bank?country=nigeria&perPage=200', ps());
    return r.data.data.filter((b: any) => b.active !== false).map((b: any) => ({ code: b.code, name: b.name }));
  }
  const r = await http.get('https://api.flutterwave.com/v3/banks/NG', fw());
  return r.data.data.map((b: any) => ({ code: b.code, name: b.name }));
}

/** Confirms the account exists and returns the registered account name. */
export async function resolveAccount(g: PayoutGateway, accountNumber: string, bankCode: string): Promise<string> {
  try {
    if (g === 'paystack') {
      const r = await http.get(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`, ps());
      return r.data.data.account_name;
    }
    const r = await http.post('https://api.flutterwave.com/v3/accounts/resolve', { account_number: accountNumber, account_bank: bankCode }, fw());
    return r.data.data.account_name;
  } catch (e: any) {
    throw Object.assign(new Error(e?.response?.data?.message || 'Could not verify this bank account. Check the number and bank.'), { status: 400 });
  }
}

/** Paystack needs a transfer recipient per bank account. */
export async function paystackRecipient(name: string, accountNumber: string, bankCode: string): Promise<string> {
  const r = await http.post('https://api.paystack.co/transferrecipient', { type: 'nuban', name, account_number: accountNumber, bank_code: bankCode, currency: 'NGN' }, ps());
  return r.data.data.recipient_code;
}

export interface TransferResult { ok: boolean; status: 'PROCESSING' | 'PAID' | 'FAILED'; transferCode?: string; message?: string; raw?: any }

/** Starts a bank transfer. Final status arrives by webhook (transfer.success / transfer.completed). */
export async function sendTransfer(g: PayoutGateway, o: { reference: string; amount: number; accountNumber: string; bankCode: string; accountName: string; recipientCode?: string | null; reason: string }): Promise<TransferResult> {
  try {
    if (g === 'paystack') {
      const recipient = o.recipientCode || (await paystackRecipient(o.accountName, o.accountNumber, o.bankCode));
      const r = await http.post('https://api.paystack.co/transfer', { source: 'balance', amount: Math.round(o.amount * 100), recipient, reference: o.reference, reason: o.reason, currency: 'NGN' }, ps());
      const d = r.data.data;
      if (d.status === 'otp') return { ok: false, status: 'FAILED', message: 'Paystack requires OTP for transfers - disable it in Settings → Preferences', raw: d };
      return { ok: true, status: d.status === 'success' ? 'PAID' : 'PROCESSING', transferCode: d.transfer_code, raw: d };
    }
    const r = await http.post('https://api.flutterwave.com/v3/transfers', {
      account_bank: o.bankCode, account_number: o.accountNumber, amount: o.amount, currency: 'NGN', debit_currency: 'NGN', reference: o.reference, narration: o.reason,
      callback_url: `${env.publicUrl}/api/webhooks/flutterwave`,
    }, fw());
    return { ok: true, status: 'PROCESSING', transferCode: String(r.data.data?.id ?? ''), raw: r.data.data };
  } catch (e: any) {
    return { ok: false, status: 'FAILED', message: e?.response?.data?.message || e?.message || 'Transfer failed', raw: e?.response?.data };
  }
}
