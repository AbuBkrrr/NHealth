// Socket.io connection for live notifications, chat, emergency tracking.
import { io } from 'socket.io-client';
import { API_BASE, auth } from './api.js';
import { state, setState } from './store.js';
import { toast } from './ui.js';

let socket = null;
const bus = new EventTarget();
export const on = (evt, fn) => { const h = (e) => fn(e.detail); bus.addEventListener(evt, h); return () => bus.removeEventListener(evt, h); };
export const emit = (evt, data) => socket?.emit(evt, data);

const FORWARD = ['notification', 'message:new', 'message:read', 'message:typing', 'appointment:new', 'appointment:updated', 'emergency:new', 'emergency:claimed', 'emergency:accepted', 'emergency:status', 'emergency:cancelled', 'emergency:alert', 'ambulance:location', 'order:new', 'order:updated', 'labresult:new', 'prescription:new', 'payment:confirmed', 'payment:new', 'nurse:new', 'nurse:claimed', 'nurse:accepted'];

export function connect() {
  disconnect();
  if (!auth.token) return;
  socket = io(API_BASE, { auth: { token: auth.token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 10000 });
  FORWARD.forEach((evt) => socket.on(evt, (d) => bus.dispatchEvent(new CustomEvent(evt, { detail: d }))));
  socket.on('notification', (n) => {
    setState({ unread: (state.unread || 0) + 1 });
    if (!location.hash.includes('/notifications')) toast((n.type === 'emergency' ? '🚨 ' : '🔔 ') + n.title);
    if (n.type === 'emergency' && navigator.vibrate) navigator.vibrate([300, 100, 300]);
  });
}
export function disconnect() { if (socket) { socket.disconnect(); socket = null; } }
