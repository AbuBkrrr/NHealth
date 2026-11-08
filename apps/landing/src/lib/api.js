// API client: token handling, timeouts, offline GET cache, uniform errors.
export const API_BASE = (import.meta.env.VITE_API_URL || 'https://n-health-backend-production.up.railway.app').replace(/\/$/, '');
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
  clear() { ls.set(TOKEN_KEY, null); ls.set(USER_KEY, null); try { Object.keys(localStorage).filter((k) => k.startsWith('nh_cache:')).forEach((k) => localStorage.removeItem(k)); } catch { /* */ } },
};

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function api(path, { method = 'GET', body, timeout = 30000, cache = method === 'GET', raw = false } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth.token) headers.Authorization = 'Bearer ' + auth.token;
  const cacheKey = 'nh_cache:' + path;
  try {
    const res = await fetch(API_BASE + '/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    if (raw) return res;
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
    if (res.status === 401 && auth.token && !path.startsWith('/auth/login')) { onUnauthorized(data?.error); }
    if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
    if (cache) ls.set(cacheKey, JSON.stringify({ at: Date.now(), data }));
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // Network failure: serve last known data for reads so the app stays usable offline.
    if (method === 'GET') {
      const hit = ls.get(cacheKey);
      if (hit) { try { const v = JSON.parse(hit).data; v && typeof v === 'object' && Object.defineProperty(v, '__offline', { value: true }); return v; } catch { /* */ } }
    }
    throw new ApiError(e.name === 'AbortError' ? 'The server took too long to respond. Check your connection.' : navigator.onLine ? 'Could not reach N-Health. Please try again.' : 'You are offline. Changes will work once you reconnect.', 0);
  } finally { clearTimeout(t); }
}

export const get = (p) => api(p);
export const post = (p, body = {}) => api(p, { method: 'POST', body });
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
