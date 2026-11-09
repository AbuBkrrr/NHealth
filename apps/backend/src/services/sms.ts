import { env } from '../config/env';
import { http } from './http';

/** Normalises Nigerian local numbers (080...) to international format (23480...). */
export function normalisePhone(phone: string): string {
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0') && p.length === 11) p = '234' + p.slice(1);
  return p;
}

/** Sends an SMS through Termii. Without TERMII_API_KEY it logs instead (dev). */
export async function sendSms(phone: string, message: string): Promise<boolean> {
  const to = normalisePhone(phone);
  if (!env.raw.TERMII_API_KEY) {
    if (env.nodeEnv !== 'production') console.log(`[sms:dev] to=${to} ${message}`);
    return false;
  }
  try {
    await http.post(`${env.raw.TERMII_BASE_URL}/api/sms/send`, {
      to, from: env.raw.TERMII_SENDER_ID, sms: message, type: 'plain', channel: 'generic', api_key: env.raw.TERMII_API_KEY,
    });
    return true;
  } catch (e: any) {
    console.error('[sms] send failed', e?.response?.data || e?.message);
    return false;
  }
}
