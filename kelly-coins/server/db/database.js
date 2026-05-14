const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'kelly-coins.json');

// ---- Persistence helpers ----

function load() {
  if (!fs.existsSync(DB_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return null; }
}

function save(d) {
  fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2), 'utf8');
}

function nextId(arr) {
  return arr.length === 0 ? 1 : Math.max(...arr.map(r => r.id)) + 1;
}

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ---- Data initialization & migration ----

let data = load();

if (!data) {
  data = { children: {}, tasks: [], rewards: [], transactions: [], redemptions: [], skins: [] };
}

// Migrate from old single-child format
if (data.settings && !data.children) {
  const oldCoins = data.settings.coins || 0;
  data.children = {
    kelly: { name: 'Kelly', age: 4, coins: oldCoins, avatar: 'default', level: 1 }
  };
  data.transactions.forEach(t => { if (!t.child_id) t.child_id = 'kelly'; });
  data.redemptions.forEach(r => { if (!r.child_id) r.child_id = 'kelly'; });
  delete data.settings;
}

// Ensure children exist
if (!data.children || Object.keys(data.children).length === 0) {
  data.children = {
    kelly: { name: 'Kelly', age: 4, coins: 0, avatar: 'default', level: 1 }
  };
}

if (!data.children.selina) {
  data.children.selina = { name: 'Selina', age: 0, coins: 0, avatar: 'default', level: 1 };
}

// Migrate children to have skin fields
for (const [_id, child] of Object.entries(data.children)) {
  if (!child.owned_skins) child.owned_skins = ['default'];
  if (!child.equipped_skin) child.equipped_skin = 'default';
}

// Seed tasks / rewards from the watercolor icon catalog. Each default
// row has an icon_file set so new installs get painterly icons out of
// the box. Parents can add/remove via the parent dashboard.
const iconCatalog = require('./icon-catalog');

if (data.tasks.length === 0) {
  iconCatalog.DEFAULT_TASKS.forEach((t, i) => {
    data.tasks.push({
      id: i + 1,
      is_active: 1,
      coins_per_interval: t.coins_per_interval || null,
      duration_minutes: t.duration_minutes || null,
      icon_file: t.icon_file || null,
      ...t,
    });
  });
}

// Migrate existing tasks: back-fill duration fields and icon_file by
// fuzzy-matching the task name against the catalog.
data.tasks.forEach(t => {
  if (t.coins_per_interval === undefined) t.coins_per_interval = t.coins;
  if (t.duration_minutes === undefined) t.duration_minutes = null;
  if (t.name.includes('Selina') || t.name.includes('陪玩')) {
    t.duration_minutes = 15;
    t.coins_per_interval = 1;
  }
  if (!t.icon_file) {
    t.icon_file = iconCatalog.findIconForName(t.name, iconCatalog.TASK_ICONS) || null;
  }
});

if (data.rewards.length === 0) {
  iconCatalog.DEFAULT_REWARDS.forEach((r, i) => {
    data.rewards.push({
      id: i + 1,
      is_active: 1,
      icon_file: r.icon_file || null,
      ...r,
    });
  });
}

// Migrate existing rewards: back-fill icon_file by name match.
data.rewards.forEach(r => {
  if (!r.icon_file) {
    r.icon_file = iconCatalog.findIconForName(r.name, iconCatalog.REWARD_ICONS) || null;
  }
});

// Seed skins if empty or missing
if (!data.skins || data.skins.length === 0) {
  data.skins = [
    { id: 'default',   name: '默认 Kelly',  cost: 0,  emoji: '👧', desc: '可爱的Kelly',     is_active: 1 },
    { id: 'princess',  name: '粉色公主',    cost: 15, emoji: '👸', desc: '梦幻公主裙',       is_active: 1 },
    { id: 'knight',    name: '小骑士',      cost: 20, emoji: '⚔️', desc: '勇敢的小骑士',    is_active: 1 },
    { id: 'mermaid',   name: '美人鱼',      cost: 25, emoji: '🧜', desc: '神秘的深海公主',   is_active: 1 },
    { id: 'astronaut', name: '小宇航员',    cost: 30, emoji: '🚀', desc: '探索宇宙的冒险家', is_active: 1 },
    { id: 'fairy',     name: '花仙子',      cost: 20, emoji: '🧚', desc: '森林里的小精灵',   is_active: 1 },
  ];
}

