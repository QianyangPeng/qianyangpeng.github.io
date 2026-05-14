// Touch-only mini games for preschoolers. Every game follows the same small
// contract as the older game modules: create(containerEl, onEnd) -> { destroy }.

import { speak } from '../components/voice.js';
import { sfx } from '../sfx.js';
import { celebrate, coinBurst } from '../components/animations.js';

const TOTAL_ROUNDS = 6;

const COLORS = [
  { id: 'red', name: '红色', hex: '#E5524F' },
  { id: 'orange', name: '橙色', hex: '#F4923B' },
  { id: 'yellow', name: '黄色', hex: '#F4C430' },
  { id: 'green', name: '绿色', hex: '#5DB874' },
  { id: 'blue', name: '蓝色', hex: '#5AA9E6' },
  { id: 'purple', name: '紫色', hex: '#9A74D1' },
  { id: 'pink', name: '粉色', hex: '#F490B4' },
  { id: 'brown', name: '棕色', hex: '#A06E42' },
];

const SHAPES = [
  { id: 'circle', name: '圆形', symbol: '●', className: 'mini-shape--circle' },
  { id: 'square', name: '正方形', symbol: '■', className: 'mini-shape--square' },
  { id: 'triangle', name: '三角形', symbol: '▲', className: 'mini-shape--triangle' },
  { id: 'star', name: '星星', symbol: '★', className: 'mini-shape--star' },
  { id: 'heart', name: '爱心', symbol: '♥', className: 'mini-shape--heart' },
  { id: 'diamond', name: '菱形', symbol: '◆', className: 'mini-shape--diamond' },
];

const COUNT_EMOJIS = ['⭐', '🌸', '🍓', '🫧', '🍪'];
const MEMORY_EMOJIS = ['🌈', '⭐', '🦋', '🍰', '🦁', '🐳'];

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function scoreToCoins(score, total = TOTAL_ROUNDS) {
  if (score >= total) return 5;
  if (score >= total - 1) return 4;
  if (score >= Math.ceil(total * 0.67)) return 3;
  if (score >= Math.ceil(total * 0.45)) return 2;
  return 1;
}

function makeShell(containerEl, title, hint) {
  const root = document.createElement('div');
  root.className = 'touch-game alphabet-game';
  root.innerHTML = `
    <div class="alphabet-game__header">
      <div class="alphabet-game__progress">
        <div class="alphabet-game__progress-label" data-progress>1 / ${TOTAL_ROUNDS}</div>
        <div class="alphabet-game__progress-bar">
          <div class="alphabet-game__progress-fill" data-fill style="width: ${(1 / TOTAL_ROUNDS) * 100}%"></div>
        </div>
      </div>
      <div class="alphabet-game__score">
        <span class="alphabet-game__score-num" data-score>0</span>
        <span class="alphabet-game__score-max">/ ${TOTAL_ROUNDS}</span>
      </div>
    </div>
    <div class="touch-game__prompt">
      <div class="touch-game__title" data-title>${title}</div>
      <div class="touch-game__hint" data-hint>${hint}</div>
    </div>
    <div class="touch-game__stage" data-stage></div>
  `;
  containerEl.appendChild(root);
  return {
    root,
    stage: root.querySelector('[data-stage]'),
    title: root.querySelector('[data-title]'),
    hint: root.querySelector('[data-hint]'),
    progress: root.querySelector('[data-progress]'),
    fill: root.querySelector('[data-fill]'),
    score: root.querySelector('[data-score]'),
  };
}

function updateRound(ui, roundIdx, score, total = TOTAL_ROUNDS) {
  ui.progress.textContent = `${roundIdx + 1} / ${total}`;
  ui.fill.style.width = `${((roundIdx + 1) / total) * 100}%`;
  ui.score.textContent = String(score);
}

