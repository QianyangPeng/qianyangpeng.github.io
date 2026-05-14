// Approval flow routes: auth, pending actions, SSE, Web Push subscriptions.
//
// Flow:
//   1. Child calls POST /api/request-purchase (or request-redeem)
//   2. Server creates a pending_action, broadcasts to parent SSE + web push
//   3. Child opens GET /api/child-events?child=... to stream the result
//   4. Parent receives the push, opens the PWA, POST /api/parent/approvals/:id/approve
//   5. Server applies the mutation, broadcasts resolved event on the child channel
//   6. Child's waiting overlay transforms into a celebration

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../db/parent-auth');
const push = require('../push');

function childChannel(childId) { return `child:${childId}`; }
const PARENT_CHANNEL = 'parent:events';

// ============================================================
// AUTH
// ============================================================

router.get('/api/parent/auth/status', (_req, res) => {
  res.json({
    success: true,
    // `has_pin` is the field the existing client code expects; we keep
    // `configured` as an alias for anything new.
    has_pin: auth.isConfigured(),
    configured: auth.isConfigured(),
    vapid_public_key: push.getPublicKey(),
  });
});

// Set or change the parent PIN. First-time setup needs no auth; changing
// an existing PIN requires a valid session (same as features.js used to do).
router.post('/api/parent/auth/set-pin', (req, res) => {
  const { pin } = req.body || {};
  if (!pin || String(pin).length < 4) {
    return res.status(400).json({ success: false, message: 'PIN至少4位' });
  }
  if (auth.isConfigured()) {
    // Changing an existing PIN — must be authenticated
    const token = req.headers['x-parent-token'] || req.query.token;
    if (!auth.verifySession(token)) {
      return res.status(401).json({ success: false, message: '请先解锁' });
    }
  }
  db.setParentPin(pin);
  res.json({ success: true });
});

// Remove the PIN (open the server back up). Must be authenticated.
router.delete('/api/parent/auth/pin', auth.requireParent, (_req, res) => {
  db.setParentPin(null);
  res.json({ success: true });
});

router.post('/api/parent/auth/login', (req, res) => {
  const { pin, device_id, device_name } = req.body || {};
  const result = auth.login(pin, { deviceId: device_id, deviceName: device_name });
  if (!result.ok) {
    return res.status(401).json({
      success: false,
      message: result.error === 'invalid_pin' ? 'PIN不正确' : result.error,
    });
  }
  res.json({ success: true, token: result.token, expires_in: result.expires_in });
});

router.post('/api/parent/auth/logout', (req, res) => {
  // Don't require middleware here — even a stale/expired token should
  // be able to hit this to clean up its own side of the session.
  const token = req.headers['x-parent-token'] || (req.body || {}).token || req.query.token;
  if (token) auth.logout(token);
  res.json({ success: true });
});

router.get('/api/parent/auth/me', auth.requireParent, (req, res) => {
  res.json({ success: true, session: req.parentSession });
});

// ============================================================
// WEB PUSH SUBSCRIPTION
// ============================================================

router.post('/api/parent/push/subscribe', auth.requireParent, (req, res) => {
  const { subscription, device_id, device_name } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ success: false, error: 'missing_subscription' });
  }
  db.addPushSubscription(subscription, {
    token: req.parentToken,
    deviceId: device_id,
    deviceName: device_name,
  });
  res.json({ success: true });
});

router.post('/api/parent/push/unsubscribe', auth.requireParent, (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) db.removePushSubscription(endpoint);
  else db.removePushSubscriptionsByToken(req.parentToken);
  res.json({ success: true });
});

// ============================================================
// PENDING ACTIONS — create (child side) / approve / reject / list
// ============================================================

