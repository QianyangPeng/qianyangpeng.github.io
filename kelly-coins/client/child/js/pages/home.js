// Home page: large character (left) + Apple-style screensaver display (right)
// Below screensaver: streak counter, daily quest banner, goal progress bar
// No menu buttons here — all navigation is via the bottom nav bar

import { createCharacter } from '../components/character.js';
import { speak } from '../components/voice.js';
import { onWeatherUpdate } from '../components/dynamic-background.js';
import { openSkinPicker } from '../components/skin-picker.js';
import { openWheelModal } from '../components/wheel-modal.js';
import { subscribe, getState } from '../state.js';
import { skinImageSrc } from '../skin-style.js';
import * as api from '../api.js';
import { navigate } from '../router.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const WEATHER_EMOJI = {
  clear:  { day: '☀️', night: '🌙' },
  cloudy: { day: '⛅', night: '☁️' },
  fog:    { day: '🌫️', night: '🌫️' },
  rain:   { day: '🌧️', night: '🌧️' },
  snow:   { day: '❄️', night: '❄️' },
};

let clockTimer = null;
let timeEl = null;
let dateEl = null;
let weatherEl = null;
let skinFabImgEl = null;
let stateUnsub = null;

export const homePage = {
  id: 'home',

  render() {
    const page = document.createElement('div');
    page.className = 'page page--home';

    // Left: large hero character + skin FAB + sparkle decorations
    const charSection = document.createElement('div');
    charSection.className = 'home__character';
    const sparkles = document.createElement('div');
    sparkles.className = 'home__sparkles';
    sparkles.setAttribute('aria-hidden', 'true');
    charSection.appendChild(sparkles);
    charSection.appendChild(createCharacter('hero'));

    // Floating action buttons — stacked column, top-left of character area
    const fabStack = document.createElement('div');
    fabStack.className = 'home-fab-stack';

    // Skin picker FAB (换装)
    const skinFab = document.createElement('button');
    skinFab.className = 'home-fab home-fab--skin';
    skinFab.setAttribute('aria-label', '换装');
    skinFab.innerHTML = `
      <div class="home-fab__icon">
        <img class="home-fab__img" src="" alt="皮肤" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="home-fab__fallback">✨</div>
      </div>
      <div class="home-fab__label">换装</div>
    `;
    skinFabImgEl = skinFab.querySelector('.home-fab__img');
    skinFab.addEventListener('click', () => openSkinPicker());
    fabStack.appendChild(skinFab);

    // Lucky wheel FAB (大转盘)
    const wheelFab = document.createElement('button');
    wheelFab.className = 'home-fab home-fab--wheel';
    wheelFab.setAttribute('aria-label', '幸运转盘');
    wheelFab.innerHTML = `
      <div class="home-fab__icon home-fab__icon--wheel">
        <div class="home-fab__wheel" aria-hidden="true"></div>
      </div>
      <div class="home-fab__label">转盘</div>
    `;
    wheelFab.addEventListener('click', () => openWheelModal());
    fabStack.appendChild(wheelFab);

    charSection.appendChild(fabStack);

    page.appendChild(charSection);

    // Right: screensaver display + widgets
    const screensaver = document.createElement('div');
    screensaver.className = 'home__screensaver';
    screensaver.innerHTML = `
      <div class="home__time" id="home-time">--:--</div>
      <div class="home__date" id="home-date">Loading...</div>

      <div class="home__widgets">
        <div class="home-widget home-widget--streak" id="streak-widget">
          <span class="home-widget__icon">🔥</span>
          <div class="home-widget__content">
            <div class="home-widget__value" id="streak-count">0</div>
            <div class="home-widget__label">连续打卡</div>
          </div>
        </div>

        <div class="home-widget home-widget--quest" id="daily-quest-widget" style="display:none;">
          <div class="home-widget__title">⭐ 今日特别任务</div>
          <div class="home-widget__quest-name" id="quest-name">--</div>
          <div class="home-widget__quest-bonus" id="quest-bonus">奖励 ×2</div>
        </div>
      </div>

      <div class="home__goal" id="goal-widget" style="display:none;">
        <div class="home__goal-header">
          <span class="home__goal-emoji" id="goal-emoji">🎯</span>
          <span class="home__goal-name" id="goal-name">梦想目标</span>
          <span class="home__goal-progress" id="goal-progress">0/0</span>
        </div>
        <div class="home__goal-bar">
          <div class="home__goal-bar-fill" id="goal-fill" style="width:0%"></div>
        </div>
        <div class="home__goal-remaining" id="goal-remaining">还差 0 🪙</div>
      </div>
    `;
    page.appendChild(screensaver);

    timeEl = screensaver.querySelector('#home-time');
    dateEl = screensaver.querySelector('#home-date');
    // weatherEl is kept for announceWeather() even though no DOM element is shown
    weatherEl = null;

    // Make the time tappable — speaks the current time
    timeEl.classList.add('home__tappable');
    timeEl.addEventListener('click', () => announceTime());

    // Make the date tappable — speaks the date
    dateEl.classList.add('home__tappable');
    dateEl.addEventListener('click', () => announceDate());

    // Streak widget tappable — speaks the streak count
    screensaver.querySelector('#streak-widget').addEventListener('click', () => announceStreak());

    // Daily quest widget — FIRST tap announces, second tap navigates
    let questTapCount = 0;
    let questTapTimer = null;
    screensaver.querySelector('#daily-quest-widget').addEventListener('click', () => {
      announceDailyQuest();
      questTapCount++;
      clearTimeout(questTapTimer);
      if (questTapCount >= 2) {
        questTapCount = 0;
        navigate('tasks');
      } else {
        questTapTimer = setTimeout(() => { questTapCount = 0; }, 2500);
      }
    });

    // Goal widget — FIRST tap announces, second tap navigates
    let goalTapCount = 0;
    let goalTapTimer = null;
    screensaver.querySelector('#goal-widget').addEventListener('click', () => {
      announceGoal();
      goalTapCount++;
      clearTimeout(goalTapTimer);
      if (goalTapCount >= 2) {
        goalTapCount = 0;
        navigate('rewards');
      } else {
        goalTapTimer = setTimeout(() => { goalTapCount = 0; }, 2500);
      }
    });

    return page;
  },

  mount() {
    speak('欢迎回来！');
    updateClock();
    clockTimer = setInterval(updateClock, 1000);
    onWeatherUpdate(updateWeather);

    // Update skin FAB portrait with current skin, and whenever it changes
    const updateFab = (s) => {
      if (!skinFabImgEl) return;
      const src = skinImageSrc(s.equipped_skin || 'default');
      skinFabImgEl.src = src;
      skinFabImgEl.style.display = '';
      const fb = skinFabImgEl.nextElementSibling;
      if (fb) fb.style.display = 'none';
    };
    updateFab(getState());
    stateUnsub = subscribe('home-skin-fab', updateFab);

    // Initial fetches
    fetch('/api/weather').then(r => r.json()).then(updateWeather).catch(() => {});
    loadStreak();
    loadDailyQuest();
    loadGoal();
  },

  unmount() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    if (stateUnsub) { stateUnsub(); stateUnsub = null; }
    timeEl = null;
    dateEl = null;
    weatherEl = null;
    skinFabImgEl = null;
  }
};