// Seed achievements catalog (definitions, not user state)
if (!data.achievements_catalog || data.achievements_catalog.length === 0) {
  data.achievements_catalog = [
    { id: 'first_task',       name: '初出茅庐',  desc: '完成第一个任务',     emoji: '🌱', tier: 'bronze', target: 1   },
    { id: 'ten_tasks',        name: '小小达人',  desc: '完成10个任务',       emoji: '⭐', tier: 'bronze', target: 10  },
    { id: 'fifty_tasks',      name: '勤劳小蜂',  desc: '完成50个任务',       emoji: '🐝', tier: 'silver', target: 50  },
    { id: 'hundred_tasks',    name: '任务大师',  desc: '完成100个任务',      emoji: '🏆', tier: 'gold',   target: 100 },
    { id: 'first_coin',       name: '第一桶金',  desc: '赚到第一个金币',     emoji: '🪙', tier: 'bronze', target: 1   },
    { id: 'fifty_coins',      name: '小富婆',    desc: '累计赚到50金币',     emoji: '💰', tier: 'bronze', target: 50  },
    { id: 'hundred_coins',    name: '百金小姐',  desc: '累计赚到100金币',    emoji: '💎', tier: 'silver', target: 100 },
    { id: 'five_hundred',     name: '金币女王',  desc: '累计赚到500金币',    emoji: '👑', tier: 'gold',   target: 500 },
    { id: 'streak_3',         name: '三天连击',  desc: '连续打卡3天',        emoji: '🔥', tier: 'bronze', target: 3   },
    { id: 'streak_7',         name: '一周战神',  desc: '连续打卡7天',        emoji: '⚡', tier: 'silver', target: 7   },
    { id: 'streak_30',        name: '月度传奇',  desc: '连续打卡30天',       emoji: '🌟', tier: 'gold',   target: 30  },
    { id: 'first_redeem',     name: '首次兑换',  desc: '第一次兑换奖励',     emoji: '🎁', tier: 'bronze', target: 1   },
    { id: 'first_skin',       name: '换装少女',  desc: '第一次购买皮肤',     emoji: '👗', tier: 'bronze', target: 1   },
    { id: 'all_skins',        name: '皮肤收藏家', desc: '拥有所有皮肤',      emoji: '🎭', tier: 'gold',   target: 6   },
    { id: 'early_bird',       name: '早起的鸟',  desc: '早晨7点前完成任务',  emoji: '🌅', tier: 'silver', target: 1   },
    { id: 'night_owl',        name: '夜猫子',    desc: '晚上8点后完成任务',  emoji: '🦉', tier: 'silver', target: 1   },
  ];
}

// Seed UI themes catalog
if (!data.themes_catalog) {
  data.themes_catalog = [
    { id: 'rpg',     name: '幻想 RPG',  desc: '深紫色金边',  primary: '#FFD700', accent: '#7C5CFC' },
    { id: 'forest',  name: '森林秘境',  desc: '绿色自然',    primary: '#9CCC65', accent: '#5D4037' },
    { id: 'ocean',   name: '海洋世界',  desc: '蓝色清爽',    primary: '#4FC3F7', accent: '#0288D1' },
    { id: 'sunset',  name: '夕阳粉色',  desc: '温柔粉橙',    primary: '#FF8A95', accent: '#FF6B9D' },
    { id: 'space',   name: '宇宙星空',  desc: '深蓝紫色',    primary: '#9575CD', accent: '#1A237E' },
  ];
}

// Holiday calendar (auto-detected by date)
if (!data.holidays_catalog) {
  data.holidays_catalog = [
    { id: 'new_year',  name: '新年',       month: 1,  day: 1,  range: 3, emoji: '🎆' },
    { id: 'valentine', name: '情人节',     month: 2,  day: 14, range: 1, emoji: '💝' },
    { id: 'halloween', name: '万圣节',     month: 10, day: 31, range: 7, emoji: '🎃' },
    { id: 'christmas', name: '圣诞节',     month: 12, day: 25, range: 7, emoji: '🎄' },
    { id: 'kelly_birthday', name: 'Kelly生日', month: 6, day: 15, range: 1, emoji: '🎂' },
  ];
}

// New collections (initialized empty)
if (!data.voice_messages) data.voice_messages = [];
if (!data.photos) data.photos = [];
if (!data.gardens) data.gardens = {}; // per-child garden state
if (!data.story_progress) data.story_progress = {}; // per-child story state
if (!data.reminders) data.reminders = []; // task reminder schedule
if (!data.notifications) data.notifications = []; // unread notifications per child
if (!data.parent_settings) data.parent_settings = { pin_hash: null, weekly_email: null };

// Migrate children to have new fields
for (const [_id, child] of Object.entries(data.children)) {
  if (!child.streak)               child.streak = { count: 0, last_active: null, longest: 0 };
  if (!child.unlocked_achievements) child.unlocked_achievements = [];
  if (child.active_goal === undefined) child.active_goal = null;
  if (!child.total_earned)         child.total_earned = child.coins || 0;
  if (!child.daily_quest)          child.daily_quest = null;
  if (!child.theme)                child.theme = 'rpg';
  // Inventory: items Kelly has purchased but not yet redeemed for real-world reward
  // Each entry: { reward_id, quantity, purchased_at }
  if (!child.inventory)            child.inventory = [];
  // Wheel spin tracking: two shifts per day (midnight-noon and noon-midnight),
  // one spin allowed per shift. We store the ISO key of the most recent shift
  // consumed and a count so we can detect a new shift cleanly.
  if (!child.wheel)                child.wheel = { last_shift: null, spins_in_shift: 0, total_spins: 0 };
  // When `wheel_unlimited` is true the shift cooldown is disabled and the
  // child can spin as often as they want. Parent toggles this from the
  // children management page.
  if (child.wheel_unlimited === undefined) child.wheel_unlimited = false;
}

save(data);

// ---- Children ----

function getChildren() { return data.children; }

function getChild(childId) { return data.children[childId] || null; }

function upsertChild(childId, fields) {
  if (!data.children[childId]) {
    data.children[childId] = { name: childId, age: 0, coins: 0, avatar: 'default', level: 1, owned_skins: ['default'], equipped_skin: 'default' };
  }
  Object.assign(data.children[childId], fields);
  save(data);
  return data.children[childId];
}

// ---- Balance (per child) ----

function getBalance(childId) {
  const child = getChild(childId);
  return child ? child.coins : 0;
}

function addCoins(childId, amount) {
  const child = getChild(childId);
  if (!child) return 0;
  child.coins += amount;
  save(data);
  return child.coins;
}

function deductCoins(childId, amount) {
  const child = getChild(childId);
  if (!child) return 0;
  child.coins = Math.max(0, child.coins - amount);
  save(data);
  return child.coins;
}

// ---- Tasks ----

