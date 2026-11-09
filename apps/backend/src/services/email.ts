import { env } from '../config/env';
import { http } from './http';

const wrap = (title: string, body: string) => `<!doctype html><html><body style="font-family:Segoe UI,Roboto,Arial,sans-serif;background:#F5F7FA;padding:24px">
<div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 10px rgba(0,0,0,.1)">
<div style="font-size:22px;font-weight:700;color:#202124">🏥 N-<span style="color:#1A73E8">Health</span></div>
<h2 style="color:#202124;font-size:18px">${title}</h2><div style="color:#5F6368;font-size:14px;line-height:1.6">${body}</div>
<p style="color:#9AA0A6;font-size:11px;margin-top:24px">You received this because you have an N-Health account. Do not share codes with anyone.</p></div></body></html>`;

/** Sends a transactional email through Resend. Without RESEND_API_KEY it logs instead (dev). */
export async function sendEmail(to: string, subject: string, title: string, bodyHtml: string): Promise<boolean> {
  if (!env.raw.RESEND_API_KEY) {
    if (env.nodeEnv !== 'production') console.log(`[email:dev] to=${to} subject=${subject}\n${bodyHtml.replace(/<[^>]+>/g, '')}`);
    else console.warn('[email] RESEND_API_KEY missing - email not sent to', to);
    return false;
  }
  try {
    await http.post('https://api.resend.com/emails', { from: env.raw.EMAIL_FROM, to: [to], subject, html: wrap(title, bodyHtml) },
      { headers: { Authorization: `Bearer ${env.raw.RESEND_API_KEY}` } });
    return true;
  } catch (e: any) {
    console.error('[email] send failed', e?.response?.data || e?.message);
    return false;
  }
}
