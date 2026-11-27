import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { sendEmail } from '../../services/email';
import { sendSms } from '../../services/sms';
import { str, uid } from './util';
import {
  parseUa, locate, hashIp, getMarketingSettings, saveMarketingSettings, linkUrl, unsubToken, readUnsubToken,
} from '../../services/marketing';

const CHANNELS = ['qr', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'youtube', 'email', 'sms', 'flyer', 'radio', 'tv', 'partner', 'event', 'other'];
const AUDIENCES = ['ALL', 'PATIENT', 'PROVIDER', 'INSTITUTION'];
const INTERESTS = ['PATIENT', 'DOCTOR', 'PHARMACY', 'LAB', 'NURSE', 'AMBULANCE', 'INSTITUTION', 'PARTNER', 'INVESTOR'];
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const deviceKeyOf = (b: any) => {
  const id = str(b?.deviceId, 64);
  if (id && /^[A-Za-z0-9-]{8,64}$/.test(id)) return { key: 'd:' + id, source: 'id' };
  const sig = str(b?.signature, 64);
  if (sig && /^[a-f0-9]{16,64}$/i.test(sig)) return { key: 's:' + sig.toLowerCase(), source: 'signature' };
  return null;
};

// =================================================================== public
/** GET /api/mkt/config - what the pitch page needs (no secrets). */
export async function publicConfig(_req: Request, res: Response) {
  const s = await getMarketingSettings();
  res.json({ metaPixelId: s.metaPixelId || null, googleTagId: s.googleTagId || null, tiktokPixelId: s.tiktokPixelId || null, whatsappNumber: s.whatsappNumber || null, headline: s.headline, subheadline: s.subheadline });
}

/** POST /api/mkt/open - records one open of a marketing link by a device. */
export async function recordOpen(req: Request, res: Response) {
  const b = req.body || {};
  const dk = deviceKeyOf(b);
  if (!dk) throw ApiError.badRequest('Missing device identifier');
  const slug = str(b.slug, 60);
  const link = slug ? await prisma.marketingLink.findUnique({ where: { slug } }) : null;
  const linkId = link && link.active ? link.id : null;

  const prev = await prisma.marketingVisit.findFirst({ where: { linkId, deviceKey: dk.key }, orderBy: { createdAt: 'asc' }, select: { deviceNo: true } });
  const openNo = (await prisma.marketingVisit.count({ where: { linkId, deviceKey: dk.key } })) + 1;
  let deviceNo = prev?.deviceNo;
  if (!deviceNo) deviceNo = (await prisma.marketingVisit.groupBy({ by: ['deviceKey'], where: { linkId } })).length + 1;

  const ua = parseUa(String(req.headers['user-agent'] || ''), str(b.model, 60));
  const utm = b.utm || {};
  const visit = await prisma.marketingVisit.create({
    data: {
      linkId, deviceKey: dk.key, idSource: dk.source, deviceNo, openNo, ipHash: hashIp(req.ip),
      timezone: str(b.timezone, 60), language: str(b.language, 20), screen: str(b.screen, 20),
      referrer: str(b.referrer, 300), utmSource: str(utm.source, 60), utmMedium: str(utm.medium, 60), utmCampaign: str(utm.campaign, 80),
      deviceType: ua.deviceType, os: ua.os, browser: ua.browser, model: ua.model, inApp: ua.inApp,
    },
  });
  // Location lookup must not slow the page down.
  locate(req.ip, req.headers as any).then((g) => (g.country || g.city) && prisma.marketingVisit.update({ where: { id: visit.id }, data: { country: g.country, region: g.region, city: g.city } })).catch(() => null);

  res.json({
    visitId: visit.id, deviceNo, openNo, newDevice: openNo === 1,
    link: link && link.active ? { label: link.label, audience: link.audience, landing: link.landing } : null,
  });
}

