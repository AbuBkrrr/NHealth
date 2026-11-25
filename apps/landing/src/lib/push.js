// Service worker registration + web push subscription.
import { post } from './api.js';
import { state } from './store.js';

export async function registerSW() {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost' && !import.meta.env.PROD) return null;
  try { return await navigator.serviceWorker.register('/sw.js'); } catch { return null; }
}
const b64ToU8 = (b) => { const p = '='.repeat((4 - (b.length % 4)) % 4); const s = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...s].map((c) => c.charCodeAt(0))); };

export async function enablePush() {
  const key = state.config?.vapidPublicKey;
  if (!key || !('PushManager' in window)) throw new Error('Push notifications are not available on this device');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications permission was not granted');
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerSW());
  if (!reg) throw new Error('Could not register the background worker');
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) }));
  await post('/push/subscribe', sub.toJSON());
  return true;
}
