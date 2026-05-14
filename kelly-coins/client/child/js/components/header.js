// Top header bar: avatar (tappable → child picker), name, level, coin display, weather
// Subscribes to state and weather changes for live updates

import { subscribe, getState } from '../state.js';
import { onWeatherUpdate } from './dynamic-background.js';
import { showSettings } from './settings-modal.js';
import { showChildPicker } from './child-picker.js';
import { skinImageSrc } from '../skin-style.js';

let headerEl = null;
let coinEl = null;
let nameEl = null;
let levelEl = null;
let avatarEl = null;
let weatherIconEl = null;
let weatherTempEl = null;
let lastCoins = -1;

const WEATHER_EMOJI = {
  clear:  { day: '☀️', night: '🌙' },
  cloudy: { day: '⛅', night: '☁️' },
  fog:    { day: '🌫️', night: '🌫️' },
  rain:   { day: '🌧️', night: '🌧️' },
  snow:   { day: '❄️', night: '❄️' },
};

export function createHeader() {
  headerEl = document.createElement('header');
  headerEl.className = 'header';
  // Avatar img has NO src attribute at this stage — setting src="" would fire
  // a synthetic error event and cache a broken-image state. updateHeader()
  // assigns the real src below and the image reveals itself via onload.
  headerEl.innerHTML = `
    <div class="header__profile">
      <button class="header__avatar header__avatar--tappable" id="header-avatar"
              aria-label="选择小朋友" aria-haspopup="dialog">
        <img alt="" class="header__avatar-img" id="header-avatar-img" style="display:none">
        <span class="header__avatar-fallback" id="header-avatar-fallback">🧒</span>
      </button>
      <div class="header__info">
        <span class="header__name" id="header-name">Kelly</span>
        <span class="header__level" id="header-level" aria-label="等级1">Lv.1</span>
      </div>
    </div>
    <div class="header__coins" aria-label="当前金币">
      <img src="/child/assets/ui/coin.png" alt="coin" class="header__coin-icon"
           onerror="this.outerHTML='<span class=&quot;header__coin-icon&quot;>🪙</span>'">
      <span class="header__coin-count" aria-live="polite" aria-atomic="true">0</span>
    </div>
    <div class="header__weather">
      <span class="header__weather-icon">☀️</span>
      <div class="header__weather-info">
        <span class="header__weather-temp">--°</span>
        <span class="header__weather-loc">Kirkland</span>
      </div>
    </div>
    <button class="header__settings" id="header-settings" aria-label="设置">⚙️</button>
  `;

  headerEl.querySelector('#header-settings').addEventListener('click', () => showSettings());
  headerEl.querySelector('#header-avatar').addEventListener('click', () => showChildPicker());

  coinEl    = headerEl.querySelector('.header__coin-count');
  nameEl    = headerEl.querySelector('#header-name');
  levelEl   = headerEl.querySelector('#header-level');
  avatarEl  = headerEl.querySelector('#header-avatar-img');
  weatherIconEl = headerEl.querySelector('.header__weather-icon');
  weatherTempEl = headerEl.querySelector('.header__weather-temp');

  subscribe('header', (s) => updateHeader(s));
  updateHeader(getState());

  onWeatherUpdate(updateWeather);

  return headerEl;
}

function updateHeader(state) {
  if (nameEl)  nameEl.textContent  = state.childName;
  if (levelEl) {
    levelEl.textContent = 'Lv.' + state.level;
    levelEl.setAttribute('aria-label', `等级${state.level}`);
  }
  if (coinEl)  coinEl.textContent  = state.coins;

  // Avatar: show equipped skin thumbnail. If the image is cached from an
  // earlier session, the load event may never fire (the handlers are attached
  // after the load completes), so we check `img.complete` synchronously after
  // setting src and trigger the reveal ourselves.
  if (avatarEl && state.equipped_skin) {
    const src = skinImageSrc(state.equipped_skin);
    if (avatarEl.dataset.currentSrc === src && avatarEl.style.display !== 'none') return;
    avatarEl.dataset.currentSrc = src;
    const fallback = headerEl.querySelector('#header-avatar-fallback');
    const reveal = () => {
      avatarEl.style.display = '';
      if (fallback) fallback.style.display = 'none';
    };
    const showFallback = () => {
      avatarEl.style.display = 'none';
      if (fallback) fallback.style.display = '';
    };
    avatarEl.onload = reveal;
    avatarEl.onerror = showFallback;
    avatarEl.alt = state.childName;
    avatarEl.src = src;
    // Handle cached-image case where onload never fires.
    if (avatarEl.complete) {
      if (avatarEl.naturalWidth > 0) reveal();
      else showFallback();
    }
  }

  if (lastCoins >= 0 && state.coins !== lastCoins) {
    coinEl.classList.remove('header__coin-count--bounce');
    void coinEl.offsetWidth;
    coinEl.classList.add('header__coin-count--bounce');
  }
  lastCoins = state.coins;
}

function updateWeather(weather) {
  if (!weatherIconEl || !weatherTempEl) return;
  const icons = WEATHER_EMOJI[weather.condition] || WEATHER_EMOJI.clear;
  weatherIconEl.textContent = weather.is_day ? icons.day : icons.night;
  weatherTempEl.textContent = `${weather.temperature}°`;
}
