import './styles/mockup.css';
import './styles/app.css';
import { get, post, auth, setUnauthorizedHandler, setFreshHandler, setReadTracker, prefetch, flushOutbox, onOutbox, pendingWrites } from './lib/api.js';
import { state, setState, subscribe } from './lib/store.js';
import { render, go, back, home, onNav, current, softRefresh, currentPattern } from './lib/router.js';
import { connect, disconnect } from './lib/realtime.js';
import { registerSW } from './lib/push.js';
import { toast, esc, $ } from './lib/ui.js';
import { t } from './lib/i18n.js';
import { S, P, V } from './screens/index.js';

// ---------- Bottom navigation per role (mockup bottom-nav styles) ----------
const NAVS = {
  PATIENT: { cls: '', items: [['/patient/home', '🏠', 'Home'], ['/patient/emergency', '🚨', 'Emergency'], ['/patient/appointments', '📅', 'Bookings'], ['/patient/pharmacy', '💊', 'Pharmacy'], ['/patient/providers', '🏥', 'Providers'], ['/profile', '👤', 'Profile']] },
  DOCTOR: { cls: 'doctor-nav', items: [['/doctor/home', '🏠', 'Home'], ['/doctor/requests', '📋', 'Requests'], ['/doctor/patients', '👥', 'Patients'], ['/doctor/schedule', '🗓️', 'Schedule'], ['/messages', '💬', 'Messages'], ['/profile', '👤', 'Profile']] },
  PHARMACY: { cls: 'pharmacy-nav', items: [['/pharmacy/home', '🏠', 'Home'], ['/pharmacy/inventory', '📦', 'Inventory'], ['/pharmacy/pos', '🧾', 'POS'], ['/pharmacy/orders', '🛒', 'Orders'], ['/pharmacy/customers', '👥', 'Customers'], ['/profile', '👤', 'Profile']] },
  LAB: { cls: 'lab-nav', items: [['/lab/home', '🏠', 'Home'], ['/lab/tests', '🧪', 'Tests'], ['/lab/catalog', '📋', 'Catalog'], ['/provider/schedule', '🗓️', 'Schedule'], ['/messages', '💬', 'Messages'], ['/profile', '👤', 'Profile']] },
  NURSE: { cls: 'nurse-nav', items: [['/nurse/home', '🏠', 'Home'], ['/nurse/requests', '📋', 'Requests'], ['/provider/schedule', '🗓️', 'Schedule'], ['/messages', '💬', 'Messages'], ['/profile', '👤', 'Profile']] },
  AMBULANCE: { cls: 'ambulance-nav', items: [['/ambulance/home', '🏠', 'Home'], ['/ambulance/requests', '🚨', 'Trips'], ['/messages', '💬', 'Messages'], ['/profile', '👤', 'Profile']] },
  INSTITUTION: { cls: 'institution-nav', items: [['/institution/home', '🏠', 'Home'], ['/institution/departments', '🏢', 'Departments'], ['/institution/staff', '👥', 'Staff'], ['/institution/patients', '🛏️', 'Patients'], ['/institution/reports', '📊', 'Reports'], ['/profile', '👤', 'Profile']] },
  ADMIN: { cls: 'admin-nav', items: [['/admin', '🛡️', 'Admin'], ['/messages', '💬', 'Messages'], ['/profile', '👤', 'Profile']] },
};
onNav((path) => {
  const host = $('#nav-host');
  const nav = path && NAVS[state.user?.role];
  if (!nav || path.startsWith('/chat/')) { host.innerHTML = ''; return; }
  const active = nav.items.reduce((best, it) => (path.startsWith(it[0].split('/').slice(0, 3).join('/')) && it[0].length > (best?.[0].length || 0) ? it : best), null) || nav.items.find((it) => it[0] === path);
  host.innerHTML = `<nav class="bottom-nav ${nav.cls}" aria-label="Main">${nav.items.map((it) => `<button class="${active && active[0] === it[0] ? 'active' : ''}" data-go="${it[0]}"><span class="nav-icon">${it[1]}</span><span class="nav-label">${t(it[2])}</span>${it[0] === '/messages' && state.unreadMessages ? '<span class="badge">●</span>' : ''}</button>`).join('')}</nav>`;
});

