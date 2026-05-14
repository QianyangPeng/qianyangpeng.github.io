const express = require('express');
const router = express.Router();
const db = require('../db/database');
const push = require('../push');

// Whenever a child mutation finishes successfully, fire a state-changed
// event on that child's SSE channel so every other tab/device currently
// viewing that child refreshes its data in real time. The `scope` field
// lets clients do targeted refreshes (only reload the tasks grid on a
// 'coins' change, only rebuild the character on 'skin', etc).
function emitStateChanged(cid, scope, extra = {}) {
  push.broadcastChild(cid, {
    type: 'state-changed',
    scope,                                // 'coins' | 'tasks' | 'skin' | 'inventory' | ...
    child_id: cid,
    at: new Date().toISOString(),
    ...extra,
  });
}

// Middleware: extract childId from query string, default to 'kelly'
function childId(req) {
  return req.query.child || 'kelly';
}

// GET /api/balance?child=kelly
router.get('/api/balance', (req, res) => {
  const cid = childId(req);
  const child = db.getChild(cid);
  if (!child) return res.status(404).json({ success: false, message: '找不到该小朋友' });
  res.json({ success: true, coins: child.coins, name: child.name, level: child.level, avatar: child.avatar, equipped_skin: child.equipped_skin || 'default' });
});

// GET /api/children  (list all children for child-selector)
router.get('/api/children', (_req, res) => {
  const children = db.getChildren();
  const list = Object.entries(children).map(([id, c]) => ({ id, ...c }));
  res.json({ success: true, data: list });
});

// GET /api/tasks  (active tasks only)
router.get('/api/tasks', (_req, res) => {
  res.json({ success: true, data: db.getTasks(true) });
});

// GET /api/rewards  (active rewards only)
router.get('/api/rewards', (_req, res) => {
  res.json({ success: true, data: db.getRewards(true) });
});

// POST /api/earn  { task_id }
router.post('/api/earn', (req, res) => {
  const cid = childId(req);
  const { task_id } = req.body;
  const task = db.getTask(task_id);
  if (!task || !task.is_active) {
    return res.status(404).json({ success: false, message: '任务不存在' });
  }

  // Check if this task is the daily quest (gets multiplier)
  const quest = db.getOrCreateDailyQuest(cid);
  let coinsEarned = task.coins;
  let isDailyQuest = false;
  if (quest && quest.task_id === task.id && !quest.completed) {
    coinsEarned = task.coins * (quest.multiplier || 2);
    db.markDailyQuestComplete(cid, task.id);
    isDailyQuest = true;
  }

  const new_balance = db.addCoins(cid, coinsEarned);
  db.trackLifetimeEarned(cid, coinsEarned);
  db.insertTransaction(cid, { task_id: task.id, task_name: task.name, coins_earned: coinsEarned });

  // Update daily streak
  const streak = db.updateStreak(cid);

  // Check for newly unlocked achievements
  const newAchievements = db.checkAndUnlockAchievements(cid);

  const updatedChild = db.getChild(cid);
  emitStateChanged(cid, 'earn', {
    new_balance,
    coins_earned: coinsEarned,
    new_level: updatedChild ? updatedChild.level : 1,
    task_id: task.id,
    streak: streak.count,
    achievements: newAchievements,
  });
  res.json({
    success: true,
    new_balance,
    coins_earned: coinsEarned,
    new_level: updatedChild ? updatedChild.level : 1,
    task_name: task.name,
    daily_quest_bonus: isDailyQuest,
    streak: streak.count,
    newly_unlocked: newAchievements,
  });
});

// POST /api/games/reward  { game_id, coins }
// game_id is the skin id ('default' | 'mermaid' | 'astronaut' | 'knight' | 'princess' | 'fairy').
// We validate against an allowlist because this string lands in the
// transaction history that's rendered in the child UI — without the
// allowlist a crafted body could inject arbitrary HTML.
const VALID_GAME_IDS = new Set([
  'alphabet',
  'numbers',
  'colors',
  'find-animal',
  'color-match',
  'counting-stars',
  'shape-sort',
  'memory-cards',
]);
const GAME_LABELS = {
  alphabet:     '认字母',
  numbers:      '认数字',
  colors:       '认颜色',
  'find-animal': '找一找',
  'color-match': '颜色花园',
  'counting-stars': '数星星',
  'shape-sort': '形状小屋',
  'memory-cards': '翻翻乐',
};

