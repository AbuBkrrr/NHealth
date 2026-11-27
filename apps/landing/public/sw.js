/* N-Health service worker: opens instantly and works offline (2G friendly) + web push.
 * - The app (HTML, scripts, styles, icons) is saved on the phone at install and served from there first;
 *   a newer version is downloaded quietly by the next worker and used the next time the app opens.
 * - API data is saved by the app itself (src/lib/api.js), so screens open with the last known data offline.
 * The build fills in __PRECACHE__ with every built file and a version (see vite.config.js). */
const MANIFEST = self.__PRECACHE__;
const SHELL = 'nhealth-shell';   // index.html (always the latest downloaded)
const ASSETS = 'nhealth-assets'; // hashed files: kept for this and the previous version so open pages keep working
const PREV = '/__nh_prev_manifest';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const assets = await caches.open(ASSETS);
    // Only download files we do not have yet (hashed names never change content).
    const missing = [];
    for (const f of MANIFEST.files) if (!(await assets.match(f))) missing.push(f);
    await Promise.all(missing.map((f) => fetch(f, { cache: 'no-cache' }).then((r) => (r.ok ? assets.put(f, r) : null)).catch(() => null)));
    const shell = await caches.open(SHELL);
    const html = await fetch('/index.html', { cache: 'no-cache' }).catch(() => null);
    if (html && html.ok) await shell.put('/index.html', html);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Drop caches from older worker versions, and asset files that neither this nor the previous version uses.
    await Promise.all((await caches.keys()).filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)));
    const assets = await caches.open(ASSETS);
    const prevRes = await assets.match(PREV);
    const prev = prevRes ? await prevRes.json().catch(() => ({ files: [] })) : { files: [] };
    if (prev.version !== MANIFEST.version) {
      const keep = new Set([...MANIFEST.files, ...prev.files, PREV]);
      for (const req of await assets.keys()) { if (!keep.has(new URL(req.url).pathname)) await assets.delete(req); }
      await assets.put(PREV, new Response(JSON.stringify(MANIFEST), { headers: { 'Content-Type': 'application/json' } }));
    }
    await self.clients.claim();
  })());
});

async function freshShell() {
  const res = await fetch('/index.html', { cache: 'no-cache' });
  if (res.ok) await (await caches.open(SHELL)).put('/index.html', res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API & third parties: handled by the app
  if (req.mode === 'navigate') {
    // Saved app first (instant on 2G / offline). A new version arrives as a new worker (the browser
    // checks /sw.js), which saves the new page and its files together, so they always match.
    e.respondWith((async () => {
      const cached = await caches.match('/index.html', { cacheName: SHELL });
      if (cached) return cached;
      try { return await freshShell(); } catch { return new Response('<h1>Offline</h1><p>Open N-Health once while online to use it offline.</p>', { headers: { 'Content-Type': 'text/html' } }); }
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    e.respondWith((async () => {
      const hit = await caches.match(req, { cacheName: ASSETS });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { const copy = res.clone(); e.waitUntil(caches.open(ASSETS).then((c) => c.put(req, copy))); }
      return res;
    })());
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'N-Health', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'N-Health', {
    body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: d.data || {}, tag: d.type || 'nhealth',
    vibrate: d.type === 'emergency' ? [300, 100, 300, 100, 300] : [100],
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.postMessage({ type: 'open-notifications' }); return c.focus(); } }
    return self.clients.openWindow('/#/notifications');
  }));
});
