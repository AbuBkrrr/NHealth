import crypto from 'crypto';
import { env } from '../config/env';
import { http } from './http';

/**
 * Card / transfer / USSD payment gateways. The server NEVER trusts the browser's word that a payment
 * succeeded: every credit is granted only after verifying with the gateway API or a signed webhook.
 */
export type Gateway = 'paystack' | 'flutterwave' | 'fincra' | 'monnify';

export function enabledGateways(): Gateway[] {
  const g: Gateway[] = [];
  if (env.raw.PAYSTACK_SECRET_KEY) g.push('paystack');
  if (env.raw.FLUTTERWAVE_SECRET_KEY) g.push('flutterwave');
  if (env.raw.FINCRA_SECRET_KEY) g.push('fincra');
  if (env.raw.MONNIFY_SECRET_KEY) g.push('monnify');
  return g;
}

export interface InitResult { checkoutUrl?: string; accessCode?: string; publicKey?: string; }

export async function initialize(gateway: Gateway, o: { reference: string; amount: number; currency: string; email: string; name: string; callbackUrl: string; channels?: string[] }): Promise<InitResult> {
  if (gateway === 'paystack') {
    const r = await http.post('https://api.paystack.co/transaction/initialize', {
      email: o.email, amount: Math.round(o.amount * 100), currency: o.currency, reference: o.reference, callback_url: o.callbackUrl,
      channels: o.channels || ['card', 'bank', 'ussd', 'bank_transfer', 'mobile_money'], metadata: { name: o.name },
    }, { headers: { Authorization: `Bearer ${env.raw.PAYSTACK_SECRET_KEY}` } });
    return { checkoutUrl: r.data.data.authorization_url, accessCode: r.data.data.access_code, publicKey: env.raw.PAYSTACK_PUBLIC_KEY };
  }
  if (gateway === 'flutterwave') {
    const r = await http.post('https://api.flutterwave.com/v3/payments', {
      tx_ref: o.reference, amount: o.amount, currency: o.currency, redirect_url: o.callbackUrl,
      customer: { email: o.email, name: o.name }, payment_options: 'card,banktransfer,ussd,account,mobilemoneyghana,mpesa',
      customizations: { title: 'N-Health', description: 'N-Health coins top-up' },
    }, { headers: { Authorization: `Bearer ${env.raw.FLUTTERWAVE_SECRET_KEY}` } });
    return { checkoutUrl: r.data.data.link, publicKey: env.raw.FLUTTERWAVE_PUBLIC_KEY };
  }
  throw Object.assign(new Error(gateway + ' checkout is handled by its own inline widget'), { status: 400 });
}

export interface VerifyResult { success: boolean; amount: number; currency: string; gatewayRef: string; raw: any; }

/** Asks the gateway itself whether `reference` was paid, and for how much. */
export async function verify(gateway: Gateway, reference: string): Promise<VerifyResult> {
  if (gateway === 'paystack') {
    const r = await http.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${env.raw.PAYSTACK_SECRET_KEY}` } });
    const d = r.data.data;
    return { success: d.status === 'success', amount: d.amount / 100, currency: d.currency, gatewayRef: String(d.id), raw: d };
  }
  if (gateway === 'flutterwave') {
    const r = await http.get(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${env.raw.FLUTTERWAVE_SECRET_KEY}` } });
    const d = r.data.data;
    return { success: d.status === 'successful', amount: Number(d.amount), currency: d.currency, gatewayRef: String(d.id), raw: d };
  }
  if (gateway === 'fincra') {
    const r = await http.get(`https://api.fincra.com/checkout/payments/merchant-reference/${encodeURIComponent(reference)}`,
      { headers: { 'api-key': env.raw.FINCRA_SECRET_KEY! } });
    const d = r.data.data;
    return { success: d.status === 'success', amount: Number(d.amount), currency: d.currency, gatewayRef: String(d.reference), raw: d };
  }
  throw Object.assign(new Error('Verification for ' + gateway + ' happens through its signed webhook only'), { status: 400 });
}

const hmac = (algo: string, key: string, body: string) => crypto.createHmac(algo, key).update(body, 'utf8').digest('hex');
const safeEq = (a: string, b: string) => { try { return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; } };

/** Webhook authenticity check per gateway. Unconfigured secrets are rejected in production. */
export function verifyWebhookSignature(gateway: Gateway, rawBody: string, headers: Record<string, any>): boolean {
  const prod = env.nodeEnv === 'production';
  switch (gateway) {
    case 'paystack': {
      const k = env.raw.PAYSTACK_SECRET_KEY; if (!k) return !prod;
      return safeEq(String(headers['x-paystack-signature'] || ''), hmac('sha512', k, rawBody));
    }
    case 'flutterwave': {
      const k = env.raw.FLUTTERWAVE_WEBHOOK_HASH; if (!k) return !prod;
      return safeEq(String(headers['verif-hash'] || ''), k);
    }
    case 'fincra': {
      const k = env.raw.FINCRA_WEBHOOK_SECRET; if (!k) return !prod;
      return safeEq(String(headers['signature'] || ''), hmac('sha512', k, rawBody));
    }
    case 'monnify': {
      const k = env.raw.MONNIFY_SECRET_KEY; if (!k) return !prod;
      return safeEq(String(headers['monnify-signature'] || ''), hmac('sha512', k, rawBody));
    }
  }
  return false;
}
