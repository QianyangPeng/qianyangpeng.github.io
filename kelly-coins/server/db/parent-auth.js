// Parent authentication — thin wrapper around database.js session helpers.
//
// Responsibilities:
//   - Combine the existing PIN verification (verifyParentPin) with per-device
//     session tokens stored in data.parent_sessions.
//   - Expose an Express middleware requireParent(req, res, next) that gates
//     parent-only endpoints. Accepts Authorization: Bearer <token> or
//     ?token=<token> for SSE where headers aren't available.
//
// The PIN itself still lives in data.parent_settings.pin_hash managed by
// database.js (hashPin / setParentPin / verifyParentPin / hasParentPin).

const crypto = require('crypto');
const db = require('./database');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ---------- Setup / login ----------

function isConfigured() {
  return db.hasParentPin();
}

/** First-time PIN setup — only allowed if no PIN is already set. */
function setupPin(pin) {
  if (db.hasParentPin()) return { ok: false, error: 'already_configured' };
  if (!pin || String(pin).length < 4) return { ok: false, error: 'pin_too_short' };
  db.setParentPin(pin);
  return { ok: true };
}

/** Verify PIN and issue a per-device session token. */
function login(pin, { deviceId, deviceName } = {}) {
  if (!db.hasParentPin()) return { ok: false, error: 'not_configured' };
  if (!db.verifyParentPin(pin)) return { ok: false, error: 'invalid_pin' };
  const token = generateToken();
  db.createParentSession(token, { deviceId, deviceName });
  return { ok: true, token, expires_in: 30 * 24 * 60 * 60 * 1000 };
}

/** Invalidate the session AND drop any push subscriptions it created. */
function logout(token) {
  if (!token) return { ok: false, error: 'missing_token' };
  db.removePushSubscriptionsByToken(token);
  const removed = db.deleteParentSession(token);
  return removed ? { ok: true } : { ok: false, error: 'no_such_session' };
}

/** Resolve a token to its session record, or null if invalid/expired. */
function verifySession(token) {
  return db.getParentSession(token);
}

// ---------- Express middleware ----------

function extractToken(req) {
  // Support three styles so existing callers keep working:
  //   - X-Parent-Token header (legacy client code in parent/js/api.js)
  //   - Authorization: Bearer (standard)
  //   - ?token=… query param (only way to auth an EventSource stream)
  const xParent = req.headers['x-parent-token'];
  if (xParent) return xParent;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  if (req.query && req.query.token) return req.query.token;
  return null;
}

function requireParent(req, res, next) {
  const token = extractToken(req);
  const session = verifySession(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      requires_pin: true,
    });
  }
  req.parentSession = session;
  req.parentToken = token;
  next();
}

module.exports = {
  isConfigured,
  setupPin,
  login,
  logout,
  verifySession,
  requireParent,
};
