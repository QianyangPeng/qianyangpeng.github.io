// Skin picker — bottom sheet opened from the home page FAB.
// All cards use the standard two-tap pattern:
//   first tap  → speaks name + status aloud
//   second tap → performs action (equip or buy)

import * as api from '../api.js';
import { getState, setState } from '../state.js';
import { showToast } from './toast.js';
import { celebrate } from './animations.js';
import { handleTwoTap, clearHighlight, speak } from './voice.js';
import { updateCharacter } from './character.js';
import { skinImageSrc, onSkinStyleChange } from '../skin-style.js';
import { showSkeleton, showGridError } from './loading.js';
import { sfx } from '../sfx.js';
import { invalidateSkinsCache } from '../pages/games.js';

let sheetEl = null;
let overlayEl = null;
let gridEl = null;
let styleUnsub = null;

function ensureElements() {
  if (sheetEl) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'spicker-overlay';
  overlayEl.addEventListener('click', hide);

  sheetEl = document.createElement('div');
  sheetEl.className = 'spicker-sheet';
  sheetEl.setAttribute('role', 'dialog');
  sheetEl.setAttribute('aria-label', '选择角色皮肤');

  document.getElementById('app').appendChild(overlayEl);
  document.getElementById('app').appendChild(sheetEl);
}

export function openSkinPicker() {
  ensureElements();
  sfx.highlight();

  sheetEl.innerHTML = `
    <div class="spicker-handle" aria-hidden="true"></div>
    <div class="spicker-header">
      <div class="spicker-title">✨ 选择皮肤</div>
      <button class="spicker-close" aria-label="关闭">✕</button>
    </div>
    <div class="spicker-body">
      <div class="skin-grid" id="spicker-skin-grid"></div>
    </div>
  `;

  gridEl = sheetEl.querySelector('#spicker-skin-grid');
  sheetEl.querySelector('.spicker-close').addEventListener('click', hide);

  overlayEl.classList.add('spicker-overlay--visible');
  sheetEl.classList.add('spicker-sheet--visible');

  loadSkins();

  if (styleUnsub) styleUnsub();
  styleUnsub = onSkinStyleChange(() => loadSkins());
}

function hide() {
  overlayEl?.classList.remove('spicker-overlay--visible');
  sheetEl?.classList.remove('spicker-sheet--visible');
  clearHighlight();
  if (styleUnsub) { styleUnsub(); styleUnsub = null; }
}

async function loadSkins() {
  if (!gridEl) return;
  showSkeleton(gridEl, 3, 'skin');
  try {
    const skins = await api.fetchSkins();
    gridEl.innerHTML = '';
    renderSkinCards(skins);
    enableDragScroll(gridEl);
  } catch {
    showGridError(gridEl, loadSkins);
  }
}

function renderSkinCards(skins) {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  const { coins } = getState();

  skins.forEach((skin, index) => {
    const canAfford = coins >= skin.cost;

    let statusClass = '';
    let statusBadge = '';

    if (skin.equipped) {
      statusClass = 'skin-card--equipped';
      statusBadge = '<div class="skin-card__status skin-card__status--equipped">✓ 使用中</div>';
    } else if (skin.owned) {
      statusClass = 'skin-card--owned';
      statusBadge = '<div class="skin-card__status skin-card__status--owned">已拥有 · 点我装备</div>';
    } else if (canAfford) {
      statusClass = 'skin-card--buyable';
      statusBadge = `<div class="skin-card__price">🪙 ${skin.cost}</div>`;
    } else {
      statusClass = 'skin-card--locked';
      statusBadge = `<div class="skin-card__price skin-card__price--locked">🪙 ${skin.cost}<br><span style="font-size:0.75em">差 ${skin.cost - coins} 枚</span></div>`;
    }

    const card = document.createElement('div');
    card.className = `skin-card ${statusClass} card-enter`;
    card.style.setProperty('--stagger-i', String(index));
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label',
      skin.equipped ? `${skin.name}，使用中`
      : skin.owned   ? `${skin.name}，已拥有，点击装备`
      : canAfford    ? `${skin.name}，需要${skin.cost}金币购买`
      :                `${skin.name}，需要${skin.cost}金币，还差${skin.cost - coins}金币`);

    card.innerHTML = `
      <div class="skin-card__preview">
        <img src="${skinImageSrc(skin.id)}" alt="${skin.name}"
             class="skin-card__img" onerror="this.style.opacity='0.3'">
      </div>
      <div class="skin-card__info">
        <div class="skin-card__name">${skin.name}</div>
        <div class="skin-card__desc">${skin.desc}</div>
        ${statusBadge}
      </div>
    `;

    // Two-tap for all interactable cards
    if (!skin.equipped) {
      card.addEventListener('click', (e) => {
        e.stopPropagation();

        if (!skin.owned && !canAfford) {
          // Can't afford — just announce, no second-tap action
          speak(`${skin.name}需要${skin.cost}个金币，还差${skin.cost - coins}个`);
          return;
        }

        const actionText = skin.owned
          ? '点击装备'
          : `需要${skin.cost}个金币，再点一下确认`;

        const shouldExecute = handleTwoTap(card, `skin-${skin.id}`, skin.name, actionText);
        if (shouldExecute) {
          if (skin.owned) doEquipSkin(skin);
          else doBuySkin(skin);
        }
      });
    }

    gridEl.appendChild(card);
  });
}

async function doBuySkin(skin) {
  try {
    const result = await api.buySkin(skin.id);
    setState({ coins: result.new_balance });
    celebrate();
    speak(`太棒了！获得了${skin.name}！`);
    showToast(`🎉 获得 ${skin.name}！`, 'success');
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    invalidateSkinsCache();
    await loadSkins();
  } catch (e) {
    showToast(e.message || '购买失败 😢', 'error');
  }
}

async function doEquipSkin(skin) {
  try {
    await api.equipSkin(skin.id);
    setState({ equipped_skin: skin.id });
    updateCharacter(skin.id);
    speak(`已装备${skin.name}！`);
    showToast(`✅ 已装备 ${skin.name}`, 'success');
    invalidateSkinsCache();
    await loadSkins();
  } catch (e) {
    showToast(e.message || '装备失败', 'error');
  }
}

function enableDragScroll(el) {
  if (el._dragScrollEnabled) return;
  el._dragScrollEnabled = true;
  let isDown = false, startX = 0, scrollLeft = 0, dragMoved = false;
  el.addEventListener('mousedown', (e) => {
    isDown = true; dragMoved = false;
    startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft;
    el.classList.add('skin-grid--dragging');
  });
  const stop = () => { if (!isDown) return; isDown = false; el.classList.remove('skin-grid--dragging'); };
  el.addEventListener('mouseleave', stop);
  el.addEventListener('mouseup', stop);
  el.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const walk = (e.pageX - el.offsetLeft - startX) * 1.5;
    if (Math.abs(walk) > 5) dragMoved = true;
    el.scrollLeft = scrollLeft - walk;
  });
  el.addEventListener('click', (e) => {
    if (dragMoved) { e.stopPropagation(); e.preventDefault(); dragMoved = false; }
  }, true);
  el.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: 'auto' });
    }
  }, { passive: false });
}
