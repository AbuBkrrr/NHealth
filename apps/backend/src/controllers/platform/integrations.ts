import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { http } from '../../services/http';
import { sendEmail } from '../../services/email';
import { sendSms } from '../../services/sms';
import { getSupportedBanks } from '../../services/payscrowService';
import { uid } from './util';

type Check = { name: string; configured: boolean; ok: boolean; detail: string; webhookUrl?: string; lastWebhookAt?: string | null };
const T = { timeout: 10000 };
const errMsg = (e: any) => e?.response ? `HTTP ${e.response.status}: ${String(e.response.data?.message || e.response.data?.error || e.response.statusText || '').slice(0, 160)}` : e?.message || 'unreachable';

async function check(name: string, configured: boolean, fn: () => Promise<{ ok: boolean; detail: string }>, extra: Partial<Check> = {}): Promise<Check> {
  if (!configured) return { name, configured, ok: false, detail: 'Not configured - add the keys in the backend environment', ...extra };
  try { return { name, configured, ...(await fn()), ...extra }; }
  catch (e) { return { name, configured, ok: false, detail: errMsg(e), ...extra }; }
}

/**
 * GET /api/admin-ops/integrations - live checks against every external provider with the production keys,
 * plus the webhook URL each dashboard must point to and when we last received a webhook from it.
 */
