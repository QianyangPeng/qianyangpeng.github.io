/**
 * Parent Settings page.
 *
 * Sections:
 *   1. PIN Code           — show status, change PIN, remove PIN
 *   2. Backups            — create new backup, restore from backup
 *   3. Weekly Reports     — generate report, view existing reports
 *   4. Notifications      — toggle daily reminders (stored in localStorage)
 */

import {
  getAuthStatus,
  setPin,
  removePin,
  parentLogout,
  getBackups,
  createBackup,
  restoreBackup,
  getReports,
  generateReport,
} from '../api.js';
import { showToast } from '../components/toast.js';
import { confirm } from '../components/modal.js';

const NOTIFY_KEY = 'parent-notify-daily';

let backups = [];
let reports = [];
let hasPin = false;

export default {
  id: 'settings',

  render() {
    return `
      <div class="section-title">设置</div>

      <div class="settings-section">
        <div class="settings-section-title">🔒 PIN 码</div>
        <div class="settings-section-body">
          <div class="settings-row">
            <div class="settings-row-label">
              <div class="settings-row-title">PIN 码状态</div>
              <div class="settings-row-sub" id="pin-status-text">检查中...</div>
            </div>
          </div>
          <div class="settings-pin-actions" id="pin-actions">
            <button class="btn btn-info btn-sm" id="pin-change-btn">修改 PIN</button>
            <button class="btn btn-danger btn-sm" id="pin-remove-btn">移除 PIN</button>
            <button class="btn btn-ghost btn-sm" id="logout-btn">退出登录</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">💾 数据备份</div>
        <div class="settings-section-body">
          <button class="btn btn-primary" id="backup-create-btn" style="width:100%;margin-bottom:12px">立即备份</button>
          <div id="backup-list" class="settings-list"></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">📊 周报</div>
        <div class="settings-section-body">
          <button class="btn btn-primary" id="report-generate-btn" style="width:100%;margin-bottom:12px">生成本周报告</button>
          <div id="report-list" class="settings-list"></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">🔔 通知</div>
        <div class="settings-section-body">
          <div class="settings-row">
            <div class="settings-row-label">
              <div class="settings-row-title">每日提醒</div>
              <div class="settings-row-sub">提醒孩子完成今日任务</div>
            </div>
            <button class="toggle off" id="notify-toggle">关闭</button>
          </div>
        </div>
      </div>
    `;
  },

  async mount() {
    await this.loadAuthStatus();
    await this.loadBackups();
    await this.loadReports();
    this.loadNotifySetting();

    document.getElementById('pin-change-btn')?.addEventListener('click', () => this.changePin());
    document.getElementById('pin-remove-btn')?.addEventListener('click', () => this.handleRemovePin());
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

    document.getElementById('backup-create-btn')?.addEventListener('click', () => this.handleCreateBackup());
    document.getElementById('report-generate-btn')?.addEventListener('click', () => this.handleGenerateReport());
    document.getElementById('notify-toggle')?.addEventListener('click', () => this.toggleNotify());
  },

  unmount() {},

  // ===== PIN =====

  async loadAuthStatus() {
    try {
      const res = await getAuthStatus();
      hasPin = res.has_pin ?? res.data?.has_pin ?? false;
    } catch (_) {
      hasPin = false;
    }
    const text = document.getElementById('pin-status-text');
    if (text) text.textContent = hasPin ? '已设置' : '未设置';

    const removeBtn = document.getElementById('pin-remove-btn');
    if (removeBtn) removeBtn.style.display = hasPin ? '' : 'none';
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.style.display = hasPin ? '' : 'none';

    const changeBtn = document.getElementById('pin-change-btn');
    if (changeBtn) changeBtn.textContent = hasPin ? '修改 PIN' : '设置 PIN';
  },

  async changePin() {
    const newPin = window.prompt(hasPin ? '请输入新的 PIN 码（至少 4 位）' : '请设置 PIN 码（至少 4 位）');
    if (newPin === null) return;
    const trimmed = newPin.trim();
    if (trimmed.length < 4) {
      showToast('PIN 码至少 4 位');
      return;
    }
    const confirmPin = window.prompt('请再次输入 PIN 码确认');
    if (confirmPin === null) return;
    if (trimmed !== confirmPin.trim()) {
      showToast('两次输入的 PIN 码不一致');
      return;
    }

    try {
      await setPin(trimmed);
      showToast(hasPin ? 'PIN 已修改' : 'PIN 已设置');
      await this.loadAuthStatus();
    } catch (err) {
      showToast('操作失败: ' + err.message);
    }
  },

  async handleRemovePin() {
    const ok = await confirm(
      '移除 PIN',
      '移除后任何人都可以访问家长面板，确定要移除吗？',
      '移除',
      '取消'
    );
    if (!ok) return;

    try {
      await removePin();
      showToast('PIN 已移除');
      // After removing PIN the token is also cleared; reload page
      window.location.reload();
    } catch (err) {
      showToast('操作失败: ' + err.message);
    }
  },

  async logout() {
    const ok = await confirm('退出登录', '确定要退出家长端吗？', '退出', '取消');
    if (!ok) return;

    // Drop the Web Push subscription + close the SSE stream before the
    // token is invalidated, so the server can match our subscription by
    // token and delete it cleanly. Best-effort — any step can fail and
    // we still fall through to parentLogout().
    try {
      const [{ disablePush }, events] = await Promise.all([
        import('../push.js'),
        import('../events.js'),
      ]);
      await disablePush();
      events.closeStream();
    } catch (_) {}

    try {
      await parentLogout();
    } finally {
      window.location.reload();
    }
  },

  // ===== Backups =====

  async loadBackups() {
    const container = document.getElementById('backup-list');
    if (!container) return;
    try {
      const res = await getBackups();
      backups = res.data || res || [];
      this.renderBackups();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-text">加载失败</div></div>`;
    }
  },

  renderBackups() {
    const container = document.getElementById('backup-list');
    if (!container) return;
    if (backups.length === 0) {
      container.innerHTML = `<div class="settings-empty">暂无备份</div>`;
      return;
    }

    container.innerHTML = backups.map(b => {
      const name = b.filename || b.name || '';
      const time = b.created_at || b.mtime || '';
      const size = b.size ? formatBytes(b.size) : '';
      return `
        <div class="settings-list-item">
          <div class="settings-list-info">
            <div class="settings-list-title">${name}</div>
            <div class="settings-list-sub">${time}${size ? ' · ' + size : ''}</div>
          </div>
          <button class="btn btn-info btn-sm" data-restore="${name}">恢复</button>
        </div>
      `;
    }).join('');

    container.onclick = async (e) => {
      const filename = e.target.dataset.restore;
      if (filename) await this.handleRestore(filename);
    };
  },

  async handleCreateBackup() {
    const btn = document.getElementById('backup-create-btn');
    if (btn) { btn.disabled = true; btn.textContent = '备份中...'; }
    try {
      await createBackup();
      showToast('备份成功');
      await this.loadBackups();
    } catch (err) {
      showToast('备份失败: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '立即备份'; }
    }
  },

  async handleRestore(filename) {
    const ok = await confirm(
      '恢复备份',
      `确定要从 ${filename} 恢复数据吗？当前数据将被覆盖。`,
      '恢复',
      '取消'
    );
    if (!ok) return;

    try {
      await restoreBackup(filename);
      showToast('恢复成功，刷新中...');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      showToast('恢复失败: ' + err.message);
    }
  },

  // ===== Reports =====

  async loadReports() {
    const container = document.getElementById('report-list');
    if (!container) return;
    try {
      const res = await getReports();
      reports = res.data || res || [];
      this.renderReports();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-text">加载失败</div></div>`;
    }
  },

  renderReports() {
    const container = document.getElementById('report-list');
    if (!container) return;
    if (reports.length === 0) {
      container.innerHTML = `<div class="settings-empty">暂无周报</div>`;
      return;
    }

    container.innerHTML = reports.map(r => {
      const name = r.filename || r.name || '';
      const time = r.created_at || r.mtime || '';
      const url = r.url || `/parent/reports/${name}`;
      return `
        <div class="settings-list-item">
          <div class="settings-list-info">
            <div class="settings-list-title">${name}</div>
            <div class="settings-list-sub">${time}</div>
          </div>
          <a class="btn btn-info btn-sm" href="${url}" target="_blank" rel="noopener">查看</a>
        </div>
      `;
    }).join('');
  },

  async handleGenerateReport() {
    const btn = document.getElementById('report-generate-btn');
    if (btn) { btn.disabled = true; btn.textContent = '生成中...'; }
    try {
      await generateReport();
      showToast('报告已生成');
      await this.loadReports();
    } catch (err) {
      showToast('生成失败: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '生成本周报告'; }
    }
  },

  // ===== Notifications =====

  loadNotifySetting() {
    const enabled = this.getNotifyEnabled();
    this.updateNotifyToggle(enabled);
  },

  getNotifyEnabled() {
    try {
      return localStorage.getItem(NOTIFY_KEY) === '1';
    } catch (_) {
      return false;
    }
  },

  updateNotifyToggle(enabled) {
    const toggle = document.getElementById('notify-toggle');
    if (!toggle) return;
    toggle.classList.toggle('on', enabled);
    toggle.classList.toggle('off', !enabled);
    toggle.textContent = enabled ? '开启' : '关闭';
  },

  toggleNotify() {
    const enabled = !this.getNotifyEnabled();
    try {
      localStorage.setItem(NOTIFY_KEY, enabled ? '1' : '0');
    } catch (_) {}
    this.updateNotifyToggle(enabled);
    showToast(enabled ? '已开启每日提醒' : '已关闭每日提醒');
  },
};

function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
