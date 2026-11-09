// UI helpers that render the mockup's components (cards, list items, badges, app bar, modals, toasts).
import { state } from './store.js';
import { t } from './i18n.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Formatting (user's currency, locale & timezone) ----------
const SYMBOL = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', XOF: 'CFA', EGP: 'E£', UGX: 'USh', TZS: 'TSh', RWF: 'RF' };
export function money(amountNgn, { currency, convert = true } = {}) {
  const cur = currency || state.user?.currency || 'NGN';
  const rate = convert && cur !== 'NGN' ? state.config?.rates?.[cur] : 1;
  const v = Number(amountNgn || 0) * (rate || 1);
  try { return new Intl.NumberFormat(state.user?.locale || 'en-NG', { style: 'currency', currencyDisplay: 'narrowSymbol', currency: rate ? cur : 'NGN', maximumFractionDigits: v >= 1000 ? 0 : 2 }).format(v); }
  catch { return (SYMBOL[cur] || cur + ' ') + v.toLocaleString(); }
}
export const coins = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const tz = () => state.user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
export function dt(v, opts = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!v) return '';
  try { return new Intl.DateTimeFormat(state.user?.locale || undefined, { ...opts, timeZone: tz() }).format(new Date(v)); } catch { return new Date(v).toLocaleString(); }
}
export const dateOnly = (v) => dt(v, { dateStyle: 'medium' });
export const timeOnly = (v) => dt(v, { timeStyle: 'short' });
export function relDay(v) {
  const d = new Date(v), now = new Date();
  const k = (x) => new Intl.DateTimeFormat('en-CA', { timeZone: tz() }).format(x);
  if (k(d) === k(now)) return t('Today') + ', ' + timeOnly(v);
  if (k(d) === k(new Date(now.getTime() + 86400000))) return t('Tomorrow') + ', ' + timeOnly(v);
  if (k(d) === k(new Date(now.getTime() - 86400000))) return t('Yesterday') + ', ' + timeOnly(v);
  return dt(v);
}
export function ago(v) {
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return dateOnly(v);
}
export const initials = (n) => String(n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

// ---------- Components (mockup classes) ----------
export const AVATAR = { DOCTOR: 'doctor-avatar', NURSE: 'nurse-avatar', PHARMACY: 'pharmacy-avatar', LAB: 'lab-avatar', AMBULANCE: 'ambulance-avatar', INSTITUTION: 'institution-avatar', ADMIN: 'admin-avatar' };
export const ICON = { PATIENT: '👤', DOCTOR: '👨‍⚕️', NURSE: '👩‍⚕️', PHARMACY: '💊', LAB: '🔬', AMBULANCE: '🚑', INSTITUTION: '🏥', ADMIN: '🛡️' };

export function avatar(role, url, fallback) {
  const cls = AVATAR[role] || '';
  if (url) return `<div class="avatar ${cls}" style="padding:0;overflow:hidden"><img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>`;
  return `<div class="avatar ${cls}">${fallback ?? ICON[role] ?? '👤'}</div>`;
}
export function item({ icon, avatarHtml, title, sub, trailing = '', attrs = '', cls = '' }) {
  return `<div class="list-item ${cls}" ${attrs} tabindex="0">${avatarHtml || `<div class="avatar">${icon || '•'}</div>`}<div class="content"><div class="title">${title}</div>${sub ? `<div class="subtitle">${sub}</div>` : ''}</div>${trailing ? `<div class="trailing">${trailing}</div>` : ''}</div>`;
}
export const card = (inner, extra = '') => `<div class="card" ${extra}>${inner}</div>`;
export const cardHead = (title, right = '') => `<div class="card-header"><span class="card-title">${title}</span>${right}</div>`;
export const empty = (icon, text, action = '') => `<div class="empty"><span class="icon">${icon}</span>${esc(text)}${action ? `<div class="mt8">${action}</div>` : ''}</div>`;
export const skeleton = (n = 3) => Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');

const STATUS = {
  PENDING: 'warning', REQUESTED: 'warning', CONFIRMED: 'success', ACCEPTED: 'success', ACTIVE: 'success', COMPLETED: 'primary', DELIVERED: 'primary',
  CANCELLED: 'error', DECLINED: 'error', REJECTED: 'error', FAILED: 'error', EXPIRED: 'error', IN_PROGRESS: 'primary', PROCESSING: 'primary', EN_ROUTE: 'warning',
  ARRIVED: 'success', READY: 'success', OUT_FOR_DELIVERY: 'warning', SAMPLE_COLLECTED: 'primary', PAID: 'success', UNPAID: 'warning', VERIFIED: 'verified',
  ADMITTED: 'warning', DISCHARGED: 'primary', OUTPATIENT: 'primary', INVITED: 'warning', SCHEDULED: 'primary', PENDING_REVIEW: 'warning', APPROVED: 'success', IN_REVIEW: 'warning',
};
export const badge = (s, label) => `<span class="badge badge-${STATUS[String(s).toUpperCase()] || 'primary'}">${esc(label || String(s).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))}</span>`;
export const verifiedBadge = (v) => (v ? '<span class="badge badge-verified">✓ Verified</span>' : '');

export function statusBar() {
  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date());
  return `<div class="status-bar"><span>${time}</span><span>${navigator.onLine ? '📶' : '<span class="net-off">⚠ Offline</span>'}</span></div>`;
}
/** Mockup app bar. `back` = route to go back to (or true for history back). */
export function appBar({ title, back, roleCls = '', actions = '', danger = false }) {
  const style = danger ? 'style="background:var(--emergency-red);color:white;"' : '';
  const left = back ? `<button class="back" data-back="${back === true ? '' : esc(back)}" aria-label="Back" ${danger ? 'style="color:white"' : ''}>←</button>` : '';
  const unread = state.unread > 0 ? `<span class="count">${state.unread > 99 ? '99+' : state.unread}</span>` : '';
  const defaultActions = `<button class="bell" data-go="/notifications" aria-label="Notifications">🔔${unread}</button><button data-go="/profile" aria-label="Profile">👤</button>`;
  return `${statusBar()}<div class="app-bar" ${style}>${left}<div class="title ${roleCls}" ${danger ? 'style="color:white"' : ''}>${title}</div><div class="app-bar-actions">${actions === null ? '' : actions || defaultActions}</div></div>`;
}
export const brandTitle = () => 'N-<span>Health</span>';