// Shared apply function: the parent has approved, we now actually
// mutate the database according to the action's payload.
function applyApprovedAction(action) {
  const { child_id, action_type, payload } = action;
  if (action_type === 'purchase') {
    const result = db.purchaseItem(child_id, payload.reward_id);
    return result.error ? { error: result.error } : { new_balance: result.new_balance };
  }
  if (action_type === 'redeem_inventory') {
    const result = db.redeemFromInventory(child_id, payload.reward_id);
    return result.error ? { error: result.error } : { redemption: result.redemption };
  }
  if (action_type === 'redeem_goal') {
    // Legacy direct-redeem path from the goal progress bar.
    const reward = db.getReward(payload.reward_id);
    if (!reward) return { error: 'reward_not_found' };
    const balance = db.getBalance(child_id);
    if (balance < reward.coins_cost) return { error: 'not_enough_coins' };
    const new_balance = db.deductCoins(child_id, reward.coins_cost);
    db.insertRedemption(child_id, {
      reward_id: reward.id,
      reward_name: reward.name,
      coins_spent: reward.coins_cost,
    });
    return { new_balance };
  }
  return { error: 'unknown_action_type' };
}

// ----- Child creates a pending purchase -----
router.post('/api/request-purchase', (req, res) => {
  const child_id = req.query.child || 'kelly';
  const { reward_id } = req.body || {};
  const reward = db.getReward(reward_id);
  if (!reward || !reward.is_active) {
    return res.status(404).json({ success: false, message: '物品不存在' });
  }
  const balance = db.getBalance(child_id);
  if (balance < reward.coins_cost) {
    return res.status(400).json({ success: false, message: '金币不够哦' });
  }

  const action = db.createPendingAction({
    child_id,
    action_type: 'purchase',
    payload: {
      reward_id: reward.id,
      name: reward.name,
      coins_cost: reward.coins_cost,
      icon_file: reward.icon_file,
      icon_emoji: reward.icon_emoji,
      category: reward.category,
    },
  });
  notifyParentsOfNewAction(action);
  res.json({ success: true, action });
});

// ----- Child creates a pending inventory redemption -----
router.post('/api/request-redeem', (req, res) => {
  const child_id = req.query.child || 'kelly';
  const { reward_id } = req.body || {};
  const reward = db.getReward(reward_id);
  if (!reward) return res.status(404).json({ success: false, message: '物品不存在' });

  // Verify the item is actually in the child's inventory first
  const inventory = db.getInventory(child_id);
  const invEntry = inventory.find(i => i.reward_id === reward.id);
  if (!invEntry) return res.status(400).json({ success: false, message: '背包里没有这个' });

  const action = db.createPendingAction({
    child_id,
    action_type: 'redeem_inventory',
    payload: {
      reward_id: reward.id,
      name: reward.name,
      icon_file: reward.icon_file,
      icon_emoji: reward.icon_emoji,
      category: reward.category,
    },
  });
  notifyParentsOfNewAction(action);
  res.json({ success: true, action });
});

// ----- Child polls for a specific action's status -----
router.get('/api/pending-actions/:id', (req, res) => {
  const action = db.getPendingAction(req.params.id);
  if (!action) return res.status(404).json({ success: false });
  res.json({ success: true, action });
});

// ----- Child cancels their own pending action (withdraw) -----
router.post('/api/pending-actions/:id/cancel', (req, res) => {
  const action = db.getPendingAction(req.params.id);
  if (!action) return res.status(404).json({ success: false });
  if (action.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'already_resolved' });
  }
  db.updatePendingAction(action.id, {
    status: 'cancelled',
    resolved_at: new Date().toISOString(),
    resolved_by: 'child',
  });
  push.broadcast(childChannel(action.child_id), {
    type: 'action-resolved',
    action: db.getPendingAction(action.id),
  });
  push.broadcast(PARENT_CHANNEL, {
    type: 'action-cancelled',
    action: db.getPendingAction(action.id),
  });
  res.json({ success: true });
});

// ----- Parent: list all pending actions (newest first) -----
router.get('/api/parent/approvals', auth.requireParent, (_req, res) => {
  res.json({
    success: true,
    data: {
      pending: db.listPendingActions({ status: 'pending' }),
      recent:  db.listPendingActions().slice(0, 20),
    },
  });
});

