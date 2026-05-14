// Games page: lobby + in-game runner + result overlay.
// Games here are always unlocked and designed for touch-only play.

import * as api from '../api.js';
import { speak, handleTwoTap } from '../components/voice.js';
import { showToast } from '../components/toast.js';
import { celebrate } from '../components/animations.js';
import { sfx } from '../sfx.js';

const GAME_DEFS = [
  {
    id: 'find-animal',
    name: '找一找',
    emoji: '👀',
    desc: '听提示，点正确图片',
    maxCoins: 5,
    reward_id: 'find-animal',
    moduleLoader: () => import('./find-animal-game.js').then(m => m.createFindAnimalGame),
    layout: 'dom',
  },
  {
    id: 'color-match',
    name: '颜色花园',
    emoji: '🎨',
    desc: '听颜色，点对色块',
    maxCoins: 5,
    reward_id: 'color-match',
    moduleLoader: () => import('./touch-mini-games.js').then(m => m.createColorMatchGame),
    layout: 'dom',
  },
  {
    id: 'counting-stars',
    name: '数星星',
    emoji: '⭐',
    desc: '按提示点够数量',
    maxCoins: 5,
    reward_id: 'counting-stars',
    moduleLoader: () => import('./touch-mini-games.js').then(m => m.createCountingStarsGame),
    layout: 'dom',
  },
  {
    id: 'shape-sort',
    name: '形状小屋',
    emoji: '🔺',
    desc: '听形状，找朋友',
    maxCoins: 5,
    reward_id: 'shape-sort',
    moduleLoader: () => import('./touch-mini-games.js').then(m => m.createShapeSortGame),
    layout: 'dom',
  },
  {
    id: 'memory-cards',
    name: '翻翻乐',
    emoji: '🃏',
    desc: '翻卡片，找一样',
    maxCoins: 5,
    reward_id: 'memory-cards',
    moduleLoader: () => import('./touch-mini-games.js').then(m => m.createMemoryCardsGame),
    layout: 'dom',
  },
];

export function invalidateSkinsCache() { /* no-op */ }

let pageEl = null;
let currentGame = null;

export const gamesPage = {
  id: 'games',

  render() {
    pageEl = document.createElement('div');
    pageEl.className = 'page page--games';
    renderLobby();
    return pageEl;
  },

  mount() {
    speak('小游戏');
  },

  unmount() {
    stopCurrentGame();
    pageEl = null;
  },
};

function renderLobby() {
  if (!pageEl) return;
  pageEl.innerHTML = '';

  const lobby = document.createElement('div');
  lobby.className = 'games-lobby';
  lobby.innerHTML = `
    <div class="games-lobby__title">🎮 小游戏</div>
    <div class="games-lobby__subtitle">点一下听介绍，再点一下开始</div>
  `;

  const grid = document.createElement('div');
  grid.className = 'games-grid';
  lobby.appendChild(grid);
  pageEl.appendChild(lobby);

  renderGameCards(grid);
}

function renderGameCards(gridEl) {
  GAME_DEFS.forEach((def, index) => {
    const card = document.createElement('button');
    card.className = 'game-card card-enter';
    card.style.setProperty('--stagger-i', String(index));
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${def.name}，${def.desc}，点击开始`);

    card.innerHTML = `
      <div class="game-card__emoji">${def.emoji}</div>
      <div class="game-card__name">${def.name}</div>
      <div class="game-card__desc">${def.desc}</div>
      <div class="game-card__reward">最多 🪙${def.maxCoins}</div>
    `;

    card.addEventListener('click', () => {
      const shouldExecute = handleTwoTap(
        card,
        `game-${def.id}`,
        def.name,
        `${def.desc}，最多赢 ${def.maxCoins} 个金币`
      );
      if (shouldExecute) startGame(def);
    });

    gridEl.appendChild(card);
  });
}

function goToLobby() {
  stopCurrentGame();
  renderLobby();
}

async function startGame(def) {
  if (!pageEl) return;
  sfx.confirm();
  pageEl.innerHTML = '';

  const gameView = document.createElement('div');
  gameView.className = 'game-view';
  gameView.style.position = 'relative';
  gameView.innerHTML = `
    <div class="game-view__header">
      <button class="game-view__back" aria-label="返回">←</button>
      <div class="game-view__title">${def.emoji} ${def.name}</div>
      <div class="game-view__timer" id="gv-timer"></div>
    </div>
  `;
  pageEl.appendChild(gameView);

  gameView.querySelector('.game-view__back').addEventListener('click', goToLobby);

  const contentArea = document.createElement('div');
  const layout = def.layout || 'dom';
  contentArea.className = layout === 'canvas' ? 'game-view__canvas-wrap' : 'game-view__dom-wrap';
  gameView.appendChild(contentArea);

  try {
    const createFn = await def.moduleLoader();
    const instance = createFn(contentArea, (coins) => handleGameEnd(def, gameView, coins));
    currentGame = { instance, def };
  } catch (e) {
    console.error('Game load failed:', e);
    currentGame = null;
    showToast('游戏加载失败 😢', 'error');
    renderLobby();
  }
}

function handleGameEnd(def, gameView, coins) {
  if (!pageEl) return;
  sfx.complete();
  const overlay = renderResultOverlay(def, gameView, coins);

  api.rewardGameCoins(def.reward_id || def.id, coins)
    .then(result => {
      if (!result || typeof result.coins_earned !== 'number') return;
      if (result.coins_earned !== coins) {
        const coinsEl = overlay.querySelector('.game-result__coins');
        if (coinsEl) {
          coinsEl.textContent = result.coins_earned > 0
            ? `+${result.coins_earned} 🪙`
            : '继续努力！';
        }
      }
      if (result.coins_earned > 0) celebrate();
    })
    .catch(e => {
      console.error('rewardGameCoins failed:', e);
    });
}

function renderResultOverlay(def, gameView, coins) {
  const emoji = coins >= 3 ? '🏆' : coins >= 2 ? '🌟' : '🎉';
  const title = coins >= 3 ? '太棒啦！' : coins >= 2 ? '真不错！' : '完成啦！';
  const coinText = coins > 0 ? `+${coins} 🪙` : '继续努力！';

  const overlay = document.createElement('div');
  overlay.className = 'game-result';
  overlay.innerHTML = `
    <div class="game-result__emoji">${emoji}</div>
    <div class="game-result__title">${title}</div>
    <div class="game-result__coins">${coinText}</div>
    <button class="game-result__btn">再来一次！</button>
    <button class="game-result__back">返回大厅</button>
  `;
  overlay.querySelector('.game-result__btn').addEventListener('click', () => {
    stopCurrentGame();
    startGame(def);
  });
  overlay.querySelector('.game-result__back').addEventListener('click', goToLobby);
  gameView.appendChild(overlay);
  return overlay;
}

function stopCurrentGame() {
  if (!currentGame) return;
  try {
    currentGame.instance.destroy();
  } catch (e) {
    console.error('game destroy failed:', e);
  }
  currentGame = null;
}
