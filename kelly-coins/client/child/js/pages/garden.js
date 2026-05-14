// Mini Garden page
// Plant seeds, water plants, and harvest mature plants for coins
// Two-tap pattern: first tap speaks the action, second tap performs it

import * as api from '../api.js';
import { setState } from '../state.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { coinBurst, celebrate } from '../components/animations.js';
import { handleTwoTap, clearHighlight, speak } from '../components/voice.js';

const PLOT_SIZE = 12; // 3 columns x 4 rows

let plotEl = null;
let shopEl = null;
let plantTypes = [];
let garden = { plants: [] };

export const gardenPage = {
  id: 'garden',

  render() {
    const page = document.createElement('div');
    page.className = 'page page--garden';

    page.innerHTML = `
      <div class="page__title">
        <span class="page__title-icon">🌻</span>
        我的花园
      </div>
      <div class="page__subtitle">种花、浇水、收获金币</div>

      <div class="garden__section">
        <div class="garden__section-title">
          <span>🪴 花圃</span>
          <span class="garden__hint">点苗苗浇水，成熟后收获</span>
        </div>
        <div class="garden-plot" id="garden-plot">
          <div class="garden__loading">加载中…</div>
        </div>
      </div>

      <div class="garden__section">
        <div class="garden__section-title">
          <span>🌱 种子商店</span>
          <span class="garden__hint">点一下听，再点一下种植</span>
        </div>
        <div class="seed-shop" id="seed-shop">
          <div class="garden__loading">加载中…</div>
        </div>
      </div>
    `;

    plotEl = page.querySelector('#garden-plot');
    shopEl = page.querySelector('#seed-shop');

    page.addEventListener('click', (e) => {
      if (!e.target.closest('.plant-cell') && !e.target.closest('.seed-card')) {
        clearHighlight();
      }
    });

    return page;
  },

  async mount() {
    speak('欢迎来到我的花园！种一颗种子，浇浇水，等它长大');
    await loadAll();
  },

  unmount() {
    plotEl = null;
    shopEl = null;
    clearHighlight();
  }
};

async function loadAll() {
  try {
    const [types, gardenData] = await Promise.all([
      api.fetchPlantTypes(),
      api.fetchGarden()
    ]);
    plantTypes = Array.isArray(types) ? types : [];
    garden = gardenData || { plants: [] };
    if (!Array.isArray(garden.plants)) garden.plants = [];
    renderPlot();
    renderSeedShop();
  } catch (e) {
    if (plotEl) plotEl.innerHTML = '<div class="garden__error">加载失败 😢</div>';
    if (shopEl) shopEl.innerHTML = '<div class="garden__error">加载失败 😢</div>';
    showToast('加载花园失败 😢', 'error');
  }
}

function getPlantType(typeId) {
  return plantTypes.find(t => t.id === typeId) || null;
}

function renderPlot() {
  if (!plotEl) return;
  plotEl.innerHTML = '';

  const plants = garden.plants || [];

  for (let i = 0; i < PLOT_SIZE; i++) {
    const cell = document.createElement('button');
    cell.className = 'plant-cell';

    const plant = plants[i];
    if (plant) {
      const type = getPlantType(plant.type);
      const stages = (type && type.stages) || ['🌱', '🌿', '🌸'];
      const stageIdx = Math.min(plant.stage || 0, stages.length - 1);
      const emoji = stages[stageIdx];
      const name = type ? type.name : '植物';
      const isMature = !!plant.is_mature;
      const daysSinceWater = plant.days_since_water != null ? plant.days_since_water : 0;
      const needsWater = daysSinceWater >= 1;

      cell.classList.add('plant-cell--planted');
      if (isMature) cell.classList.add('plant-cell--mature');
      if (needsWater && !isMature) cell.classList.add('plant-cell--thirsty');

      cell.innerHTML = `
        <div class="plant-cell__emoji">${emoji}</div>
        <div class="plant-cell__name">${name}</div>
        <div class="plant-cell__meta">
          ${isMature
            ? '<span class="plant-cell__ready">收获 ✨</span>'
            : `<span class="plant-cell__stage">第${stageIdx + 1}/${stages.length}阶段</span>`}
        </div>
        ${needsWater && !isMature ? '<div class="plant-cell__thirst">💧</div>' : ''}
      `;

      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        onPlantClick(plant, type, cell, isMature);
      });
    } else {
      cell.classList.add('plant-cell--empty');
      cell.innerHTML = `
        <div class="plant-cell__plus">+</div>
        <div class="plant-cell__empty-label">空地</div>
      `;
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        speak('在下面种子商店选一颗种子吧');
        showToast('在下面种子商店选一颗种子吧 🌱', 'info');
      });
    }

    plotEl.appendChild(cell);
  }
}

function onPlantClick(plant, type, cellEl, isMature) {
  const name = type ? type.name : '植物';
  if (isMature) {
    const reward = type ? type.harvest_coins : 0;
    const shouldExecute = handleTwoTap(cellEl, `harvest-${plant.id}`, name, `已经成熟啦，收获${reward}个金币`);
    if (shouldExecute) {
      confirmHarvest(plant, type, cellEl);
    }
  } else {
    const shouldExecute = handleTwoTap(cellEl, `water-${plant.id}`, name, '点一下浇水');
    if (shouldExecute) {
      doWater(plant, type, cellEl);
    }
  }
}