export async function integrationStatus(_req: Request, res: Response) {
  const R = env.raw;
  const base = env.publicUrl.replace(/\/$/, '');
  const last = async (gateway: string) => (await prisma.paymentGatewayLog.findFirst({ where: { gateway, NOT: { webhookPayload: { equals: null as any } } }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }).catch(() => null))?.updatedAt?.toISOString() ?? null;
  const emailDomain = (R.EMAIL_FROM.match(/@([^>\s]+)/) || [])[1];

  const checks = await Promise.all([
    check('Resend (email)', !!R.RESEND_API_KEY, async () => {
      const r = await http.get('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${R.RESEND_API_KEY}` }, ...T });
      const domains: any[] = r.data?.data || [];
      const d = domains.find((x) => x.name === emailDomain);
      return { ok: !!d && d.status === 'verified', detail: d ? `Domain ${d.name} is ${d.status}${d.status === 'verified' ? '' : ' - finish DNS records in Resend'}` : `Sender domain ${emailDomain} not found in Resend (found: ${domains.map((x) => x.name).join(', ') || 'none'})` };
    }),
    check('Paystack (top-ups & payouts)', !!R.PAYSTACK_SECRET_KEY, async () => {
      const r = await http.get('https://api.paystack.co/balance', { headers: { Authorization: `Bearer ${R.PAYSTACK_SECRET_KEY}` }, ...T });
      const ngn = (r.data?.data || []).find((b: any) => b.currency === 'NGN');
      const live = String(R.PAYSTACK_SECRET_KEY).startsWith('sk_live');
      return { ok: live, detail: `${live ? 'LIVE' : 'TEST'} key • NGN balance ₦${((ngn?.balance || 0) / 100).toLocaleString()}${live ? '' : ' - switch to the live secret key before launch'}` };
    }, { webhookUrl: `${base}/api/webhooks/paystack`, lastWebhookAt: await last('paystack') }),
    check('Flutterwave (top-ups & payouts)', !!R.FLUTTERWAVE_SECRET_KEY, async () => {
      const r = await http.get('https://api.flutterwave.com/v3/balances/NGN', { headers: { Authorization: `Bearer ${R.FLUTTERWAVE_SECRET_KEY}` }, ...T });
      const live = !String(R.FLUTTERWAVE_SECRET_KEY).includes('TEST');
      const hash = !!R.FLUTTERWAVE_WEBHOOK_HASH;
      return { ok: live && hash, detail: `${live ? 'LIVE' : 'TEST'} key • NGN available ₦${Number(r.data?.data?.available_balance || 0).toLocaleString()}${hash ? '' : ' • FLUTTERWAVE_WEBHOOK_HASH missing'}` };
    }, { webhookUrl: `${base}/api/webhooks/flutterwave`, lastWebhookAt: await last('flutterwave') }),
    check('PayScrow (escrow)', !!process.env.PAYSCROW_API_KEY, async () => {
      const banks: any = await getSupportedBanks();
      const n = Array.isArray(banks) ? banks.length : Array.isArray(banks?.data) ? banks.data.length : 0;
      const hook = !!process.env.PAYSCROW_WEBHOOK_SECRET;
      return { ok: n > 0 && hook, detail: `API reachable • ${n} banks${hook ? '' : ' • PAYSCROW_WEBHOOK_SECRET missing (webhooks rejected in production)'}` };
    }, { webhookUrl: `${base}/api/webhooks/payscrow`, lastWebhookAt: (await prisma.escrowTransaction.findFirst({ where: { fundedAt: { not: null } }, orderBy: { fundedAt: 'desc' }, select: { fundedAt: true } }).catch(() => null))?.fundedAt?.toISOString() ?? null }),
    check('Didit (identity KYC)', !!(R.DIDIT_API_KEY && R.DIDIT_WORKFLOW_ID), async () => {
      // Listing sessions proves the API key is valid without creating a billable session.
      const r = await http.get(`${R.DIDIT_BASE_URL}/v3/sessions/?limit=1`, { headers: { 'x-api-key': R.DIDIT_API_KEY! }, ...T, validateStatus: () => true });
      const keyOk = r.status < 400 || r.status === 404 || r.status === 405;
      const hook = !!R.DIDIT_WEBHOOK_SECRET;
      return { ok: keyOk && r.status !== 401 && r.status !== 403 && hook, detail: `${r.status === 401 || r.status === 403 ? 'API key rejected' : 'API key accepted'} (HTTP ${r.status})${hook ? '' : ' • DIDIT_WEBHOOK_SECRET missing'} • workflow ${R.DIDIT_WORKFLOW_ID}` };
    }, { webhookUrl: `${base}/api/webhooks/didit`, lastWebhookAt: (await prisma.kycVerification.findFirst({ where: { NOT: { decision: { equals: null as any } } }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }).catch(() => null))?.updatedAt?.toISOString() ?? null }),
    check('Termii (SMS)', !!R.TERMII_API_KEY, async () => {
      const r = await http.get(`${R.TERMII_BASE_URL}/api/get-balance?api_key=${encodeURIComponent(R.TERMII_API_KEY!)}`, T);
      const bal = Number(r.data?.balance || 0);
      return { ok: bal > 0, detail: `Balance ${r.data?.currency || ''} ${bal}${bal > 0 ? '' : ' - top up Termii'} • sender "${R.TERMII_SENDER_ID}"` };
    }),
    check('Cloudinary (files)', !!(R.CLOUDINARY_CLOUD_NAME && R.CLOUDINARY_API_KEY && R.CLOUDINARY_API_SECRET), async () => {
      const r = await http.get(`https://api.cloudinary.com/v1_1/${R.CLOUDINARY_CLOUD_NAME}/usage`, { auth: { username: R.CLOUDINARY_API_KEY!, password: R.CLOUDINARY_API_SECRET! }, ...T });
      return { ok: true, detail: `Plan ${r.data?.plan || ''} • storage used ${Math.round((r.data?.storage?.usage || 0) / 1048576)} MB` };
    }),
    check('N-Health settlement account (escrow commission)', true, async () => {
      const R2 = process.env;
      const ok = !!(R2.PLATFORM_BANK_CODE && R2.PLATFORM_ACCOUNT_NUMBER);
      return { ok, detail: ok ? `${R2.PLATFORM_ACCOUNT_NAME || 'N-Health'} • bank ${R2.PLATFORM_BANK_CODE} • ••${String(R2.PLATFORM_ACCOUNT_NUMBER).slice(-4)}` : 'Set PLATFORM_BANK_CODE, PLATFORM_ACCOUNT_NUMBER, PLATFORM_ACCOUNT_NAME so escrow payments send your commission to your account' };
    }),
    check('Split settlement (subaccounts)', true, async () => {
      const [total, direct] = await Promise.all([
        prisma.bankAccount.count({ where: { isPrimary: true } }),
        prisma.bankAccount.count({ where: { isPrimary: true, OR: [{ paystackSubaccount: { not: null } }, { flutterwaveSubaccount: { not: null } }] } }),
      ]);
      return { ok: total === 0 || direct === total, detail: `${direct}/${total} provider & institution bank accounts can receive card payments directly${direct < total ? ' - the rest are paid on the payout schedule' : ''}` };
    }),
    check('Web push (VAPID)', true, async () => ({ ok: !!(R.VAPID_PUBLIC_KEY && R.VAPID_PRIVATE_KEY), detail: R.VAPID_PUBLIC_KEY ? 'Keys set' : 'Generate with: npx web-push generate-vapid-keys' })),
    check('Google sign-in', true, async () => ({ ok: !!process.env.GOOGLE_CLIENT_ID, detail: process.env.GOOGLE_CLIENT_ID ? 'Client ID set' : 'Optional - set GOOGLE_CLIENT_ID to show "Continue with Google"' })),
    check('App URLs', true, async () => ({ ok: /^https:\/\//.test(env.publicUrl) && /^https:\/\//.test(env.appUrl) && env.corsOrigin !== '*', detail: `API ${env.publicUrl} • Web ${env.appUrl} • CORS ${env.corsOrigin}` })),
  ]);
  res.json({ environment: env.nodeEnv, checkedAt: new Date().toISOString(), checks });
}

/** POST /api/admin-ops/integrations/test-email - sends a real email to the admin through Resend. */
export async function testEmail(req: Request, res: Response) {
  const u = await prisma.user.findUnique({ where: { id: uid(req) } });
  const to = typeof req.body?.to === 'string' && req.body.to.includes('@') ? req.body.to : u!.email;
  const ok = await sendEmail(to, 'N-Health test email', 'Email is working ✅', `This test was sent from the N-Health admin console at ${new Date().toISOString()}.`);
  if (!ok) throw ApiError.badRequest('Resend did not accept the email - check RESEND_API_KEY and that the sender domain is verified');
  res.json({ ok: true, to });
}
/** POST /api/admin-ops/integrations/test-sms { to } */
export async function testSms(req: Request, res: Response) {
  const to = String(req.body?.to || '');
  if (!/^\+?\d{10,15}$/.test(to.replace(/\s/g, ''))) throw ApiError.badRequest('Enter a phone number');
  const ok = await sendSms(to, 'N-Health test SMS - SMS is working.');
  if (!ok) throw ApiError.badRequest('Termii did not accept the SMS - check TERMII_API_KEY, sender ID approval and balance');
  res.json({ ok: true, to });
}