function makeRoundGame(containerEl, onEnd, config) {
  const ui = makeShell(containerEl, config.title, config.hint);
  let roundIdx = 0;
  let score = 0;
  let locked = false;
  let destroyed = false;
  const timers = [];

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  };

  function next() {
    if (destroyed) return;
    roundIdx += 1;
    if (roundIdx >= TOTAL_ROUNDS) {
      if (score >= TOTAL_ROUNDS - 1) celebrate();
      onEnd(scoreToCoins(score));
      return;
    }
    render();
  }

  function choose(isCorrect, cardEl, successText, retryText) {
    if (locked || destroyed) return;
    if (isCorrect) {
      locked = true;
      score += 1;
      ui.score.textContent = String(score);
      cardEl.classList.add('touch-card--correct');
      sfx.earn(2);
      speak(successText || '答对啦');
      if (navigator.vibrate) navigator.vibrate([25, 20, 25]);
      try { coinBurst(cardEl, 2); } catch {}
      later(next, 1050);
    } else {
      cardEl.classList.remove('touch-card--wrong');
      void cardEl.offsetWidth;
      cardEl.classList.add('touch-card--wrong');
      ui.hint.textContent = retryText || '再试一次';
      sfx.error();
      speak(retryText || '再试一次');
    }
  }

  function render() {
    locked = false;
    updateRound(ui, roundIdx, score);
    config.renderRound({ ui, roundIdx, choose, later });
  }

  render();

  return {
    destroy() {
      destroyed = true;
      timers.forEach(clearTimeout);
      if (ui.root.parentNode) ui.root.parentNode.removeChild(ui.root);
    }
  };
}

export function createColorMatchGame(containerEl, onEnd) {
  const rounds = shuffle(COLORS).slice(0, TOTAL_ROUNDS);
  return makeRoundGame(containerEl, onEnd, {
    title: '颜色花园',
    hint: '听一听，点正确的颜色',
    renderRound({ ui, roundIdx, choose, later }) {
      const target = rounds[roundIdx];
      const options = shuffle([target, ...shuffle(COLORS.filter(c => c.id !== target.id)).slice(0, 3)]);
      ui.title.textContent = `请找到${target.name}`;
      ui.hint.textContent = '点一个大色块';
      ui.stage.className = 'touch-game__stage touch-game__stage--grid';
      ui.stage.innerHTML = '';
      options.forEach((color, i) => {
        const btn = document.createElement('button');
        btn.className = 'touch-card color-choice';
        btn.style.setProperty('--paint', color.hex);
        btn.style.setProperty('--stagger-i', String(i));
        btn.innerHTML = `<span class="color-choice__blob"></span><span>${color.name}</span>`;
        btn.addEventListener('click', () => choose(color.id === target.id, btn, `找到了，${target.name}`, '再看看颜色'));
        ui.stage.appendChild(btn);
      });
      later(() => speak(`请找到${target.name}`), 250);
    },
  });
}

export function createCountingStarsGame(containerEl, onEnd) {
  const targets = shuffle([1, 2, 3, 4, 5, 3]).slice(0, TOTAL_ROUNDS);
  return makeRoundGame(containerEl, onEnd, {
    title: '数星星',
    hint: '按提示点够数量',
    renderRound({ ui, roundIdx, choose, later }) {
      const target = targets[roundIdx];
      const emoji = COUNT_EMOJIS[roundIdx % COUNT_EMOJIS.length];
      let tapped = 0;
      const buttons = shuffle([
        ...Array.from({ length: target }, (_, i) => ({ id: `good-${i}`, good: true, emoji })),
        ...Array.from({ length: Math.max(2, 6 - target) }, (_, i) => ({ id: `extra-${i}`, good: false, emoji: COUNT_EMOJIS[(roundIdx + i + 1) % COUNT_EMOJIS.length] })),
      ]);
      ui.title.textContent = `请点 ${target} 个 ${emoji}`;
      ui.hint.textContent = `已经点了 ${tapped} 个`;
      ui.stage.className = 'touch-game__stage touch-game__stage--count';
      ui.stage.innerHTML = '';
      buttons.forEach((item, i) => {
        const btn = document.createElement('button');
        btn.className = 'touch-card count-choice';
        btn.style.setProperty('--stagger-i', String(i));
        btn.textContent = item.emoji;
        btn.addEventListener('click', () => {
          if (!item.good || btn.classList.contains('count-choice--picked')) {
            choose(false, btn, '', '只点提示里的图案');
            return;
          }
          btn.classList.add('count-choice--picked');
          tapped += 1;
          ui.hint.textContent = `已经点了 ${tapped} 个`;
          sfx.highlight();
          if (tapped >= target) choose(true, btn, `数对啦，${target} 个`);
        });
        ui.stage.appendChild(btn);
      });
      later(() => speak(`请点${target}个${emoji}`), 250);
    },
  });
}