export function tabs(list, active, attr = 'data-tab') {
  return `<div class="tab-container">${list.map(([k, label]) => `<div class="tab ${k === active ? 'active' : ''}" ${attr}="${k}" tabindex="0">${label}</div>`).join('')}</div>`;
}

// ---------- Toast & modal ----------
export function toast(msg, ms = 2800) {
  const host = $('#toast-host');
  const el = document.createElement('div');
  el.className = 'toast-notification';
  el.textContent = msg;
  host.innerHTML = '';
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
export const toastErr = (e) => toast('⚠️ ' + (e?.message || 'Something went wrong'));

let modalClose = null;
export function modal(html, onMount) {
  const ov = $('#modal');
  const box = ov.querySelector('.modal-content');
  box.innerHTML = `<button class="close-btn" aria-label="Close" data-close>✕</button>${html}`;
  ov.classList.add('active');
  const close = () => { ov.classList.remove('active'); box.innerHTML = ''; modalClose = null; };
  modalClose = close;
  box.querySelector('[data-close]').onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  onMount?.(box, close);
  return close;
}
export const closeModal = () => modalClose?.();

export function confirmBox(message, { ok = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    modal(`<div class="modal-title">${esc(message)}</div><div class="row mt12"><button class="btn btn-outline grow" data-no>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'} grow" data-yes>${esc(ok)}</button></div>`, (box, close) => {
      box.querySelector('[data-no]').onclick = () => { close(); resolve(false); };
      box.querySelector('[data-yes]').onclick = () => { close(); resolve(true); };
    });
  });
}