/** POST /api/mkt/lead - "talk to us" form on the pitch page. */
export async function createLead(req: Request, res: Response) {
  const b = req.body || {};
  const name = str(b.name, 120);
  const email = str(b.email, 160)?.toLowerCase();
  const phone = str(b.phone, 30);
  if (!name) throw ApiError.badRequest('Please enter your name');
  if (!email && !phone) throw ApiError.badRequest('Please enter an email or phone number');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest('Please enter a valid email');
  const dk = deviceKeyOf(b);
  const slug = str(b.slug, 60);
  const link = slug ? await prisma.marketingLink.findUnique({ where: { slug } }) : null;
  const opensBefore = dk ? await prisma.marketingVisit.count({ where: { deviceKey: dk.key, ...(link ? { linkId: link.id } : {}) } }) : 0;
  const lastVisit = dk ? await prisma.marketingVisit.findFirst({ where: { deviceKey: dk.key }, orderBy: { createdAt: 'desc' } }) : null;
  const lead = await prisma.marketingLead.create({
    data: {
      linkId: link?.id ?? null, deviceKey: dk?.key ?? null, opensBefore, name, email, phone,
      interest: INTERESTS.includes(String(b.interest)) ? String(b.interest) : 'PATIENT',
      organization: str(b.organization, 160), country: str(b.country, 2)?.toUpperCase() || lastVisit?.country || null,
      city: str(b.city, 80) || lastVisit?.city || null, message: str(b.message, 1000), consent: b.consent === true,
    },
  });
  res.status(201).json({ ok: true, id: lead.id });
}

/** GET /api/mkt/unsubscribe?t=... - one-click unsubscribe from marketing messages. */
export async function unsubscribe(req: Request, res: Response) {
  const t = readUnsubToken(String(req.query.t || ''));
  if (t?.kind === 'u') await prisma.user.updateMany({ where: { id: t.id }, data: { marketingOptIn: false } });
  if (t?.kind === 'l') await prisma.marketingLead.updateMany({ where: { id: t.id }, data: { unsubscribed: true, consent: false } });
  res.type('html').send(`<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;padding:40px;text-align:center"><h2>${t ? 'You are unsubscribed' : 'Link not valid'}</h2><p>${t ? 'You will no longer receive marketing messages from N-Health. Service messages about your account still arrive.' : 'This unsubscribe link is invalid or expired.'}</p></body>`);
}

// =================================================================== admin
/** GET /api/admin-ops/marketing/links */
export async function listLinks(_req: Request, res: Response) {
  const links = await prisma.marketingLink.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(links.map((l) => ({ ...l, url: linkUrl(l.slug) })));
}

/** POST /api/admin-ops/marketing/links */
export async function createLink(req: Request, res: Response) {
  const b = req.body || {};
  const label = str(b.label, 120);
  if (!label) throw ApiError.badRequest('Give the link a name, e.g. "Lagos flyers - December"');
  let slug = slugify(str(b.slug, 40) || label) || 'link';
  for (let i = 0; await prisma.marketingLink.findUnique({ where: { slug } }); i++) slug = slugify(label).slice(0, 34) + '-' + Math.random().toString(36).slice(2, 6);
  const link = await prisma.marketingLink.create({
    data: {
      slug, label, channel: CHANNELS.includes(b.channel) ? b.channel : 'other', campaign: str(b.campaign, 80),
      audience: AUDIENCES.includes(b.audience) ? b.audience : 'ALL', landing: b.landing === 'signup' ? 'signup' : 'pitch',
      country: str(b.country, 2)?.toUpperCase(), notes: str(b.notes, 500), createdById: uid(req),
    },
  });
  res.status(201).json({ ...link, url: linkUrl(link.slug) });
}

/** PATCH /api/admin-ops/marketing/links/:id */
export async function updateLink(req: Request, res: Response) {
  const b = req.body || {};
  const data: any = {};
  if (b.label !== undefined) data.label = str(b.label, 120) || undefined;
  if (b.channel !== undefined && CHANNELS.includes(b.channel)) data.channel = b.channel;
  if (b.campaign !== undefined) data.campaign = str(b.campaign, 80) ?? null;
  if (b.audience !== undefined && AUDIENCES.includes(b.audience)) data.audience = b.audience;
  if (b.landing !== undefined) data.landing = b.landing === 'signup' ? 'signup' : 'pitch';
  if (b.notes !== undefined) data.notes = str(b.notes, 500) ?? null;
  if (typeof b.active === 'boolean') data.active = b.active;
  const link = await prisma.marketingLink.update({ where: { id: req.params.id }, data });
  res.json({ ...link, url: linkUrl(link.slug) });
}

