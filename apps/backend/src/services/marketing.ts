import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';

/**
 * Marketing analytics: tracking links (URL/QR), opens per device, location and device details,
 * leads and signup attribution. Personal data is minimised: the browser sends a random ID it
 * generated itself (no personal data), IPs are stored only as a salted hash, location is city-level.
 */

const salt = () => String(env.jwtSecret || 'nhealth');
export const hashIp = (ip?: string) => (ip ? crypto.createHash('sha256').update(salt() + '|' + ip).digest('hex').slice(0, 24) : null);
/** Signed token for unsubscribe links (no login needed). */
export const unsubToken = (kind: 'u' | 'l', id: string) => kind + '.' + id + '.' + crypto.createHmac('sha256', salt()).update(kind + id).digest('hex').slice(0, 20);
export function readUnsubToken(t: string): { kind: 'u' | 'l'; id: string } | null {
  const [kind, id, sig] = String(t || '').split('.');
  if ((kind !== 'u' && kind !== 'l') || !id || !sig) return null;
  return unsubToken(kind, id) === t ? { kind, id } : null;
}

// ---------------------------------------------------------------- user agent
export interface UaInfo { deviceType: string; os: string; browser: string; model: string | null; inApp: string | null }
export function parseUa(ua = '', hintModel?: string): UaInfo {
  const u = ua || '';
  const inApp =
    /WhatsApp/i.test(u) ? 'WhatsApp' :
    /Instagram/i.test(u) ? 'Instagram' :
    /FBAN|FBAV|FB_IAB|FBIOS/i.test(u) ? 'Facebook' :
    /musical_ly|TikTok|BytedanceWebview|trill/i.test(u) ? 'TikTok' :
    /Twitter/i.test(u) ? 'X (Twitter)' :
    /LinkedInApp/i.test(u) ? 'LinkedIn' :
    /Snapchat/i.test(u) ? 'Snapchat' :
    /Telegram/i.test(u) ? 'Telegram' :
    /Line\//i.test(u) ? 'LINE' :
    /GSA\//i.test(u) ? 'Google app' : null;
  const os =
    /Windows NT/i.test(u) ? 'Windows' :
    /iPhone|iPad|iPod/i.test(u) ? 'iOS ' + ((u.match(/OS (\d+)[_.](\d+)/) || []).slice(1, 3).join('.') || '').replace(/\.$/, '') :
    /Android/i.test(u) ? 'Android ' + ((u.match(/Android (\d+(\.\d+)?)/) || [])[1] || '') :
    /Mac OS X/i.test(u) ? 'macOS' :
    /CrOS/i.test(u) ? 'ChromeOS' :
    /Linux/i.test(u) ? 'Linux' : 'Other';
  const browser =
    /SamsungBrowser/i.test(u) ? 'Samsung Internet' :
    /OPR\/|Opera/i.test(u) ? 'Opera' :
    /Edg\//i.test(u) ? 'Edge' :
    /Firefox|FxiOS/i.test(u) ? 'Firefox' :
    /CriOS|Chrome\//i.test(u) ? 'Chrome' :
    /Safari/i.test(u) ? 'Safari' : 'Other';
  const tablet = /iPad|Tablet/i.test(u) || (/Android/i.test(u) && !/Mobile/i.test(u));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android/i.test(u);
  let model: string | null = hintModel && hintModel.trim() ? hintModel.trim() : null;
  if (!model) {
    if (/iPhone/i.test(u)) model = 'iPhone';
    else if (/iPad/i.test(u)) model = 'iPad';
    else { const m = u.match(/Android [\d.]+; (?:[a-z]{2}-[a-z]{2}; )?([^;)]+?)(?: Build|\))/i); if (m && m[1] && !/^K$/.test(m[1])) model = m[1].trim(); }
  }
  return { deviceType: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop', os: os.trim(), browser, model, inApp };
}

// ---------------------------------------------------------------- location
const geoCache = new Map<string, { country?: string; region?: string; city?: string }>();
const isPrivate = (ip: string) => /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|fe80|::ffff:127\.)/i.test(ip);

