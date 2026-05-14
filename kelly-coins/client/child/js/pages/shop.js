// Shop page with 3 tabs: 皮肤 (skins), 道具商店 (item shop), 道具背包 (inventory)
// - Skins tab: full character illustrations, two-tap purchase + equip
// - Item shop tab: food/activity rewards, INSTANT purchase (no parent approval)
// - Inventory tab: items already purchased, tap to redeem → requires parent approval

import * as api from '../api.js';
import { getState, setState } from '../state.js';
import { getChildId } from '../api.js';
import { showToast } from '../components/toast.js';
import { showSkeleton, showGridError } from '../components/loading.js';
import { celebrate, coinBurst } from '../components/animations.js';
import { handleTwoTap, clearHighlight, speak } from '../components/voice.js';
import { showActionPending } from '../components/action-pending.js';
import { onChildEvent } from '../state-sync.js';

let rootEl = null;
let currentTab = 'items'; // 'items' | 'inventory'
let unsubscribeSync = null;

const TABS = [
  { id: 'items',     icon: '🍫', label: '道具商店', voice: '道具商店' },
  { id: 'inventory', icon: '🎒', label: '背包',     voice: '我的背包' },
];

export const shopPage = {
  id: 'shop',

  render() {
    const page = document.createElement('div');
    page.className = 'page page--shop';
    page.innerHTML = `
      <div class="page__title">
        <span class="page__title-icon">🛍️</span>
        梦幻商店
      </div>
      <div class="page__subtitle">购买皮肤和奖品！</div>
      <div class="shop-tabs" id="shop-tabs">
        ${TABS.map(t => `
          <button class="shop-tab" data-tab="${t.id}">
            <span class="shop-tab__icon">${t.icon}</span>
            <span class="shop-tab__label">${t.label}</span>
          </button>
        `).join('')}
      </div>
      <div class="shop-content" id="shop-content"></div>
    `;

    rootEl = page;
    page.addEventListener('click', (e) => {
      if (!e.target.closest('.skin-card') && !e.target.closest('.item-card') && !e.target.closest('.inv-card')) {
        clearHighlight();
      }
    });

    // Tab click handlers
    page.querySelectorAll('.shop-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        const tab = TABS.find(t => t.id === tabId);
        if (tab) speak(tab.voice);
        switchTab(tabId);
      });
    });

    return page;
  },

  async mount() {
    speak('欢迎来到商店！');
    switchTab('items');

    // Multi-session sync: reload the active tab if another device changed
    // the coin balance, bought something that went into the inventory,
    // or had a pending purchase approved by a parent.
    const handleSync = (e) => {
      if (!rootEl) return;
      // Re-fetch whichever tab is visible. Both paths use the current coin
      // balance from state.js to decide affordability, which state-sync
      // already updated before dispatching this event.
      if (currentTab === 'items')     loadItems().catch(() => {});
      else if (currentTab === 'inventory') loadInventory().catch(() => {});
    };
    const off1 = onChildEvent('state-changed', (e) => {
      if (['purchase', 'earn', 'redeem-legacy', 'game-reward', 'skin-buy'].includes(e.scope)) {
        handleSync(e);
      }
    });
    const off2 = onChildEvent('action-resolved', (e) => {
      if (e.action?.status === 'approved') handleSync(e);
    });
    unsubscribeSync = () => { off1(); off2(); };
  },

  unmount() {
    rootEl = null;
    clearHighlight();
    if (unsubscribeSync) { unsubscribeSync(); unsubscribeSync = null; }
  }
};

function switchTab(tabId) {
  currentTab = tabId;
  if (!rootEl) return;

  // Update active state
  rootEl.querySelectorAll('.shop-tab').forEach(btn => {
    btn.classList.toggle('shop-tab--active', btn.dataset.tab === tabId);
  });

  if (tabId === 'items') loadItems();
  else if (tabId === 'inventory') loadInventory();
}

// ============================================================
// ITEMS SHOP TAB
// ============================================================

async function loadItems() {
  const contentEl = rootEl?.querySelector('#shop-content');
  if (!contentEl) return;
  contentEl.innerHTML = '';
  showSkeleton(contentEl, 4);
  try {
    const items = await api.fetchRewards();
    contentEl.innerHTML = `
      <div class="shop-hint">💡 购买后会放进背包，想要的时候再兑换</div>
      <div class="item-grid" id="item-grid"></div>
    `;
    const grid = contentEl.querySelector('#item-grid');
    renderItemCards(grid, items);
  } catch (e) {
    showGridError(contentEl, loadItems);
  }
}

function renderItemCards(grid, items) {
  grid.innerHTML = '';
  const { coins } = getState();

  items.forEach((item, index) => {
    const canAfford = coins >= item.coins_cost;
    const card = document.createElement('button');
    card.className = 'item-card card-enter' + (canAfford ? '' : ' item-card--locked');
    card.style.setProperty('--stagger-i', String(index));
    card.setAttribute('aria-label',
      `道具：${item.name}，需要${item.coins_cost}金币${canAfford ? '' : `，还差${item.coins_cost - coins}金币`}`);

    const iconMarkup = item.icon_file
      ? `<img src="/child/assets/icons/rewards/${item.icon_file}.png"
             alt="${item.name}" class="card__icon-img"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
         <div class="card__icon-emoji" style="display:none">${item.icon_emoji}</div>`
      : `<div class="card__icon-emoji">${item.icon_emoji}</div>`;

    let costVisual = '';
    if (item.coins_cost <= 5) {
      costVisual = '🪙'.repeat(item.coins_cost);
    } else {
      costVisual = `🪙 × ${item.coins_cost}`;
    }

    card.innerHTML = `
      <div class="item-card__icon">
        ${iconMarkup}
      </div>
      <div class="item-card__name">${item.name}</div>
      <div class="item-card__cost">${costVisual}</div>
      ${item.category === 'virtual' ? '<div class="item-card__badge">虚拟</div>' : ''}
      ${canAfford
        ? '<div class="item-card__hint">点我购买</div>'
        : `<div class="item-card__shortfall">还差 ${item.coins_cost - coins} 🪙</div>`}
    `;

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!canAfford) {
        speak(`${item.name}需要${item.coins_cost}个金币，还差${item.coins_cost - coins}个`);
        return;
      }
      const shouldExecute = handleTwoTap(card, `item-${item.id}`, item.name, `${item.coins_cost}个金币`);
      if (shouldExecute) {
        doPurchaseItem(item, card);
      }
    });

    grid.appendChild(card);
  });
}

