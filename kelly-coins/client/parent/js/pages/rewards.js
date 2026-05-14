/**
 * Reward management page.
 * Each reward row shows its watercolor icon with a "换图标" button that
 * opens the icon picker and updates via PUT.
 */
import { getRewards, createReward, updateReward } from '../api.js';
import { showToast } from '../components/toast.js';
import { pickIcon, iconThumbHtml } from '../components/icon-picker.js';

let rewards = [];
let draftIconFile = null;

export default {
  id: 'rewards',

  render() {
    return `
      <div class="section-title">奖励管理</div>
      <div class="add-form" id="reward-add-form">
        <div class="add-form-row">
          <div class="form-group" style="flex:0 0 100px">
            <label class="form-label">图标</label>
            <button class="btn btn-info btn-sm" id="reward-new-pick-icon" type="button" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 8px">
              <span id="reward-new-icon-preview">🎁</span>
              <span style="font-size:0.7rem">选择</span>
            </button>
          </div>
          <div class="form-group" style="flex:2">
            <label class="form-label">奖励名称</label>
            <input class="form-input" id="reward-new-name" placeholder="例如：看电影">
          </div>
          <div class="form-group" style="flex:0 0 70px">
            <label class="form-label">金币</label>
            <input class="form-input" id="reward-new-coins" type="number" placeholder="20" min="1" style="text-align:center">
          </div>
          <div class="form-group" style="flex:0 0 80px">
            <label class="form-label">类型</label>
            <select class="form-input" id="reward-new-cat" style="padding:8px 6px">
              <option value="virtual">虚拟</option>
              <option value="real">实物</option>
            </select>
          </div>
          <div class="form-group" style="flex:0 0 auto">
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-primary btn-sm" id="reward-add-btn">添加</button>
          </div>
        </div>
      </div>
      <div id="reward-list"></div>
    `;
  },

  async mount() {
    document.getElementById('reward-add-btn')?.addEventListener('click', () => this.addReward());
    document.getElementById('reward-new-pick-icon')?.addEventListener('click', () => this.pickNewIcon());
    await this.loadRewards();
  },

  unmount() { draftIconFile = null; },

  async loadRewards() {
    try {
      const res = await getRewards();
      rewards = res.data || res || [];
      this.renderList();
    } catch (err) {
      console.error('Rewards load error:', err);
    }
  },

  renderList() {
    const container = document.getElementById('reward-list');
    if (!container) return;

    if (rewards.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎁</div>
          <div class="empty-text">还没有奖励，添加一个吧</div>
        </div>
      `;
      return;
    }

    container.innerHTML = rewards.map(r => `
      <div class="list-item" data-id="${r.id}">
        <div class="list-item-icon">${iconThumbHtml('rewards', r.icon_file, r.icon_emoji || '🎁')}</div>
        <div class="list-item-body">
          <div class="list-item-title">
            ${r.name}
            <span class="chip ${r.category === 'real' ? 'chip-real' : 'chip-virtual'}">
              ${r.category === 'real' ? '实物' : '虚拟'}
            </span>
            <button class="btn-icon-swap" data-swap-reward="${r.id}">换图标</button>
          </div>
          <div class="list-item-sub">
            <input class="inline-input" type="number" min="1" value="${r.coins_cost}" data-reward-coins="${r.id}"> 金币
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-info btn-sm" data-save-reward="${r.id}">保存</button>
          <button class="toggle ${r.is_active ? 'on' : 'off'}" data-toggle-reward="${r.id}">
            ${r.is_active ? '启用' : '停用'}
          </button>
        </div>
      </div>
    `).join('');

    container.onclick = (e) => {
      const saveId = e.target.dataset.saveReward;
      const toggleId = e.target.dataset.toggleReward;
      const swapId = e.target.dataset.swapReward;
      if (saveId) this.saveCoins(saveId);
      if (toggleId) this.toggleActive(toggleId);
      if (swapId) this.swapIcon(swapId);
    };
  },

  async pickNewIcon() {
    const key = await pickIcon('rewards', draftIconFile);
    if (!key) return;
    draftIconFile = key;
    const preview = document.getElementById('reward-new-icon-preview');
    if (preview) {
      preview.innerHTML = `<img src="/child/assets/icons/rewards/${key}.png" alt="" style="width:24px;height:24px;vertical-align:middle;background:#FFF7EC;border-radius:4px;padding:2px">`;
    }
  },

  async swapIcon(id) {
    const reward = rewards.find(r => String(r.id) === String(id));
    if (!reward) return;
    const key = await pickIcon('rewards', reward.icon_file);
    if (!key) return;
    try {
      await updateReward(id, { icon_file: key });
      reward.icon_file = key;
      this.renderList();
      showToast('图标已更新');
    } catch (err) {
      showToast('更新失败');
    }
  },

  async addReward() {
    const name = document.getElementById('reward-new-name')?.value.trim();
    const coins_cost = parseInt(document.getElementById('reward-new-coins')?.value, 10);
    const category = document.getElementById('reward-new-cat')?.value || 'virtual';

    if (!name) { showToast('请输入奖励名称'); return; }
    if (!coins_cost || coins_cost < 1) { showToast('请输入有效金币数'); return; }

    try {
      await createReward({ name, coins_cost, icon_emoji: '🎁', icon_file: draftIconFile, category });
      showToast('奖励已添加');
      document.getElementById('reward-new-name').value = '';
      document.getElementById('reward-new-coins').value = '';
      draftIconFile = null;
      const preview = document.getElementById('reward-new-icon-preview');
      if (preview) preview.textContent = '🎁';
      await this.loadRewards();
    } catch (err) {
      showToast('添加失败: ' + err.message);
    }
  },

  async saveCoins(id) {
    const input = document.querySelector(`[data-reward-coins="${id}"]`);
    const coins_cost = parseInt(input?.value, 10);
    if (!coins_cost || coins_cost < 1) { showToast('请输入有效金币数'); return; }

    try {
      await updateReward(id, { coins_cost });
      showToast('已保存');
    } catch (err) {
      showToast('保存失败');
    }
  },

  async toggleActive(id) {
    const reward = rewards.find(r => String(r.id) === String(id));
    if (!reward) return;
    const newState = reward.is_active ? 0 : 1;

    try {
      await updateReward(id, { is_active: newState });
      reward.is_active = newState;
      this.renderList();
      showToast(newState ? '奖励已启用' : '奖励已停用');
    } catch (err) {
      showToast('操作失败');
    }
  },
};
