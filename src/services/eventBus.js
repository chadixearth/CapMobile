// Simple global event bus without external deps
// Usage: on('EVENT', cb), off('EVENT', cb), emit('EVENT', payload)

const listeners = {};

export function on(eventName, callback) {
  if (!listeners[eventName]) listeners[eventName] = new Set();
  listeners[eventName].add(callback);
  return () => off(eventName, callback);
}

export function off(eventName, callback) {
  const set = listeners[eventName];
  if (set) set.delete(callback);
}

export function emit(eventName, payload) {
  const set = listeners[eventName];
  if (!set) return;
  for (const cb of Array.from(set)) {
    try { cb(payload); } catch (e) { /* no-op */ }
  }
}

export const EVENTS = {
  SESSION_EXPIRED: 'SESSION_EXPIRED',
};