function getTasks(activeOnly = false) {
  return activeOnly ? data.tasks.filter(t => t.is_active) : data.tasks;
}

function getTask(id) { return data.tasks.find(t => t.id === Number(id)); }

function insertTask({ name, coins, icon_emoji, icon_file, duration_minutes, coins_per_interval }) {
  const task = {
    id: nextId(data.tasks),
    name,
    coins: Number(coins),
    icon_emoji: icon_emoji || '⭐',
    icon_file: icon_file || null,
    duration_minutes: duration_minutes || null,
    coins_per_interval: coins_per_interval || null,
    is_active: 1,
  };
  data.tasks.push(task);
  save(data);
  return task;
}

function updateTask(id, fields) {
  const t = getTask(id);
  if (!t) return null;
  // Allowlist of fields the client is permitted to mutate.
  const allowed = ['name', 'coins', 'icon_emoji', 'icon_file', 'duration_minutes', 'coins_per_interval', 'is_active'];
  for (const k of allowed) {
    if (k in fields) t[k] = fields[k];
  }
  save(data);
  return t;
}

// ---- Rewards ----

function getRewards(activeOnly = false) {
  return activeOnly ? data.rewards.filter(r => r.is_active) : data.rewards;
}

function getReward(id) { return data.rewards.find(r => r.id === Number(id)); }

function insertReward({ name, coins_cost, icon_emoji, icon_file, category }) {
  const reward = {
    id: nextId(data.rewards),
    name,
    coins_cost: Number(coins_cost),
    icon_emoji: icon_emoji || '🎁',
    icon_file: icon_file || null,
    category: category || 'real',
    is_active: 1,
  };
  data.rewards.push(reward);
  save(data);
  return reward;
}

function updateReward(id, fields) {
  const r = getReward(id);
  if (!r) return null;
  const allowed = ['name', 'coins_cost', 'icon_emoji', 'icon_file', 'category', 'is_active'];
  for (const k of allowed) {
    if (k in fields) r[k] = fields[k];
  }
  save(data);
  return r;
}

// ---- Transactions (per child) ----

function insertTransaction(childId, { task_id, task_name, coins_earned }) {
  const txn = { id: nextId(data.transactions), child_id: childId, task_id: task_id || null, task_name, coins_earned: Number(coins_earned), created_at: now() };
  data.transactions.push(txn);
  save(data);
  return txn;
}

function getTransactions(childId, limit = 50) {
  let txns = [...data.transactions];
  if (childId) txns = txns.filter(t => t.child_id === childId);
  return txns.reverse().slice(0, limit);
}

// ---- Redemptions (per child) ----

function insertRedemption(childId, { reward_id, reward_name, coins_spent }) {
  const r = { id: nextId(data.redemptions), child_id: childId, reward_id, reward_name, coins_spent: Number(coins_spent), status: 'pending', created_at: now() };
  data.redemptions.push(r);
  save(data);
  return r;
}

function getRedemption(id) { return data.redemptions.find(r => r.id === Number(id)); }

function getPendingRedemptions(childId) {
  let pending = data.redemptions.filter(r => r.status === 'pending');
  if (childId) pending = pending.filter(r => r.child_id === childId);
  return [...pending].reverse();
}

function updateRedemptionStatus(id, status) {
  const r = getRedemption(id);
  if (!r) return null;
  r.status = status;
  save(data);
  return r;
}

// ---- Skins ----

function getSkins() {
  return data.skins.filter(s => s.is_active);
}

function getSkin(skinId) {
  return data.skins.find(s => s.id === skinId);
}

function getSkinsForChild(childId) {
  const child = getChild(childId);
  if (!child) return [];
  const owned = new Set(child.owned_skins || ['default']);
  return getSkins().map(skin => ({
    ...skin,
    owned: owned.has(skin.id),
    equipped: child.equipped_skin === skin.id,
  }));
}

function buySkin(childId, skinId) {
  const child = getChild(childId);
  const skin = getSkin(skinId);
  if (!child || !skin) return { error: '找不到' };
  if ((child.owned_skins || []).includes(skinId)) return { error: '已拥有' };
  if (child.coins < skin.cost) return { error: '金币不够' };

  child.coins -= skin.cost;
  if (!child.owned_skins) child.owned_skins = ['default'];
  child.owned_skins.push(skinId);
  save(data);

  // Log transaction
  insertTransaction(childId, { task_name: `购买皮肤: ${skin.name}`, coins_earned: -skin.cost });

  return { success: true, new_balance: child.coins };
}

function equipSkin(childId, skinId) {
  const child = getChild(childId);
  if (!child) return { error: '找不到' };
  if (!(child.owned_skins || []).includes(skinId)) return { error: '未拥有' };
  child.equipped_skin = skinId;
  save(data);
  return { success: true, equipped_skin: skinId };
}

// ============================================================
// INVENTORY (item purchase → redeem flow)
// ============================================================
// Purchase: instant, deducts coins, adds item to inventory (no approval)
// Redeem:   from inventory, removes item, creates redemption (needs approval)

function getInventory(childId) {
  const child = getChild(childId);
  if (!child) return [];
  const items = child.inventory || [];
  // Enrich with reward details for display
  return items.map(entry => {
    const reward = data.rewards.find(r => r.id === entry.reward_id);
    if (!reward) return null;
    return {
      ...entry,
      name: reward.name,
      icon_emoji: reward.icon_emoji,
      icon_file: reward.icon_file || null,
      coins_cost: reward.coins_cost,
      category: reward.category,
    };
  }).filter(Boolean);
}

