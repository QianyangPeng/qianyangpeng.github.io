// Waiting overlay shown while a pending_action is in limbo.
//
// Flow: child calls requestPurchase() → server returns { action } →
// this overlay opens, subscribes to the server SSE stream for child events,
// and waits for an `action-resolved` event matching our action.id.
//
// Fallback: if SSE doesn't fire within 2s we start a polling loop on
// /api/pending-actions/:id (covers flaky networks / proxies that eat SSE).
//
// On resolution we morph the overlay into one of three states:
//   - approved:  coin burst + item entering the backpack
//   - rejected:  gentle 'maybe next time' message
//   - cancelled: no-op close (child hit the cancel button)
//
// Returns a promise that resolves with the final action object.

import { fetchPendingAction, cancelPendingAction } from '../api.js';
import { sfx } from '../sfx.js';
import { celebrate } from './animations.js';

let rootEl = null;
let sseSource = null;
let pollTimer = null;
let resolvePromise = null;

function closeAll() {
  if (sseSource) {
    try { sseSource.close(); } catch {}
    sseSource = null;
  }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (rootEl) {
    rootEl.classList.remove('action-pending--visible');
    const toRemove = rootEl;
    setTimeout(() => { try { toRemove.remove(); } catch {} }, 300);
    rootEl = null;
  }
}

function mountOverlay(action) {
  rootEl = document.createElement('div');
  rootEl.className = 'action-pending';
  const iconMarkup = action.payload?.icon_file
    ? `<img src="/child/assets/icons/rewards/${action.payload.icon_file}.png" alt="" class="action-pending__icon-img">`
    : `<div class="action-pending__icon-emoji">${action.payload?.icon_emoji || '🎁'}</div>`;
  const costStr = action.payload?.coins_cost ? `${action.payload.coins_cost} 🪙` : '';

  rootEl.innerHTML = `
    <div class="action-pending__backdrop"></div>
    <div class="action-pending__card" role="dialog" aria-live="polite">
      <div class="action-pending__sparkles" aria-hidden="true">
        <span>✨</span><span>⭐</span><span>💫</span><span>✨</span>
      </div>
      <div class="action-pending__icon">${iconMarkup}</div>
      <div class="action-pending__title">${action.payload?.name || '等待批准'}</div>
      <div class="action-pending__cost">${costStr}</div>
      <div class="action-pending__status">等爸爸妈妈批准哦...</div>
      <div class="action-pending__dots" aria-hidden="true"><span></span><span></span><span></span></div>
      <button class="action-pending__cancel" type="button">取消</button>
    </div>
  `;
  document.getElementById('app').appendChild(rootEl);
  requestAnimationFrame(() => rootEl.classList.add('action-pending--visible'));

  rootEl.querySelector('.action-pending__cancel').addEventListener('click', async () => {
    try { await cancelPendingAction(action.id); } catch {}
    const resolved = { ...action, status: 'cancelled' };
    finish(resolved);
  });
}

function transformResolved(action) {
  if (!rootEl) return;
  const card = rootEl.querySelector('.action-pending__card');
  const statusEl = rootEl.querySelector('.action-pending__status');
  const dotsEl = rootEl.querySelector('.action-pending__dots');
  const cancelEl = rootEl.querySelector('.action-pending__cancel');

  if (dotsEl) dotsEl.remove();
  if (cancelEl) cancelEl.remove();

  if (action.status === 'approved') {
    card.classList.add('action-pending__card--approved');
    statusEl.textContent = '🎉 爸爸妈妈同意了！';
    sfx.unlock();
    celebrate();
    // Auto-close after the celebration so the child sees their balance update.
    setTimeout(() => finish(action), 1800);
  } else if (action.status === 'rejected') {
    card.classList.add('action-pending__card--rejected');
    statusEl.textContent = '下次再试试吧 💛';
    sfx.error();
    setTimeout(() => finish(action), 1800);
  } else {
    // cancelled or any other terminal state → just close
    finish(action);
  }
}

function finish(action) {
  const r = resolvePromise;
  resolvePromise = null;
  closeAll();
  if (r) r(action);
}

/**
 * Show the overlay and wait for the action to be resolved. Returns the
 * final action object (status approved | rejected | cancelled).
 */
export function showActionPending(action, { childId }) {
  return new Promise((resolve) => {
    resolvePromise = resolve;
    mountOverlay(action);
    sfx.confirm();

    const handleUpdate = (updated) => {
      if (!updated || updated.id !== action.id) return;
      if (updated.status === 'pending') return;
      transformResolved(updated);
    };

    // 1. SSE subscription on the child channel
    try {
      sseSource = new EventSource(`/api/child-events?child=${encodeURIComponent(childId)}`);
      sseSource.addEventListener('message', (e) => {
        let data;
        try { data = JSON.parse(e.data); } catch { return; }
        if (data.type === 'action-resolved' && data.action) handleUpdate(data.action);
      });
      sseSource.addEventListener('error', () => { /* reconnect handled by browser */ });
    } catch (_) {}

    // 2. Polling fallback — kicks in after 2s and runs every 3s.
    setTimeout(() => {
      pollTimer = setInterval(async () => {
        try {
          const updated = await fetchPendingAction(action.id);
          handleUpdate(updated);
        } catch {}
      }, 3000);
    }, 2000);
  });
}