async function doPurchaseItem(item, cardEl) {
  // New flow: the child CANNOT purchase directly. We create a pending_action
  // on the server, the parent gets a Web Push + SSE notification, and the
  // child sees a waiting overlay. When the parent approves from their
  // dashboard, the overlay transforms into a celebration.
  try {
    const res = await api.requestPurchase(item.id);
    if (!res.success || !res.action) {
      showToast(res.message || '请求失败 😢', 'error');
      return;
    }
    speak(`请爸爸妈妈批准${item.name}`);
    const resolved = await showActionPending(res.action, { childId: getChildId() });
    if (resolved.status === 'approved') {
      const newBalance = resolved.result?.new_balance;
      if (typeof newBalance === 'number') setState({ coins: newBalance });
      speak(`购买成功！${item.name}放进背包啦！`);
      showToast(`✅ ${item.name} 已入背包！`, 'success');
      coinBurst(cardEl, 1);
      await loadItems();
    } else if (resolved.status === 'rejected') {
      speak(`爸爸妈妈说${item.name}下次再买吧`);
      showToast('爸爸妈妈说下次再买哦', 'info');
    } else if (resolved.status === 'cancelled') {
      speak('已取消');
    }
  } catch (e) {
    showToast(e.message || '请求失败 😢', 'error');
  }
}

// ============================================================
// INVENTORY TAB
// ============================================================

async function loadInventory() {
  const contentEl = rootEl?.querySelector('#shop-content');
  if (!contentEl) return;
  contentEl.innerHTML = '';
  showSkeleton(contentEl, 6, 'inv');
  try {
    const inventory = await api.fetchInventory();
    if (!inventory || inventory.length === 0) {
      contentEl.innerHTML = `
        <div class="inv-empty">
          <div class="inv-empty__icon">🎒</div>
          <div class="inv-empty__text">背包是空的</div>
          <div class="inv-empty__hint">去道具商店买点东西吧！</div>
        </div>
      `;
      return;
    }
    contentEl.innerHTML = `
      <div class="shop-hint">💡 点一下物品就可以兑换使用，需要爸爸妈妈批准哦</div>
      <div class="inv-grid" id="inv-grid"></div>
    `;
    const grid = contentEl.querySelector('#inv-grid');
    renderInventoryCards(grid, inventory);
  } catch (e) {
    showGridError(contentEl, loadInventory);
  }
}

function renderInventoryCards(grid, inventory) {
  grid.innerHTML = '';
  inventory.forEach((item, index) => {
    const card = document.createElement('button');
    card.className = 'inv-card card-enter';
    card.style.setProperty('--stagger-i', String(index));
    card.setAttribute('aria-label', `背包道具：${item.name}${item.quantity > 1 ? `，数量${item.quantity}` : ''}，点击兑换`);

    const iconMarkup = item.icon_file
      ? `<img src="/child/assets/icons/rewards/${item.icon_file}.png"
             alt="${item.name}" class="card__icon-img"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
         <div class="card__icon-emoji" style="display:none">${item.icon_emoji}</div>`
      : `<div class="card__icon-emoji">${item.icon_emoji}</div>`;

    card.innerHTML = `
      <div class="inv-card__icon">
        ${iconMarkup}
      </div>
      ${item.quantity > 1 ? `<div class="inv-card__qty">×${item.quantity}</div>` : ''}
      <div class="inv-card__name">${item.name}</div>
      <div class="inv-card__hint">点我兑换</div>
    `;

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const shouldExecute = handleTwoTap(card, `inv-${item.reward_id}`, item.name, '兑换使用');
      if (shouldExecute) {
        doRedeemFromInventory(item);
      }
    });

    grid.appendChild(card);
  });
}

async function doRedeemFromInventory(item) {
  // Same pending-action flow as purchase, but for redeeming an item
  // that's already in the backpack.
  try {
    const res = await api.requestRedeem(item.reward_id);
    if (!res.success || !res.action) {
      showToast(res.message || '请求失败 😢', 'error');
      return;
    }
    speak(`请爸爸妈妈批准兑换${item.name}`);
    const resolved = await showActionPending(res.action, { childId: getChildId() });
    if (resolved.status === 'approved') {
      speak(`太棒了！${item.name}可以用了！`);
      showToast(`🎉 ${item.name} 已兑换！`, 'success');
      await loadInventory();
    } else if (resolved.status === 'rejected') {
      speak(`爸爸妈妈说${item.name}再等等吧`);
      showToast('爸爸妈妈说再等等哦', 'info');
    } else if (resolved.status === 'cancelled') {
      speak('已取消');
    }
  } catch (e) {
    showToast(e.message || '兑换失败 😢', 'error');
  }
}