function purchaseItem(childId, rewardId) {
  const child = getChild(childId);
  const reward = data.rewards.find(r => r.id === Number(rewardId));
  if (!child || !reward) return { error: '找不到物品' };
  if (!reward.is_active) return { error: '物品未上架' };
  if (child.coins < reward.coins_cost) return { error: '金币不够' };

  child.coins -= reward.coins_cost;
  if (!child.inventory) child.inventory = [];

  // Stack same items by quantity
  const existing = child.inventory.find(i => i.reward_id === reward.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    child.inventory.push({
      reward_id: reward.id,
      quantity: 1,
      purchased_at: now(),
    });
  }

  save(data);
  insertTransaction(childId, {
    task_name: `购买: ${reward.name}`,
    coins_earned: -reward.coins_cost,
  });

  return { success: true, new_balance: child.coins };
}

function redeemFromInventory(childId, rewardId) {
  const child = getChild(childId);
  const reward = data.rewards.find(r => r.id === Number(rewardId));
  if (!child || !reward) return { error: '找不到物品' };

  const inv = child.inventory || [];
  const entry = inv.find(i => i.reward_id === reward.id);
  if (!entry || entry.quantity <= 0) return { error: '背包里没有这个物品' };

  // Decrement quantity
  entry.quantity -= 1;
  if (entry.quantity <= 0) {
    const idx = inv.indexOf(entry);
    inv.splice(idx, 1);
  }

  // Create pending redemption (still needs parent approval for real-world items)
  const redemption = insertRedemption(childId, {
    reward_id: reward.id,
    reward_name: reward.name,
    coins_spent: 0, // already paid at purchase time
  });

  save(data);
  return { success: true, redemption };
}

// ============================================================
// ACHIEVEMENTS
// ============================================================

function getAchievementsCatalog() { return data.achievements_catalog || []; }

function getChildAchievements(childId) {
  const child = getChild(childId);
  if (!child) return [];
  const unlocked = new Set(child.unlocked_achievements || []);
  return getAchievementsCatalog().map(a => ({
    ...a,
    unlocked: unlocked.has(a.id),
    progress: computeAchievementProgress(childId, a),
  }));
}

function computeAchievementProgress(childId, achievement) {
  const child = getChild(childId);
  if (!child) return 0;
  const txns = data.transactions.filter(t => t.child_id === childId);
  const earnTxns = txns.filter(t => t.coins_earned > 0 && t.task_id);

  switch (achievement.id) {
    case 'first_task':     return Math.min(earnTxns.length, 1);
    case 'ten_tasks':      return Math.min(earnTxns.length, 10);
    case 'fifty_tasks':    return Math.min(earnTxns.length, 50);
    case 'hundred_tasks':  return Math.min(earnTxns.length, 100);
    case 'first_coin':     return Math.min(child.total_earned || 0, 1);
    case 'fifty_coins':    return Math.min(child.total_earned || 0, 50);
    case 'hundred_coins':  return Math.min(child.total_earned || 0, 100);
    case 'five_hundred':   return Math.min(child.total_earned || 0, 500);
    case 'streak_3':       return Math.min(child.streak?.count || 0, 3);
    case 'streak_7':       return Math.min(child.streak?.count || 0, 7);
    case 'streak_30':      return Math.min(child.streak?.count || 0, 30);
    case 'first_redeem':   return data.redemptions.filter(r => r.child_id === childId).length > 0 ? 1 : 0;
    case 'first_skin':     return (child.owned_skins || []).length > 1 ? 1 : 0;
    case 'all_skins':      return (child.owned_skins || []).length;
    case 'early_bird':     return earnTxns.some(t => { const h = parseInt(t.created_at.slice(11, 13)); return h < 7; }) ? 1 : 0;
    case 'night_owl':      return earnTxns.some(t => { const h = parseInt(t.created_at.slice(11, 13)); return h >= 20; }) ? 1 : 0;
    default: return 0;
  }
}

// Returns array of newly unlocked achievement IDs
function checkAndUnlockAchievements(childId) {
  const child = getChild(childId);
  if (!child) return [];
  if (!child.unlocked_achievements) child.unlocked_achievements = [];

  const newly = [];
  for (const a of getAchievementsCatalog()) {
    if (child.unlocked_achievements.includes(a.id)) continue;
    const progress = computeAchievementProgress(childId, a);
    if (progress >= a.target) {
      child.unlocked_achievements.push(a.id);
      newly.push(a);
    }
  }
  if (newly.length) save(data);
  return newly;
}

// ============================================================
// STREAK TRACKING
// ============================================================

function updateStreak(childId) {
  const child = getChild(childId);
  if (!child) return null;
  if (!child.streak) child.streak = { count: 0, last_active: null, longest: 0 };

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const last = child.streak.last_active;

  if (last === today) return child.streak; // already counted today

  if (last) {
    const lastDate = new Date(last);
    const todayDate = new Date(today);
    const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      child.streak.count += 1;
    } else {
      child.streak.count = 1; // streak broken, restart
    }
  } else {
    child.streak.count = 1;
  }

  child.streak.last_active = today;
  if (child.streak.count > (child.streak.longest || 0)) {
    child.streak.longest = child.streak.count;
  }
  save(data);
  return child.streak;
}

function getStreak(childId) {
  const child = getChild(childId);
  if (!child) return { count: 0, longest: 0 };

  // Auto-reset if more than 1 day gap (without requiring task completion)
  if (child.streak?.last_active) {
    const last = new Date(child.streak.last_active);
    const today = new Date(new Date().toISOString().slice(0, 10));
    const diff = Math.round((today - last) / (1000 * 60 * 60 * 24));
    if (diff > 1) {
      child.streak.count = 0;
      save(data);
    }
  }
  return child.streak || { count: 0, longest: 0 };
}

