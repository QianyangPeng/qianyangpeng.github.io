/**
 * Pending approvals page.
 *
 * Shows BOTH the new unified pending_actions queue (all purchases and
 * inventory redemptions) AND the legacy /api/parent/pending queue
 * (old-style direct redemptions that predate the new flow). They render
 * in one list, newest first.
 *
 * Subscribes to the SSE event stream so new requests appear instantly
 * without a manual refresh, and an approved/rejected action fades out
 * of the list the moment any device confirms it.
 */
import {
  getPending, approveRedemption, rejectRedemption,
  getPendingActions, approvePendingAction, rejectPendingAction,
} from '../api.js';
import { showToast } from '../components/toast.js';
import { confirm } from '../components/modal.js';
import { updateBadge } from '../components/nav.js';
import { onEvent } from '../events.js';

// Two separate internal sources, merged into a single list for rendering.
let pendingActions = []; // new unified queue
let legacyItems = [];    // old /api/parent/pending rows
let unsubscribeEvents = [];

function countAll() {
  return pendingActions.length + legacyItems.length;
}

export default {
  id: 'approvals',

  render() {
    return `
      <div class="section-title">待审批的请求</div>
      <div id="approvals-list"></div>
    `;
  },

  async mount() {
    await this.loadAll();
    // Live updates via SSE — new requests animate in, resolved ones fall off.
    unsubscribeEvents.push(onEvent('action-created', (e) => {
      if (e.action && !pendingActions.find(a => a.id === e.action.id)) {
        pendingActions.unshift(e.action);
        updateBadge(countAll());
        this.renderList();
      }
    }));
    const dropResolved = (e) => {
      if (!e.action) return;
      pendingActions = pendingActions.filter(a => a.id !== e.action.id);
      updateBadge(countAll());
      this.renderList();
    };
    unsubscribeEvents.push(onEvent('action-approved',  dropResolved));
    unsubscribeEvents.push(onEvent('action-rejected',  dropResolved));
    unsubscribeEvents.push(onEvent('action-cancelled', dropResolved));
  },

  unmount() {
    unsubscribeEvents.forEach(fn => fn());
    unsubscribeEvents = [];
  },

  async loadAll() {
    try {
      const [newRes, legacyRes] = await Promise.all([
        getPendingActions().catch(() => ({ data: { pending: [] } })),
        getPending().catch(() => ({ data: [] })),
      ]);
      pendingActions = newRes?.data?.pending || [];
      legacyItems = legacyRes?.data || legacyRes || [];
      updateBadge(countAll());
      this.renderList();
    } catch (err) {
      console.error('Approvals load error:', err);
    }
  },

  renderList() {
    const container = document.getElementById('approvals-list');
    if (!container) return;

    if (countAll() === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <div class="empty-text">太棒了，没有待审批的请求！</div>
        </div>
      `;
      return;
    }

    // Render the new unified actions first (they have richer metadata),
    // then any legacy rows underneath.
    const newRows = pendingActions.map(a => this._actionRow(a)).join('');
    const legacyRows = legacyItems.map(it => this._legacyRow(it)).join('');

    container.innerHTML = newRows + legacyRows;

    container.onclick = async (e) => {
      const approveActionId = e.target.dataset.approveAction;
      const rejectActionId  = e.target.dataset.rejectAction;
      const approveLegacyId = e.target.dataset.approveLegacy;
      const rejectLegacyId  = e.target.dataset.rejectLegacy;
      if (approveActionId) await this.doApproveAction(approveActionId);
      if (rejectActionId)  await this.doRejectAction(rejectActionId);
      if (approveLegacyId) await this.doApproveLegacy(approveLegacyId);
      if (rejectLegacyId)  await this.doRejectLegacy(rejectLegacyId);
    };
  },

  _actionRow(a) {
    const iconHtml = a.payload?.icon_file
      ? `<img src="/child/assets/icons/rewards/${a.payload.icon_file}.png" alt="" class="icon-thumb">`
      : (a.payload?.icon_emoji || '🎁');
    const verb = a.action_type === 'purchase'
      ? '想买'
      : a.action_type === 'redeem_inventory'
      ? '想兑换（背包）'
      : '想兑换';
    const cost = a.payload?.coins_cost ? ` · ${a.payload.coins_cost} 🪙` : '';
    return `
      <div class="approval-item" data-action-id="${a.id}">
        <div class="approval-top">
          <div class="approval-icon">${iconHtml}</div>
          <div class="approval-info">
            <div class="approval-title">${a.payload?.name || '未知物品'}</div>
            <div class="approval-meta">
              ${a.child_id || ''} · ${verb}${cost} · ${formatTime(a.created_at)}
            </div>
          </div>
        </div>
        <div class="approval-actions">
          <button class="btn btn-danger btn-sm"  data-reject-action="${a.id}">拒绝</button>
          <button class="btn btn-success btn-sm" data-approve-action="${a.id}">批准</button>
        </div>
      </div>
    `;
  },

  _legacyRow(it) {
    return `
      <div class="approval-item" data-approval-id="${it.id}">
        <div class="approval-top">
          <div class="approval-icon">${it.reward_icon || '🎁'}</div>
          <div class="approval-info">
            <div class="approval-title">${it.reward_name || '未知奖励'}</div>
            <div class="approval-meta">
              ${it.child_name || ''} · ${it.coins_spent || it.coins_cost || 0} 🪙 · ${formatTime(it.created_at)}
            </div>
          </div>
        </div>
        <div class="approval-actions">
          <button class="btn btn-danger btn-sm"  data-reject-legacy="${it.id}">拒绝</button>
          <button class="btn btn-success btn-sm" data-approve-legacy="${it.id}">批准</button>
        </div>
      </div>
    `;
  },

  // ---- New unified actions ----

  async doApproveAction(id) {
    try {
      await approvePendingAction(id);
      pendingActions = pendingActions.filter(a => String(a.id) !== String(id));
      updateBadge(countAll());
      this.renderList();
      showToast('已批准');
    } catch (err) {
      showToast('操作失败: ' + (err.message || 'unknown'));
    }
  },

  async doRejectAction(id) {
    const ok = await confirm('确认拒绝', '拒绝后金币会退给孩子，确定吗？', '拒绝', '取消');
    if (!ok) return;
    try {
      await rejectPendingAction(id);
      pendingActions = pendingActions.filter(a => String(a.id) !== String(id));
      updateBadge(countAll());
      this.renderList();
      showToast('已拒绝');
    } catch (err) {
      showToast('操作失败');
    }
  },

  // ---- Legacy redemptions ----

  async doApproveLegacy(id) {
    try {
      await approveRedemption(id);
      legacyItems = legacyItems.filter(i => String(i.id) !== String(id));
      updateBadge(countAll());
      this.renderList();
      showToast('已批准');
    } catch (err) {
      showToast('操作失败');
    }
  },

  async doRejectLegacy(id) {
    const ok = await confirm('确认拒绝', '拒绝后金币将退还给孩子，确定要拒绝吗？', '拒绝', '取消');
    if (!ok) return;
    try {
      await rejectRedemption(id);
      legacyItems = legacyItems.filter(i => String(i.id) !== String(id));
      updateBadge(countAll());
      this.renderList();
      showToast('已拒绝，金币已退还');
    } catch (err) {
      showToast('操作失败');
    }
  },
};

function formatTime(ts) {
  if (!ts) return '';
  return String(ts).slice(0, 16).replace('T', ' ');
}