router.post('/api/games/reward', (req, res) => {
  const cid = childId(req);
  const { game_id, coins } = req.body;
  if (!VALID_GAME_IDS.has(game_id)) {
    return res.status(400).json({ success: false, message: 'unknown game' });
  }
  const amount = Math.max(0, Math.min(5, Math.floor(Number(coins) || 0)));
  if (amount === 0) return res.json({ success: true, new_balance: db.getBalance(cid), coins_earned: 0 });
  const new_balance = db.addCoins(cid, amount);
  db.trackLifetimeEarned(cid, amount);
  db.insertTransaction(cid, { task_name: `小游戏: ${GAME_LABELS[game_id]}`, coins_earned: amount });
  const child = db.getChild(cid);
  emitStateChanged(cid, 'game-reward', { new_balance, coins_earned: amount, new_level: child?.level });
  res.json({ success: true, new_balance, coins_earned: amount, new_level: child?.level });
});

// POST /api/redeem  { reward_id }  — legacy: buy-and-redeem in one step
// Still used by older clients (goal progress bar, etc.) — kept for compatibility
router.post('/api/redeem', (req, res) => {
  const cid = childId(req);
  const { reward_id } = req.body;
  const reward = db.getReward(reward_id);
  if (!reward || !reward.is_active) {
    return res.status(404).json({ success: false, message: '奖励不存在' });
  }
  const balance = db.getBalance(cid);
  if (balance < reward.coins_cost) {
    return res.status(400).json({ success: false, message: '金币不够哦！' });
  }
  const new_balance = db.deductCoins(cid, reward.coins_cost);
  db.insertRedemption(cid, { reward_id: reward.id, reward_name: reward.name, coins_spent: reward.coins_cost });
  emitStateChanged(cid, 'redeem-legacy', { new_balance, reward_id: reward.id });
  res.json({ success: true, new_balance, message: '兑换成功！等爸爸妈妈审批哦 🎉' });
});

// POST /api/purchase  { reward_id }  — buy item, goes to inventory, NO approval needed
router.post('/api/purchase', (req, res) => {
  const cid = childId(req);
  const { reward_id } = req.body;
  const result = db.purchaseItem(cid, reward_id);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  emitStateChanged(cid, 'purchase', { new_balance: result.new_balance, reward_id });
  res.json({ success: true, new_balance: result.new_balance });
});

// GET /api/inventory?child=kelly — items already purchased, not yet redeemed
router.get('/api/inventory', (req, res) => {
  const cid = childId(req);
  res.json({ success: true, data: db.getInventory(cid) });
});

// POST /api/inventory/redeem  { reward_id }  — redeem from inventory, needs parent approval
router.post('/api/inventory/redeem', (req, res) => {
  const cid = childId(req);
  const { reward_id } = req.body;
  const result = db.redeemFromInventory(cid, reward_id);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true, redemption: result.redemption, message: '等爸爸妈妈批准就可以用啦！' });
});

// GET /api/history?child=kelly&limit=20
router.get('/api/history', (req, res) => {
  const cid = childId(req);
  const limit = parseInt(req.query.limit) || 20;
  res.json({ success: true, data: db.getTransactions(cid, limit) });
});

// ---- Skin system ----

// GET /api/skins?child=kelly  (all skins with owned/equipped status)
router.get('/api/skins', (req, res) => {
  const cid = childId(req);
  res.json({ success: true, data: db.getSkinsForChild(cid) });
});

// POST /api/skins/buy  { skin_id }
router.post('/api/skins/buy', (req, res) => {
  const cid = childId(req);
  const { skin_id } = req.body;
  const result = db.buySkin(cid, skin_id);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  emitStateChanged(cid, 'skin-buy', { new_balance: result.new_balance, skin_id });
  res.json({ success: true, new_balance: result.new_balance });
});

// ---- Lucky wheel ----

// GET /api/wheel/status  — prize list + whether a free spin is available
router.get('/api/wheel/status', (req, res) => {
  const cid = childId(req);
  const status = db.getWheelStatus(cid);
  if (!status) return res.status(404).json({ success: false, message: '找不到该小朋友' });
  res.json({ success: true, ...status });
});

// POST /api/wheel/spin  — consume a free spin, award a prize
router.post('/api/wheel/spin', (req, res) => {
  const cid = childId(req);
  const result = db.spinWheel(cid);
  if (result.error === 'cooldown') {
    return res.status(429).json({
      success: false,
      cooldown: true,
      nextWindow: result.nextWindow,
      message: result.nextWindow?.when === 'noon'
        ? '还不能转，等到中午12点再转吧！'
        : '今天的转盘转完啦，明天早上再来！',
    });
  }
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  emitStateChanged(cid, 'wheel-spin', {
    new_balance: result.new_balance,
    coins_earned: result.coins,
    prize_id: result.prize_id,
  });
  res.json({ success: true, ...result });
});

// POST /api/skins/equip  { skin_id }
router.post('/api/skins/equip', (req, res) => {
  const cid = childId(req);
  const { skin_id } = req.body;
  const result = db.equipSkin(cid, skin_id);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  emitStateChanged(cid, 'skin-equip', { equipped_skin: result.equipped_skin });
  res.json({ success: true, equipped_skin: result.equipped_skin });
});

module.exports = router;