/** GET /api/admin-ops/marketing/links/:id/qr.(svg|png) - printable QR code of the link. */
export async function linkQr(req: Request, res: Response) {
  const link = await prisma.marketingLink.findUnique({ where: { id: req.params.id } });
  if (!link) throw ApiError.notFound('Link not found');
  const url = linkUrl(link.slug) + '?utm_source=' + encodeURIComponent(link.channel) + '&utm_medium=qr';
  const name = 'nhealth-qr-' + link.slug;
  if (req.params.fmt === 'png') {
    const buf = await QRCode.toBuffer(url, { width: Math.min(2000, Math.max(200, Number(req.query.size) || 1000)), margin: 2, errorCorrectionLevel: 'M' });
    res.setHeader('Content-Disposition', `inline; filename="${name}.png"`);
    return res.type('png').send(buf);
  }
  const svg = await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
  res.setHeader('Content-Disposition', `inline; filename="${name}.svg"`);
  res.type('image/svg+xml').send(svg);
}

const count = (rows: any[], key: (r: any) => string | null | undefined, top = 12) => {
  const m = new Map<string, number>();
  for (const r of rows) { const k = key(r) || 'Unknown'; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([name, n]) => ({ name, n }));
};

/** GET /api/admin-ops/marketing/overview?days=30&linkId= - the whole Marketing dashboard in one call. */
export async function overview(req: Request, res: Response) {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const since = new Date(Date.now() - days * 86400_000);
  const linkFilter = req.query.linkId ? (req.query.linkId === 'none' ? { linkId: null } : { linkId: String(req.query.linkId) }) : {};
  const [visits, links, leads, conversions, referralTop] = await Promise.all([
    prisma.marketingVisit.findMany({ where: { createdAt: { gte: since }, ...linkFilter }, orderBy: { createdAt: 'desc' }, take: 50_000 }),
    prisma.marketingLink.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.marketingLead.findMany({ where: { createdAt: { gte: since }, ...linkFilter }, orderBy: { createdAt: 'desc' }, take: 500, include: { link: { select: { label: true } } } }),
    prisma.marketingConversion.findMany({ where: { createdAt: { gte: since }, ...linkFilter } }),
    prisma.referral.groupBy({ by: ['fromId'], _count: { _all: true }, orderBy: { _count: { fromId: 'desc' } }, take: 10 }).catch(() => [] as any[]),
  ]);
  const linkById = new Map(links.map((l) => [l.id, l]));

  // Per link: opens, distinct devices, repeat opens and the verdict.
  const groups = new Map<string, any[]>();
  for (const v of visits) { const k = v.linkId || 'none'; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(v); }
  for (const l of links) if (!groups.has(l.id) && !req.query.linkId) groups.set(l.id, []);
  const perLink = [...groups.entries()].map(([k, vs]) => {
    const l = k === 'none' ? null : linkById.get(k);
    const byDevice = new Map<string, number>();
    for (const v of vs) byDevice.set(v.deviceKey, (byDevice.get(v.deviceKey) || 0) + 1);
    const devices = byDevice.size;
    const maxOpens = Math.max(0, ...byDevice.values());
    const signups = conversions.filter((c) => (c.linkId || 'none') === k).length;
    const leadN = leads.filter((x) => (x.linkId || 'none') === k).length;
    const verdict = vs.length === 0 ? 'No opens yet' : devices === 1 ? `1 device, opened ${vs.length}×` : `Shared · ${devices} devices`;
    return {
      id: k, slug: l?.slug ?? null, label: l?.label ?? '(no label)', channel: l?.channel ?? '-', campaign: l?.campaign ?? null, active: l?.active ?? true,
      url: l ? linkUrl(l.slug) : null, opens: vs.length, devices, repeatOpens: vs.length - devices, maxOpensOneDevice: maxOpens,
      verdict, shared: devices > 1, leads: leadN, signups, conversionRate: devices ? Math.round((signups / devices) * 1000) / 10 : 0,
      lastOpen: vs[0]?.createdAt ?? null,
    };
  }).sort((a, b) => b.opens - a.opens);

  const devices = new Set(visits.map((v) => v.deviceKey)).size;
  const byDay: Record<string, { opens: number; devices: Set<string> }> = {};
  for (const v of visits) { const d = v.createdAt.toISOString().slice(0, 10); (byDay[d] ||= { opens: 0, devices: new Set() }).opens++; byDay[d].devices.add(v.deviceKey); }
  const series = Object.keys(byDay).sort().map((d) => ({ day: d, opens: byDay[d].opens, devices: byDay[d].devices.size }));
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, n: 0 }));
  for (const v of visits) hours[v.createdAt.getUTCHours()].n++;

  const referrers = referralTop.length
    ? await prisma.user.findMany({ where: { id: { in: referralTop.map((r: any) => r.fromId) } }, select: { id: true, name: true, role: true } })
    : [];

  res.json({
    days,
    totals: {
      opens: visits.length, devices, repeatOpens: visits.length - devices, leads: leads.length, signups: conversions.length,
      conversionRate: devices ? Math.round((conversions.length / devices) * 1000) / 10 : 0,
      signupsByRole: count(conversions, (c) => c.role, 10),
      fallbackIds: visits.filter((v) => v.idSource === 'signature').length,
    },
    perLink,
    breakdown: {
      countries: count(visits, (v) => v.country), cities: count(visits, (v) => (v.city ? `${v.city}${v.country ? ', ' + v.country : ''}` : null)),
      deviceTypes: count(visits, (v) => v.deviceType), os: count(visits, (v) => v.os), browsers: count(visits, (v) => v.browser),
      inApp: count(visits, (v) => v.inApp || 'Normal browser'), models: count(visits, (v) => v.model), languages: count(visits, (v) => v.language),
      channels: count(visits, (v) => (v.linkId ? linkById.get(v.linkId)?.channel : 'direct')), utmSources: count(visits, (v) => v.utmSource),
      referrerSites: count(visits, (v) => { try { return v.referrer ? new URL(v.referrer).hostname : null; } catch { return null; } }),
    },
    series, hours,
    recentOpens: visits.slice(0, 150).map((v) => ({
      id: v.id, at: v.createdAt, link: v.linkId ? linkById.get(v.linkId)?.label : '(no label)', deviceNo: v.deviceNo, openNo: v.openNo, newDevice: v.openNo === 1,
      deviceType: v.deviceType, model: v.model, os: v.os, browser: v.browser, inApp: v.inApp, city: v.city, region: v.region, country: v.country,
      timezone: v.timezone, language: v.language, screen: v.screen, utmSource: v.utmSource, registered: !!v.userId, idSource: v.idSource,
    })),
    leads: leads.map((l) => ({ ...l, deviceKey: undefined, link: l.link?.label ?? '(no label)' })),
    topReferrers: referralTop.map((r: any) => ({ ...(referrers.find((u) => u.id === r.fromId) || { name: 'Unknown' }), referrals: r._count._all })),
  });
}