function confirmHarvest(plant, type, cellEl) {
  const reward = type ? type.harvest_coins : 0;
  const name = type ? type.name : '植物';
  const emojiEnd = (type && type.stages) ? type.stages[type.stages.length - 1] : '🌸';
  showModal({
    emoji: emojiEnd,
    title: `收获${name}？`,
    body: `成熟啦！收获后可以得到 <strong>${reward} 🪙</strong>`,
    confirmText: '收获 ✨',
    cancelText: '再等等',
    onConfirm: () => doHarvest(plant, type, cellEl),
  });
}

async function doHarvest(plant, type, cellEl) {
  try {
    const result = await api.harvestPlant(plant.id);
    const reward = (result && (result.coins_earned || result.harvest_coins)) || (type ? type.harvest_coins : 0);
    if (result && result.new_balance != null) {
      setState({ coins: result.new_balance });
    }
    coinBurst(cellEl, reward);
    celebrate();
    speak(`收获成功！得到了${reward}个金币`);
    showToast(`🌸 +${reward}🪙`, 'success');
    if (navigator.vibrate) navigator.vibrate([40, 30, 60]);
    await loadAll();
  } catch (e) {
    showToast(e.message || '收获失败 😢', 'error');
  }
}

async function doWater(plant, type, cellEl) {
  // Show splash immediately for snappy feedback
  spawnWaterSplash(cellEl);
  if (navigator.vibrate) navigator.vibrate(30);

  try {
    const result = await api.waterPlant(plant.id);
    speak('浇水啦！咕嘟咕嘟');
    showToast('💦 浇水成功！', 'success');

    // If plant grew a stage, replay grow animation on the cell
    const updatedPlant = result && result.plant;
    if (updatedPlant && updatedPlant.stage > (plant.stage || 0)) {
      cellEl.classList.add('plant-cell--growing');
      setTimeout(() => cellEl.classList.remove('plant-cell--growing'), 700);
    }
    await loadAll();
  } catch (e) {
    showToast(e.message || '浇水失败 😢', 'error');
  }
}

function spawnWaterSplash(cellEl) {
  const splash = document.createElement('div');
  splash.className = 'plant-cell__splash';
  splash.textContent = '💦';
  cellEl.appendChild(splash);
  splash.addEventListener('animationend', () => splash.remove());
}

function renderSeedShop() {
  if (!shopEl) return;
  shopEl.innerHTML = '';

  if (!plantTypes.length) {
    shopEl.innerHTML = '<div class="garden__error">没有种子可买 😢</div>';
    return;
  }

  plantTypes.forEach(type => {
    const card = document.createElement('button');
    card.className = 'seed-card';

    const stages = type.stages || ['🌱', '🌿', '🌸'];
    const finalEmoji = stages[stages.length - 1];

    card.innerHTML = `
      <div class="seed-card__icon">${finalEmoji}</div>
      <div class="seed-card__name">${type.name}</div>
      <div class="seed-card__row">
        <span class="seed-card__cost">🪙 ${type.cost}</span>
        <span class="seed-card__arrow">→</span>
        <span class="seed-card__reward">+${type.harvest_coins}</span>
      </div>
      <div class="seed-card__days">${type.grow_days || 1}天成熟</div>
    `;

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const shouldExecute = handleTwoTap(
        card,
        `seed-${type.id}`,
        type.name,
        `${type.cost}个金币种子，${type.grow_days || 1}天后收获${type.harvest_coins}个金币`
      );
      if (shouldExecute) {
        confirmPlant(type);
      }
    });

    shopEl.appendChild(card);
  });
}

function confirmPlant(type) {
  // Check space first
  const occupied = (garden.plants || []).length;
  if (occupied >= PLOT_SIZE) {
    showToast('花圃满啦，先收获一些吧 🌸', 'info');
    speak('花圃满啦，先收获一些吧');
    return;
  }
  const stages = type.stages || ['🌱', '🌿', '🌸'];
  showModal({
    emoji: stages[0],
    title: `种植${type.name}？`,
    body: `花费 <strong>${type.cost} 🪙</strong>，<strong>${type.grow_days || 1}天</strong>后可收获 <strong>${type.harvest_coins} 🪙</strong>`,
    confirmText: '种下 🌱',
    cancelText: '再想想',
    onConfirm: () => doPlant(type),
  });
}

async function doPlant(type) {
  try {
    const result = await api.plantSeed(type.id);
    if (result && result.new_balance != null) {
      setState({ coins: result.new_balance });
    }
    speak(`种下了${type.name}！记得每天浇水哦`);
    showToast(`🌱 种下了 ${type.name}！`, 'success');
    if (navigator.vibrate) navigator.vibrate(40);
    await loadAll();

    // Grow animation on newest plant cell
    requestAnimationFrame(() => {
      const cells = plotEl ? plotEl.querySelectorAll('.plant-cell--planted') : [];
      const lastCell = cells[cells.length - 1];
      if (lastCell) {
        lastCell.classList.add('plant-cell--growing');
        setTimeout(() => lastCell.classList.remove('plant-cell--growing'), 700);
      }
    });
  } catch (e) {
    showToast(e.message || '种植失败 😢', 'error');
  }
}
