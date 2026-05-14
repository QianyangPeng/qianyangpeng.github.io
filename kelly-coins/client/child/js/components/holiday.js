// Holiday decorations
// Detects current holiday from /api/holiday endpoint and applies seasonal decorations:
// - Adds floating decoration particles to the screen
// - Adds a small holiday banner to the home page screensaver
// - Plays a holiday-specific greeting on first visit each day

import * as api from '../api.js';
import { speak } from './voice.js';

const HOLIDAY_PARTICLES = {
  new_year:       { emoji: '🎆', count: 12, animation: 'float-up' },
  valentine:      { emoji: '💝', count: 10, animation: 'float-down' },
  halloween:      { emoji: '🎃', count: 8,  animation: 'float-down' },
  christmas:      { emoji: '❄', count: 30, animation: 'snow-fall' },
  kelly_birthday: { emoji: '🎂', count: 15, animation: 'float-up' },
};

const HOLIDAY_GREETINGS = {
  new_year:       '新年快乐！愿你新的一年开心又健康！',
  valentine:      '情人节快乐！妈妈最爱你啦！',
  halloween:      '万圣节快乐！不给糖就捣蛋！',
  christmas:      '圣诞快乐！圣诞老人会送礼物给你哦！',
  kelly_birthday: '生日快乐我的小公主！今天是你的特别日子！',
};

let particleContainer = null;
let bannerEl = null;
let activeHoliday = null;

export async function setupHolidayDecorations() {
  try {
    const holiday = await api.fetchHoliday();
    if (!holiday) return;
    activeHoliday = holiday;
    addParticles(holiday);
    addBanner(holiday);
    maybeGreet(holiday);
  } catch (e) {
    console.warn('Holiday check failed:', e);
  }
}

function addParticles(holiday) {
  const config = HOLIDAY_PARTICLES[holiday.id];
  if (!config) return;
  if (particleContainer) particleContainer.remove();

  particleContainer = document.createElement('div');
  particleContainer.className = `holiday-particles holiday-particles--${config.animation}`;
  particleContainer.dataset.holiday = holiday.id;

  for (let i = 0; i < config.count; i++) {
    const p = document.createElement('div');
    p.className = 'holiday-particle';
    p.textContent = config.emoji;
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDelay = `${(Math.random() * 8).toFixed(2)}s`;
    p.style.animationDuration = `${(8 + Math.random() * 8).toFixed(2)}s`;
    particleContainer.appendChild(p);
  }
  document.getElementById('app').appendChild(particleContainer);
}

function addBanner(holiday) {
  if (bannerEl) bannerEl.remove();
  bannerEl = document.createElement('div');
  bannerEl.className = 'holiday-banner';
  bannerEl.innerHTML = `
    <span class="holiday-banner__emoji">${holiday.emoji}</span>
    <span class="holiday-banner__name">${holiday.name}</span>
    ${holiday.is_today ? '<span class="holiday-banner__today">今天哦！</span>' : ''}
  `;
  document.getElementById('app').appendChild(bannerEl);
}

function maybeGreet(holiday) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `kelly-coins-holiday-greeting-${holiday.id}`;
  if (localStorage.getItem(key) === today) return;
  if (!holiday.is_today) return;
  const greeting = HOLIDAY_GREETINGS[holiday.id];
  if (greeting) {
    setTimeout(() => speak(greeting), 4000); // wait for other greetings to finish
    localStorage.setItem(key, today);
  }
}

export function getActiveHoliday() {
  return activeHoliday;
}
