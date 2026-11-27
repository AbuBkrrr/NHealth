// API client: token handling, timeouts, offline GET cache, uniform errors.
export const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.nhealth.com.ng').replace(/\/$/, '');
const TOKEN_KEY = 'nh_token';
const USER_KEY = 'nh_user';

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

export const auth = {
  get token() { return ls.get(TOKEN_KEY); },
  set token(v) { ls.set(TOKEN_KEY, v); },
  get user() { try { return JSON.parse(ls.get(USER_KEY) || 'null'); } catch { return null; } },
  set user(v) { ls.set(USER_KEY, v ? JSON.stringify(v) : null); },
  clear() { ls.set(TOKEN_KEY, null); ls.set(USER_KEY, null); ls.set('nh_outbox', null); mem.clear(); try { Object.keys(localStorage).filter((k) => k.startsWith('nh_cache:')).forEach((k) => localStorage.removeItem(k)); } catch { /* */ } },
};

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

// ---------------------------------------------------------------- read cache (fast on 2G, works offline)
// Every GET is kept (memory + localStorage). Opening a screen again shows the saved copy at once and
// refreshes it in the background; if the server has something newer, the screen redraws (see onFresh).
// After the user changes something (POST/PATCH/...) or a live update arrives, the next read goes to
// the network first so nobody sees out-of-date data after their own action.
const FRESH_MS = 20000; // a copy younger than this is used without asking the server again
const mem = new Map(); // path -> { at, mut, text }
let mutations = 0; // bumped by writes and live updates: the next read of each path goes to the network first
let onFresh = () => {};
export function setFreshHandler(fn) { onFresh = fn; }
/** Marks saved reads as out of date (after a write or a live update). */
export function invalidate() { mutations++; }

function readEntry(path) {
  let e = mem.get(path);
  if (!e) {
    const hit = ls.get('nh_cache:' + path);
    if (hit) { try { const v = JSON.parse(hit); e = { at: v.at, mut: mutations, text: JSON.stringify(v.data) }; mem.set(path, e); } catch { /* */ } }
  }
  return e;
}
function writeEntry(path, data) {
  const text = JSON.stringify(data);
  mem.set(path, { at: Date.now(), mut: mutations, text });
  try { localStorage.setItem('nh_cache:' + path, JSON.stringify({ at: Date.now(), data })); }
  catch { // storage full: drop the oldest half of the saved reads and try once more
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('nh_cache:')).map((k) => { try { return [k, JSON.parse(localStorage.getItem(k)).at || 0]; } catch { return [k, 0]; } }).sort((a, b) => a[1] - b[1]);
      keys.slice(0, Math.ceil(keys.length / 2)).forEach(([k]) => localStorage.removeItem(k));
      localStorage.setItem('nh_cache:' + path, JSON.stringify({ at: Date.now(), data }));
    } catch { /* memory copy still works */ }
  }
  return text;
}
const fromText = (text, offline) => { const v = JSON.parse(text); if (offline && v && typeof v === 'object') Object.defineProperty(v, '__offline', { value: true }); return v; };
export function clearReadCache() { mem.clear(); }
let tracker = () => {};
/** Lets the app learn which reads each screen makes, so it can fetch them ahead of time. */
export function setReadTracker(fn) { tracker = fn; }

const inflight = new Map(); // path -> Promise (one network read per path at a time)
async function network(path, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout);
  const headers = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth.token) headers.Authorization = 'Bearer ' + auth.token;
  try {
    const res = await fetch(API_BASE + '/api' + path, { method: opts.method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: ctrl.signal });
    if (opts.raw) return res;
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
    if (res.status === 401 && auth.token && !path.startsWith('/auth/login')) { onUnauthorized(data?.error); }
    if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const err = new ApiError(e.name === 'AbortError' ? 'The server took too long to respond. Check your connection.' : navigator.onLine ? 'Could not reach N-Health. Please try again.' : 'You are offline. This will work once you reconnect.', 0);
    err.network = true;
    throw err;
  } finally { clearTimeout(t); }
}
function readNetwork(path, opts) {
  if (!inflight.has(path)) inflight.set(path, network(path, opts).finally(() => inflight.delete(path)));
  return inflight.get(path);
}

