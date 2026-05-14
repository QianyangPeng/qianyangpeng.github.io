// Child picker — bottom sheet that slides up from the footer nav.
// Opened by tapping the avatar in the header.
// Switches childId in state + reloads the app at #home.

import * as api from '../api.js';
import { setState } from '../state.js';
import { setChildId } from '../api.js';
import { sfx } from '../sfx.js';

let sheetEl = null;
let overlayEl = null;

function ensureElements() {
  if (sheetEl) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'cpicker-overlay';
  overlayEl.addEventListener('click', hide);

  sheetEl = document.createElement('div');
  sheetEl.className = 'cpicker-sheet';
  sheetEl.setAttribute('role', 'dialog');
  sheetEl.setAttribute('aria-label', '选择小朋友');

  document.getElementById('app').appendChild(overlayEl);
  document.getElementById('app').appendChild(sheetEl);
}

export async function showChildPicker() {
  ensureElements();
  sfx.highlight();

  // Fetch children list
  let children = [];
  try {
    children = await api.fetchChildren();
  } catch {
    children = [];
  }

  const currentId = api.getChildId();

  sheetEl.innerHTML = `
    <div class="cpicker-handle" aria-hidden="true"></div>
    <div class="cpicker-title">选择小朋友</div>
    <div class="cpicker-list">
      ${children.map(child => {
        const isActive = child.id === currentId;
        const skinSrc = `/child/assets/characters/styles/watercolor/${child.equipped_skin || 'default'}.png`;
        return `
          <button class="cpicker-card ${isActive ? 'cpicker-card--active' : ''}"
                  data-id="${child.id}"
                  aria-label="${child.name}，${child.coins}金币，${isActive ? '当前选中' : ''}">
            <div class="cpicker-card__avatar">
              <img src="${skinSrc}" alt="${child.name}"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
              <div class="cpicker-card__emoji" style="display:none">🧒</div>
            </div>
            <div class="cpicker-card__name">${child.name}</div>
            <div class="cpicker-card__coins">🪙 ${child.coins}</div>
            ${isActive ? '<div class="cpicker-card__check">✓</div>' : ''}
          </button>
        `;
      }).join('')}
    </div>
  `;

  // Card click handlers
  sheetEl.querySelectorAll('.cpicker-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const newId = btn.dataset.id;
      if (newId === currentId) { hide(); return; }
      sfx.confirm();
      // Persist and reload
      setState({ childId: newId });
      setChildId(newId);
      hide();
      // Reload to home so all pages pick up the new childId cleanly
      setTimeout(() => {
        window.location.hash = '#home';
        window.location.reload();
      }, 200);
    });
  });

  // Show
  overlayEl.classList.add('cpicker-overlay--visible');
  sheetEl.classList.add('cpicker-sheet--visible');
}

function hide() {
  overlayEl?.classList.remove('cpicker-overlay--visible');
  sheetEl?.classList.remove('cpicker-sheet--visible');
}