// ----- Parent approves -----
router.post('/api/parent/approvals/:id/approve', auth.requireParent, (req, res) => {
  const action = db.getPendingAction(req.params.id);
  if (!action) return res.status(404).json({ success: false });
  if (action.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'already_resolved' });
  }
  const result = applyApprovedAction(action);
  if (result.error) {
    // Still mark as resolved but record the failure so the child doesn't hang
    db.updatePendingAction(action.id, {
      status: 'rejected',
      resolved_at: new Date().toISOString(),
      resolved_by: 'system',
      error: result.error,
    });
    const resolved = db.getPendingAction(action.id);
    push.broadcast(childChannel(action.child_id), { type: 'action-resolved', action: resolved });
    return res.status(400).json({ success: false, error: result.error });
  }
  db.updatePendingAction(action.id, {
    status: 'approved',
    resolved_at: new Date().toISOString(),
    resolved_by: 'parent',
    result,
  });
  const resolved = db.getPendingAction(action.id);
  push.broadcast(childChannel(action.child_id), { type: 'action-resolved', action: resolved });
  push.broadcast(PARENT_CHANNEL, { type: 'action-approved', action: resolved });
  res.json({ success: true, action: resolved });
});

// ----- Parent rejects -----
router.post('/api/parent/approvals/:id/reject', auth.requireParent, (req, res) => {
  const action = db.getPendingAction(req.params.id);
  if (!action) return res.status(404).json({ success: false });
  if (action.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'already_resolved' });
  }
  const reason = (req.body || {}).reason || null;
  db.updatePendingAction(action.id, {
    status: 'rejected',
    resolved_at: new Date().toISOString(),
    resolved_by: 'parent',
    reason,
  });
  const resolved = db.getPendingAction(action.id);
  push.broadcast(childChannel(action.child_id), { type: 'action-resolved', action: resolved });
  push.broadcast(PARENT_CHANNEL, { type: 'action-rejected', action: resolved });
  res.json({ success: true, action: resolved });
});

// ============================================================
// SSE STREAMS
// ============================================================

router.get('/api/parent/events', auth.requireParent, (req, res) => {
  push.openSseStream(req, res);
  push.subscribe(PARENT_CHANNEL, res);
  // Send a hello so the client knows the stream is live.
  res.write(`data: ${JSON.stringify({ type: 'hello', at: new Date().toISOString() })}\n\n`);
});

router.get('/api/child-events', (req, res) => {
  const childId = req.query.child || 'kelly';
  push.openSseStream(req, res);
  push.subscribe(childChannel(childId), res);
  res.write(`data: ${JSON.stringify({ type: 'hello', at: new Date().toISOString() })}\n\n`);
});

// ============================================================
// Internal: fire SSE + Web Push when a new pending action lands
// ============================================================

function notifyParentsOfNewAction(action) {
  // SSE (for parents actively watching the dashboard)
  push.broadcast(PARENT_CHANNEL, { type: 'action-created', action });

  // Web Push (for parents whose dashboard isn't open)
  const child = db.getChild(action.child_id);
  const who = child?.name || action.child_id;
  const what = action.payload.name;
  const cost = action.payload.coins_cost ? ` (${action.payload.coins_cost} 🪙)` : '';
  const title =
    action.action_type === 'purchase'         ? `${who} 想买 ${what}${cost}`
  : action.action_type === 'redeem_inventory' ? `${who} 想兑换 ${what}`
  : action.action_type === 'redeem_goal'      ? `${who} 想兑换心愿 ${what}`
  : `${who} 有新请求`;

  push.sendToParents({
    title: 'Kelly Coins',
    body: title,
    tag: `pending-${action.id}`,
    actionId: action.id,
    url: `/parent/#approvals`,
  }).catch(err => console.error('[push] notifyParentsOfNewAction failed', err));
}

module.exports = router;