// ============================================================
// GOALS / WISHLIST
// ============================================================

function setActiveGoal(childId, rewardId) {
  const child = getChild(childId);
  if (!child) return null;
  child.active_goal = rewardId ? Number(rewardId) : null;
  save(data);
  return child.active_goal;
}

function getActiveGoal(childId) {
  const child = getChild(childId);
  if (!child || !child.active_goal) return null;
  const reward = data.rewards.find(r => r.id === child.active_goal);
  if (!reward) return null;
  return {
    reward,
    progress: child.coins,
    target: reward.coins_cost,
    percent: Math.min(100, Math.round((child.coins / reward.coins_cost) * 100)),
    remaining: Math.max(0, reward.coins_cost - child.coins),
  };
}

// ============================================================
// DAILY QUEST
// ============================================================

function getOrCreateDailyQuest(childId) {
  const child = getChild(childId);
  if (!child) return null;
  const today = new Date().toISOString().slice(0, 10);

  if (child.daily_quest && child.daily_quest.date === today) {
    return child.daily_quest;
  }

  const activeTasks = data.tasks.filter(t => t.is_active);
  if (activeTasks.length === 0) return null;

  // Pick a random task and double its reward
  const task = activeTasks[Math.floor(Math.random() * activeTasks.length)];
  child.daily_quest = {
    date: today,
    task_id: task.id,
    task_name: task.name,
    icon: task.icon_emoji,
    multiplier: 2,
    completed: false,
  };
  save(data);
  return child.daily_quest;
}

function markDailyQuestComplete(childId, taskId) {
  const child = getChild(childId);
  if (!child || !child.daily_quest) return false;
  if (child.daily_quest.task_id !== Number(taskId)) return false;
  if (child.daily_quest.completed) return false;
  child.daily_quest.completed = true;
  save(data);
  return true;
}

// ============================================================
// VOICE MESSAGES (parent → child)
// ============================================================

function insertVoiceMessage({ child_id, audio_path, duration, category, label }) {
  const msg = {
    id: nextId(data.voice_messages || []),
    child_id,
    audio_path,
    duration,
    category: category || 'general',
    label: label || '',
    created_at: now(),
    played: 0,
  };
  if (!data.voice_messages) data.voice_messages = [];
  data.voice_messages.push(msg);
  save(data);
  return msg;
}

function getVoiceMessages(childId, unplayedOnly = false) {
  let msgs = (data.voice_messages || []).filter(m => m.child_id === childId);
  if (unplayedOnly) msgs = msgs.filter(m => !m.played);
  return [...msgs].reverse();
}

function markVoiceMessagePlayed(id) {
  const msg = (data.voice_messages || []).find(m => m.id === Number(id));
  if (!msg) return null;
  msg.played = 1;
  save(data);
  return msg;
}

function deleteVoiceMessage(id) {
  if (!data.voice_messages) return false;
  const idx = data.voice_messages.findIndex(m => m.id === Number(id));
  if (idx < 0) return false;
  const msg = data.voice_messages[idx];
  data.voice_messages.splice(idx, 1);
  save(data);
  return msg;
}

// ============================================================
// PHOTO EVIDENCE
// ============================================================

function insertPhoto({ child_id, task_id, task_name, photo_path }) {
  const photo = {
    id: nextId(data.photos || []),
    child_id,
    task_id,
    task_name,
    photo_path,
    created_at: now(),
  };
  if (!data.photos) data.photos = [];
  data.photos.push(photo);
  save(data);
  return photo;
}

function getPhotos(childId, limit = 50) {
  let photos = (data.photos || []);
  if (childId) photos = photos.filter(p => p.child_id === childId);
  return [...photos].reverse().slice(0, limit);
}

function deletePhoto(id) {
  if (!data.photos) return false;
  const idx = data.photos.findIndex(p => p.id === Number(id));
  if (idx < 0) return false;
  const photo = data.photos[idx];
  data.photos.splice(idx, 1);
  save(data);
  return photo;
}

// ============================================================
// GARDEN
// ============================================================

const PLANT_TYPES = [
  { id: 'rose',      name: '玫瑰',      cost: 3,  emoji: '🌹', stages: ['🌱', '🌿', '🌹'], grow_days: 3, harvest_coins: 5  },
  { id: 'tulip',     name: '郁金香',    cost: 2,  emoji: '🌷', stages: ['🌱', '🌿', '🌷'], grow_days: 2, harvest_coins: 3  },
  { id: 'sunflower', name: '向日葵',    cost: 5,  emoji: '🌻', stages: ['🌱', '🌿', '🌻'], grow_days: 5, harvest_coins: 10 },
  { id: 'cactus',    name: '小仙人掌',  cost: 4,  emoji: '🌵', stages: ['🌱', '🌿', '🌵'], grow_days: 4, harvest_coins: 8  },
];

function getPlantTypes() { return PLANT_TYPES; }

function getGarden(childId) {
  if (!data.gardens) data.gardens = {};
  if (!data.gardens[childId]) data.gardens[childId] = { plants: [] };
  // Update plant stages based on current time
  data.gardens[childId].plants.forEach(p => {
    const planted = new Date(p.planted_at);
    const now = new Date();
    const daysSince = (now - planted) / (1000 * 60 * 60 * 24);
    const type = PLANT_TYPES.find(t => t.id === p.type);
    if (!type) return;
    p.stage = Math.min(2, Math.floor(daysSince * 2 / type.grow_days));
    p.is_mature = daysSince >= type.grow_days;
    p.days_since_water = p.last_watered
      ? Math.floor((now - new Date(p.last_watered)) / (1000 * 60 * 60 * 24))
      : 0;
  });
  return data.gardens[childId];
}

