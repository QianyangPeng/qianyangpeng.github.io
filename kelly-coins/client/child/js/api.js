// API client for child-facing endpoints
// All requests include the childId as a query parameter

const BASE = '';

let _childId = 'kelly';

export function setChildId(id) {
  _childId = id;
}

export function getChildId() {
  return _childId;
}

function qs(extra = {}) {
  const params = new URLSearchParams({ child: _childId, ...extra });
  return '?' + params.toString();
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || '请求失败');
  }
  return data;
}

// Fetch balance and profile for current child
export async function fetchProfile() {
  return request(`${BASE}/api/balance${qs()}`);
}

// Fetch list of all children (for child selector)
export async function fetchChildren() {
  const res = await request(`${BASE}/api/children`);
  return res.data;
}

// Fetch active tasks
export async function fetchTasks() {
  const res = await request(`${BASE}/api/tasks`);
  return res.data;
}

// Fetch active rewards
export async function fetchRewards() {
  const res = await request(`${BASE}/api/rewards`);
  return res.data;
}

// Complete a task and earn coins
export async function earnCoins(taskId) {
  return request(`${BASE}/api/earn${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId })
  });
}

// Legacy redeem (buy + request approval in one step) — kept for goal flow
export async function redeemReward(rewardId) {
  return request(`${BASE}/api/redeem${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ reward_id: rewardId })
  });
}

// Purchase an item (instant, adds to inventory, no parent approval)
export async function purchaseItem(rewardId) {
  return request(`${BASE}/api/purchase${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ reward_id: rewardId })
  });
}

// Get inventory (items already bought, not yet redeemed)
export async function fetchInventory() {
  const res = await request(`${BASE}/api/inventory${qs()}`);
  return res.data;
}

// Redeem an item from inventory (creates pending redemption for parent approval)
export async function redeemFromInventory(rewardId) {
  return request(`${BASE}/api/inventory/redeem${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ reward_id: rewardId })
  });
}

// Fetch transaction history
export async function fetchHistory(limit = 20) {
  const res = await request(`${BASE}/api/history${qs({ limit })}`);
  return res.data;
}

// Fetch all skins with owned/equipped status
export async function fetchSkins() {
  const res = await request(`${BASE}/api/skins${qs()}`);
  return res.data;
}

// Buy a skin
export async function buySkin(skinId) {
  return request(`${BASE}/api/skins/buy${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ skin_id: skinId })
  });
}

// Equip an owned skin
export async function equipSkin(skinId) {
  return request(`${BASE}/api/skins/equip${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ skin_id: skinId })
  });
}

// ---- Achievements ----
export async function fetchAchievements() {
  const res = await request(`${BASE}/api/achievements${qs()}`);
  return res.data;
}

// ---- Streak ----
export async function fetchStreak() {
  const res = await request(`${BASE}/api/streak${qs()}`);
  return res.data;
}

// ---- Goal ----
export async function fetchGoal() {
  const res = await request(`${BASE}/api/goal${qs()}`);
  return res.data;
}

export async function setGoal(rewardId) {
  return request(`${BASE}/api/goal${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ reward_id: rewardId })
  });
}

// ---- Daily Quest ----
export async function fetchDailyQuest() {
  const res = await request(`${BASE}/api/daily-quest${qs()}`);
  return res.data;
}

// ---- Voice messages ----
export async function fetchVoiceMessages(unplayedOnly = false) {
  const url = `${BASE}/api/voice-messages${qs(unplayedOnly ? { unplayed: '1' } : {})}`;
  const res = await request(url);
  return res.data;
}

export async function markVoicePlayed(id) {
  return request(`${BASE}/api/voice-messages/${id}/played`, { method: 'POST' });
}

// ---- Garden ----
export async function fetchPlantTypes() {
  const res = await request(`${BASE}/api/garden/types`);
  return res.data;
}

export async function fetchGarden() {
  const res = await request(`${BASE}/api/garden${qs()}`);
  return res.data;
}

export async function plantSeed(plantType) {
  return request(`${BASE}/api/garden/plant${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ plant_type: plantType })
  });
}

export async function waterPlant(plantId) {
  return request(`${BASE}/api/garden/water/${plantId}${qs()}`, { method: 'POST' });
}

export async function harvestPlant(plantId) {
  return request(`${BASE}/api/garden/harvest/${plantId}${qs()}`, { method: 'POST' });
}

// ---- Holiday ----
export async function fetchHoliday() {
  const res = await request(`${BASE}/api/holiday`);
  return res.data;
}

// ---- Themes ----
export async function fetchThemes() {
  const res = await request(`${BASE}/api/themes`);
  return res.data;
}

export async function setTheme(themeId) {
  return request(`${BASE}/api/theme${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ theme_id: themeId })
  });
}

// ---- Photos ----
export async function uploadPhoto(blob, taskId, taskName) {
  const params = new URLSearchParams({ child: getChildId(), task_id: taskId, task_name: taskName });
  const res = await fetch(`${BASE}/api/photos?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  return res.json();
}

// ---- Mini-game rewards ----
export async function rewardGameCoins(gameId, coins) {
  return request(`${BASE}/api/games/reward${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ game_id: gameId, coins })
  });
}

// ---- Voice-verify games: letters / numbers / colors ----
// Server handles the vocab pack, phonetic aliasing, and Whisper prompt
// biasing. Client just POSTs the audio + pack + expected answer.
export async function verifyVoice(pack, answer, audioBlob) {
  const url = `${BASE}/api/voice-verify${qs({ pack, answer })}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
    body: audioBlob,
  });
  return res.json();
}

// Backward-compat alias — old callers may still import verifyAlphabet.
export async function verifyAlphabet(letter, audioBlob) {
  return verifyVoice('letters', letter, audioBlob);
}

// ---- Lucky wheel ----
export async function fetchWheelStatus() {
  return request(`${BASE}/api/wheel/status${qs()}`);
}

export async function spinWheel() {
  // 429 is an expected response (cooldown), not an error — caller needs the body.
  const url = `${BASE}/api/wheel/spin${qs()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ...data };
}

// ---- Pending actions (parent approval queue) ----
// These replace the instant purchase/redeem endpoints: instead of applying
// the change directly, they create a pending_action that the parent must
// approve before coins move. The child UI polls (or subscribes via SSE) on
// the returned action.id until status leaves 'pending'.

export async function requestPurchase(rewardId) {
  return request(`${BASE}/api/request-purchase${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ reward_id: rewardId }),
  });
}

export async function requestRedeem(rewardId) {
  return request(`${BASE}/api/request-redeem${qs()}`, {
    method: 'POST',
    body: JSON.stringify({ reward_id: rewardId }),
  });
}

export async function fetchPendingAction(id) {
  const res = await request(`${BASE}/api/pending-actions/${id}`);
  return res.action;
}

export async function cancelPendingAction(id) {
  return request(`${BASE}/api/pending-actions/${id}/cancel`, { method: 'POST' });
}

// ---- Notifications ----
export async function fetchNotifications(unreadOnly = false) {
  const url = `${BASE}/api/notifications${qs(unreadOnly ? { unread: '1' } : {})}`;
  const res = await request(url);
  return res.data;
}
