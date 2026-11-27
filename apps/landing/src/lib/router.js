// Hash router. Routes: '/patient/home', '/chat/:id'. Screens receive (el, params, query) and may return a cleanup fn.
import { state } from './store.js';
import { toastErr, $ } from './ui.js';

const routes = [];
let cleanup = null;
let renderNav = () => {};
export function onNav(fn) { renderNav = fn; }

export function route(pattern, screen, { roles, public: isPublic = false, nav = true } = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ pattern, re, keys, screen, roles, isPublic, nav });
}

export const current = () => (location.hash.slice(1) || '/').split('?')[0];
let depth = 0;
export function go(path, { replace = false } = {}) {
  const h = '#' + path;
  if (location.hash === h) return render();
  if (replace) history.replaceState({ d: depth }, '', h); else { depth++; history.pushState({ d: depth }, '', h); }
  render();
}
/** Goes back inside the app; falls back to a route when there is no in-app history (deep link). */
export function back(fallback) {
  if (depth > 0) { depth--; history.back(); }
  else go(fallback || home(), { replace: true });
}
export function home(role = state.user?.role) {
  return { PATIENT: '/patient/home', DOCTOR: '/doctor/home', PHARMACY: '/pharmacy/home', LAB: '/lab/home', NURSE: '/nurse/home', AMBULANCE: '/ambulance/home', INSTITUTION: '/institution/home', ADMIN: '/admin' }[role] || '/auth';
}

let seq = 0;
let pattern = null;
let touched = false; // the person has tapped or typed since this screen opened
['click', 'keydown', 'input', 'change'].forEach((ev) => document.addEventListener(ev, () => { touched = true; }, { capture: true, passive: true }));
/** Route pattern of the open screen, e.g. '/patient/home'. */
export const currentPattern = () => pattern;

// Screens that keep their own live state (maps, chats, payments, forms): never redrawn underneath the person.
const NO_AUTO_REFRESH = /^\/(book|patient\/emergency|patient\/wallet|ambulance|kyc|pharmacy\/pos|pharmacy\/intake|settings|support|go)/;
/** Redraws the open screen with newer data, unless the person is using it. */
export function softRefresh() {
  if (touched || document.hidden || document.getElementById('modal')?.classList.contains('active')) return;
  if (NO_AUTO_REFRESH.test(current())) return;
  render({ soft: true });
}

export async function render({ soft = false } = {}) {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  let match = null, params = {};
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) { match = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; }
  }
  if (!state.user && (!match || !match.isPublic)) return go('/auth', { replace: true });
  if (state.user && (!match || path === '/' || path === '/auth')) return go(home(), { replace: true });
  if (match.roles && !match.roles.includes(state.user.role)) return go(home(), { replace: true });

  const my = ++seq;
  pattern = match.pattern;
  touched = false;
  const keepScroll = soft ? $('#app .screen')?.scrollTop || 0 : 0;
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* */ } }
  cleanup = null;
  const app = $('#app');
  const el = document.createElement('div');
  el.className = 'screen active';
  app.replaceChildren(el);
  document.body.dataset.side = state.user && state.user.role !== 'PATIENT' ? 'provider' : 'patient';
  renderNav(match.nav && state.user ? path : null);
  try {
    const c = await match.screen(el, params, query);
    if (my !== seq) { if (typeof c === 'function') c(); return; }
    cleanup = c;
  } catch (e) {
    console.error(e);
    if (my === seq) { el.innerHTML += `<div class="empty"><span class="icon">⚠️</span>${e?.message || 'Could not load this screen'}<div class="mt8"><button class="btn btn-outline btn-sm" onclick="location.reload()">Retry</button></div></div>`; toastErr(e); }
  }
  el.scrollTop = keepScroll;
  if (keepScroll) requestAnimationFrame(() => { el.scrollTop = keepScroll; });
}
window.addEventListener('popstate', render);