function plantSeed(childId, plantTypeId) {
  const child = getChild(childId);
  const type = PLANT_TYPES.find(t => t.id === plantTypeId);
  if (!child || !type) return { error: '无效' };
  if (child.coins < type.cost) return { error: '金币不够' };
  child.coins -= type.cost;
  const garden = getGarden(childId);
  const plant = {
    id: Date.now(),
    type: plantTypeId,
    planted_at: now(),
    last_watered: now(),
    stage: 0,
    is_mature: false,
  };
  garden.plants.push(plant);
  insertTransaction(childId, { task_name: `种植: ${type.name}`, coins_earned: -type.cost });
  save(data);
  return { success: true, plant, new_balance: child.coins };
}

function waterPlant(childId, plantId) {
  const garden = getGarden(childId);
  const plant = garden.plants.find(p => p.id === Number(plantId));
  if (!plant) return { error: '找不到植物' };
  plant.last_watered = now();
  save(data);
  return { success: true, plant };
}

function harvestPlant(childId, plantId) {
  const garden = getGarden(childId);
  const idx = garden.plants.findIndex(p => p.id === Number(plantId));
  if (idx < 0) return { error: '找不到植物' };
  const plant = garden.plants[idx];
  if (!plant.is_mature) return { error: '还没长大' };
  const type = PLANT_TYPES.find(t => t.id === plant.type);
  const reward = type.harvest_coins;
  addCoins(childId, reward);
  insertTransaction(childId, { task_name: `收获: ${type.name}`, coins_earned: reward });
  garden.plants.splice(idx, 1);
  save(data);
  return { success: true, reward, new_balance: getChild(childId).coins };
}

// ============================================================
// HOLIDAY EVENTS
// ============================================================

function getActiveHoliday() {
  const today = new Date();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  for (const h of (data.holidays_catalog || [])) {
    if (h.month !== m) continue;
    const diff = Math.abs(h.day - d);
    if (diff <= (h.range || 0)) {
      return { ...h, is_today: h.day === d };
    }
  }
  return null;
}

// ============================================================
// BACKUP / RESTORE
// ============================================================

function createBackup() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', '..', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `kelly-coins-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));

  // Keep last 30 backups, delete older
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort();
  while (files.length > 30) {
    fs.unlinkSync(path.join(backupDir, files.shift()));
  }
  return { backup_path: backupPath, timestamp: ts };
}

function listBackups() {
  const backupDir = path.join(__dirname, '..', '..', 'backups');
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .map(f => {
      const stat = fs.statSync(path.join(backupDir, f));
      return { filename: f, size: stat.size, created: stat.mtime.toISOString() };
    });
}

function restoreBackup(filename) {
  const backupDir = path.join(__dirname, '..', '..', 'backups');
  const filePath = path.join(backupDir, filename);
  if (!fs.existsSync(filePath)) return { error: '备份文件不存在' };
  // Safety: backup current state first
  createBackup();
  const restored = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data = restored;
  save(data);
  return { success: true };
}

// Auto-backup on every save (lightweight: just touch a file daily)
let lastDailyBackup = null;
function maybeAutoBackup() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastDailyBackup === today) return;
  lastDailyBackup = today;
  createBackup();
}

// ============================================================
// PARENT SETTINGS / PIN
// ============================================================

const crypto = require('crypto');

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

function setParentPin(pin) {
  if (!data.parent_settings) data.parent_settings = {};
  if (!pin) {
    data.parent_settings.pin_hash = null;
  } else {
    data.parent_settings.pin_hash = hashPin(pin);
  }
  save(data);
  return true;
}

function verifyParentPin(pin) {
  if (!data.parent_settings || !data.parent_settings.pin_hash) return true; // no PIN set = open
  return data.parent_settings.pin_hash === hashPin(pin);
}

function hasParentPin() {
  return !!(data.parent_settings && data.parent_settings.pin_hash);
}

function getParentSettings() {
  return data.parent_settings || {};
}

function updateParentSettings(fields) {
  if (!data.parent_settings) data.parent_settings = {};
  Object.assign(data.parent_settings, fields);
  save(data);
  return data.parent_settings;
}

// ---- Parent sessions (device-scoped login tokens) ----
// Stored per-device so a logout on one iPhone doesn't invalidate the
// session on a second parent device.

function _sessionBucket() {
  if (!data.parent_sessions) data.parent_sessions = {};
  return data.parent_sessions;
}

function createParentSession(token, { deviceId, deviceName }) {
  const now = new Date().toISOString();
  _sessionBucket()[token] = {
    device_id: deviceId || 'unknown',
    device_name: deviceName || 'unknown device',
    role: 'parent',
    created_at: now,
    last_seen: now,
  };
  save(data);
}

function getParentSession(token) {
  if (!token) return null;
  const s = _sessionBucket()[token];
  if (!s) return null;
  // TTL: 30 days since creation
  const age = Date.now() - new Date(s.created_at).getTime();
  if (age > 30 * 24 * 60 * 60 * 1000) {
    delete _sessionBucket()[token];
    save(data);
    return null;
  }
  s.last_seen = new Date().toISOString();
  return s;
}

function deleteParentSession(token) {
  const b = _sessionBucket();
  if (b[token]) {
    delete b[token];
    save(data);
    return true;
  }
  return false;
}

function listParentSessions() {
  return Object.entries(_sessionBucket()).map(([token, s]) => ({
    token_preview: token.slice(0, 8) + '…',
    ...s,
  }));
}

