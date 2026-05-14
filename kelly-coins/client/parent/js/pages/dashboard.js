/**
 * Dashboard / Overview page.
 */
import { getChildren, getPending, getHistory } from '../api.js';
import { updateBadge } from '../components/nav.js';

export default {
  id: 'dashboard',

  render() {
    return `
      <div class="section-title">总览</div>
      <div class="stats-grid" id="dash-stats">
        <div class="stat-card">
          <div class="stat-value" id="dash-total-coins">--</div>
          <div class="stat-label">总金币</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="dash-today-earned">--</div>
          <div class="stat-label">今日获得</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="dash-pending">--</div>
          <div class="stat-label">待审批</div>
        </div>
      </div>
      <div class="section-title mb-8">孩子列表</div>
      <div id="dash-children"></div>
    `;
  },

  async mount() {
    await this.loadData();
  },

  unmount() {},

  async loadData() {
    try {
      const childRes = await getChildren();
      const children = childRes.data || childRes || [];

      // Render child cards
      const container = document.getElementById('dash-children');
      if (!container) return;

      if (children.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">👶</div>
            <div class="empty-text">还没有添加孩子，去"管理"页面添加吧</div>
          </div>
        `;
      } else {
        container.innerHTML = children.map(c => `
          <div class="card child-card">
            <div class="child-avatar">${(c.name || '?')[0]}</div>
            <div class="child-info">
              <div class="child-name">${c.name}</div>
              <div class="child-meta">${c.age || '--'}岁 · Lv.${c.level || 1}</div>
            </div>
            <div class="child-coins">${c.coins || 0} 🪙</div>
          </div>
        `).join('');
      }

      // Total coins
      const totalCoins = children.reduce((s, c) => s + (c.coins || 0), 0);
      const totalEl = document.getElementById('dash-total-coins');
      if (totalEl) totalEl.textContent = totalCoins;

      // Pending count
      const pendingItems = await getPending();
      const pending = pendingItems.data || pendingItems || [];
      const pendingEl = document.getElementById('dash-pending');
      if (pendingEl) pendingEl.textContent = pending.length;
      updateBadge(pending.length);

      // Today's earnings
      const today = new Date().toISOString().slice(0, 10);
      let todayEarned = 0;
      try {
        const histRes = await getHistory();
        const hist = histRes.data || histRes || [];
        todayEarned = hist
          .filter(t => t.created_at && t.created_at.startsWith(today) && (t.coins_earned > 0 || t.coins > 0))
          .reduce((s, t) => s + (t.coins_earned || t.coins || 0), 0);
      } catch (_) { /* ignore */ }
      const todayEl = document.getElementById('dash-today-earned');
      if (todayEl) todayEl.textContent = todayEarned;
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  },
};