export function createShapeSortGame(containerEl, onEnd) {
  const rounds = shuffle(SHAPES).slice(0, TOTAL_ROUNDS);
  return makeRoundGame(containerEl, onEnd, {
    title: '形状小屋',
    hint: '听形状，找朋友',
    renderRound({ ui, roundIdx, choose, later }) {
      const target = rounds[roundIdx];
      const options = shuffle([target, ...shuffle(SHAPES.filter(s => s.id !== target.id)).slice(0, 3)]);
      ui.title.textContent = `找一找${target.name}`;
      ui.hint.textContent = '点一样的形状';
      ui.stage.className = 'touch-game__stage touch-game__stage--grid';
      ui.stage.innerHTML = '';
      options.forEach((shape, i) => {
        const btn = document.createElement('button');
        btn.className = `touch-card shape-choice ${shape.className}`;
        btn.style.setProperty('--stagger-i', String(i));
        btn.innerHTML = `<span class="shape-choice__symbol">${shape.symbol}</span><span>${shape.name}</span>`;
        btn.addEventListener('click', () => choose(shape.id === target.id, btn, `对啦，${target.name}`, '再找一找'));
        ui.stage.appendChild(btn);
      });
      later(() => speak(`找一找${target.name}`), 250);
    },
  });
}

export function createMemoryCardsGame(containerEl, onEnd) {
  const ui = makeShell(containerEl, '翻翻乐', '翻两张一样的卡片');
  const pairs = shuffle(MEMORY_EMOJIS).slice(0, 6);
  const cards = shuffle([...pairs, ...pairs].map((emoji, i) => ({ id: `${emoji}-${i}`, emoji, matched: false })));
  let first = null;
  let second = null;
  let matches = 0;
  let misses = 0;
  let locked = false;
  let destroyed = false;
  const timers = [];
  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.push(id);
  };

  ui.progress.textContent = '0 / 6';
  ui.fill.style.width = '0%';
  ui.score.textContent = '0';
  ui.stage.className = 'touch-game__stage memory-grid';
  ui.stage.innerHTML = '';

  cards.forEach((card, i) => {
    const btn = document.createElement('button');
    btn.className = 'memory-card';
    btn.style.setProperty('--stagger-i', String(i));
    btn.innerHTML = `<span class="memory-card__back">?</span><span class="memory-card__front">${card.emoji}</span>`;
    btn.addEventListener('click', () => flip(card, btn));
    ui.stage.appendChild(btn);
  });

  later(() => speak('翻两张一样的卡片'), 250);

  function flip(card, btn) {
    if (destroyed || locked || card.matched || btn.classList.contains('memory-card--open')) return;
    sfx.highlight();
    btn.classList.add('memory-card--open');
    if (!first) {
      first = { card, btn };
      return;
    }
    second = { card, btn };
    locked = true;
    if (first.card.emoji === second.card.emoji) {
      first.card.matched = true;
      second.card.matched = true;
      first.btn.classList.add('memory-card--matched');
      second.btn.classList.add('memory-card--matched');
      matches += 1;
      ui.score.textContent = String(matches);
      ui.progress.textContent = `${matches} / 6`;
      ui.fill.style.width = `${(matches / 6) * 100}%`;
      sfx.earn(2);
      speak('找到一对啦');
      resetTurn();
      if (matches >= 6) {
        later(() => {
          celebrate();
          const coins = misses <= 2 ? 5 : misses <= 5 ? 4 : misses <= 8 ? 3 : 2;
          onEnd(coins);
        }, 900);
      }
    } else {
      misses += 1;
      sfx.error();
      speak('再试一次');
      later(() => {
        first.btn.classList.remove('memory-card--open');
        second.btn.classList.remove('memory-card--open');
        resetTurn();
      }, 850);
    }
  }

  function resetTurn() {
    first = null;
    second = null;
    locked = false;
  }

  return {
    destroy() {
      destroyed = true;
      timers.forEach(clearTimeout);
      if (ui.root.parentNode) ui.root.parentNode.removeChild(ui.root);
    }
  };
}
