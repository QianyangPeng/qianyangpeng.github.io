// Character display: single PNG with gentle breathing/bob animation
// Loads skin from the user's chosen style folder (gacha/crayon/old)
//
// Two display modes:
//   - 'sidebar' (default): circular frame, small, for non-home pages on tablet
//   - 'hero':              full body, large, no frame, for home page
//
// Hero mode also supports tap interaction:
//   - Tap character → particle burst (hearts/sparkles) + random voice line

import { getState } from '../state.js';
import { skinImageSrc, onSkinStyleChange } from '../skin-style.js';
import { speak } from './voice.js';
import { getNextLine } from '../character-lines.js';

// Track all live elements so updateCharacter() can refresh every instance
const liveElements = new Set();

// Re-render all characters when the user switches styles
onSkinStyleChange(() => {
  const state = getState();
  updateCharacter(state.equipped_skin || 'default');
});

export function createCharacter(mode = 'sidebar') {
  const wrap = document.createElement('div');
  wrap.className = `character character--${mode}`;
  wrap.innerHTML = `
    <div class="character__speech" aria-hidden="true"></div>
    <div class="character__glow"></div>
    <div class="character__frame">
      <div class="character__live">
        <div class="char-layer"></div>
      </div>
      <div class="character__burst" aria-hidden="true"></div>
    </div>
    <div class="character__sparkles">
      <div class="sparkle sparkle--1">✨</div>
      <div class="sparkle sparkle--2">⭐</div>
      <div class="sparkle sparkle--3">💫</div>
    </div>
    ${mode === 'sidebar' ? `
      <div class="character__name">Kelly</div>
      <div class="character__title">小小冒险家</div>
    ` : ''}
  `;

  const liveEl = wrap.querySelector('.character__live');
  liveElements.add(liveEl);

  // Hero mode: tap character to trigger interaction
  if (mode === 'hero') {
    const frame = wrap.querySelector('.character__frame');
    frame.classList.add('character__frame--tappable');
    frame.addEventListener('click', () => handleCharacterTap(wrap));
  }

  // Cleanup tracking when element leaves the DOM
  const observer = new MutationObserver(() => {
    if (!document.contains(wrap)) {
      liveElements.delete(liveEl);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    const state = getState();
    applySkinTo(liveEl, state.equipped_skin || 'default');
    const nameEl = wrap.querySelector('.character__name');
    if (nameEl) nameEl.textContent = state.childName;
  }, 0);

  return wrap;
}

// Handle tap: play voice line + particle burst + pop animation
function handleCharacterTap(wrap) {
  const state = getState();
  const skinId = state.equipped_skin || 'default';
  const line = getNextLine(skinId);

  // Pop animation
  const frame = wrap.querySelector('.character__frame');
  frame.classList.remove('character__frame--tapped');
  void frame.offsetWidth;
  frame.classList.add('character__frame--tapped');

  // Particle burst — spawn hearts and sparkles around the character
  spawnInteractionParticles(wrap);

  // Speech bubble with line text
  const speechEl = wrap.querySelector('.character__speech');
  if (speechEl) {
    speechEl.textContent = line;
    speechEl.classList.remove('character__speech--show');
    void speechEl.offsetWidth;
    speechEl.classList.add('character__speech--show');
    // Auto-hide after 3.5s
    clearTimeout(speechEl._hideTimer);
    speechEl._hideTimer = setTimeout(() => {
      speechEl.classList.remove('character__speech--show');
    }, 3500);
  }

  // Voice it
  speak(line);

  // Haptic
  if (navigator.vibrate) navigator.vibrate(30);
}

function spawnInteractionParticles(wrap) {
  const burst = wrap.querySelector('.character__burst');
  if (!burst) return;
  burst.innerHTML = '';

  const icons = ['❤️', '💖', '✨', '⭐', '💫', '🌟'];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'char-burst-particle';
    p.textContent = icons[Math.floor(Math.random() * icons.length)];
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 80 + Math.random() * 60;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 20;
    p.style.setProperty('--dx', dx + 'px');
    p.style.setProperty('--dy', dy + 'px');
    p.style.animationDelay = (i * 20) + 'ms';
    burst.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

// Apply skin PNG to a specific live element using current style
function applySkinTo(liveEl, skinId) {
  const src = skinImageSrc(skinId);
  const testImg = new Image();
  testImg.onload = () => {
    const layer = liveEl.querySelector('.char-layer');
    if (layer) layer.style.backgroundImage = `url(${src})`;
    liveEl.classList.add('character__live--loaded');
  };
  testImg.onerror = () => {
    // Fallback: try the 'old' style if current style is missing this skin
    const fallback = `/child/assets/characters/styles/old/${skinId || 'default'}.png`;
    const fallbackImg = new Image();
    fallbackImg.onload = () => {
      const layer = liveEl.querySelector('.char-layer');
      if (layer) layer.style.backgroundImage = `url(${fallback})`;
      liveEl.classList.add('character__live--loaded');
    };
    fallbackImg.onerror = () => {
      liveEl.classList.remove('character__live--loaded');
    };
    fallbackImg.src = fallback;
  };
  testImg.src = src;
}

// Update ALL character displays (home + sidebar) when skin changes
export function updateCharacter(skinId) {
  liveElements.forEach(liveEl => {
    if (document.contains(liveEl)) {
      applySkinTo(liveEl, skinId);
    } else {
      liveElements.delete(liveEl);
    }
  });

  const state = getState();
  document.querySelectorAll('.character__name').forEach(el => {
    el.textContent = state.childName;
  });
}
