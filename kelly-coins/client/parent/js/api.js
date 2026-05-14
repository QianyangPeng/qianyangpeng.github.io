/**
 * API client for parent dashboard.
 * All endpoints return parsed JSON.
 *
 * Token handling:
 *   - Stored in localStorage under `parent-token`
 *   - Auto-attached as X-Parent-Token header to every request
 *   - On 401 response, callers can re-auth by clearing the token
 */

const BASE = '/api/parent';
const TOKEN_KEY = 'parent-token';

// ===== Token Storage =====

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (_) {}
}

export function clearToken() {
  setToken('');
}

// ===== Core Request Helper =====

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers['X-Parent-Token'] = token;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Invalid or missing token — clear it so the auth screen takes over
    clearToken();
    const text = await res.text().catch(() => '');
    const err = new Error(text || 'Unauthorized');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`API ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Raw fetch helper that still includes the token but does NOT set Content-Type. */
async function rawRequest(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['X-Parent-Token'] = token;

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`API ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  // Some endpoints may return empty body
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

// ===== Auth =====

export function getAuthStatus() {
  return request(`${BASE}/auth/status`);
}

export async function parentLogin(pin) {
  const res = await request(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
  const token = res.token || res.data?.token;
  if (token) setToken(token);
  return res;
}

export async function parentLogout() {
  try {
    await request(`${BASE}/auth/logout`, { method: 'POST' });
  } catch (_) {
    // Even if the server call fails, clear the local token
  } finally {
    clearToken();
  }
}

export function setPin(pin) {
  return request(`${BASE}/auth/set-pin`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

export async function removePin() {
  const res = await request(`${BASE}/auth/pin`, { method: 'DELETE' });
  // After removing the PIN, the existing token is no longer needed
  clearToken();
  return res;
}

// ===== Children =====

export function getChildren() {
  return request(`${BASE}/children`);
}

export function createChild(data) {
  return request(`${BASE}/children`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateChild(id, data) {
  return request(`${BASE}/children/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ===== Pending Approvals (legacy redemption-only queue) =====

export function getPending(childId) {
  const qs = childId ? `?child=${childId}` : '';
  return request(`${BASE}/pending${qs}`);
}

export function approveRedemption(id) {
  return request(`${BASE}/approve/${id}`, { method: 'POST' });
}

export function rejectRedemption(id) {
  return request(`${BASE}/reject/${id}`, { method: 'POST' });
}

// ===== Unified pending_actions queue (new approval flow) =====
// Every child-initiated purchase/redeem lives here, including cost preview
// and the exact payload to apply on approval.

export function getPendingActions() {
  return request(`${BASE}/approvals`);
}

export function approvePendingAction(id) {
  return request(`${BASE}/approvals/${id}/approve`, { method: 'POST' });
}

export function rejectPendingAction(id, reason = null) {
  return request(`${BASE}/approvals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ===== Web Push subscription =====

export function subscribeToPush(subscription, { deviceId, deviceName }) {
  return request(`${BASE}/push/subscribe`, {
    method: 'POST',
    body: JSON.stringify({
      subscription,
      device_id: deviceId,
      device_name: deviceName,
    }),
  });
}

export function unsubscribeFromPush(endpoint) {
  return request(`${BASE}/push/unsubscribe`, {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  });
}

// ===== Tasks =====

export function getTasks() {
  return request(`${BASE}/tasks`);
}

export function createTask(data) {
  return request(`${BASE}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTask(id, data) {
  return request(`${BASE}/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ===== Rewards =====

export function getRewards() {
  return request(`${BASE}/rewards`);
}

export function createReward(data) {
  return request(`${BASE}/rewards`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateReward(id, data) {
  return request(`${BASE}/rewards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ===== History =====

export function getHistory(childId, limit = 50) {
  const params = new URLSearchParams();
  if (childId) params.set('child', childId);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  return request(`${BASE}/history${qs ? '?' + qs : ''}`);
}

// ===== Coin Adjustment =====

export function adjustCoins(childId, coins, note) {
  return request(`${BASE}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ child: childId, coins, note }),
  });
}

// ===== Backups =====

export function getBackups() {
  return request(`${BASE}/backups`);
}

export function createBackup() {
  return request(`${BASE}/backup`, { method: 'POST' });
}

export function restoreBackup(filename) {
  return request(`${BASE}/restore`, {
    method: 'POST',
    body: JSON.stringify({ filename }),
  });
}

// ===== Reports =====

export function getReports() {
  return request(`${BASE}/reports`);
}

export function generateReport() {
  return request(`${BASE}/reports/generate`, { method: 'POST' });
}

// ===== Voice Messages =====

export function getVoiceMessages(childId) {
  const qs = childId ? `?child=${childId}` : '';
  return request(`/api/voice-messages${qs}`);
}

export async function uploadVoiceMessage(childId, blob, category = 'general', label = '', duration = 0) {
  const params = new URLSearchParams();
  if (childId) params.set('child', childId);
  if (category) params.set('category', category);
  if (label) params.set('label', label);
  if (duration) params.set('duration', String(Math.round(duration)));

  const url = `/api/voice-messages?${params.toString()}`;
  return rawRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'audio/webm' },
    body: blob,
  });
}

export function deleteVoiceMessage(id) {
  return request(`/api/voice-messages/${id}`, { method: 'DELETE' });
}

// ===== Photos =====

export function getPhotos(childId) {
  const qs = childId ? `?child=${childId}` : '';
  return request(`/api/photos${qs}`);
}

export function deletePhoto(id) {
  return request(`/api/photos/${id}`, { method: 'DELETE' });
}