function updateClock() {
  if (!timeEl || !dateEl) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  timeEl.textContent = `${hh}:${mm}`;

  const weekday = WEEKDAYS[now.getDay()];
  const month = MONTHS[now.getMonth()];
  const day = now.getDate();
  dateEl.textContent = `${weekday}, ${month} ${day}`;
}

function updateWeather(_weather) {
  // No-op: weather is displayed in the header, not on the home screensaver.
  // Kept as a callback target so dynamic-background can still subscribe.
}

async function loadStreak() {
  try {
    const streak = await api.fetchStreak();
    const el = document.getElementById('streak-count');
    if (el) el.textContent = streak.count || 0;
  } catch {}
}

async function loadDailyQuest() {
  try {
    const quest = await api.fetchDailyQuest();
    const widget = document.getElementById('daily-quest-widget');
    if (!quest || !widget) return;
    if (quest.completed) {
      widget.classList.add('home-widget--quest-done');
    }
    widget.style.display = '';
    document.getElementById('quest-name').textContent = `${quest.icon || '⭐'} ${quest.task_name}`;
    document.getElementById('quest-bonus').textContent = quest.completed ? '✅ 已完成' : `奖励 ×${quest.multiplier}`;
  } catch {}
}

async function loadGoal() {
  try {
    const goal = await api.fetchGoal();
    const widget = document.getElementById('goal-widget');
    if (!goal || !widget) return;
    widget.style.display = '';
    document.getElementById('goal-emoji').textContent = goal.reward.icon_emoji;
    document.getElementById('goal-name').textContent = goal.reward.name;
    document.getElementById('goal-progress').textContent = `${goal.progress}/${goal.target}`;
    document.getElementById('goal-fill').style.width = `${goal.percent}%`;
    document.getElementById('goal-remaining').textContent =
      goal.remaining > 0 ? `还差 ${goal.remaining} 🪙` : '🎉 可以兑换啦！';
  } catch {}
}

