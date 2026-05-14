// Web Push + SSE — two ways to notify the parent dashboard of new events.
//
// The SSE hub is in-memory (no persistence). It streams to any parent
// client that holds an open connection. We use it for instant updates
// when the parent is actively looking at the dashboard.
//
// Web Push goes through the browser's APNs bridge on iOS and is what wakes
// the device when the parent PWA is closed or the phone is locked.
//
// VAPID keys live in scripts/vapid-keys.json (one per install). The keys
// never get committed because the repo isn't a git project — if you rotate,
// all existing subscriptions become invalid and parents need to re-subscribe.

const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const db = require('./db/database');

const VAPID_PATH = path.join(__dirname, '..', 'scripts', 'vapid-keys.json.tmp');
let vapid = null;

function loadVapid() {
  if (vapid) return vapid;
  try {
    vapid = JSON.parse(fs.readFileSync(VAPID_PATH, 'utf8'));
  } catch (e) {
    console.error('[push] VAPID keys not found at', VAPID_PATH, '- generating a new pair');
    vapid = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_PATH, JSON.stringify(vapid, null, 2));
  }
  // NOTE: Apple Push Service (web.push.apple.com) is strict about the VAPID
  // `sub` claim — it rejects mailto URLs without a valid TLD with 403
  // BadJwtToken, silently dropping the push. Chrome and Firefox ignore the
  // specific value, but Safari/iOS does not. Always use a real-looking
  // mailto or an https URL here.
  webpush.setVapidDetails(
    'mailto:kelly-coins@example.com',
    vapid.publicKey,
    vapid.privateKey,
  );
  return vapid;
}

function getPublicKey() {
  return loadVapid().publicKey;
}

/**
 * Send a push to every parent device that has an active session.
 * Dead subscriptions (410 Gone) are cleaned up automatically.
 */
async function sendToParents(payload) {
  loadVapid();
  const subs = db.getParentPushSubscriptions();
  if (subs.length === 0) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;
  await Promise.all(subs.map(async (sub) => {
    const subscription = { endpoint: sub.endpoint, keys: sub.keys };
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      sent++;
    } catch (err) {
      if (err && (err.statusCode === 410 || err.statusCode === 404)) {
        db.removePushSubscription(sub.endpoint);
        removed++;
      } else {
        console.error('[push] send failed', sub.endpoint.slice(0, 40), err.statusCode || err.message);
      }
    }
  }));
  return { sent, removed };
}

// ---------- SSE hub ----------
// Maintains a list of open response streams per channel and broadcasts
// JSON events to them. No retention; late subscribers don't see past events.

const channels = new Map(); // channel name -> Set<res>

function subscribe(channel, res) {
  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel).add(res);
  res.on('close', () => {
    const s = channels.get(channel);
    if (s) s.delete(res);
  });
}

function broadcast(channel, event) {
  const s = channels.get(channel);
  if (!s || s.size === 0) return 0;
  const serialized = `data: ${JSON.stringify(event)}\n\n`;
  let delivered = 0;
  for (const res of s) {
    try {
      res.write(serialized);
      delivered++;
    } catch (e) {
      s.delete(res);
    }
  }
  return delivered;
}

/** Set up response headers + keep-alive pings for an SSE stream. */
function openSseStream(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx + other proxies
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  // Heartbeat every 25s to keep the connection alive through proxies.
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 25_000);
  req.on('close', () => clearInterval(heartbeat));
}

/**
 * Shortcut: broadcast a state change to all open sessions of a specific
 * child. Used by mutation routes (earn coins, equip skin, buy skin, etc.)
 * so every tab/device currently viewing that child refreshes in real time.
 */
function broadcastChild(childId, event) {
  return broadcast(`child:${childId}`, event);
}

module.exports = {
  getPublicKey,
  sendToParents,
  subscribe,
  broadcast,
  broadcastChild,
  openSseStream,
};
