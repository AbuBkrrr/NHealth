// Socket.io connection for live notifications, chat, emergency tracking.
import { API_BASE, auth, invalidate } from './api.js';
import { state, setState } from './store.js';
import { toast } from './ui.js';

let socket = null;
const bus = new EventTarget();
export const on = (evt, fn) => { const h = (e) => fn(e.detail); bus.addEventListener(evt, h); return () => bus.removeEventListener(evt, h); };
export const emit = (evt, data) => socket?.emit(evt, data);

const FORWARD = ['notification', 'message:new', 'message:read', 'message:typing', 'appointment:new', 'appointment:updated', 'emergency:new', 'emergency:claimed', 'emergency:accepted', 'emergency:status', 'emergency:cancelled', 'emergency:alert', 'ambulance:location', 'order:new', 'order:updated', 'labresult:new', 'prescription:new', 'payment:confirmed', 'payment:new', 'nurse:new', 'nurse:claimed', 'nurse:accepted', 'er:new', 'er:updated', 'er:location'];

// Live updates that change what screens show: saved reads are refreshed on next use.
const QUIET = new Set(['message:typing', 'ambulance:location', 'er:location']);
let attempt = 0;
export async function connect() {
  disconnect();
  if (!auth.token) return;
  const my = ++attempt;
  let io;
  try { ({ io } = await import('socket.io-client')); } catch { return; } // loaded after the first screen; retried when back online
  if (my !== attempt || !auth.token) return;
  socket = io(API_BASE, { auth: { token: auth.token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 10000 });
  FORWARD.forEach((evt) => socket.on(evt, (d) => { if (!QUIET.has(evt)) invalidate(); bus.dispatchEvent(new CustomEvent(evt, { detail: d })); }));
  socket.on('notification', (n) => {
    setState({ unread: (state.unread || 0) + 1 });
    if (!location.hash.includes('/notifications')) toast((n.type === 'emergency' ? '🚨 ' : '🔔 ') + n.title);
    if (n.type === 'emergency' && navigator.vibrate) navigator.vibrate([300, 100, 300]);
  });
}
export function disconnect() { attempt++; if (socket) { socket.disconnect(); socket = null; } }