// ============================================================
// Click-to-speak announcements
// ============================================================

function announceTime() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const period = hour < 6 ? '凌晨' : hour < 12 ? '早上' : hour < 14 ? '中午' : hour < 18 ? '下午' : '晚上';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const mm = minute === 0 ? '整' : `${minute}分`;
  speak(`现在是${period}${h12}点${mm}`);
}

function announceDate() {
  const now = new Date();
  const chineseWeekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekday = chineseWeekdays[now.getDay()];
  const month = now.getMonth() + 1;
  const day = now.getDate();
  speak(`今天是${month}月${day}日，${weekday}`);
}

async function announceWeather() {
  try {
    const weather = await (await fetch('/api/weather')).json();
    const conditionText = {
      clear:  weather.is_day ? '晴天' : '晴朗的夜晚',
      cloudy: '多云',
      fog:    '有雾',
      rain:   '下雨',
      snow:   '下雪',
    };
    const cond = conditionText[weather.condition] || '天气不错';
    speak(`现在${cond}，气温${weather.temperature}度，地点在Kirkland`);
  } catch {
    speak('天气信息加载中');
  }
}

async function announceStreak() {
  try {
    const streak = await api.fetchStreak();
    if (streak.count <= 0) {
      speak('还没开始连续打卡哦，今天来完成一个任务吧！');
    } else if (streak.count === 1) {
      speak('你已经打卡1天了，继续加油！');
    } else {
      speak(`你已经连续打卡${streak.count}天了，真棒！`);
    }
  } catch {}
}

async function announceDailyQuest() {
  try {
    const quest = await api.fetchDailyQuest();
    if (!quest) {
      speak('今天还没有特别任务哦');
      return;
    }
    if (quest.completed) {
      speak(`今日特别任务 ${quest.task_name} 已经完成啦，真棒！`);
    } else {
      speak(`今日特别任务是：${quest.task_name}，完成可以获得${quest.multiplier}倍奖励！`);
    }
  } catch {}
}

async function announceGoal() {
  try {
    const goal = await api.fetchGoal();
    if (!goal) {
      speak('还没有设定目标哦，点两下可以选一个心愿');
      return;
    }
    if (goal.remaining > 0) {
      speak(`你的目标是${goal.reward.name}，还差${goal.remaining}个金币`);
    } else {
      speak(`太棒了！${goal.reward.name}已经可以兑换了！`);
    }
  } catch {}
}
