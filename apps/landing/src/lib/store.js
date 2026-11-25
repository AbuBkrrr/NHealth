// Tiny global state with subscribe().
const listeners = new Set();
export const state = { user: null, config: null, unread: 0, balance: null, online: typeof navigator !== 'undefined' ? navigator.onLine : true };
export function setState(patch) { Object.assign(state, patch); listeners.forEach((fn) => fn(state, patch)); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
