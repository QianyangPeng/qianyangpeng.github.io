// Tasks page: grid of task cards
// Two-tap: first tap speaks + highlights, second tap opens task progress modal
// Coins are awarded only when user confirms in the modal

import * as api from '../api.js';
import { getState, setState } from '../state.js';
import { showToast } from '../components/toast.js';
import { showSkeleton, showGridError } from '../components/loading.js';
import { coinBurst } from '../components/animations.js';
import { handleTwoTap, clearHighlight, speak } from '../components/voice.js';
import { showTaskProgress, closeTaskProgress } from '../components/task-progress.js';
import { showAchievementUnlock } from '../components/achievement-unlock.js';
import { showLevelUp } from '../components/level-up.js';
import { requestParentVerify } from '../components/parent-verify.js';
import { sfx } from '../sfx.js';
import { onChildEvent } from '../state-sync.js';

let gridEl = null;
let unsubscribeSync = null;

export const tasksPage = {
  id: 'tasks',

  render() {
    const page = document.createElement('div');
    page.className = 'page page--tasks';

    page.innerHTML = `
      <div class="page__title">
        <span class="page__title-icon">⭐</span>
        攒金币
      </div>
      <div class="page__subtitle">点一下听，再点一下开始！</div>
      <div class="task-grid" id="task-grid"></div>
    `;

    gridEl = page.querySelector('#task-grid');

    page.addEventListener('click', (e) => {
      if (!e.target.closest('.task-card')) clearHighlight();
    });

    return page;
  },

  async mount() {
    speak('攒金币啦！点一下听任务，再点一下开始');
    await loadTasks();

    // Multi-session sync: if Kelly completes a task on another device,
    // or a parent adjusts coins, reload the grid so hints / daily-quest
    // highlighting reflects reality.
    unsubscribeSync = onChildEvent('state-changed', (e) => {
      if (e.scope === 'earn' || e.scope === 'purchase' || e.scope === 'redeem-legacy') {
        loadTasks().catch(() => {});
      }
    });
  },

  unmount() {
    gridEl = null;
    clearHighlight();
    closeTaskProgress();
    if (unsubscribeSync) { unsubscribeSync(); unsubscribeSync = null; }
  }
};

async function loadTasks() {
  if (!gridEl) return;
  showSkeleton(gridEl, 4);
  try {
    const tasks = await api.fetchTasks();
    setState({ tasks });
    gridEl.innerHTML = '';
    renderTaskCards(tasks);
  } catch (e) {
    showGridError(gridEl, loadTasks);
  }
}

function renderTaskCards(tasks) {
  if (!gridEl) return;
  gridEl.innerHTML = '';

  tasks.forEach((task, index) => {
    const card = document.createElement('button');
    card.className = 'task-card card-enter';
    card.style.setProperty('--stagger-i', String(index));

    const isTimed = task.duration_minutes && task.duration_minutes > 0;
    const coinLabel = isTimed
      ? `每${task.duration_minutes}分钟得${task.coins_per_interval}金币`
      : `完成得${task.coins}金币`;
    card.setAttribute('aria-label', `任务：${task.name}，${coinLabel}`);

    // Prefer the watercolor library icon if the parent assigned one
    // (icon_file is a filename stem from server/db/icon-catalog.js like
    // 'bath'); fall back to the raw emoji. We conditionally render the
    // <img> tag so there's no empty `src` attribute that would trigger
    // a spurious error event.
    const iconMarkup = task.icon_file
      ? `<img src="/child/assets/icons/tasks/${task.icon_file}.png"
             alt="${task.name}" class="card__icon-img"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
         <div class="card__icon-emoji" style="display:none">${task.icon_emoji}</div>`
      : `<div class="card__icon-emoji">${task.icon_emoji}</div>`;

    card.innerHTML = `
      <div class="task-card__icon">
        ${iconMarkup}
      </div>
      <div class="task-card__name">${task.name}</div>
      <div class="task-card__reward">
        <span class="task-card__coin">🪙</span>
        <span class="task-card__amount">${isTimed ? `每${task.duration_minutes}分钟+${task.coins_per_interval}` : `+${task.coins}`}</span>
      </div>
      <div class="task-card__hint">点我</div>
    `;

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const coinText = isTimed
        ? `每${task.duration_minutes}分钟得${task.coins_per_interval}个金币`
        : (task.coins === 1 ? '一个金币' : `${task.coins}个金币`);
      const shouldExecute = handleTwoTap(card, `task-${task.id}`, task.name, coinText);
      if (shouldExecute) {
        openTaskModal(task, card);
      }
    });

    gridEl.appendChild(card);
  });
}

function openTaskModal(task, cardEl) {
  showTaskProgress(task, async (coinsEarned) => {
    if (coinsEarned <= 0) return; // cancelled

    // Parent verification: gate coin award behind a multiplication challenge
    speak('请爸爸或妈妈来确认一下哦');
    const verified = await requestParentVerify();
    if (!verified) {
      showToast('需要家长确认才能获得金币哦', 'info');
      return;
    }

    // Award coins via API (may need multiple earn calls for timed tasks)
    try {
      const prevLevel = getState().level;
      let totalAwarded = 0;
      let allUnlocked = [];
      let dailyQuestBonus = false;
      let lastNewLevel = prevLevel;
      const calls = Math.ceil(coinsEarned / task.coins);
      for (let i = 0; i < calls && totalAwarded < coinsEarned; i++) {
        const result = await api.earnCoins(task.id);
        totalAwarded += result.coins_earned;
        setState({ coins: result.new_balance, level: result.new_level ?? prevLevel });
        if (result.new_level) lastNewLevel = result.new_level;
        if (result.newly_unlocked && result.newly_unlocked.length > 0) {
          allUnlocked = allUnlocked.concat(result.newly_unlocked);
        }
        if (result.daily_quest_bonus) dailyQuestBonus = true;
      }

      // Celebration sequence: coin burst → sfx → screen pulse → toast
      coinBurst(cardEl, coinsEarned);
      sfx.earn(Math.min(5, coinsEarned));
      setTimeout(() => sfx.complete(), 280);

      // Screen pulse — brief scale bounce on the whole app
      const appEl = document.getElementById('app');
      if (appEl) {
        appEl.classList.add('app--pulse');
        appEl.addEventListener('animationend', () => appEl.classList.remove('app--pulse'), { once: true });
      }

      const bonusText = dailyQuestBonus ? '今日特别任务！双倍奖励！' : '';
      speak(`太棒了！${task.name}完成了！${bonusText}赚了${coinsEarned}个金币`);
      showToast(`${task.icon_emoji} +${coinsEarned}🪙${dailyQuestBonus ? ' (双倍!)' : ''}`, 'success');

      // Level-up ceremony (fires before achievements so they don't overlap)
      if (lastNewLevel > prevLevel) {
        setTimeout(() => showLevelUp(lastNewLevel), 800);
      } else if (allUnlocked.length > 0) {
        setTimeout(() => { sfx.unlock(); showAchievementUnlock(allUnlocked); }, 1500);
      }
    } catch (e) {
      sfx.error();
      showToast(e.message || '失败了 😢', 'error');
    }
  });
}
