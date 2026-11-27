// Marketing: device recognition for tracking links, signup attribution, ad pixels behind consent.
import { post } from './api.js';

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** Random ID this browser keeps (no personal data). Opening a forwarded link on another phone gives a different ID. */
export function deviceId() {
  let id = ls.get('nh_did');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''));
    ls.set('nh_did', id);
    if (ls.get('nh_did') !== id) return null; // storage blocked
  }
  return id;
}

/** Fallback when storage is blocked: a rough signature (model, screen, timezone, language). Identical phones look the same. */
export async function signature() {
  const s = [navigator.userAgent, `${screen.width}x${screen.height}`, window.devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language, navigator.platform, navigator.hardwareConcurrency].join('|');
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 40);
  } catch {
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16).padStart(16, '0');
  }
}

async function modelHint() {
  try { const v = await navigator.userAgentData?.getHighEntropyValues?.(['model']); return v?.model || undefined; } catch { return undefined; }
}

/** Records one open of a tracking link and remembers it for signup attribution (60 days). */
export async function trackOpen(slug) {
  const q = new URLSearchParams(location.search);
  const id = deviceId();
  const sig = id ? undefined : await signature();
  const r = await post('/mkt/open', {
    slug: slug || undefined, deviceId: id || undefined, signature: sig,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: navigator.language,
    screen: `${screen.width}x${screen.height}`, model: await modelHint(),
    referrer: document.referrer || undefined,
    utm: { source: q.get('utm_source') || undefined, medium: q.get('utm_medium') || undefined, campaign: q.get('utm_campaign') || undefined },
  });
  const deviceKey = id ? 'd:' + id : 's:' + sig;
  if (!ls.get('nh_mkt')) ls.set('nh_mkt', JSON.stringify({ slug, deviceKey, at: Date.now() }));
  else { try { const m = JSON.parse(ls.get('nh_mkt')); if (!m.slug && slug) ls.set('nh_mkt', JSON.stringify({ slug, deviceKey, at: m.at })); } catch { /* */ } }
  return { ...r, deviceKey };
}

/** Attribution sent with registration (first link this device came from, within 60 days). */
export function signupAttribution() {
  try {
    const m = JSON.parse(ls.get('nh_mkt') || 'null');
    if (m && Date.now() - m.at < 60 * 86400_000) return { slug: m.slug || undefined, deviceKey: m.deviceKey };
  } catch { /* */ }
  const id = ls.get('nh_did');
  return id ? { deviceKey: 'd:' + id } : undefined;
}

// ---------------------------------------------------------------- ad pixels (only after consent)
let loaded = false;
export function adPixels(cfg) {
  if (!cfg || !(cfg.metaPixelId || cfg.googleTagId || cfg.tiktokPixelId)) return;
  const choice = ls.get('nh_ads_consent');
  if (choice === 'yes') return loadPixels(cfg);
  if (choice === 'no' || document.getElementById('nh-consent')) return;
  const bar = document.createElement('div');
  bar.id = 'nh-consent';
  bar.className = 'consent-bar';
  bar.innerHTML = '<span>We use cookies to measure our ads and improve N-Health. <a href="#/auth" data-privacy>Privacy</a></span><span><button class="btn btn-outline btn-sm" data-c="no">Decline</button> <button class="btn btn-primary btn-sm" data-c="yes">Accept</button></span>';
  bar.onclick = (e) => { const c = e.target?.dataset?.c; if (!c) return; ls.set('nh_ads_consent', c); bar.remove(); if (c === 'yes') loadPixels(cfg); };
  document.body.appendChild(bar);
}
function inject(src) { const s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s); }
function loadPixels(cfg) {
  if (loaded) return; loaded = true;
  if (cfg.metaPixelId) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];}(window,document);
    /* eslint-enable */
    inject('https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', cfg.metaPixelId); window.fbq('track', 'PageView');
  }
  if (cfg.googleTagId) {
    inject('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.googleTagId));
    window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', cfg.googleTagId);
  }
  if (cfg.tiktokPixelId) {
    const ttq = (window.ttq = window.ttq || []);
    ['page', 'track', 'identify'].forEach((m) => { ttq[m] = (...a) => ttq.push([m, ...a]); });
    inject('https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=' + encodeURIComponent(cfg.tiktokPixelId) + '&lib=ttq');
    ttq.page();
  }
}
/** Conversion events for ad platforms (no-op until consent). */
export function adEvent(name) {
  try {
    window.fbq?.('track', name);
    window.gtag?.('event', name === 'Lead' ? 'generate_lead' : name === 'CompleteRegistration' ? 'sign_up' : name);
    window.ttq?.track?.(name === 'Lead' ? 'SubmitForm' : name);
  } catch { /* */ }
}
