/**
 * Main application controller for the parent dashboard.
 * Hash-based routing with ES module pages.
 *
 * Boot sequence:
 *   1. Check /auth/status. If a PIN is set and we don't have a valid token,
 *      show the auth screen until the parent successfully logs in.
 *   2. If no PIN is set, render the dashboard immediately. The parent can
 *      set a PIN later from the Settings page.
 */

import { renderNav, setActiveNav, updateBadge } from './components/nav.js';
import { getPending, getPendingActions, getChildren, getAuthStatus, getToken } from './api.js';
import { showToast } from './components/toast.js';
import { enablePush, disablePush } from './push.js';
import { openStream, closeStream, onEvent } from './events.js';

import dashboardPage      from './pages/dashboard.js';
import approvalsPage      from './pages/approvals.js';
import tasksPage          from './pages/tasks.js';
import rewardsPage        from './pages/rewards.js';
import childrenPage       from './pages/children.js';
import historyPage        from './pages/history.js';
import voiceMessagesPage  from './pages/voice-messages.js';
import photosPage         from './pages/photos.js';
import settingsPage       from './pages/settings.js';

import { showAuthScreen } from './pages/auth.js';

// ===== Page Registry =====
const pages = [
  dashboardPage,
  approvalsPage,
  tasksPage,
  rewardsPage,
  childrenPage,
  historyPage,
  voiceMessagesPage,
  photosPage,
  settingsPage,
];
const pageMap = {};
pages.forEach(p => { pageMap[p.id] = p; });

let currentPage = null;
let refreshTimer = null;

// ===== Header =====
function renderHeader() {
  const header = document.getElementById('app-header');
  header.innerHTML = `
    <div class="header-title">
      <span class="icon">🪙</span>
      <h1>Kelly Coins 家长端</h1>
    </div>
    <select class="child-selector" id="global-child-selector">
      <option value="">全部孩子</option>
    </select>
  `;

  // Load children into the selector
  loadChildSelector();
}

async function loadChildSelector() {
  try {
    const res = await getChildren();
    const children = res.data || res || [];
    const select = document.getElementById('global-child-selector');
    if (!select) return;

    children.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  } catch (_) {}
}

// ===== Navigation =====
function setupNav() {
  const nav = document.getElementById('app-nav');
  renderNav(nav, navigateTo);
}

// ===== Router =====
function navigateTo(pageId) {
  window.location.hash = '#' + pageId;
}

async function handleRoute() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  const page = pageMap[hash] || dashboardPage;

  // Unmount current
  if (currentPage && currentPage.unmount) {
    try { currentPage.unmount(); } catch (_) {}
  }

  // Render new page
  const content = document.getElementById('app-content');
  content.innerHTML = page.render();
  setActiveNav(page.id);

  // Mount
  currentPage = page;
  if (page.mount) {
    try {
      await page.mount();
    } catch (err) {
      // 401 from inside a page mount: re-show auth screen
      if (err && err.status === 401) {
        await bootApp();
      } else {
        console.error('Page mount error:', err);
      }
    }
  }
}

// ===== Background Refresh =====
async function backgroundRefresh() {
  try {
    const [legacy, neo] = await Promise.all([
      getPending().catch(() => ({ data: [] })),
      getPendingActions().catch(() => ({ data: { pending: [] } })),
    ]);
    const legacyItems = legacy?.data || legacy || [];
    const actionItems = neo?.data?.pending || [];
    updateBadge(legacyItems.length + actionItems.length);
  } catch (_) {}
}

// ===== Live event plumbing (SSE + push) =====

let bellAudio = null;
function playBell() {
  // Tiny synthesized bell via WebAudio so we don't ship an mp3.
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!bellAudio) bellAudio = new AC();
    const ctx = bellAudio;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.22, now + i * 0.08 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(now + i * 0.08);
      o.stop(now + i * 0.08 + 0.4);
    });
  } catch (_) {}
}

function wireLiveEvents() {
  openStream();

  // New request: toast + bell + badge bump, regardless of current page
  onEvent('action-created', (e) => {
    playBell();
    if (navigator.vibrate) { try { navigator.vibrate([30, 20, 30]); } catch {} }
    const payloadName = e.action?.payload?.name || '新请求';
    showToast(`🔔 ${e.action?.child_id || ''} 想要 ${payloadName}`);
    backgroundRefresh(); // bump the badge
  });

  // Resolved anywhere (maybe on another device) — refresh the badge
  ['action-approved', 'action-rejected', 'action-cancelled'].forEach(type =>
    onEvent(type, backgroundRefresh)
  );

  // Service worker message: parent tapped a push notification → jump to approvals
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'notification-click') {
        window.location.hash = '#approvals';
      }
    });
  }
}

async function enablePushIfPossible() {
  try {
    const status = await getAuthStatus();
    const vapid = status.vapid_public_key || status.data?.vapid_public_key;
    if (!vapid) return;
    // Fire-and-forget; non-fatal if the browser refuses.
    await enablePush(vapid).catch(() => {});
  } catch (_) {}
}

// ===== Boot / Auth Flow =====

async function bootApp() {
  // Stop any existing background refresh while we re-check auth
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  let needsAuth = false;
  try {
    const status = await getAuthStatus();
    const hasPin = status.has_pin ?? status.data?.has_pin ?? false;
    if (hasPin && !getToken()) {
      needsAuth = true;
    }
  } catch (err) {
    // If status returns 401, we definitely need auth
    if (err && err.status === 401) needsAuth = true;
  }

  if (needsAuth) {
    showAuthScreen(async () => {
      await startDashboard();
    });
    return;
  }

  await startDashboard();
}

async function startDashboard() {
  renderHeader();
  setupNav();

  // Verify token is still valid by attempting a protected call.
  // If it fails with 401, the api helper clears the token; bounce back to auth.
  try {
    await backgroundRefresh();
  } catch (err) {
    if (err && err.status === 401) {
      return bootApp();
    }
  }

  await handleRoute();

  // Open the SSE event stream so the dashboard gets live updates for new
  // pending requests, approvals made from another device, etc.
  wireLiveEvents();

  // Kick off web-push subscription if the browser supports it and the user
  // hasn't already denied permission. This is the notification path used
  // when the parent is NOT actively looking at the dashboard.
  enablePushIfPossible();

  // Slow fallback refresh every 60s in case the SSE connection dropped
  // without a reconnect event firing.
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(backgroundRefresh, 60000);
}

// ===== Init =====
function init() {
  window.addEventListener('hashchange', handleRoute);
  bootApp();
}

document.addEventListener('DOMContentLoaded', init);