/** PATCH /api/admin-ops/marketing/leads/:id */
export async function updateLead(req: Request, res: Response) {
  const status = String(req.body?.status || '');
  if (!['NEW', 'CONTACTED', 'REGISTERED', 'LOST'].includes(status)) throw ApiError.badRequest('Invalid status');
  res.json(await prisma.marketingLead.update({ where: { id: req.params.id }, data: { status } }));
}

/** GET /api/admin-ops/marketing/leads.csv */
export async function leadsCsv(_req: Request, res: Response) {
  const rows = await prisma.marketingLead.findMany({ orderBy: { createdAt: 'desc' }, include: { link: { select: { label: true } } } });
  const q = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = ['date,name,email,phone,interest,organization,country,city,link,opens_before,consent,status,message']
    .concat(rows.map((r) => [r.createdAt.toISOString(), r.name, r.email, r.phone, r.interest, r.organization, r.country, r.city, r.link?.label, r.opensBefore, r.consent, r.status, r.message].map(q).join(','))).join('\n');
  res.setHeader('Content-Disposition', 'attachment; filename="nhealth-leads.csv"');
  res.type('text/csv').send(csv);
}

/** GET/PUT /api/admin-ops/marketing/settings */
export async function getSettings(_req: Request, res: Response) { res.json(await getMarketingSettings()); }
export async function putSettings(req: Request, res: Response) { res.json(await saveMarketingSettings(req.body || {}, uid(req))); }

