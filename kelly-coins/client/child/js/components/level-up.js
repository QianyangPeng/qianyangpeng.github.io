// Level-up ceremony overlay
// Triggered from tasks.js when earn response returns new_level > current level.
// Full-screen starburst with animated level number, confetti, sfx.unlock.

import { speak } from './voice.js';
import { sfx } from '../sfx.js';

let backdropEl = null;

function ensureBackdrop() {
  if (backdropEl) return;
  backdropEl = document.createElement('div');
  backdropEl.className = 'levelup-backdrop';
  backdropEl.setAttribute('role', 'dialog');
  backdropEl.setAttribute('aria-modal', 'true');
  document.getElementById('app').appendChild(backdropEl);
}

/**
 * Show the level-up celebration.
 * @param {number} newLevel - the level just reached
 */
export function showLevelUp(newLevel) {
  ensureBackdrop();

  backdropEl.innerHTML = `
    <div class="levelup">
      <div class="levelup__rays" aria-hidden="true"></div>
      <div class="levelup__stars" aria-hidden="true">
        ${'<span class="levelup__star">⭐</span>'.repeat(8)}
      </div>
      <div class="levelup__label">升级啦！</div>
      <div class="levelup__badge" aria-label="现在是${newLevel}级">
        <span class="levelup__lv">Lv.</span>
        <span class="levelup__num">${newLevel}</span>
      </div>
      <div class="levelup__sub">继续努力，更多奖励等着你！</div>
      <button class="levelup__btn" id="levelup-close" aria-label="关闭升级提示">
        太棒了！继续 🚀
      </button>
    </div>
  `;

  backdropEl.classList.add('levelup-backdrop--visible');

  sfx.unlock();
  speak(`哇！升级了！现在是${newLevel}级！真棒！`);
  if (navigator.vibrate) navigator.vibrate([60, 30, 60, 30, 100, 30, 150]);

  const close = () => {
    backdropEl.classList.remove('levelup-backdrop--visible');
  };
  backdropEl.querySelector('#levelup-close').addEventListener('click', close);
  backdropEl.addEventListener('click', (e) => {
    if (e.target === backdropEl) close();
  });

  // Auto-dismiss after 6s
  setTimeout(() => {
    if (backdropEl.classList.contains('levelup-backdrop--visible')) close();
  }, 6000);
}