/**
 * Renders a form inside a modal. fields: [{name,label,type,options,value,required,placeholder,hint}]
 * Resolves with the values object, or null if cancelled. `onSubmit` may throw to keep the modal open.
 */
export function formModal(title, fields, { submit = 'Save', onSubmit, intro = '' } = {}) {
  return new Promise((resolve) => {
    const body = fields.map(field).join('');
    modal(`<div class="modal-title">${title}</div>${intro}<form novalidate>${body}<button class="btn btn-primary btn-block mt8" type="submit">${esc(submit)}</button></form>`, (box, close) => {
      const form = box.querySelector('form');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const vals = readForm(form);
        const missing = fields.find((f) => f.required && (vals[f.name] === '' || vals[f.name] == null));
        if (missing) return toast('⚠️ ' + (missing.label || missing.name) + ' is required');
        const btn = form.querySelector('[type=submit]');
        try { btn.disabled = true; btn.textContent = 'Please wait…'; if (onSubmit) await onSubmit(vals); close(); resolve(vals); }
        catch (err) { toastErr(err); btn.disabled = false; btn.textContent = submit; }
      };
    });
  });
}
export function field(f) {
  const id = 'f_' + f.name;
  const req = f.required ? ' <span style="color:var(--error)">*</span>' : '';
  const v = f.value ?? '';
  let input;
  if (f.type === 'select') input = `<select id="${id}" name="${f.name}">${(f.options || []).map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
  else if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  else if (f.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> <span>${f.label}</span></label>`;
  else if (f.type === 'password') input = `<div class="pw-wrap"><input id="${id}" name="${f.name}" type="password" autocomplete="${f.autocomplete || 'current-password'}" placeholder="${esc(f.placeholder || '')}" value="${esc(v)}"><button type="button" data-pw aria-label="Show password">👁</button></div>`;
  else input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" ${f.step ? `step="${f.step}"` : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} placeholder="${esc(f.placeholder || '')}" value="${esc(v)}" ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''} ${f.inputmode ? `inputmode="${f.inputmode}"` : ''}>`;
  return `<div class="form-group"><label for="${id}">${f.label}${req}</label>${input}${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</div>`;
}
export function readForm(form) {
  const out = {};
  $$('input,select,textarea', form).forEach((el) => {
    if (!el.name) return;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'number') out[el.name] = el.value === '' ? '' : Number(el.value);
    else if (el.type === 'file') return;
    else out[el.name] = el.value.trim();
  });
  return out;
}
// Password reveal (delegated)
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pw]');
  if (!b) return;
  const i = b.parentElement.querySelector('input');
  i.type = i.type === 'password' ? 'text' : 'password';
});

// ---------- Files ----------
/** Reads a file to a data URI; images are downscaled & re-encoded (saves data on mobile networks). */
export function fileToDataUri(file, { maxDim = 1600, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('video/') && file.size > 25 * 1024 * 1024) return reject(new Error('Videos must be under 25MB (about 30 seconds)'));
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && file.size > 10 * 1024 * 1024) return reject(new Error('Files must be under 10MB'));
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read file'));
    r.onload = () => {
      if (!file.type.startsWith('image/') || file.type === 'image/gif') return resolve(r.result);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(r.result);
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
export function pickFile(accept = 'image/*') {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.onchange = () => resolve(i.files?.[0] || null);
    i.click();
  });
}

/** Wires a button to an async action with a busy state and error toast. */
export async function busy(btn, fn) {
  if (btn?.disabled) return;
  const label = btn?.innerHTML;
  try { if (btn) { btn.disabled = true; btn.innerHTML = '⏳'; } return await fn(); }
  catch (e) { toastErr(e); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
}

/** Gets the device position (with a friendly error). */
export function locate({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported on this device'));
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission denied - enable it in your browser settings' : 'Could not get your location')),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 });
  });
}
