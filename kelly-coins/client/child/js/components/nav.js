// Bottom navigation bar with voice feedback
// Stays horizontal on all screen sizes (familiar for kids)

import { navigate, currentPageId } from '../router.js';
import { playTapSound } from './animations.js';
import { speak } from './voice.js';

// Visible tabs in bottom nav
// (achievements + garden pages still exist and are accessible via URL hash,
//  they're just not in the bottom bar until we polish them further)
const TABS = [
  { id: 'home',   icon: '🏠', label: '首页',   voice: '回到首页' },
  { id: 'tasks',  icon: '⭐', label: '攒金币', voice: '攒金币' },
  { id: 'games',  icon: '🎮', label: '小游戏', voice: '小游戏' },
  { id: 'shop',   icon: '🛍️', label: '商店',   voice: '梦幻商店' },
];

let navEl = null;
let buttons = [];

export function createNav() {
  navEl = document.createElement('nav');
  navEl.className = 'nav';

  TABS.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'nav__item';
    btn.dataset.page = tab.id;
    btn.innerHTML = `
      <span class="nav__icon">${tab.icon}</span>
      <span class="nav__label">${tab.label}</span>
    `;
    btn.addEventListener('click', () => {
      playTapSound();
      navigate(tab.id);
    });
    navEl.appendChild(btn);
    buttons.push(btn);
  });

  window.addEventListener('hashchange', () => updateActive());
  setTimeout(() => updateActive(), 0);

  return navEl;
}

function updateActive() {
  const current = location.hash.slice(1) || 'home';
  buttons.forEach(btn => {
    btn.classList.toggle('nav__item--active', btn.dataset.page === current);
  });
}
