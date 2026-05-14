/**
 * Transaction history page.
 */
import { getHistory, getChildren } from '../api.js';

let children = [];

export default {
  id: 'history',

  render() {
    return `
      <div class="section-title">交易记录</div>
      <div class="mb-16">
        <select class="form-input" id="history-child-filter" style="max-width:200px">
          <option value="">全部孩子</option>
        </select>
      </div>
      <div id="history-list"></div>
    `;
  },

  async mount() {
    // Load children for filter
    try {
      const res = await getChildren();
      children = res.data || res || [];
      const select = document.getElementById('history-child-filter');
      if (select) {
        children.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          select.appendChild(opt);
        });
        select.addEventListener('change', () => this.loadHistory());
      }
    } catch (_) {}

    await this.loadHistory();
  },

  unmount() {},

  async loadHistory() {
    const childId = document.getElementById('history-child-filter')?.value || '';
    const container = document.getElementById('history-list');
    if (!container) return;

    try {
      const res = await getHistory(childId, 50);
      const items = res.data || res || [];

      if (items.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📜</div>
            <div class="empty-text">暂无交易记录</div>
          </div>
        `;
        return;
      }

      container.innerHTML = '<div class="card" style="padding:4px 16px">' +
        items.map(t => {
          const coins = t.coins_earned ?? t.coins ?? 0;
          const sign = coins >= 0 ? '+' : '';
          const cls = coins >= 0 ? 'coins-positive' : 'coins-negative';
          const name = t.task_name || t.description || t.note || '--';
          const childName = t.child_name || '';
          const time = t.created_at ? t.created_at.slice(0, 16).replace('T', ' ') : '';

          return `
            <div class="history-item">
              <div class="history-desc">
                <div>${name}</div>
                ${childName ? `<div class="text-dim text-sm">${childName}</div>` : ''}
              </div>
              <div class="history-time">${time}</div>
              <div class="history-coins ${cls}">${sign}${coins} 🪙</div>
            </div>
          `;
        }).join('') +
        '</div>';
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-text">加载失败</div></div>`;
      console.error('History load error:', err);
    }
  },
};
