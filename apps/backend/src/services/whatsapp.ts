// WhatsApp Business messages through Meta's WhatsApp Cloud API. N-Health sends no SMS.
// Business-started messages must use templates approved in WhatsApp Manager (see docs/WHATSAPP.md):
//   nhealth_code   (Authentication) "{{1}} is your verification code."  + copy-code button
//   nhealth_update (Utility)        "N-Health: {{1}}"
//   nhealth_news   (Marketing)      "{{1}}"  + "Stop promotions" quick reply
// Without WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID nothing is sent (dev logs the message instead).
import { env } from '../config/env';
import { http } from './http';

/** Nigerian local numbers (080...) to international digits (23480...). */
export function normalisePhone(phone: string): string {
  let p = String(phone || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0') && p.length === 11) p = '234' + p.slice(1);
  return p;
}

export const whatsappReady = () => !!(env.raw.WHATSAPP_TOKEN && env.raw.WHATSAPP_PHONE_NUMBER_ID);
const clip = (s: string, n = 1000) => String(s).replace(/\s+/g, ' ').trim().slice(0, n); // template params can't contain newlines

async function send(to: string, template: string, params: string[], button?: { sub_type: string; index: string; parameters: any[] }) {
  const phone = normalisePhone(to);
  if (!phone) return false;
  if (!whatsappReady()) {
    if (env.nodeEnv !== 'production') console.log(`[whatsapp:dev] to=${phone} ${template}: ${params.join(' | ')}`);
    return false;
  }
  const components: any[] = [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: clip(text) })) }];
  if (button) components.push({ type: 'button', ...button });
  try {
    await http.post(`https://graph.facebook.com/${env.raw.WHATSAPP_API_VERSION}/${env.raw.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      { messaging_product: 'whatsapp', to: phone, type: 'template', template: { name: template, language: { code: env.raw.WHATSAPP_TEMPLATE_LANG }, components } },
      { headers: { Authorization: `Bearer ${env.raw.WHATSAPP_TOKEN}` } });
    return true;
  } catch (e: any) {
    console.error('[whatsapp] send failed', e?.response?.data?.error?.message || e?.message);
    return false;
  }
}

/** A one-time code (sign-in, phone check, password reset). */
export const sendWhatsAppCode = (to: string, code: string) =>
  send(to, env.raw.WHATSAPP_TEMPLATE_OTP, [code], { sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] });

/** An account or service update (appointment, order, emergency, job). */
export const sendWhatsApp = (to: string, text: string) => send(to, env.raw.WHATSAPP_TEMPLATE_UPDATE, [text]);

/** A marketing message, only to people who opted in. */
export const sendWhatsAppNews = (to: string, text: string) => send(to, env.raw.WHATSAPP_TEMPLATE_NEWS, [text]);