// ---------- Global delegated navigation ----------
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  const b = e.target.closest('[data-back]');
  if (b) { e.preventDefault(); back(b.dataset.back || undefined); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('.list-item[tabindex],.quick-action[tabindex],.tab[tabindex]')) e.target.click();
  if (e.key === 'Escape') $('#modal').classList.contains('active') && $('#modal [data-close]')?.click();
});

// ---------- Session ----------
export async function startSession(token, user) {
  auth.token = token;
  auth.user = user;
  setState({ user });
  connect();
  refreshUnread();
  go(home(user.role), { replace: true });
  warmUp();
}
export function logout(msg) {
  auth.clear();
  disconnect();
  setState({ user: null, unread: 0, balance: null });
  go('/auth', { replace: true });
  if (msg) toast(msg);
}
window.nhLogout = logout;
setUnauthorizedHandler((m) => logout(m || 'Your session ended - please sign in again'));

export async function refreshUnread() {
  try { const r = await get('/notifications?limit=1'); setState({ unread: r.unread || 0 }); } catch { /* offline */ }
}
export async function refreshMe() {
  const me = await get('/auth/me');
  const user = { ...auth.user, ...me, role: me.activeRole || auth.user?.role, kycStatus: me.kycStatus, verificationStatus: me.verificationStatus };
  auth.user = user;
  setState({ user });
  return user;
}

// ---------- Connectivity (mockup offline banner) ----------
function netBanner() {
  let b = $('#offline-banner');
  const waiting = pendingWrites().length;
  if (navigator.onLine && !waiting) { b?.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'offline-banner'; b.className = 'offline-banner'; $('#app').before(b); }
  b.innerHTML = navigator.onLine
    ? `<span class="dot"></span> Sending ${waiting} saved change${waiting > 1 ? 's' : ''}…`
    : `<span class="dot"></span> Offline - showing saved data.${waiting ? ` ${waiting} change${waiting > 1 ? 's' : ''} will send when you reconnect.` : ' Messages and health notes you add will send when you reconnect.'}`;
}
async function syncOutbox() {
  const n = await flushOutbox().catch(() => 0);
  netBanner();
  if (n) { toast(`✅ ${n} saved change${n > 1 ? 's' : ''} sent`); softRefresh(); }
}
onOutbox(netBanner);
window.addEventListener('online', () => { netBanner(); toast('✅ Back online'); setState({ online: true }); if (state.user) { connect(); refreshUnread(); syncOutbox(); } });
window.addEventListener('offline', () => { netBanner(); toast('⚠️ You are offline. Saved screens still work.'); setState({ online: false }); });

// ---------- Speed: redraw when newer data arrives, learn and pre-load each screen's data ----------
let freshTimer = null;
setFreshHandler(() => { clearTimeout(freshTimer); freshTimer = setTimeout(softRefresh, 250); });
const LEARN = 'nh_routes';
let learned = (() => { try { return JSON.parse(localStorage.getItem(LEARN) || '{}'); } catch { return {}; } })();
let learnTimer = null;
setReadTracker((path) => {
  const p = currentPattern();
  if (!p || p.includes(':') || path.startsWith('/auth') || path.startsWith('/mkt')) return; // only fixed screens (bottom tabs, home)
  const list = learned[p] || (learned[p] = []);
  if (list.includes(path)) return;
  list.push(path); if (list.length > 10) list.shift();
  clearTimeout(learnTimer);
  learnTimer = setTimeout(() => { try { localStorage.setItem(LEARN, JSON.stringify(learned)); } catch { /* */ } }, 1000);
});
// What each role's main tabs read, so even a first visit to a tab opens instantly (learned reads are added).
const MSG = '/messages/conversations', PROF = '/provider-profile', AVAIL = '/availability/me';
const TAB_READS = {
  PATIENT: ['/patient/appointments', '/patient/emergency', '/directory?type=PHARMACY&sort=rating', '/directory?type=ALL&q=&sort=rating', MSG],
  DOCTOR: ['/doctor-ops/stats', '/doctor/appointments', '/doctor/patients', AVAIL, MSG, PROF],
  PHARMACY: ['/pharmacy/stats', '/pharmacy/inventory', '/pharmacy/orders', '/pharmacy-ops/customers', '/pharmacy-ops/alerts', MSG, PROF],
  LAB: ['/lab/stats', '/lab/tests', '/lab-ops/catalog', AVAIL, MSG, PROF],
  NURSE: ['/nurse/stats', '/nurse/requests/mine', '/nurse/requests/available', AVAIL, MSG, PROF],
  AMBULANCE: ['/ambulance/stats', '/ambulance/requests/mine', '/ambulance/requests/available', MSG, PROF],
  INSTITUTION: ['/institution/profile', '/institution/stats', '/institution/departments', '/institution/staff', '/institution/patients?status=&q=', '/institution/reports?days=30', MSG, PROF],
};
/** After the first screen: download the person's other screens and their tabs' data in the background. */
function warmUp() {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  idle(() => {
    if (!state.user) return;
    const mods = state.user.role === 'PATIENT' ? [P, S] : [V, S, P];
    mods.forEach((m) => m.preload().catch(() => null));
    const nav = NAVS[state.user.role];
    if (nav) prefetch([...new Set(['/auth/me', ...(TAB_READS[state.user.role] || []), ...nav.items.flatMap(([p]) => learned[p] || [])])]);
  });
}
subscribe((_s, p) => { if ('unread' in p) { const c = document.querySelector('.bell .count'); const bell = document.querySelector('.bell'); if (bell) { if (c) c.remove(); if (state.unread > 0) bell.insertAdjacentHTML('beforeend', `<span class="count">${state.unread > 99 ? '99+' : state.unread}</span>`); } } });