// ---- Push subscriptions (web-push) ----
// One row per subscription endpoint. Tagged with the session token that
// created it so we can revoke all pushes when the parent logs out.

function _pushBucket() {
  if (!data.push_subscriptions) data.push_subscriptions = [];
  return data.push_subscriptions;
}

function addPushSubscription(subscription, { token, deviceId, deviceName }) {
  const b = _pushBucket();
  // Replace any existing subscription with the same endpoint.
  const existing = b.findIndex(s => s.endpoint === subscription.endpoint);
  const record = {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    token,
    device_id: deviceId || 'unknown',
    device_name: deviceName || 'unknown device',
    created_at: new Date().toISOString(),
  };
  if (existing >= 0) b[existing] = record;
  else b.push(record);
  save(data);
  return record;
}

function removePushSubscription(endpoint) {
  const b = _pushBucket();
  const i = b.findIndex(s => s.endpoint === endpoint);
  if (i >= 0) {
    b.splice(i, 1);
    save(data);
    return true;
  }
  return false;
}

function removePushSubscriptionsByToken(token) {
  const b = _pushBucket();
  const before = b.length;
  data.push_subscriptions = b.filter(s => s.token !== token);
  if (before !== data.push_subscriptions.length) save(data);
}

function getParentPushSubscriptions() {
  // Only return subs whose session token still exists and is valid.
  const sessions = _sessionBucket();
  return _pushBucket().filter(s => sessions[s.token]);
}

// ---- Pending actions (unified approval queue) ----
// Every child-initiated spend flows through here. Parent approval
// (or rejection) moves it to a terminal state and applies the real
// database mutation.

function _pendingBucket() {
  if (!data.pending_actions) data.pending_actions = [];
  return data.pending_actions;
}

function createPendingAction({ child_id, action_type, payload }) {
  const action = {
    id: nextId(_pendingBucket()),
    child_id,
    action_type,          // 'purchase' | 'redeem_inventory' | 'redeem_goal'
    payload,              // { reward_id, name, coins_cost, icon_file, icon_emoji, category }
    status: 'pending',    // 'pending' | 'approved' | 'rejected' | 'cancelled'
    created_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by: null,
  };
  _pendingBucket().push(action);
  save(data);
  return action;
}

function getPendingAction(id) {
  return _pendingBucket().find(a => a.id === Number(id));
}

function listPendingActions({ status = null, child_id = null } = {}) {
  let rows = _pendingBucket();
  if (status)   rows = rows.filter(a => a.status === status);
  if (child_id) rows = rows.filter(a => a.child_id === child_id);
  return rows.slice().reverse(); // newest first
}

function updatePendingAction(id, fields) {
  const a = getPendingAction(id);
  if (!a) return null;
  Object.assign(a, fields);
  save(data);
  return a;
}

// ============================================================
// THEMES
// ============================================================

function getThemesCatalog() { return data.themes_catalog || []; }

