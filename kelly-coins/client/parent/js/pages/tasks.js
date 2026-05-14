/**
 * Task management page.
 * Each task row shows its watercolor icon (or emoji fallback) with a
 * "换图标" button that opens the icon picker and updates via PUT.
 */
import { getTasks, createTask, updateTask } from '../api.js';
import { showToast } from '../components/toast.js';
import { pickIcon, iconThumbHtml } from '../components/icon-picker.js';

let tasks = [];
// Draft icon_file for the "add new task" form, assigned via the picker.
let draftIconFile = null;

export default {
  id: 'tasks',

  render() {
    return `
      <div class="section-title">任务管理</div>
      <div class="add-form" id="task-add-form">
        <div class="add-form-row">
          <div class="form-group" style="flex:0 0 100px">
            <label class="form-label">图标</label>
            <button class="btn btn-info btn-sm" id="task-new-pick-icon" type="button" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 8px">
              <span id="task-new-icon-preview">📌</span>
              <span style="font-size:0.7rem">选择</span>
            </button>
          </div>
          <div class="form-group" style="flex:2">
            <label class="form-label">任务名称</label>
            <input class="form-input" id="task-new-name" placeholder="例如：完成作业">
          </div>
          <div class="form-group" style="flex:0 0 70px">
            <label class="form-label">金币</label>
            <input class="form-input" id="task-new-coins" type="number" placeholder="5" min="1" style="text-align:center">
          </div>
          <div class="form-group" style="flex:0 0 auto">
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-primary btn-sm" id="task-add-btn">添加</button>
          </div>
        </div>
      </div>
      <div id="task-list"></div>
    `;
  },

  async mount() {
    document.getElementById('task-add-btn')?.addEventListener('click', () => this.addTask());
    document.getElementById('task-new-pick-icon')?.addEventListener('click', () => this.pickNewIcon());
    await this.loadTasks();
  },

  unmount() {
    draftIconFile = null;
  },

  async loadTasks() {
    try {
      const res = await getTasks();
      tasks = res.data || res || [];
      this.renderList();
    } catch (err) {
      console.error('Tasks load error:', err);
    }
  },

  renderList() {
    const container = document.getElementById('task-list');
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-text">还没有任务，添加一个吧</div>
        </div>
      `;
      return;
    }

    container.innerHTML = tasks.map(t => `
      <div class="list-item" data-id="${t.id}">
        <div class="list-item-icon">${iconThumbHtml('tasks', t.icon_file, t.icon_emoji || '📌')}</div>
        <div class="list-item-body">
          <div class="list-item-title">
            ${t.name}
            <button class="btn-icon-swap" data-swap-task="${t.id}">换图标</button>
          </div>
          <div class="list-item-sub">
            <input class="inline-input" type="number" min="1" value="${t.coins}" data-task-coins="${t.id}"> 金币
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-info btn-sm" data-save-task="${t.id}">保存</button>
          <button class="toggle ${t.is_active ? 'on' : 'off'}" data-toggle-task="${t.id}">
            ${t.is_active ? '启用' : '停用'}
          </button>
        </div>
      </div>
    `).join('');

    container.onclick = (e) => {
      const saveId = e.target.dataset.saveTask;
      const toggleId = e.target.dataset.toggleTask;
      const swapId = e.target.dataset.swapTask;
      if (saveId) this.saveCoins(saveId);
      if (toggleId) this.toggleActive(toggleId);
      if (swapId) this.swapIcon(swapId);
    };
  },

  async pickNewIcon() {
    const key = await pickIcon('tasks', draftIconFile);
    if (!key) return;
    draftIconFile = key;
    const preview = document.getElementById('task-new-icon-preview');
    if (preview) {
      preview.innerHTML = `<img src="/child/assets/icons/tasks/${key}.png" alt="" style="width:24px;height:24px;vertical-align:middle;background:#FFF7EC;border-radius:4px;padding:2px">`;
    }
  },

  async swapIcon(id) {
    const task = tasks.find(t => String(t.id) === String(id));
    if (!task) return;
    const key = await pickIcon('tasks', task.icon_file);
    if (!key) return;
    try {
      await updateTask(id, { icon_file: key });
      task.icon_file = key;
      this.renderList();
      showToast('图标已更新');
    } catch (err) {
      showToast('更新失败');
    }
  },

  async addTask() {
    const name = document.getElementById('task-new-name')?.value.trim();
    const coins = parseInt(document.getElementById('task-new-coins')?.value, 10);

    if (!name) { showToast('请输入任务名称'); return; }
    if (!coins || coins < 1) { showToast('请输入有效金币数'); return; }

    try {
      await createTask({ name, coins, icon_emoji: '📌', icon_file: draftIconFile });
      showToast('任务已添加');
      document.getElementById('task-new-name').value = '';
      document.getElementById('task-new-coins').value = '';
      draftIconFile = null;
      const preview = document.getElementById('task-new-icon-preview');
      if (preview) preview.textContent = '📌';
      await this.loadTasks();
    } catch (err) {
      showToast('添加失败: ' + err.message);
    }
  },

  async saveCoins(id) {
    const input = document.querySelector(`[data-task-coins="${id}"]`);
    const coins = parseInt(input?.value, 10);
    if (!coins || coins < 1) { showToast('请输入有效金币数'); return; }

    try {
      await updateTask(id, { coins });
      showToast('已保存');
    } catch (err) {
      showToast('保存失败');
    }
  },

  async toggleActive(id) {
    const task = tasks.find(t => String(t.id) === String(id));
    if (!task) return;
    const newState = task.is_active ? 0 : 1;

    try {
      await updateTask(id, { is_active: newState });
      task.is_active = newState;
      this.renderList();
      showToast(newState ? '任务已启用' : '任务已停用');
    } catch (err) {
      showToast('操作失败');
    }
  },
};
