// Singleton SSE connection that keeps every open child session in sync.
//
// When Kelly has the app open on both her iPad and a second tab, any
// mutation on one device (earning coins, equipping a skin, buying an
// item, a parent-approved purchase, etc.) should instantly reflect on
// the other. This module opens one EventSource connection per app
// lifetime and dispatches events to subscribers.
//
// Event types the server emits on `child:<childId>`:
//   - state-changed  { scope, new_balance?, equipped_skin?, ... }
//   - action-resolved { action: { id, status, result, ... } }
//
// The module auto-handles the most universal updates (coin balance,
// equipped skin) by writing straight into state.js, so the header,
// character sprite, and anything else subscribed to state re-renders
// without the page code having to care.
//
// Pages can register their own listeners via onChildEvent(type, handler)
// to do page-specific refreshes (e.g., tasks.js reloads its task grid
// when scope === 'earn' so a second device sees completed tasks).

import { getChildId } from './api.js';
import { setState, getState } from './state.js';
import { updateCharacter } from './components/character.js';

let source = null;
let currentChild = null;
const handlers = new Map(); // type -> Set<handler>

function dispatch(type, data) {
  const set = handlers.get(type);
  if (set) set.forEach(fn => { try { fn(data); } catch (e) { console.error('state-sync handler error', e); } });
  const star = handlers.get('*');
  if (star) star.forEach(fn => { try { fn(data); } catch (e) { console.error('state-sync handler error', e); } });
}

/**
 * Start (or restart) the SSE connection for the current child. Safe to
 * call multiple times; it no-ops unless the child id has changed.
 */
export function initStateSync() {
  const childId = getChildId();
  if (!childId) return;
  if (source && currentChild === childId && source.readyState !== EventSource.CLOSED) return;

  closeStateSync();
  currentChild = childId;
  source = new EventSource(`/api/child-events?child=${encodeURIComponent(childId)}`);

  source.addEventListener('message', (e) => {
    let data;
    try { data = JSON.parse(e.data); } catch { return; }
    if (!data || !data.type) return;

    // ---- Built-in handlers: keep global state fresh automatically ----
    if (data.type === 'state-changed') {
      if (typeof data.new_balance === 'number') {
        setState({ coins: data.new_balance });
      }
      if (typeof data.new_level === 'number') {
        setState({ level: data.new_level });
      }
      if (data.scope === 'skin-equip' && data.equipped_skin) {
        setState({ equipped_skin: data.equipped_skin });
        try { updateCharacter(data.equipped_skin); } catch {}
      }
    }
    if (data.type === 'action-resolved' && data.action?.status === 'approved') {
      const nb = data.action.result?.new_balance;
      if (typeof nb === 'number') setState({ coins: nb });
    }

    // ---- Dispatch to any extra listeners registered by pages ----
    dispatch(data.type, data);
  });

  source.addEventListener('error', () => {
    // Browser automatically reconnects using the server's `retry:` hint.
    // Nothing to do here.
  });
}

/** Tear down the SSE connection (used on app teardown or child switch). */
export function closeStateSync() {
  if (source) {
    try { source.close(); } catch {}
    source = null;
  }
  currentChild = null;
}

/**
 * Register a listener for a specific event type. Use '*' to receive all
 * events. Returns an unsubscribe function.
 */
export function onChildEvent(type, handler) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(handler);
  return () => {
    const s = handlers.get(type);
    if (s) s.delete(handler);
  };
}
