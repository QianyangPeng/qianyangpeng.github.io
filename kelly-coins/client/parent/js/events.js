/**
 * Parent SSE event stream — real-time updates while the dashboard is open.
 *
 * Supplements Web Push: web push wakes the device when the PWA is closed,
 * this keeps the UI fresh while the parent is actively looking at the page
 * (no push permission required, works the instant login succeeds).
 *
 * Subscribers register with onEvent(type, handler) and get { type, ...payload }
 * for every matching server event. Events currently emitted:
 *   - hello              (connection established)
 *   - action-created     (new pending_action needs approval)
 *   - action-approved    (any parent approved one)
 *   - action-rejected    (any parent rejected one)
 *   - action-cancelled   (the child withdrew their own request)
 */

import { getToken } from './api.js';

let source = null;
const handlers = new Map(); // event type -> Set<handler>

/** Open the SSE stream. Call after successful auth. Safe to call twice. */
export function openStream() {
  if (source && source.readyState !== EventSource.CLOSED) return;
  const token = getToken();
  if (!token) return;
  // EventSource can't set custom headers, so the token goes in the query.
  // server/routes/approvals.js reads it via extractToken() → req.query.token.
  source = new EventSource(`/api/parent/events?token=${encodeURIComponent(token)}`);

  source.addEventListener('message', (e) => {
    let data;
    try { data = JSON.parse(e.data); } catch { return; }
    if (!data || !data.type) return;
    const set = handlers.get(data.type);
    if (set) set.forEach(fn => { try { fn(data); } catch (err) { console.error('sse handler error', err); } });
    const allSet = handlers.get('*');
    if (allSet) allSet.forEach(fn => { try { fn(data); } catch (err) { console.error('sse handler error', err); } });
  });

  source.addEventListener('error', () => {
    // Browser auto-reconnects with the `retry:` hint from the server.
    // Nothing to do here unless we want to surface a "connection lost" UI.
  });
}

export function closeStream() {
  if (source) {
    try { source.close(); } catch {}
    source = null;
  }
}

/**
 * Register a listener. `type` is an event name like 'action-created', or
 * '*' to receive every event. Returns an unsubscribe function.
 */
export function onEvent(type, handler) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(handler);
  return () => {
    const set = handlers.get(type);
    if (set) set.delete(handler);
  };
}
