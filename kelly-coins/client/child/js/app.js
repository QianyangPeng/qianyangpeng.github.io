// Main application entry point
// Sets up app shell, routing, and tablet-aware layout
// On tablet (1024px+): character panel visible on left side at all times
// On phone: character only shown on home page

import { setState, getState } from './state.js';
import { setChildId } from './api.js';
import * as api from './api.js';
import { initRouter, registerPage, route } from './router.js';
import { createHeader } from './components/header.js';
import { createNav } from './components/nav.js';
import { createCharacter, updateCharacter } from './components/character.js';
import { createDynamicBackground } from './components/dynamic-background.js';
import { setupInstallPrompt } from './components/install-prompt.js';
import { homePage } from './pages/home.js';
import { tasksPage } from './pages/tasks.js';
import { rewardsPage } from './pages/rewards.js';
import { shopPage } from './pages/shop.js';
import { achievementsPage } from './pages/achievements.js';
import { gardenPage } from './pages/garden.js';
import { storyPage } from './pages/story.js';
import { gamesPage } from './pages/games.js';
import { applyTheme, initTheme } from './theme.js';
import { setupReminders } from './components/reminders.js';
import { setupVoiceMessageWatcher } from './components/voice-message-player.js';
import { setupHolidayDecorations } from './components/holiday.js';
import { sfx } from './sfx.js';
import { initOfflineBanner } from './components/offline.js';
import { initStateSync } from './state-sync.js';

class App {
  constructor() {
    this.appEl = document.getElementById('app');
    this.init();
  }

  async init() {
    const state = getState();
    setChildId(state.childId);

    // Build app shell
    this.appEl.innerHTML = '';

    // Dynamic background (must be created BEFORE header so weather subscriptions work)
    this.appEl.appendChild(createDynamicBackground());

    // Header (subscribes to weather updates from dynamic background)
    this.appEl.appendChild(createHeader());

    // Main body area (character sidebar + content)
    const body = document.createElement('div');
    body.className = 'app-body';

    // Character sidebar (visible on tablet via CSS)
    const sidebar = document.createElement('aside');
    sidebar.className = 'character-sidebar';
    sidebar.appendChild(createCharacter());
    body.appendChild(sidebar);

    // Content area (pages render here)
    const content = document.createElement('main');
    content.className = 'content';
    content.id = 'content';
    body.appendChild(content);

    this.appEl.appendChild(body);

    // Bottom nav
    this.appEl.appendChild(createNav());

    // Register pages
    registerPage(homePage);
    registerPage(tasksPage);
    registerPage(rewardsPage);
    registerPage(shopPage);
    registerPage(achievementsPage);
    registerPage(gardenPage);
    registerPage(storyPage);
    registerPage(gamesPage);

    initRouter(content);

    // PWA: show "install to home screen" floating button when supported
    setupInstallPrompt();

    // Initialize UI theme (loads from localStorage)
    initTheme();

    // Setup reminders, voice message watcher, holiday decorations
    setupReminders();
    setupVoiceMessageWatcher();
    setupHolidayDecorations();

    // Offline detection banner
    initOfflineBanner();

    // Global tap sound — delegated listener. Any interactive element
    // (button, card, tab, key) gets a soft pluck on press. Specific loud
    // sounds (earn/complete/unlock) are still fired from their components.
    this.setupGlobalTapSound();

    // Load data (non-blocking — if the network/SW hiccups we still render
    // the UI immediately with placeholder state, and the profile populates
    // as soon as the fetch settles).
    this.loadProfile();

    // Open a persistent SSE connection to the server so every open session
    // of this child (second browser tab, second device) stays in sync. The
    // module auto-updates state.coins, state.level, and the equipped skin
    // when events arrive; pages register their own listeners for richer
    // refreshes (tasks reloading, shop inventory reloading, etc).
    initStateSync();

    // Route — render the first page immediately so the app never looks frozen
    route();
  }

  setupGlobalTapSound() {
    // pointerdown = earliest signal, plays before the click fires visually.
    // Single listener: walks the DOM once per tap and dispatches by selector.
    // Order matters: more specific selectors must be checked first.
    const TAPPABLE_SELECTORS = [
      '.menu-card', '.task-card', '.reward-card', '.shop-card', '.skin-card',
      '.skin-fab', '.spicker-close', '.cpicker-card',
      '.modal__btn', '.task-progress__btn', '.reader-btn',
      '.settings-toggle-btn', '.settings-style-card', '.settings-theme-card',
      '.settings-modal__close', '.header__settings', '.install-prompt',
      '.nav__item', '.shop-tab', '.item-card', '.inv-card',
      '.story-card', '.seed-card', '.achievement-card', '.game-card',
      '.game-result__btn', '.game-result__back', '.game-view__back',
      '.touch-card', '.memory-card',
      '.voice-msg-banner__play', '.voice-msg-banner__close',
      '.parent-verify__cancel', '.task-progress__photo-btn',
      '.task-progress__photo-remove', '.achievement-unlock__btn',
    ].join(',');

    document.addEventListener('pointerdown', (e) => {
      const target = e.target;

      // pv-key has per-variant sounds (the math keypad)
      const key = target.closest('.pv-key');
      if (key) {
        if (key.classList.contains('pv-key--ok'))         sfx.confirm();
        else if (key.classList.contains('pv-key--clear')) sfx.error();
        else                                              sfx.highlight();
        return;
      }

      // Wheel spin button (when not already spinning)
      const spin = target.closest('.wheel-spin-btn');
      if (spin) {
        if (!spin.classList.contains('wheel-spin-btn--spinning')) sfx.confirm();
        return;
      }

      // Generic tap sound for everything else interactive
      const tappable = target.closest(TAPPABLE_SELECTORS);
      if (!tappable) return;
      if (tappable.disabled || tappable.classList.contains('is-disabled')) return;
      sfx.tap();
    }, { capture: true });
  }

  async loadProfile() {
    try {
      const profile = await api.fetchProfile();
      setState({
        coins: profile.coins,
        childName: profile.name,
        level: profile.level,
        avatar: profile.avatar,
        equipped_skin: profile.equipped_skin || 'default',
      });
      updateCharacter(profile.equipped_skin || 'default');
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
