/**
 * Children management page.
 */
import { getChildren, createChild, updateChild, adjustCoins } from '../api.js';
import { showToast } from '../components/toast.js';
import { confirm } from '../components/modal.js';

let children = [];

export default {
  id: 'children',

  render() {
    return `
      <div class="section-title">孩子管理</div>
      <div class="add-form mb-16" id="child-add-form">
        <div class="add-form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">姓名</label>
            <input class="form-input" id="child-new-name" placeholder="例如：小明">
          </div>
          <div class="form-group" style="flex:0 0 80px">
            <label class="form-label">年龄</label>
            <input class="form-input" id="child-new-age" type="number" placeholder="8" min="1" max="18" style="text-align:center">
          </div>
          <div class="form-group" style="flex:0 0 auto">
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-primary btn-sm" id="child-add-btn">添加</button>
          </div>
        </div>
      </div>

      <div id="children-list"></div>

      <div class="section-title" style="margin-top:24px">手动调整金币</div>
      <div class="card" id="adjust-section">
        <div class="form-group">
          <label class="form-label">选择孩子</label>
          <select class="form-input" id="adjust-child"></select>
        </div>
        <div class="form-group">
          <label class="form-label">金币数量（正数增加，负数扣除）</label>
          <input class="form-input" id="adjust-coins" type="number" placeholder="例如: 5 或 -3">
        </div>
        <div class="form-group">
          <label class="form-label">备注说明</label>
          <input class="form-input" id="adjust-note" placeholder="例如: 表现很棒的奖励">
        </div>
        <button class="btn btn-primary" id="adjust-btn" style="width:100%">确认调整</button>
      </div>
    `;
  },

  async mount() {
    document.getElementById('child-add-btn')?.addEventListener('click', () => this.addChild());
    document.getElementById('adjust-btn')?.addEventListener('click', () => this.doAdjust());
    await this.loadChildren();
  },

  unmount() {},

  async loadChildren() {
    try {
      const res = await getChildren();
      children = res.data || res || [];
      this.renderList();
      this.updateAdjustSelect();
    } catch (err) {
      console.error('Children load error:', err);
    }
  },

  renderList() {
    const container = document.getElementById('children-list');
    if (!container) return;

    if (children.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👶</div>
          <div class="empty-text">还没有添加孩子</div>
        </div>
      `;
      return;
    }

    container.innerHTML = children.map(c => {
      const unlimited = !!c.wheel_unlimited;
      return `
      <div class="card" data-child-id="${c.id}">
        <div class="card-header">
          <div class="card-title">${c.name}</div>
          <span class="text-dim text-sm">${c.coins || 0} 🪙 · Lv.${c.level || 1}</span>
        </div>
        <div class="add-form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">姓名</label>
            <input class="form-input" value="${c.name}" data-child-name="${c.id}">
          </div>
          <div class="form-group" style="flex:0 0 80px">
            <label class="form-label">年龄</label>
            <input class="form-input" type="number" min="1" max="18" value="${c.age || ''}" data-child-age="${c.id}" style="text-align:center">
          </div>
          <div class="form-group" style="flex:0 0 auto">
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-info btn-sm" data-save-child="${c.id}">保存</button>
          </div>
        </div>
        <div class="settings-row" style="margin-top:8px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)">
          <div class="settings-row-label">
            <div class="settings-row-title">🎡 幸运转盘无限次</div>
            <div class="settings-row-sub">
              ${unlimited
                ? '当前:无限制,可以随时转'
                : '当前:每天 2 次(中午和午夜各重置一次)'}
            </div>
          </div>
          <button
            class="toggle ${unlimited ? 'on' : 'off'}"
            data-wheel-toggle="${c.id}"
            data-current="${unlimited ? '1' : '0'}">
            ${unlimited ? '无限' : '限制'}
          </button>
        </div>
      </div>
      `;
    }).join('');

    container.onclick = (e) => {
      const saveId = e.target.dataset.saveChild;
      if (saveId) { this.saveChild(saveId); return; }
      const toggleBtn = e.target.closest('[data-wheel-toggle]');
      if (toggleBtn) {
        const id = toggleBtn.dataset.wheelToggle;
        const current = toggleBtn.dataset.current === '1';
        this.toggleWheelUnlimited(id, !current);
      }
    };
  },

  async toggleWheelUnlimited(id, enable) {
    try {
      await updateChild(id, { wheel_unlimited: !!enable });
      const child = children.find(c => String(c.id) === String(id));
      if (child) child.wheel_unlimited = !!enable;
      // Re-render just this card's toggle in place so the parent doesn't lose
      // focus on the name/age inputs they might be editing.
      const btn = document.querySelector(`[data-wheel-toggle="${id}"]`);
      if (btn) {
        btn.classList.toggle('on', !!enable);
        btn.classList.toggle('off', !enable);
        btn.textContent = enable ? '无限' : '限制';
        btn.dataset.current = enable ? '1' : '0';
        const sub = btn.closest('.settings-row')?.querySelector('.settings-row-sub');
        if (sub) sub.textContent = enable
          ? '当前:无限制,可以随时转'
          : '当前:每天 2 次(中午和午夜各重置一次)';
      }
      showToast(enable ? `${children.find(c => String(c.id) === String(id))?.name || ''} 转盘已改为无限次` : '已改回每天 2 次');
    } catch (err) {
      showToast('更新失败: ' + err.message);
    }
  },

  updateAdjustSelect() {
    const select = document.getElementById('adjust-child');
    if (!select) return;
    select.innerHTML = children.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  },

  async addChild() {
    const name = document.getElementById('child-new-name')?.value.trim();
    const age = parseInt(document.getElementById('child-new-age')?.value, 10);

    if (!name) { showToast('请输入孩子姓名'); return; }

    try {
      await createChild({ name, age: age || undefined });
      showToast('孩子已添加');
      document.getElementById('child-new-name').value = '';
      document.getElementById('child-new-age').value = '';
      await this.loadChildren();
    } catch (err) {
      showToast('添加失败: ' + err.message);
    }
  },

  async saveChild(id) {
    const nameInput = document.querySelector(`[data-child-name="${id}"]`);
    const ageInput = document.querySelector(`[data-child-age="${id}"]`);
    const name = nameInput?.value.trim();
    const age = parseInt(ageInput?.value, 10);

    if (!name) { showToast('姓名不能为空'); return; }

    try {
      await updateChild(id, { name, age: age || undefined });
      showToast('已保存');
      // Update local data
      const child = children.find(c => String(c.id) === String(id));
      if (child) { child.name = name; child.age = age; }
      this.updateAdjustSelect();
    } catch (err) {
      showToast('保存失败');
    }
  },

  async doAdjust() {
    const childId = document.getElementById('adjust-child')?.value;
    const coins = parseInt(document.getElementById('adjust-coins')?.value, 10);
    const note = document.getElementById('adjust-note')?.value.trim() || '手动调整';

    if (!childId) { showToast('请选择孩子'); return; }
    if (!coins || coins === 0) { showToast('请输入有效金币数量'); return; }

    const childName = children.find(c => String(c.id) === String(childId))?.name || '';
    const action = coins > 0 ? `增加 ${coins}` : `扣除 ${Math.abs(coins)}`;
    const ok = await confirm('确认调整', `确定要为 ${childName} ${action} 金币吗？`, '确认', '取消');
    if (!ok) return;

    try {
      const res = await adjustCoins(childId, coins, note);
      const newBalance = res.new_balance ?? res.data?.new_balance ?? '';
      showToast(`调整成功${newBalance !== '' ? '，余额: ' + newBalance : ''}`);
      document.getElementById('adjust-coins').value = '';
      document.getElementById('adjust-note').value = '';
      await this.loadChildren();
    } catch (err) {
      showToast('调整失败: ' + err.message);
    }
  },
};
