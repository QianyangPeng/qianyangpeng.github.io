// Settings Modal — skin style picker, UI theme picker, reminders toggle, sound toggle
// Opened from the gear icon in the header
// EXTENSION POINT: add more settings sections here

import { AVAILABLE_STYLES, getSkinStyle, setSkinStyle } from '../skin-style.js';
import { getAvailableThemes, getTheme, setTheme } from '../theme.js';
import { areRemindersEnabled, enableReminders, disableReminders } from './reminders.js';
import { showToast } from './toast.js';
import { sfx } from '../sfx.js';

let backdropEl = null;

function ensureBackdrop() {
  if (backdropEl) return;
  backdropEl = document.createElement('div');
  backdropEl.className = 'settings-backdrop';
  backdropEl.addEventListener('click', (e) => {
    if (e.target === backdropEl) hideSettings();
  });
  document.getElementById('app').appendChild(backdropEl);
}

export function showSettings() {
  ensureBackdrop();

  const currentStyle = getSkinStyle();
  const currentTheme = getTheme();
  const themes = getAvailableThemes();
  const remindersOn = areRemindersEnabled();
  const soundOn = !sfx.isMuted();

  const styleCards = AVAILABLE_STYLES.map(style => {
    const isActive = style.id === currentStyle;
    const previewSrc = `/child/assets/characters/styles/${style.id}/${style.preview}`;
    return `
      <button class="settings-style-card ${isActive ? 'settings-style-card--active' : ''}"
              data-style="${style.id}">
        <div class="settings-style-card__preview">
          <img src="${previewSrc}" alt="${style.label}"
               onerror="this.style.opacity='0.3'">
        </div>
        <div class="settings-style-card__info">
          <div class="settings-style-card__label">${style.label}</div>
          <div class="settings-style-card__desc">${style.desc}</div>
        </div>
        ${isActive ? '<div class="settings-style-card__check">✓</div>' : ''}
      </button>
    `;
  }).join('');

  const themeCards = themes.map(theme => {
    const isActive = theme.id === currentTheme;
    // Watercolor themes provide a `swatch` gradient string directly
    const swatchBg = theme.swatch || 'linear-gradient(135deg, #FFE8D6, #F5BB1D)';
    return `
      <button class="settings-theme-card ${isActive ? 'settings-theme-card--active' : ''}"
              data-theme="${theme.id}">
        <div class="settings-theme-card__swatch"
             style="background: ${swatchBg}"></div>
        <div class="settings-theme-card__label">${theme.name}</div>
        <div class="settings-theme-card__desc">${theme.desc}</div>
        ${isActive ? '<div class="settings-style-card__check">✓</div>' : ''}
      </button>
    `;
  }).join('');

  backdropEl.innerHTML = `
    <div class="settings-modal">
      <div class="settings-modal__header">
        <div class="settings-modal__title">⚙️ 设置</div>
        <button class="settings-modal__close" id="settings-close">✕</button>
      </div>
      <div class="settings-modal__body">
        <div class="settings-section">
          <div class="settings-section__title">皮肤风格</div>
          <div class="settings-section__desc">选择角色立绘的艺术风格</div>
          <div class="settings-style-grid">
            ${styleCards}
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section__title">界面主题</div>
          <div class="settings-section__desc">调整应用的颜色主题</div>
          <div class="settings-theme-grid">
            ${themeCards}
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section__title">声音与震动</div>
          <div class="settings-section__desc">按钮音效、奖励音乐、轻微震动反馈</div>
          <button class="settings-toggle-btn ${soundOn ? 'settings-toggle-btn--on' : ''}"
                  id="sound-toggle">
            ${soundOn ? '🔊 已开启' : '🔇 已关闭'}
          </button>
        </div>

        <div class="settings-section">
          <div class="settings-section__title">任务提醒</div>
          <div class="settings-section__desc">早晨/晚上自动提醒</div>
          <button class="settings-toggle-btn ${remindersOn ? 'settings-toggle-btn--on' : ''}"
                  id="reminders-toggle">
            ${remindersOn ? '✓ 已开启' : '开启提醒'}
          </button>
        </div>
      </div>
    </div>
  `;

  backdropEl.classList.add('settings-backdrop--visible');

  // Close button
  document.getElementById('settings-close').addEventListener('click', hideSettings);

  // Skin style selection
  backdropEl.querySelectorAll('.settings-style-card').forEach(card => {
    card.addEventListener('click', () => {
      const styleId = card.dataset.style;
      if (styleId === getSkinStyle()) return;
      setSkinStyle(styleId);
      showToast(`已切换为「${AVAILABLE_STYLES.find(s => s.id === styleId).label}」`, 'success');
      backdropEl.querySelectorAll('.settings-style-card').forEach(c => {
        c.classList.toggle('settings-style-card--active', c.dataset.style === styleId);
        const check = c.querySelector('.settings-style-card__check');
        if (c.dataset.style === styleId && !check) {
          c.insertAdjacentHTML('beforeend', '<div class="settings-style-card__check">✓</div>');
        } else if (c.dataset.style !== styleId && check) {
          check.remove();
        }
      });
    });
  });

  // Theme selection
  backdropEl.querySelectorAll('.settings-theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const themeId = card.dataset.theme;
      if (themeId === getTheme()) return;
      setTheme(themeId);
      const themeName = themes.find(t => t.id === themeId)?.name || themeId;
      showToast(`已切换为「${themeName}」主题`, 'success');
      backdropEl.querySelectorAll('.settings-theme-card').forEach(c => {
        c.classList.toggle('settings-theme-card--active', c.dataset.theme === themeId);
        const check = c.querySelector('.settings-style-card__check');
        if (c.dataset.theme === themeId && !check) {
          c.insertAdjacentHTML('beforeend', '<div class="settings-style-card__check">✓</div>');
        } else if (c.dataset.theme !== themeId && check) {
          check.remove();
        }
      });
    });
  });

  // Reminders toggle
  document.getElementById('reminders-toggle').addEventListener('click', async () => {
    const btn = document.getElementById('reminders-toggle');
    if (areRemindersEnabled()) {
      disableReminders();
      btn.classList.remove('settings-toggle-btn--on');
      btn.textContent = '开启提醒';
      showToast('已关闭任务提醒', 'info');
    } else {
      const ok = await enableReminders();
      if (ok) {
        btn.classList.add('settings-toggle-btn--on');
        btn.textContent = '✓ 已开启';
        showToast('已开启任务提醒！', 'success');
      } else {
        showToast('需要允许浏览器通知权限', 'error');
      }
    }
  });

  // Sound toggle
  document.getElementById('sound-toggle').addEventListener('click', () => {
    const btn = document.getElementById('sound-toggle');
    const newMuted = !sfx.isMuted();
    sfx.setMuted(newMuted);
    if (newMuted) {
      btn.classList.remove('settings-toggle-btn--on');
      btn.textContent = '🔇 已关闭';
      showToast('已关闭声音', 'info');
    } else {
      btn.classList.add('settings-toggle-btn--on');
      btn.textContent = '🔊 已开启';
      // Play a sample so the user hears it worked
      setTimeout(() => sfx.confirm(), 50);
      showToast('已开启声音', 'success');
    }
  });
}

export function hideSettings() {
  if (backdropEl) {
    backdropEl.classList.remove('settings-backdrop--visible');
  }
}