// ------------------------------------------------------------------ broadcasts
interface Audience { users?: boolean; roles?: string[]; countries?: string[]; leads?: boolean; leadInterests?: string[] }
async function recipients(a: Audience, channel: 'email' | 'sms') {
  const out: { name: string; to: string; unsub: string }[] = [];
  const seen = new Set<string>();
  if (a.users) {
    const users = await prisma.user.findMany({
      where: {
        marketingOptIn: true, isActive: true, deletedAt: null,
        ...(a.roles?.length ? { role: { in: a.roles as any } } : {}), ...(a.countries?.length ? { country: { in: a.countries } } : {}),
      },
      select: { id: true, name: true, email: true, phone: true }, take: 50_000,
    });
    for (const u of users) { const to = channel === 'email' ? u.email : u.phone; if (to && !seen.has(to)) { seen.add(to); out.push({ name: u.name, to, unsub: unsubToken('u', u.id) }); } }
  }
  if (a.leads) {
    const leads = await prisma.marketingLead.findMany({
      where: { consent: true, unsubscribed: false, userId: null, ...(a.leadInterests?.length ? { interest: { in: a.leadInterests } } : {}), ...(a.countries?.length ? { country: { in: a.countries } } : {}) },
      take: 50_000,
    });
    for (const l of leads) { const to = channel === 'email' ? l.email : l.phone; if (to && !seen.has(to)) { seen.add(to); out.push({ name: l.name, to, unsub: unsubToken('l', l.id) }); } }
  }
  return out;
}

/** POST /api/admin-ops/marketing/broadcasts { channel, subject, body, audience, linkId, dryRun } */
export async function broadcast(req: Request, res: Response) {
  const b = req.body || {};
  const channel = b.channel === 'sms' ? 'sms' : 'email';
  const body = str(b.body, channel === 'sms' ? 480 : 5000);
  const subject = str(b.subject, 150);
  const audience: Audience = { users: !!b.audience?.users, leads: !!b.audience?.leads, roles: b.audience?.roles || [], countries: (b.audience?.countries || []).map((c: string) => String(c).toUpperCase()), leadInterests: b.audience?.leadInterests || [] };
  if (!audience.users && !audience.leads) throw ApiError.badRequest('Choose who receives it');
  const list = await recipients(audience, channel);
  if (b.dryRun) return res.json({ recipients: list.length, sample: list.slice(0, 5).map((r) => r.name) });
  if (!body) throw ApiError.badRequest('Write the message');
  if (channel === 'email' && !subject) throw ApiError.badRequest('Email needs a subject');

  const link = b.linkId ? await prisma.marketingLink.findUnique({ where: { id: String(b.linkId) } }) : null;
  const trackUrl = link ? linkUrl(link.slug) + `?utm_source=${channel}&utm_medium=broadcast` : String(env.appUrl);
  const bc = await prisma.marketingBroadcast.create({ data: { channel, subject, body, audience: audience as any, linkId: link?.id, total: list.length, status: 'SENDING', createdById: uid(req) } });
  res.status(202).json({ id: bc.id, recipients: list.length });

  // Send in the background, gently (providers rate-limit bulk sending).
  (async () => {
    let sent = 0, failed = 0;
    const unsubBase = String(env.publicUrl).replace(/\/$/, '') + '/api/mkt/unsubscribe?t=';
    for (const r of list) {
      const text = body.replace(/\{\{\s*name\s*\}\}/g, r.name.split(' ')[0]).replace(/\{\{\s*link\s*\}\}/g, trackUrl);
      let ok = false;
      try {
        ok = channel === 'email'
          ? await sendEmail(r.to, subject!, subject!, `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p><p><a href="${trackUrl}">Open N-Health</a></p><p style="font-size:12px;color:#888">You receive this because you agreed to hear from N-Health. <a href="${unsubBase + r.unsub}">Unsubscribe</a></p>`)
          : await sendSms(r.to, text + ' Reply STOP to opt out.');
      } catch { ok = false; }
      ok ? sent++ : failed++;
      if ((sent + failed) % 20 === 0) await prisma.marketingBroadcast.update({ where: { id: bc.id }, data: { sent, failed } }).catch(() => null);
      await new Promise((ok2) => setTimeout(ok2, channel === 'sms' ? 400 : 150));
    }
    await prisma.marketingBroadcast.update({ where: { id: bc.id }, data: { sent, failed, status: 'DONE' } }).catch(() => null);
  })().catch(() => null);
}

/** GET /api/admin-ops/marketing/broadcasts */
export async function listBroadcasts(_req: Request, res: Response) {
  res.json(await prisma.marketingBroadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }));
}