navigator.serviceWorker?.addEventListener?.('message', (e) => { if (e.data?.type === 'open-notifications') go('/notifications'); });

// ---------- Boot ----------
// The app opens straight away from what is saved on the phone; fresh data follows in the background.
const DEFAULT_CONFIG = { gateways: [], currencies: ['NGN'], rates: { NGN: 1 }, emergencyNumbers: { DEFAULT: ['112'] } };
(function boot() {
  const cfg = get('/config').then((c) => setState({ config: c })).catch(() => { if (!state.config) setState({ config: DEFAULT_CONFIG }); });
  if (auth.token && auth.user) {
    setState({ user: auth.user });
    refreshMe().catch(() => null); // a 401 signs out through the unauthorized handler
    connect();
    refreshUnread();
  }
  // Wait for settings only when nothing is saved yet, and never more than 1.5 s.
  Promise.race([cfg, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    if (!state.config) setState({ config: DEFAULT_CONFIG });
    netBanner();
    const q = new URLSearchParams(location.search);
    // Tracking links / QR codes: https://www.<domain>/go/<slug>?utm_... -> pitch page
    const goM = location.pathname.match(/^\/go(?:\/([^/?#]+))?\/?$/);
    if (goM) history.replaceState(null, '', '/' + location.search + '#/go' + (goM[1] ? '/' + goM[1] : ''));
    if (q.get('topup')) { sessionStorage.setItem('nh_topup', q.get('topup')); history.replaceState(null, '', location.pathname + '#/patient/wallet'); }
    if (q.get('kyc')) history.replaceState(null, '', location.pathname + '#/kyc');
    if (q.get('paid')) { sessionStorage.setItem('nh_paid', q.get('paid')); history.replaceState(null, '', location.pathname + '#/patient/appointments'); }
    if (q.get('settle')) { sessionStorage.setItem('nh_settle', q.get('settle')); history.replaceState(null, '', location.pathname + '#/provider/earnings'); }
    render();
    setTimeout(() => sessionStorage.removeItem('nh_chunk_reload'), 10000);
    confirmCardPayment();
    if (state.user) { warmUp(); syncOutbox(); }
  });
  registerSW();
})();

/** After returning from a card checkout: the server verifies the payment with the gateway before marking it paid. */
async function confirmCardPayment() {
  const ref = sessionStorage.getItem('nh_paid');
  if (!ref || !state.user) return;
  for (let i = 0; i < 8; i++) {
    try { await post('/credits/purchase/confirm', { internalRef: ref }); sessionStorage.removeItem('nh_paid'); toast('✅ Payment successful'); render(); return; }
    catch (e) { if (e.status !== 402) { sessionStorage.removeItem('nh_paid'); toast('⚠️ ' + e.message); return; } await new Promise((r) => setTimeout(r, 3000)); }
  }
  toast('⏳ Payment is still confirming - it will update automatically');
}

export { esc, current };
