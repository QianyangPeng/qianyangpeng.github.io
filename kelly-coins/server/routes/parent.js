const express = require('express');
const router = express.Router();
const db = require('../db/database');
const iconCatalog = require('../db/icon-catalog');

// ---- Children management ----

router.get('/api/parent/children', (_req, res) => {
  const children = db.getChildren();
  const list = Object.entries(children).map(([id, c]) => ({ id, ...c }));
  res.json({ success: true, data: list });
});

router.put('/api/parent/children/:id', (req, res) => {
  const child = db.upsertChild(req.params.id, req.body);
  res.json({ success: true, data: child });
});

router.post('/api/parent/children', (req, res) => {
  const { id, name, age } = req.body;
  if (!id || !name) return res.status(400).json({ success: false, message: '需要id和name' });
  const child = db.upsertChild(id, { name, age: age || 0 });
  res.json({ success: true, data: child });
});

// ---- Redemption approvals ----

router.get('/api/parent/pending', (req, res) => {
  const childId = req.query.child || null;
  res.json({ success: true, data: db.getPendingRedemptions(childId) });
});

router.post('/api/parent/approve/:id', (req, res) => {
  const r = db.updateRedemptionStatus(req.params.id, 'approved');
  if (!r) return res.status(404).json({ success: false, message: '记录不存在' });
  res.json({ success: true, message: '已批准' });
});

router.post('/api/parent/reject/:id', (req, res) => {
  const r = db.getRedemption(req.params.id);
  if (!r) return res.status(404).json({ success: false, message: '记录不存在' });
  db.updateRedemptionStatus(req.params.id, 'rejected');

  if (r.coins_spent > 0) {
    // Legacy one-step redeem: refund coins
    db.addCoins(r.child_id, r.coins_spent);
    db.insertTransaction(r.child_id, { task_name: `退还: ${r.reward_name}`, coins_earned: r.coins_spent });
    return res.json({ success: true, message: '已拒绝，金币已退还' });
  }

  // Inventory redemption (coins_spent = 0): put the item back in inventory
  // so Kelly can try again later instead of losing her purchase
  const child = db.getChild(r.child_id);
  if (child) {
    if (!child.inventory) child.inventory = [];
    const existing = child.inventory.find(i => i.reward_id === r.reward_id);
    if (existing) {
      existing.quantity += 1;
    } else {
      child.inventory.push({
        reward_id: r.reward_id,
        quantity: 1,
        purchased_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      });
    }
    db.upsertChild(r.child_id, {}); // triggers save
  }
  res.json({ success: true, message: '已拒绝，物品已放回背包' });
});

// ---- Icon catalog ----
// Served to both the parent dashboard (icon picker) and the child app
// (for rendering the right painterly icon per task/reward).
router.get('/api/icon-catalog', (_req, res) => {
  res.json({
    success: true,
    data: {
      tasks: iconCatalog.TASK_ICONS,
      rewards: iconCatalog.REWARD_ICONS,
      shop: iconCatalog.SHOP_ICONS,
    },
  });
});

// ---- Task CRUD ----

router.get('/api/parent/tasks', (_req, res) => {
  res.json({ success: true, data: db.getTasks(false) });
});

router.post('/api/parent/tasks', (req, res) => {
  const task = db.insertTask(req.body);
  res.json({ success: true, data: task });
});

router.put('/api/parent/tasks/:id', (req, res) => {
  const task = db.updateTask(req.params.id, req.body);
  if (!task) return res.status(404).json({ success: false });
  res.json({ success: true, data: task });
});

// ---- Reward CRUD ----

router.get('/api/parent/rewards', (_req, res) => {
  res.json({ success: true, data: db.getRewards(false) });
});

router.post('/api/parent/rewards', (req, res) => {
  const reward = db.insertReward(req.body);
  res.json({ success: true, data: reward });
});

router.put('/api/parent/rewards/:id', (req, res) => {
  const reward = db.updateReward(req.params.id, req.body);
  if (!reward) return res.status(404).json({ success: false });
  res.json({ success: true, data: reward });
});

// ---- History ----

router.get('/api/parent/history', (req, res) => {
  const childId = req.query.child || null;
  const limit = parseInt(req.query.limit) || 50;
  res.json({ success: true, data: db.getTransactions(childId, limit) });
});

// ---- Manual adjustment ----

router.post('/api/parent/adjust', (req, res) => {
  const { child: childId, coins, note } = req.body;
  const cid = childId || 'kelly';
  const amount = parseInt(coins, 10);
  const label = note || '手动调整';
  let new_balance;
  if (amount >= 0) { new_balance = db.addCoins(cid, amount); }
  else             { new_balance = db.deductCoins(cid, Math.abs(amount)); }
  db.insertTransaction(cid, { task_id: null, task_name: label, coins_earned: amount });
  res.json({ success: true, new_balance });
});

module.exports = router;
