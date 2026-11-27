// Provider flyers made by N-Health, and the public provider page their QR code opens.
import { get, post } from '../lib/api.js';
import { state } from '../lib/store.js';
import { go } from '../lib/router.js';
import { appBar, card, cardHead, esc, $, $$, toast, toastErr, skeleton, logo, verifiedBadge } from '../lib/ui.js';

const PUBLIC_HOST = 'www.nhealth.com.ng';
// Printed flyers always point at the public web address (a dev/test build points at itself).
const origin = () => (/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname) && !window.Capacitor ? location.origin : 'https://' + PUBLIC_HOST);
const pageLink = (p, src) => `${origin()}/p/${p.id}?${p.referralCode ? 'ref=' + encodeURIComponent(p.referralCode) + '&' : ''}src=${src}`;
const ROLE_COLOR = { DOCTOR: '#1A73E8', NURSE: '#E91E63', PHARMACY: '#0F9D58', LAB: '#7B1FA2', AMBULANCE: '#D93025', INSTITUTION: '#00796B' };
const ROLE_ICON = { DOCTOR: '👨‍⚕️', NURSE: '👩‍⚕️', PHARMACY: '💊', LAB: '🔬', AMBULANCE: '🚑', INSTITUTION: '🏥' };

function deviceId() {
  try {
    let d = localStorage.getItem('nh_device');
    if (!d) { d = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)); localStorage.setItem('nh_device', d); }
    return d;
  } catch { return undefined; }
}

