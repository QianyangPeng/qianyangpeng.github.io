// Rewards page: grid of reward cards
// Two-tap: first tap speaks name + cost, second tap triggers redeem confirmation

import * as api from '../api.js';
import { getState, setState } from '../state.js';
import { showToast } from '../components/toast.js';
import { showSkeleton, showGridError } from '../components/loading.js';
import { showModal } from '../components/modal.js';
import { celebrate } from '../components/animations.js';
import { handleTwoTap, clearHighlight, speak } from '../components/voice.js';

let gridEl = null;

export const rewardsPage = {
  id: 'rewards',

  render() {
    const page = document.createElement('div');
    page.className = 'page page--rewards';

    page.innerHTML = `
      <div class="page__title">
        <span class="page__title-icon">🎁</span>
        兑换奖励
      </div>
      <div class="page__subtitle">点一下听，再点一下兑换！</div>
      <div class="reward-grid" id="reward-grid"></div>
    `;

    gridEl = page.querySelector('#reward-grid');

    page.addEventListener('click', (e) => {
      if (!e.target.closest('.reward-card')) clearHighlight();
    });

    return page;
  },

  async mount() {
    speak('用金币换奖品！点一下听，再点一下兑换');
    await loadRewards();
  },

  unmount() {
    gridEl = null;
    clearHighlight();
  }
};

async function loadRewards() {
  if (!gridEl) return;
  showSkeleton(gridEl, 4);
  try {
    const rewards = await api.fetchRewards();
    setState({ rewards });
    gridEl.innerHTML = '';
    renderRewardCards(rewards);
  } catch (e) {
    showGridError(gridEl, loadRewards);
  }
}

function renderRewardCards(rewards) {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  const { coins } = getState();

  rewards.forEach((reward, index) => {
    const canAfford = coins >= reward.coins_cost;
    const card = document.createElement('button');
    card.className = 'reward-card card-enter' + (canAfford ? '' : ' reward-card--locked');
    card.style.setProperty('--stagger-i', String(index));
    card.setAttribute('aria-label',
      `奖励：${reward.name}，需要${reward.coins_cost}金币${canAfford ? '' : `，还差${reward.coins_cost - coins}金币`}`);

    // Visual coin dots (up to 5, then number)
    let costVisual = '';
    if (reward.coins_cost <= 5) {
      costVisual = '🪙'.repeat(reward.coins_cost);
    } else {
      costVisual = `🪙 × ${reward.coins_cost}`;
    }

    const imgSrc = `/child/assets/icons/rewards/${reward.id}.png`;
    card.innerHTML = `
      <div class="reward-card__icon">
        <img src="${imgSrc}" alt="${reward.name}" class="card__icon-img"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div class="card__icon-emoji" style="display:none">${reward.icon_emoji}</div>
      </div>
      <div class="reward-card__name">${reward.name}</div>
      <div class="reward-card__cost">${costVisual}</div>
      ${!canAfford
        ? `<div class="reward-card__shortfall">还差 ${reward.coins_cost - coins} 🪙</div>`
        : '<div class="reward-card__hint">点我</div>'}
    `;

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!canAfford) {
        speak(`${reward.name}需要${reward.coins_cost}个金币，还差${reward.coins_cost - coins}个`);
        return;
      }
      const costText = `需要${reward.coins_cost}个金币`;
      const shouldExecute = handleTwoTap(card, `reward-${reward.id}`, reward.name, costText);
      if (shouldExecute) {
        doRedeem(reward);
      }
    });

    gridEl.appendChild(card);
  });
}

async function doRedeem(reward) {
  try {
    const result = await api.redeemReward(reward.id);
    setState({ coins: result.new_balance });
    celebrate();
    speak(`兑换成功！${reward.name}！等爸爸妈妈批准哦`);
    showToast(`🎉 ${reward.name} 兑换成功！`, 'success');
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    await loadRewards();
  } catch (e) {
    showToast(e.message || '兑换失败 😢', 'error');
    speak('金币不够哦');
  }
}