function setChildTheme(childId, themeId) {
  const child = getChild(childId);
  if (!child) return null;
  child.theme = themeId;
  save(data);
  return themeId;
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function pushNotification(childId, { title, body, type, payload }) {
  if (!data.notifications) data.notifications = [];
  const notif = {
    id: nextId(data.notifications),
    child_id: childId,
    title,
    body,
    type: type || 'info',
    payload: payload || null,
    created_at: now(),
    read: 0,
  };
  data.notifications.push(notif);
  save(data);
  return notif;
}

function getNotifications(childId, unreadOnly = false) {
  let notifs = (data.notifications || []).filter(n => n.child_id === childId);
  if (unreadOnly) notifs = notifs.filter(n => !n.read);
  return [...notifs].reverse();
}

function markNotificationRead(id) {
  const n = (data.notifications || []).find(n => n.id === Number(id));
  if (!n) return null;
  n.read = 1;
  save(data);
  return n;
}

// ============================================================
// HELPERS
// ============================================================

// Level thresholds based on total lifetime earned coins
function computeLevel(totalEarned) {
  if (totalEarned >= 200) return 10;
  if (totalEarned >= 100) return 8;
  if (totalEarned >= 50)  return 6;
  if (totalEarned >= 30)  return 5;
  if (totalEarned >= 20)  return 4;
  if (totalEarned >= 10)  return 3;
  if (totalEarned >= 5)   return 2;
  return 1;
}

// Track lifetime earned (called from earn endpoint)
function trackLifetimeEarned(childId, amount) {
  const child = getChild(childId);
  if (!child) return;
  child.total_earned = (child.total_earned || 0) + amount;
  child.level = computeLevel(child.total_earned);
  save(data);
}

// ============================================================
// LUCKY WHEEL
// ============================================================
//
// Two free spins per day, gated by "shift": the day is split into an AM
// shift (00:00 - 11:59) and a PM shift (12:00 - 23:59). Each shift allows
// one spin. The shift id is `YYYY-MM-DD-AM` or `YYYY-MM-DD-PM` so rolling
// into a new day automatically resets.
//
// Prize pool is deliberately designed for a 4-year-old: every slot is a
// positive outcome (no "nothing"), most spins land on small coin rewards
// and a rare few on bigger rewards so there's genuine variable-ratio
// excitement without ever letting her feel like she lost.

const WHEEL_PRIZES = [
  // Most common: 1 coin — shows up in multiple slots so the wheel has rhythm
  { id: 'coin-1',      label: '1 🪙',       coins: 1,  weight: 28, emoji: '🪙',  palette: 'peach' },
  { id: 'coin-2',      label: '2 🪙',       coins: 2,  weight: 22, emoji: '🪙',  palette: 'butter' },
  { id: 'star-gift',   label: '小惊喜',      coins: 1,  weight: 14, emoji: '🌟', palette: 'mint' },
  { id: 'coin-3',      label: '3 🪙',       coins: 3,  weight: 12, emoji: '✨', palette: 'rose' },
  { id: 'rainbow',     label: '彩虹2 🪙',   coins: 2,  weight: 10, emoji: '🌈', palette: 'lavender' },
  { id: 'coin-5',      label: '5 🪙',       coins: 5,  weight: 7,  emoji: '💖', palette: 'peach' },
  { id: 'lucky-star',  label: '幸运星',      coins: 4,  weight: 4,  emoji: '⭐', palette: 'butter' },
  { id: 'jackpot',     label: '大奖10 🪙',  coins: 10, weight: 3,  emoji: '🎁', palette: 'rose' },
];

function currentShiftId(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const shift = now.getHours() < 12 ? 'AM' : 'PM';
  return `${y}-${m}-${d}-${shift}`;
}

// Describes when the next spin becomes available (for friendly UI messages).
function nextShiftWindow(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return { when: 'noon', label: '中午12点', messageKey: 'wait-noon' };
  return { when: 'midnight', label: '明天早上', messageKey: 'wait-tomorrow' };
}

function getWheelStatus(childId) {
  const child = getChild(childId);
  if (!child) return null;
  if (!child.wheel) child.wheel = { last_shift: null, spins_in_shift: 0, total_spins: 0 };
  const unlimited = !!child.wheel_unlimited;
  const shiftId = currentShiftId();
  const spinsPerShift = 1;
  const canSpin = unlimited
    || child.wheel.last_shift !== shiftId
    || child.wheel.spins_in_shift < spinsPerShift;
  return {
    canSpin,
    unlimited,
    shiftId,
    spinsInShift: child.wheel.last_shift === shiftId ? child.wheel.spins_in_shift : 0,
    spinsPerShift,
    totalSpins: child.wheel.total_spins || 0,
    nextWindow: canSpin ? null : nextShiftWindow(),
    prizes: WHEEL_PRIZES.map(p => ({ id: p.id, label: p.label, coins: p.coins, emoji: p.emoji, palette: p.palette })),
  };
}

// Weighted random prize pick
function pickWheelPrize() {
  const total = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of WHEEL_PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return WHEEL_PRIZES[0];
}

function spinWheel(childId) {
  const child = getChild(childId);
  if (!child) return { error: '找不到该小朋友' };
  if (!child.wheel) child.wheel = { last_shift: null, spins_in_shift: 0, total_spins: 0 };
  const unlimited = !!child.wheel_unlimited;

  const shiftId = currentShiftId();
  if (!unlimited && child.wheel.last_shift === shiftId && child.wheel.spins_in_shift >= 1) {
    return {
      error: 'cooldown',
      nextWindow: nextShiftWindow(),
    };
  }

  // Consume one spin from this shift (still tracked even in unlimited mode
  // so the per-shift counter stays meaningful if parent flips the toggle
  // off mid-day).
  if (child.wheel.last_shift !== shiftId) {
    child.wheel.last_shift = shiftId;
    child.wheel.spins_in_shift = 0;
  }
  child.wheel.spins_in_shift += 1;
  child.wheel.total_spins = (child.wheel.total_spins || 0) + 1;

  const prize = pickWheelPrize();
  // Always award the prize; the minimum in the pool is 1 coin so there's no
  // failure state for Kelly. Track as lifetime earned too.
  const new_balance = addCoins(childId, prize.coins);
  trackLifetimeEarned(childId, prize.coins);
  insertTransaction(childId, { task_name: `幸运转盘 · ${prize.label}`, coins_earned: prize.coins });
  save(data);

  return {
    success: true,
    prize_id: prize.id,
    prize_index: WHEEL_PRIZES.findIndex(p => p.id === prize.id),
    coins: prize.coins,
    label: prize.label,
    new_balance,
    status: getWheelStatus(childId),
  };
}

module.exports = {
  getChildren, getChild, upsertChild,
  getBalance, addCoins, deductCoins,
  getTasks, getTask, insertTask, updateTask,
  getRewards, getReward, insertReward, updateReward,
  insertTransaction, getTransactions,
  insertRedemption, getRedemption, getPendingRedemptions, updateRedemptionStatus,
  getSkins, getSkin, getSkinsForChild, buySkin, equipSkin,
  getInventory, purchaseItem, redeemFromInventory,
  // New
  getAchievementsCatalog, getChildAchievements, checkAndUnlockAchievements,
  updateStreak, getStreak,
  setActiveGoal, getActiveGoal,
  getOrCreateDailyQuest, markDailyQuestComplete,
  insertVoiceMessage, getVoiceMessages, markVoiceMessagePlayed, deleteVoiceMessage,
  insertPhoto, getPhotos, deletePhoto,
  getPlantTypes, getGarden, plantSeed, waterPlant, harvestPlant,
  getActiveHoliday,
  createBackup, listBackups, restoreBackup, maybeAutoBackup,
  hashPin, setParentPin, verifyParentPin, hasParentPin, getParentSettings, updateParentSettings,
  createParentSession, getParentSession, deleteParentSession, listParentSessions,
  addPushSubscription, removePushSubscription, removePushSubscriptionsByToken, getParentPushSubscriptions,
  createPendingAction, getPendingAction, listPendingActions, updatePendingAction,
  getThemesCatalog, setChildTheme,
  pushNotification, getNotifications, markNotificationRead,
  trackLifetimeEarned,
  // Lucky wheel
  getWheelStatus, spinWheel, WHEEL_PRIZES,
};
