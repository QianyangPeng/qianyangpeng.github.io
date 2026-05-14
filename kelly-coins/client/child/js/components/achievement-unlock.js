// Achievement unlock celebration overlay
// Called when new achievements are unlocked (from tasks.js after earnCoins)
// Shows a big golden burst with the achievement details, plays sound, speaks name

import { speak } from './voice.js';
import { celebrate } from './animations.js';

let backdropEl = null;
let queue = [];
let showing = false;

const TIER_GLOW = {
  bronze: 'rgba(205,127,50,0.6)',
  silver: 'rgba(192,192,192,0.6)',
  gold:   'rgba(255,215,0,0.7)',
};

function ensureBackdrop() {
  if (backdropEl) return;
  backdropEl = document.createElement('div');
  backdropEl.className = 'achievement-unlock-backdrop';
  document.getElementById('app').appendChild(backdropEl);
}

// Show one or more newly unlocked achievements (queues them)
export function showAchievementUnlock(achievements) {
  if (!Array.isArray(achievements)) achievements = [achievements];
  if (achievements.length === 0) return;
  queue.push(...achievements);
  if (!showing) processQueue();
}

function processQueue() {
  if (queue.length === 0) {
    showing = false;
    return;
  }
  showing = true;
  const ach = queue.shift();
  showOne(ach, () => {
    setTimeout(processQueue, 400);
  });
}

function showOne(ach, onDone) {
  ensureBackdrop();
  const glow = TIER_GLOW[ach.tier] || TIER_GLOW.bronze;

  backdropEl.innerHTML = `
    <div class="achievement-unlock" style="--tier-glow: ${glow}">
      <div class="achievement-unlock__rays"></div>
      <div class="achievement-unlock__title">🎉 解锁新成就！</div>
      <div class="achievement-unlock__emoji">${ach.emoji}</div>
      <div class="achievement-unlock__name">${ach.name}</div>
      <div class="achievement-unlock__desc">${ach.desc}</div>
      <button class="achievement-unlock__btn" id="ach-unlock-close">太棒了！</button>
    </div>
  `;
  backdropEl.classList.add('achievement-unlock-backdrop--visible');

  // Celebration animation + voice
  celebrate();
  speak(`恭喜！解锁新成就：${ach.name}`);
  if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 120]);

  const close = () => {
    backdropEl.classList.remove('achievement-unlock-backdrop--visible');
    onDone();
  };
  backdropEl.querySelector('#ach-unlock-close').addEventListener('click', close);
  // Auto-close after 5s if not dismissed
  setTimeout(() => {
    if (backdropEl.classList.contains('achievement-unlock-backdrop--visible')) close();
  }, 5000);
}