/** City-level location: Cloudflare visitor-location headers when present, otherwise an IP lookup (cached). */
export async function locate(ip: string | undefined, headers: Record<string, any>): Promise<{ country?: string; region?: string; city?: string }> {
  const h = (k: string) => (headers[k] ? String(headers[k]).slice(0, 80) : undefined);
  const cf = { country: h('cf-ipcountry'), region: h('cf-region'), city: h('cf-ipcity') };
  if (cf.country && cf.country !== 'XX') return cf;
  if (!ip || isPrivate(ip) || String(process.env.GEOIP_LOOKUP || 'on') === 'off') return {};
  if (geoCache.has(ip)) return geoCache.get(ip)!;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,region,city`, { signal: ctrl.signal });
    clearTimeout(t);
    const j: any = await r.json();
    const v = j?.success ? { country: j.country_code, region: j.region, city: j.city } : {};
    if (geoCache.size > 5000) geoCache.clear();
    geoCache.set(ip, v);
    return v;
  } catch { return {}; }
}

// ---------------------------------------------------------------- settings
export interface MarketingSettings {
  metaPixelId: string; googleTagId: string; tiktokPixelId: string;
  whatsappNumber: string; headline: string; subheadline: string;
}
const DEFAULTS: MarketingSettings = {
  metaPixelId: '', googleTagId: '', tiktokPixelId: '', whatsappNumber: '',
  headline: 'Healthcare in your pocket',
  subheadline: 'Book doctors, order medicines, get lab tests, nurses and ambulances - with verified providers, secure payments and your records in one place.',
};
export async function getMarketingSettings(): Promise<MarketingSettings> {
  const row = await prisma.platformSetting.findUnique({ where: { key: 'marketing' } }).catch(() => null);
  return { ...DEFAULTS, ...((row?.value as any) || {}) };
}
export async function saveMarketingSettings(patch: any, adminId: string) {
  const cur = await getMarketingSettings();
  const clean = (v: any, max: number, re?: RegExp) => { const s = String(v ?? '').trim().slice(0, max); return re && s && !re.test(s) ? null : s; };
  const next: MarketingSettings = {
    metaPixelId: clean(patch.metaPixelId ?? cur.metaPixelId, 30, /^\d+$/) ?? cur.metaPixelId,
    googleTagId: clean(patch.googleTagId ?? cur.googleTagId, 30, /^(G|AW|GT)-[A-Z0-9]+$/i) ?? cur.googleTagId,
    tiktokPixelId: clean(patch.tiktokPixelId ?? cur.tiktokPixelId, 40, /^[A-Z0-9]+$/i) ?? cur.tiktokPixelId,
    whatsappNumber: clean(patch.whatsappNumber ?? cur.whatsappNumber, 20, /^\+?\d{7,15}$/) ?? cur.whatsappNumber,
    headline: clean(patch.headline ?? cur.headline, 120) || DEFAULTS.headline,
    subheadline: clean(patch.subheadline ?? cur.subheadline, 300) || DEFAULTS.subheadline,
  };
  await prisma.platformSetting.upsert({ where: { key: 'marketing' }, create: { key: 'marketing', value: next as any, updatedById: adminId }, update: { value: next as any, updatedById: adminId } });
  return next;
}

/** Public tracking URL of a link. */
export const linkUrl = (slug: string) => `${String(env.appUrl || 'https://www.nhealth.com.ng').replace(/\/$/, '')}/go/${encodeURIComponent(slug)}`;

/**
 * Called after a user registers: credits the marketing link the device first came from,
 * tags that device's opens with the user, and closes any matching lead.
 */
export async function attributeSignup(user: { id: string; email: string; role: string; country?: string | null }, mkt?: { deviceKey?: string; slug?: string } | null) {
  try {
    const deviceKey = mkt?.deviceKey ? String(mkt.deviceKey).slice(0, 80) : null;
    let linkId: string | null = null;
    if (deviceKey) {
      const first = await prisma.marketingVisit.findFirst({ where: { deviceKey, linkId: { not: null } }, orderBy: { createdAt: 'asc' } });
      linkId = first?.linkId ?? null;
      await prisma.marketingVisit.updateMany({ where: { deviceKey, userId: null }, data: { userId: user.id } });
    }
    if (!linkId && mkt?.slug) linkId = (await prisma.marketingLink.findUnique({ where: { slug: String(mkt.slug) } }))?.id ?? null;
    await prisma.marketingLead.updateMany({ where: { email: user.email.toLowerCase(), userId: null }, data: { userId: user.id, status: 'REGISTERED' } });
    if (linkId || deviceKey) {
      await prisma.marketingConversion.upsert({ where: { userId: user.id }, create: { userId: user.id, linkId, deviceKey, role: user.role, country: user.country ?? null }, update: {} });
    }
  } catch (e) { console.warn('[marketing] attribution failed', (e as Error).message); }
}

/**
 * A member's invite link (/?ref=CODE) is tracked as marketing link "inv-CODE", created the first time it is opened,
 * so invite opens, devices (same phone or shared on), places and sign-ups show up in Marketing like any campaign.
 */
export async function ensureInviteLink(slug: string) {
  const m = /^inv-([A-Z0-9]{4,20})$/i.exec(slug);
  if (!m) return null;
  const code = m[1].toUpperCase();
  const canonical = 'inv-' + code;
  const existing = await prisma.marketingLink.findUnique({ where: { slug: canonical } });
  if (existing) return existing;
  const u = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true, name: true, role: true } });
  if (!u) return null;
  return prisma.marketingLink.upsert({
    where: { inviterId: u.id },
    create: { slug: canonical, label: `Invite · ${u.name}`, channel: 'invite', campaign: 'invites', audience: u.role === 'PATIENT' ? 'PATIENT' : 'ALL', landing: 'signup', inviterId: u.id, notes: 'Created automatically from the member\'s invite link' },
    update: {},
  }).catch(() => prisma.marketingLink.findUnique({ where: { slug: canonical } }));
}