export async function api(path, { method = 'GET', body, timeout = 30000, cache = method === 'GET', raw = false, queue = false, fresh = false } = {}) {
  const opts = { method, body, timeout, raw };
  if (method !== 'GET') {
    try {
      const r = await network(path, opts);
      invalidate();
      return r;
    } catch (e) {
      // Safe, repeatable writes (messages, reminders, notes) are kept and sent when the connection returns.
      if (queue && e.network) { enqueue(path, method, body); invalidate(); return { queued: true }; }
      throw e;
    }
  }
  if (raw || !cache) return network(path, opts);
  tracker(path);
  const e = readEntry(path);
  if (e && !fresh) {
    const offline = !navigator.onLine;
    const current = e.mut === mutations;
    if (offline) return fromText(e.text, true);
    if (current && Date.now() - e.at < FRESH_MS) return fromText(e.text);
    if (current) {
      // Show the saved copy now; refresh quietly and redraw only if something changed.
      readNetwork(path, opts).then((data) => { const text = JSON.stringify(data); if (text !== e.text) { writeEntry(path, data); onFresh(path); } else e.at = Date.now(); }).catch(() => null);
      return fromText(e.text);
    }
  }
  try {
    const data = await readNetwork(path, opts);
    writeEntry(path, data);
    return fromText(JSON.stringify(data));
  } catch (err) {
    if (err.network && e) return fromText(e.text, true); // offline or very slow: last saved copy (also for fresh reads)
    throw err;
  }
}

/** Fetches reads in the background so the next screens open instantly (no redraw). */
export function prefetch(paths) {
  if (!auth.token || !navigator.onLine || navigator.connection?.saveData) return;
  paths.forEach((p, i) => setTimeout(() => { const e = readEntry(p); if (!e || Date.now() - e.at > FRESH_MS) readNetwork(p, { method: 'GET', timeout: 30000 }).then((d) => writeEntry(p, d)).catch(() => null); }, 400 * i));
}

// ---------------------------------------------------------------- offline outbox
const OUTBOX = 'nh_outbox';
const readOutbox = () => { try { return JSON.parse(ls.get(OUTBOX) || '[]'); } catch { return []; } };
const listeners = new Set();
export const onOutbox = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((fn) => { try { fn(readOutbox()); } catch { /* */ } });
function enqueue(path, method, body) {
  const box = readOutbox();
  box.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), path, method, body, at: Date.now() });
  ls.set(OUTBOX, JSON.stringify(box));
  notify();
}
export const pendingWrites = () => readOutbox();
let flushing = false;
/** Sends queued writes in order. Returns how many were sent. */
export async function flushOutbox() {
  if (flushing || !navigator.onLine || !auth.token) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const w of readOutbox()) {
      try { await network(w.path, { method: w.method, body: w.body, timeout: 30000 }); }
      catch (e) { if (e.network) break; /* rejected by the server: drop it, it will never succeed */ }
      ls.set(OUTBOX, JSON.stringify(readOutbox().filter((x) => x.id !== w.id)));
      sent++;
    }
  } finally { flushing = false; }
  if (sent) { invalidate(); notify(); }
  return sent;
}

export const get = (p) => api(p);
/** Read that always asks the server first (live screens such as emergency tracking); saved copy only if offline. */
export const getFresh = (p) => api(p, { fresh: true });
export const post = (p, body = {}) => api(p, { method: 'POST', body });
/** POST that is kept and sent later if the phone is offline. Use only for writes that are safe to send late. */
export const postLater = (p, body = {}) => api(p, { method: 'POST', body, queue: true });
export const patch = (p, body = {}) => api(p, { method: 'PATCH', body });
export const put = (p, body = {}) => api(p, { method: 'PUT', body });
export const del = (p, body) => api(p, { method: 'DELETE', body });

/** Downloads an authenticated file (PDF receipts, data export). */
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  if (!res.ok) throw new ApiError('Download failed', res.status);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