// ================= Public provider page (/p/:id) =================
export async function publicProviderScreen(el, { id }, q) {
  el.innerHTML = `<div class="pp-hero">${logo(36)}<b>N-Health</b></div>${skeleton(3)}`;
  post(`/public/providers/${encodeURIComponent(id)}/visit`, { deviceId: deviceId(), source: q.src === 'flyer' ? 'flyer' : 'link' }).catch(() => null);
  let p;
  try { p = await get('/public/providers/' + encodeURIComponent(id)); } catch (e) {
    el.innerHTML = `<div class="pp-hero">${logo(36)}<b>N-Health</b></div>` + card(`<div class="empty"><span class="icon">🔎</span>${esc(e.status === 404 ? 'This provider is no longer on N-Health.' : e.message)}<div class="mt8"><button class="btn btn-primary btn-sm" data-go="${state.user ? '/' : '/auth?mode=register'}">Open N-Health</button></div></div>`);
    return;
  }
  // Already signed in: straight to the provider's page in the app, where booking/ordering happens.
  if (state.user) return go('/provider/' + p.id, { replace: true });
  const color = ROLE_COLOR[p.role] || '#1A73E8';
  const place = [p.address || p.place, p.city, p.state].filter(Boolean).join(', ');
  el.innerHTML = `<div class="pp-hero">${logo(36)}<b>N-Health</b><span class="grow"></span><button class="btn btn-sm pp-login" data-pp="login">Sign in</button></div>
    <div class="card pp-card" style="border-top:4px solid ${color}">
      <div class="pp-avatar" style="background:${color}">${ROLE_ICON[p.role] || '🏥'}</div>
      <h2>${esc(p.name)}</h2>
      <div class="muted">${esc(p.title || p.roleLabel || '')}</div>
      <div class="mt8">${verifiedBadge(p.verified)} ${p.rating ? `<span class="badge">⭐ ${p.rating}${p.reviews ? ` (${p.reviews})` : ''}</span>` : ''}</div>
      ${place ? `<div class="small muted mt8">📍 ${esc(place)}</div>` : ''}${p.hours ? `<div class="small muted">🕘 ${esc(p.hours)}</div>` : ''}
      ${p.services?.length ? `<ul class="pp-services">${p.services.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      <button class="btn btn-primary btn-block mt12" data-pp="act" style="background:${color};border-color:${color}">${esc(p.action || 'Continue')} on N-Health</button>
      <button class="btn btn-outline btn-block mt8" data-pp="login">I already have an account</button>
    </div>
    ${card(`<div class="small muted">N-Health is free for patients: book doctors and tests, order medicines, request home care and call an ambulance, all in one app. Create your account in under a minute.</div>`)}`;
  $$('[data-pp]', el).forEach((b) => (b.onclick = () => {
    try { sessionStorage.setItem('nh_after_login', '/provider/' + p.id); } catch { /* */ }
    go(b.dataset.pp === 'login' ? '/auth' : '/auth?mode=register');
  }));
}

// ================= Flyer maker (/flyer) =================
const FORMATS = { poster: { w: 1240, h: 1748, label: 'Poster (A5 print)' }, square: { w: 1080, h: 1080, label: 'Square (WhatsApp / Instagram)' }, story: { w: 1080, h: 1920, label: 'Status / story' } };
const THEMES = { brand: ['#1A73E8', '#0B4FB3'], role: null, dark: ['#0B2545', '#13315C'] };
const LOGO_CROSS = 'M206 96h100a14 14 0 0 1 14 14v96h96a14 14 0 0 1 14 14v72a14 14 0 0 1-14 14h-96v96a14 14 0 0 1-14 14H206a14 14 0 0 1-14-14v-96H96a14 14 0 0 1-14-14v-72a14 14 0 0 1 14-14h96v-96a14 14 0 0 1 14-14z';
const LOGO_PULSE = 'M112 256h88l24-52 36 108 28-72 14 16h98';
const FONT = 'Arial, Helvetica, sans-serif';

function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
/** The N-Health logo drawn from its SVG paths (no image download, works offline). */
function drawLogo(c, x, y, s, tile = '#1A73E8', cross = '#fff', pulse = tile) {
  c.save(); c.translate(x, y); c.scale(s / 512, s / 512);
  roundRect(c, 0, 0, 512, 512, 116); c.fillStyle = tile; c.fill();
  c.fillStyle = cross; c.fill(new Path2D(LOGO_CROSS));
  c.strokeStyle = pulse; c.lineWidth = 22; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(new Path2D(LOGO_PULSE));
  c.restore();
}
/** Wraps text to the width; returns the y after the last line. */
function wrap(c, text, x, y, maxW, lh, maxLines = 3) {
  const words = String(text || '').split(/\s+/); let line = ''; let n = 0;
  for (let i = 0; i < words.length; i++) {
    const t = line ? line + ' ' + words[i] : words[i];
    if (c.measureText(t).width > maxW && line) {
      if (++n === maxLines) { let l = line; while (c.measureText(l + '…').width > maxW && l) l = l.slice(0, -1); c.fillText(l + '…', x, y); return y + lh; }
      c.fillText(line, x, y); y += lh; line = words[i];
    } else line = t;
  }
  if (line) { c.fillText(line, x, y); y += lh; }
  return y;
}

async function drawFlyer(canvas, p, fmt, theme) {
  const QR = (await import('qrcode')).default;
  const { w, h } = FORMATS[fmt];
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d');
  const role = ROLE_COLOR[p.role] || '#1A73E8';
  const [c1, c2] = THEMES[theme] || [role, '#0B2545'];
  const u = w / 1080; // scale unit
  const pad = 70 * u;
  // Background
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, c1); g.addColorStop(1, c2);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.08; c.fillStyle = '#fff';
  c.beginPath(); c.arc(w - 60 * u, 120 * u, 260 * u, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(40 * u, h - 80 * u, 200 * u, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1;
  // Header: logo + N-Health
  drawLogo(c, pad, pad, 84 * u, '#ffffff', c1, '#ffffff');
  c.fillStyle = '#fff'; c.textBaseline = 'middle';
  c.font = `bold ${46 * u}px ${FONT}`; c.fillText('N-Health', pad + 104 * u, pad + 42 * u);
  c.font = `${24 * u}px ${FONT}`; c.globalAlpha = 0.85; c.textAlign = 'right';
  c.fillText(p.verified ? '✓ Verified provider' : (p.roleLabel || ''), w - pad, pad + 42 * u); c.textAlign = 'left'; c.globalAlpha = 1;
  c.textBaseline = 'alphabetic';

  const square = fmt === 'square';
  // White card
  const cardY = pad + 130 * u, cardH = h - cardY - pad - 70 * u;
  c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 40 * u; c.shadowOffsetY = 12 * u;
  roundRect(c, pad, cardY, w - pad * 2, cardH, 36 * u); c.fillStyle = '#fff'; c.fill(); c.restore();
  const ix = pad + 50 * u, iw = w - pad * 2 - 100 * u;
  let y = cardY + 80 * u;
  // Name and title
  c.fillStyle = '#5f6368'; c.font = `bold ${26 * u}px ${FONT}`;
  c.fillText((p.title || p.roleLabel || '').toUpperCase().slice(0, 48), ix, y); y += 64 * u;
  c.fillStyle = '#202124'; c.font = `bold ${(square ? 58 : 66) * u}px ${FONT}`;
  y = wrap(c, p.name, ix, y, iw, (square ? 66 : 76) * u, 2);
  const place = [p.address || p.place, p.city, p.state].filter(Boolean).join(', ');
  if (place) { c.fillStyle = '#5f6368'; c.font = `${28 * u}px ${FONT}`; y = wrap(c, place, ix, y + 6 * u, iw, 38 * u, square ? 1 : 2); }

  // QR (with the logo in the middle) and services side by side (square) or stacked (poster/story)
  const qrSize = Math.round((square ? 360 : fmt === 'story' ? 560 : 600) * u);
  const link = pageLink(p, 'flyer');
  const qc = document.createElement('canvas');
  await QR.toCanvas(qc, link, { width: qrSize, margin: 1, errorCorrectionLevel: 'H', color: { dark: '#202124', light: '#ffffff' } });
  const services = (p.services || []).slice(0, square ? 4 : 5);
  if (square) {
    const qx = w - pad - 50 * u - qrSize, qy = cardY + cardH - 50 * u - qrSize - 40 * u;
    let sy = Math.max(y + 40 * u, qy - 60 * u);
    c.font = `${28 * u}px ${FONT}`;
    for (const s of services) { c.fillStyle = role; c.beginPath(); c.arc(ix + 10 * u, sy - 9 * u, 9 * u, 0, Math.PI * 2); c.fill(); c.fillStyle = '#202124'; sy = wrap(c, s, ix + 34 * u, sy, qx - ix - 60 * u, 36 * u, 2) + 14 * u; }
    c.drawImage(qc, qx, qy);
    drawLogo(c, qx + qrSize / 2 - 36 * u, qy + qrSize / 2 - 36 * u, 72 * u);
    c.fillStyle = '#202124'; c.font = `bold ${30 * u}px ${FONT}`; c.textAlign = 'center';
    c.fillText('Scan to ' + (p.action || 'book').toLowerCase(), qx + qrSize / 2, qy + qrSize + 36 * u); c.textAlign = 'left';
  } else {
    y += 24 * u;
    c.font = `${32 * u}px ${FONT}`;
    for (const s of services) { c.fillStyle = role; c.beginPath(); c.arc(ix + 11 * u, y - 10 * u, 11 * u, 0, Math.PI * 2); c.fill(); c.fillStyle = '#202124'; y = wrap(c, s, ix + 40 * u, y, iw - 40 * u, 40 * u, 1) + 12 * u; }
    const bottom = cardY + cardH - 60 * u;
    const qy = Math.max(y + 30 * u, bottom - qrSize - 70 * u);
    const size = Math.min(qrSize, bottom - 70 * u - qy);
    c.drawImage(qc, (w - size) / 2, qy, size, size);
    drawLogo(c, w / 2 - 44 * u * size / qrSize, qy + size / 2 - 44 * u * size / qrSize, 88 * u * size / qrSize);
    c.fillStyle = '#202124'; c.font = `bold ${38 * u}px ${FONT}`; c.textAlign = 'center';
    c.fillText('Scan to ' + (p.action || 'book').toLowerCase(), w / 2, qy + size + 52 * u); c.textAlign = 'left';
  }
  // Footer
  c.fillStyle = '#fff'; c.font = `bold ${28 * u}px ${FONT}`; c.textAlign = 'center';
  c.fillText('Free on N-Health  •  ' + PUBLIC_HOST, w / 2, h - pad + 10 * u);
  c.textAlign = 'left';
}

export async function flyerScreen(el) {
  el.innerHTML = appBar({ title: '📣 My flyer', back: true }) + skeleton(3);
  let p;
  try { p = await get('/flyer/me'); } catch (e) { el.innerHTML = appBar({ title: '📣 My flyer', back: true }) + card(`<div class="empty">${esc(e.message)}</div>`); return; }
  let fmt = 'poster', theme = 'brand';
  const link = pageLink(p, 'link');
  const s = p.stats || {};
  el.innerHTML = appBar({ title: '📣 My flyer', back: true }) +
    `<div class="banner info">Print your flyer or share it on WhatsApp. Customers scan the QR code and land on your N-Health page, where they can ${esc((p.action || 'book').toLowerCase())}.</div>` +
    card(`<div class="flyer-stats"><div><b>${s.scans || 0}</b><span>Scans</span></div><div><b>${s.last30 || 0}</b><span>Last 30 days</span></div><div><b>${s.people || 0}</b><span>People</span></div><div><b>${s.joined || 0}</b><span>Joined via you</span></div></div>`) +
    card(`<div class="field"><label>Size</label><div class="chips" id="fmt">${Object.entries(FORMATS).map(([k, f]) => `<span class="chip ${k === fmt ? 'active' : ''}" data-fmt="${k}" tabindex="0">${f.label}</span>`).join('')}</div></div>
      <div class="field"><label>Colours</label><div class="chips" id="thm">${[['brand', 'N-Health blue'], ['role', 'My colour'], ['dark', 'Dark']].map(([k, l]) => `<span class="chip ${k === theme ? 'active' : ''}" data-thm="${k}" tabindex="0">${l}</span>`).join('')}</div></div>
      <div class="flyer-preview"><canvas id="cv" aria-label="Your flyer"></canvas></div>
      <div class="row wrap mt12"><button class="btn btn-primary btn-sm grow" id="dl">⬇️ Download</button><button class="btn btn-outline btn-sm grow" id="sh">📤 Share</button><button class="btn btn-outline btn-sm grow" id="pr">🖨️ Print</button></div>`) +
    card(cardHead('🔗 Your page link') + `<div class="small muted">Put it in your WhatsApp bio, Instagram or messages.</div><div class="flyer-link mt8">${esc(link)}</div>
      <div class="row mt8"><button class="btn btn-outline btn-sm grow" id="cp">Copy link</button><a class="btn btn-outline btn-sm grow" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`${p.action || 'Book'} with ${p.name} on N-Health: ${link}`)}">WhatsApp</a></div>`) +
    (p.verified ? '' : card('<div class="small">⚠️ Your account is not verified yet. Customers can still open your page, but you get a "Verified" tick on the flyer once verification is approved.</div>'));
  const cv = $('#cv', el);
  const draw = () => drawFlyer(cv, p, fmt, theme).catch(toastErr);
  await draw();
  $$('[data-fmt]', el).forEach((b) => (b.onclick = () => { fmt = b.dataset.fmt; $$('[data-fmt]', el).forEach((x) => x.classList.toggle('active', x === b)); draw(); }));
  $$('[data-thm]', el).forEach((b) => (b.onclick = () => { theme = b.dataset.thm; $$('[data-thm]', el).forEach((x) => x.classList.toggle('active', x === b)); draw(); }));
  const file = () => new Promise((r) => cv.toBlob((b) => r(new File([b], `n-health-flyer-${fmt}.png`, { type: 'image/png' })), 'image/png'));
  $('#dl', el).onclick = async () => {
    const f = await file(); const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('✅ Flyer saved');
  };
  $('#sh', el).onclick = async () => {
    const f = await file();
    const text = `${p.action || 'Book'} with ${p.name} on N-Health: ${link}`;
    try {
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], text });
      else if (navigator.share) await navigator.share({ title: p.name, text, url: link });
      else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    } catch (e) { if (e?.name !== 'AbortError') toastErr(e); }
  };
  $('#pr', el).onclick = () => {
    const url = cv.toDataURL('image/png');
    const wdw = window.open('', '_blank');
    if (!wdw) return toast('Allow pop-ups to print, or use Download');
    wdw.document.write(`<!doctype html><title>N-Health flyer</title><style>@page{size:${fmt === 'poster' ? 'A5' : 'auto'};margin:0}body{margin:0;display:flex;justify-content:center}img{width:100%;max-width:${fmt === 'poster' ? '148mm' : '120mm'};height:auto}</style><img src="${url}" onload="setTimeout(()=>print(),200)">`);
    wdw.document.close();
  };
  $('#cp', el).onclick = async () => { try { await navigator.clipboard.writeText(link); toast('✅ Link copied'); } catch { prompt('Copy your link', link); } };
}
