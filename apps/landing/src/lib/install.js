// "Install N-Health" prompt, shown on every visit until the app is installed on this device.
// - Android / desktop Chrome, Edge, Samsung Internet, Opera: one-tap Install (the browser's own prompt).
// - iPhone / iPad: Safari, Chrome and others can't install from a button, so we show the two taps (Share -> Add to Home Screen).
// - WhatsApp, Instagram, Facebook, TikTok... in-app browsers can't install at all: we ask to open the page in the real browser.
// - Firefox, older browsers and desktop: short instructions for that browser.
// "Not now" hides it until the next visit (this browser session only).
import { logo } from './ui.js';

const KEY_DONE = 'nh_installed';
const KEY_LATER = 'nh_install_later';
let deferred = null;
let shown = false;

const ua = navigator.userAgent || '';
const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(ua);
const inApp = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|TikTok|musical_ly|Snapchat|Line\/|Twitter|LinkedInApp|GSA\/|; wv\)/i.test(ua);
const browser = /SamsungBrowser/i.test(ua) ? 'samsung' : /EdgA?|Edg\//i.test(ua) ? 'edge' : /OPR\/|Opera/i.test(ua) ? 'opera'
  : /FxiOS|Firefox/i.test(ua) ? 'firefox' : /CriOS|Chrome/i.test(ua) ? 'chrome' : /Safari/i.test(ua) ? 'safari' : 'other';

export const isInstalled = () => {
  if (window.Capacitor?.isNativePlatform?.()) return true; // inside the App Store / Play Store app
  try { if (localStorage.getItem(KEY_DONE)) return true; } catch { /* */ }
  return window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: minimal-ui)').matches || navigator.standalone === true;
};
const later = () => { try { return sessionStorage.getItem(KEY_LATER); } catch { return null; } };
// Never cover an emergency, a call or a payment.
const quietRoute = () => /^#\/(patient\/emergency|ambulance|institution\/er|chat\/|book\/|patient\/wallet|e\/)/.test(location.hash);

const SHARE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

function content() {
  if (inApp) {
    const intent = isAndroid ? `intent://${location.host}${location.pathname}${location.search}${location.hash}#Intent;scheme=https;package=com.android.chrome;end` : '';
    return {
      text: `Open this page in ${isIOS ? 'Safari' : 'Chrome'} to install N-Health on your phone.`,
      steps: isIOS ? 'Tap <b>•••</b> or the compass icon, then <b>Open in Safari</b>.' : 'Tap <b>⋮</b>, then <b>Open in Chrome</b> (or your browser).',
      action: intent ? `<a class="btn btn-primary btn-sm" href="${intent}">Open in Chrome</a>` : '<button class="btn btn-primary btn-sm" data-ins="copy">Copy link</button>',
    };
  }
  if (deferred) return { text: 'Install N-Health for faster access, offline use and alerts.', action: '<button class="btn btn-primary btn-sm" data-ins="go">Install</button>' };
  if (isIOS) return {
    text: 'Add N-Health to your Home Screen: it opens like an app, works offline and sends alerts.',
    steps: browser === 'safari' || browser === 'other'
      ? `Tap ${SHARE_ICON} <b>Share</b> below, then <b>Add to Home Screen</b>.`
      : `Tap ${SHARE_ICON} <b>Share</b> (top or bottom of the screen), then <b>Add to Home Screen</b>. If you don't see it, open this page in Safari.`,
  };
  if (isAndroid) return {
    text: 'Install N-Health on your phone: it opens like an app and works offline.',
    steps: browser === 'samsung' ? 'Tap <b>≡</b> menu, then <b>Add page to</b> → <b>Home screen</b>.'
      : browser === 'firefox' ? 'Tap <b>⋮</b>, then <b>Install</b> (or <b>Add to Home screen</b>).'
        : 'Tap <b>⋮</b> menu, then <b>Install app</b> or <b>Add to Home screen</b>.',
  };
  return {
    text: 'Install N-Health on this computer for quick access.',
    steps: browser === 'safari' ? 'In the menu bar choose <b>File</b> → <b>Add to Dock</b>.'
      : browser === 'firefox' ? 'Firefox on computers can\'t install apps: open this page in Chrome or Edge, or install it on your phone.'
        : 'Click the install icon at the right of the address bar, or <b>⋮</b> → <b>Install N-Health</b>.',
  };
}

function hide() { document.getElementById('install-banner')?.remove(); document.body.classList.remove('has-install'); shown = false; }

function show() {
  if (isInstalled() || later() || quietRoute()) return hide();
  const c = content();
  let b = document.getElementById('install-banner');
  if (!b) { b = document.createElement('div'); b.id = 'install-banner'; b.className = 'install-banner'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Install N-Health'); document.body.appendChild(b); }
  b.innerHTML = `<div class="ib-row">${logo(44)}<div class="ib-text"><b>Get the N-Health app</b><div>${c.text}</div>${c.steps ? `<div class="ib-steps">${c.steps}</div>` : ''}</div><button class="ib-x" data-ins="later" aria-label="Not now">×</button></div>
    <div class="ib-actions"><button class="btn btn-outline btn-sm" data-ins="later">Not now</button>${c.action || ''}</div>`;
  // Sit just above the bottom menu (or the screen edge when there is none), and let the page scroll clear of it.
  b.style.bottom = document.querySelector('#nav-host nav') ? '' : 'calc(12px + env(safe-area-inset-bottom))';
  document.body.classList.add('has-install');
  shown = true;
}

export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; if (shown || !isInstalled()) show(); });
  window.addEventListener('appinstalled', () => { try { localStorage.setItem(KEY_DONE, '1'); } catch { /* */ } deferred = null; hide(); });
  // Opened from the Home Screen: remember, so the browser tab doesn't keep asking.
  if (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true) { try { localStorage.setItem(KEY_DONE, '1'); } catch { /* */ } return; }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ins]');
    if (!b) return;
    const a = b.dataset.ins;
    if (a === 'later') { try { sessionStorage.setItem(KEY_LATER, '1'); } catch { /* */ } hide(); }
    if (a === 'go' && deferred) {
      const d = deferred; deferred = null;
      d.prompt();
      const r = await d.userChoice.catch(() => null);
      if (r?.outcome === 'accepted') { try { localStorage.setItem(KEY_DONE, '1'); } catch { /* */ } hide(); } else show();
    }
    if (a === 'copy') { try { await navigator.clipboard.writeText(location.href); b.textContent = 'Copied ✓'; } catch { prompt('Copy this link and open it in your browser', location.href); } }
  });
  window.addEventListener('hashchange', () => setTimeout(() => (quietRoute() ? hide() : show()), 600));
  // A moment after the app opens, so it never covers the first screen while it loads.
  setTimeout(show, 2500);
}
