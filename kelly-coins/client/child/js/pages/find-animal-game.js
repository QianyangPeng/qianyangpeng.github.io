// Tap-based picture recognition game. No microphone required.

import { speak } from '../components/voice.js';
import { sfx } from '../sfx.js';
import { celebrate, coinBurst } from '../components/animations.js';

const TOTAL_ROUNDS = 10;
const OPTIONS_PER_ROUND = 4;
const MAX_ATTEMPTS = 2;

const ITEMS = [
  { id: 'angel', name: '小天使', file: 'angel' },
  { id: 'butterfly', name: '蝴蝶', file: 'butterfly' },
  { id: 'cake', name: '蛋糕', file: 'cake' },
  { id: 'elephant', name: '大象', file: 'elephant' },
  { id: 'fox', name: '狐狸', file: 'fox' },
  { id: 'giraffe', name: '长颈鹿', file: 'giraffe' },
  { id: 'heart', name: '爱心', file: 'heart' },
  { id: 'jellyfish', name: '水母', file: 'jellyfish' },
  { id: 'koala', name: '考拉', file: 'koala' },
  { id: 'lion', name: '狮子', file: 'lion' },
  { id: 'mushroom', name: '蘑菇', file: 'mushroom' },
  { id: 'owl', name: '猫头鹰', file: 'owl' },
  { id: 'pumpkin', name: '南瓜', file: 'pumpkin' },
  { id: 'queen', name: '女王', file: 'queen' },
  { id: 'rainbow', name: '彩虹', file: 'rainbow' },
  { id: 'star', name: '星星', file: 'star' },
  { id: 'turtle', name: '乌龟', file: 'turtle' },
  { id: 'unicorn', name: '独角兽', file: 'unicorn' },
  { id: 'violin', name: '小提琴', file: 'violin' },
  { id: 'whale', name: '鲸鱼', file: 'whale' },
  { id: 'xylophone', name: '木琴', file: 'xylophone' },
  { id: 'yarn', name: '毛线球', file: 'yarn' },
  { id: 'zebra', name: '斑马', file: 'zebra' },
];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function coinsFor(correctCount) {
  if (correctCount >= TOTAL_ROUNDS) return 5;
  if (correctCount >= TOTAL_ROUNDS - 1) return 4;
  if (correctCount >= TOTAL_ROUNDS - 3) return 3;
  if (correctCount >= Math.ceil(TOTAL_ROUNDS / 2)) return 2;
  return 1;
}

export function createFindAnimalGame(containerEl, onEnd) {
  let roundIdx = 0;
  let correctCount = 0;
  let attemptsThisRound = 0;
  let currentTarget = null;
  let currentOptions = [];
  let lockedUntilNext = false;
  let destroyed = false;
  const timers = [];

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.push(id);
  };

  const root = document.createElement('div');
  root.className = 'alphabet-game';
  root.innerHTML = `
    <div class="alphabet-game__header">
      <div class="alphabet-game__progress">
        <div class="alphabet-game__progress-label" id="fa-progress">1 / ${TOTAL_ROUNDS}</div>
        <div class="alphabet-game__progress-bar">
          <div class="alphabet-game__progress-fill" id="fa-fill" style="width: ${(1 / TOTAL_ROUNDS) * 100}%"></div>
        </div>
      </div>
      <div class="alphabet-game__score">
        <span class="alphabet-game__score-num" id="fa-score">0</span>
        <span class="alphabet-game__score-max">/ ${TOTAL_ROUNDS}</span>
      </div>
    </div>

    <div class="find-game__prompt" id="fa-prompt">
      <div class="find-game__prompt-en" id="fa-prompt-main">找一找</div>
      <div class="find-game__prompt-zh" id="fa-prompt-sub">听提示，点正确图片</div>
    </div>

    <div class="find-game__grid" id="fa-grid"></div>
    <div class="alphabet-game__hint" id="fa-hint">点下面的图片</div>
  `;
  containerEl.appendChild(root);

  const gridEl = root.querySelector('#fa-grid');
  const promptMainEl = root.querySelector('#fa-prompt-main');
  const promptSubEl = root.querySelector('#fa-prompt-sub');
  const hintEl = root.querySelector('#fa-hint');
  const progressLabelEl = root.querySelector('#fa-progress');
  const fillEl = root.querySelector('#fa-fill');
  const scoreEl = root.querySelector('#fa-score');

  function buildRound() {
    currentOptions = shuffle(ITEMS).slice(0, OPTIONS_PER_ROUND);
    currentTarget = currentOptions[Math.floor(Math.random() * currentOptions.length)];
    attemptsThisRound = 0;
    lockedUntilNext = false;

    promptMainEl.textContent = `请找到${currentTarget.name}`;
    promptSubEl.textContent = '点正确的图片';
    hintEl.textContent = '点下面的图片';
    progressLabelEl.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
    fillEl.style.width = `${((roundIdx + 1) / TOTAL_ROUNDS) * 100}%`;

    renderGrid();
    later(() => speak(`请找到${currentTarget.name}`), 250);
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    currentOptions.forEach((item, i) => {
      const card = document.createElement('button');
      card.className = 'find-game__card';
      card.dataset.itemId = item.id;
      card.style.setProperty('--stagger-i', String(i));
      card.setAttribute('aria-label', item.name);
      card.innerHTML = `
        <div class="find-game__card-img-wrap">
          <img src="/child/assets/icons/alphabet/${item.file}.png" alt="${item.name}" class="find-game__card-img">
        </div>
        <div class="find-game__card-label">${item.name}</div>
      `;
      card.addEventListener('click', () => handleChoice(card, item));
      gridEl.appendChild(card);
    });
  }

  function handleChoice(cardEl, item) {
    if (destroyed || lockedUntilNext) return;
    if (item.id === currentTarget.id) onCorrect(cardEl);
    else onWrong(cardEl);
  }

  function onCorrect(cardEl) {
    lockedUntilNext = true;
    correctCount += 1;
    scoreEl.textContent = String(correctCount);
    cardEl.classList.add('find-game__card--correct');
    hintEl.textContent = '找到了！';
    sfx.earn(2);
    speak(`找到了，${currentTarget.name}`);
    if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
    try { coinBurst(cardEl, 2); } catch {}
    later(advance, 1100);
  }

  function onWrong(cardEl) {
    attemptsThisRound += 1;
    cardEl.classList.remove('find-game__card--wrong');
    void cardEl.offsetWidth;
    cardEl.classList.add('find-game__card--wrong');
    sfx.error();
    if (attemptsThisRound >= MAX_ATTEMPTS) {
      lockedUntilNext = true;
      const correctCard = gridEl.querySelector(`[data-item-id="${currentTarget.id}"]`);
      if (correctCard) correctCard.classList.add('find-game__card--reveal');
      hintEl.textContent = `这是${currentTarget.name}`;
      speak(`这是${currentTarget.name}`);
      later(advance, 1500);
    } else {
      hintEl.textContent = '再找一找';
      speak(`再找一找${currentTarget.name}`);
    }
  }

  function advance() {
    if (destroyed) return;
    roundIdx += 1;
    if (roundIdx >= TOTAL_ROUNDS) {
      if (correctCount >= TOTAL_ROUNDS - 1) celebrate();
      onEnd(coinsFor(correctCount));
      return;
    }
    buildRound();
  }

  buildRound();

  return {
    destroy() {
      destroyed = true;
      timers.forEach(clearTimeout);
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };
}
