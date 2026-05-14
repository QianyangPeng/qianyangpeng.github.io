// Achievements page: shows all achievement badges with locked/unlocked state
// + progress bar for in-progress ones

import * as api from '../api.js';
import { showToast } from '../components/toast.js';
import { speak } from '../components/voice.js';

let gridEl = null;

const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold:   '#FFD700',
};

const TIER_LABELS = {
  bronze: '铜',
  silver: '银',
  gold:   '金',
};

export const achievementsPage = {
  id: 'achievements',

  render() {
    const page = document.createElement('div');
    page.className = 'page page--achievements';
    page.innerHTML = `
      <div class="page__title">
        <span class="page__title-icon">🏆</span>
        成就馆
      </div>
      <div class="page__subtitle">收集所有成就徽章！</div>
      <div class="achievements-stats" id="ach-stats">--/--</div>
      <div class="achievements-grid" id="achievements-grid"></div>
    `;

    gridEl = page.querySelector('#achievements-grid');
    return page;
  },

  async mount() {
    speak('成就馆！来看看你赚到了哪些徽章');
    await loadAchievements();
  },

  unmount() {
    gridEl = null;
  }
};

async function loadAchievements() {
  if (!gridEl) return;
  try {
    const achievements = await api.fetchAchievements();
    renderAchievements(achievements);
  } catch (e) {
    showToast('加载失败 😢', 'error');
  }
}

function renderAchievements(list) {
  if (!gridEl) return;
  gridEl.innerHTML = '';

  // Update stats
  const unlocked = list.filter(a => a.unlocked).length;
  const statsEl = document.getElementById('ach-stats');
  if (statsEl) statsEl.textContent = `已解锁 ${unlocked} / ${list.length}`;

  list.forEach(a => {
    const card = document.createElement('div');
    const tierColor = TIER_COLORS[a.tier] || TIER_COLORS.bronze;
    card.className = 'achievement-card' + (a.unlocked ? ' achievement-card--unlocked' : ' achievement-card--locked');
    card.style.setProperty('--tier-color', tierColor);

    const percent = Math.min(100, Math.round((a.progress / a.target) * 100));

    card.innerHTML = `
      <div class="achievement-card__emoji">${a.unlocked ? a.emoji : '🔒'}</div>
      <div class="achievement-card__name">${a.name}</div>
      <div class="achievement-card__desc">${a.desc}</div>
      <div class="achievement-card__tier">${TIER_LABELS[a.tier] || '铜'}牌</div>
      ${!a.unlocked ? `
        <div class="achievement-card__progress">
          <div class="achievement-card__progress-bar">
            <div class="achievement-card__progress-fill" style="width:${percent}%"></div>
          </div>
          <div class="achievement-card__progress-text">${a.progress}/${a.target}</div>
        </div>
      ` : '<div class="achievement-card__check">✓ 已解锁</div>'}
    `;

    if (a.unlocked) {
      card.addEventListener('click', () => {
        speak(`${a.name}！${a.desc}`);
      });
    }

    gridEl.appendChild(card);
  });
}
