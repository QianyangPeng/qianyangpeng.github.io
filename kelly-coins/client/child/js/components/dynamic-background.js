// Dynamic Background System
// Selects a backyard scene image based on real time + season + weather
// Two-layer crossfade for smooth transitions
// EXTENSION POINT: add more conditions and scenes here

const SCENES = [
  'spring-morning',
  'summer-day',
  'summer-rain',
  'fall-day',
  'winter-snow',
  'night-clear',
  'night-rain',
  'sunrise-fog',
];

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

let currentScene = null;
let bgRoot = null;
let layerA = null;
let layerB = null;
let activeLayer = 'A';
let weatherListeners = [];
let refreshTimer = null;

// Build the DOM structure for the dynamic background
export function createDynamicBackground() {
  bgRoot = document.createElement('div');
  bgRoot.className = 'dynamic-bg';
  bgRoot.innerHTML = `
    <div class="dynamic-bg__layer dynamic-bg__layer--a"></div>
    <div class="dynamic-bg__layer dynamic-bg__layer--b"></div>
    <div class="dynamic-bg__overlay"></div>
    <div class="dynamic-bg__effects" id="dynamic-bg-effects"></div>
  `;
  layerA = bgRoot.querySelector('.dynamic-bg__layer--a');
  layerB = bgRoot.querySelector('.dynamic-bg__layer--b');

  // Initial load
  refresh();

  // Periodic refresh
  refreshTimer = setInterval(refresh, REFRESH_INTERVAL);

  return bgRoot;
}

// Subscribe to weather changes (for HUD widget)
export function onWeatherUpdate(callback) {
  weatherListeners.push(callback);
}

function notifyWeatherListeners(weather) {
  weatherListeners.forEach(cb => {
    try { cb(weather); } catch (e) { console.error('Weather listener error:', e); }
  });
}

// Determine scene from time + season + weather
function selectBackground(season, timeOfDay, weather) {
  // Night takes priority
  if (timeOfDay === 'night') {
    return weather.condition === 'rain' ? 'night-rain' : 'night-clear';
  }

  // Sunrise/sunset window
  if (timeOfDay === 'sunrise') return 'sunrise-fog';

  // Weather-based overrides
  if (weather.condition === 'snow' || season === 'winter') return 'winter-snow';
  if (weather.condition === 'rain') return 'summer-rain';

  // Season-based defaults
  if (season === 'fall') return 'fall-day';
  if (season === 'spring') return 'spring-morning';
  return 'summer-day';
}

function getCurrentSeasonAndTime() {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth() + 1;

  let season;
  if (month >= 3 && month <= 5) season = 'spring';
  else if (month >= 6 && month <= 8) season = 'summer';
  else if (month >= 9 && month <= 11) season = 'fall';
  else season = 'winter';

  let timeOfDay;
  if (hour >= 5 && hour < 7) timeOfDay = 'sunrise';
  else if (hour >= 7 && hour < 18) timeOfDay = 'day';
  else if (hour >= 18 && hour < 20) timeOfDay = 'sunset';
  else timeOfDay = 'night';

  return { season, timeOfDay, hour, month };
}

async function fetchWeather() {
  try {
    const res = await fetch('/api/weather');
    return await res.json();
  } catch {
    return { condition: 'clear', is_day: true, temperature: 60, location: 'Kirkland, WA' };
  }
}

async function refresh() {
  const { season, timeOfDay } = getCurrentSeasonAndTime();
  const weather = await fetchWeather();

  notifyWeatherListeners(weather);

  const scene = selectBackground(season, timeOfDay, weather);
  if (scene !== currentScene) {
    setBackground(scene);
    currentScene = scene;
    setAmbientEffects(scene, weather);
  }
}

function setBackground(scene) {
  // Prefer watercolor set, fall back to original PNGs if missing
  const url = `/child/assets/backgrounds/watercolor/${scene}.png`;
  const fallback = `/child/assets/backgrounds/${scene}.png`;
  const next = activeLayer === 'A' ? layerB : layerA;
  const current = activeLayer === 'A' ? layerA : layerB;

  const applyUrl = (finalUrl) => {
    next.style.backgroundImage = `url(${finalUrl})`;
    next.classList.add('dynamic-bg__layer--visible');
    current.classList.remove('dynamic-bg__layer--visible');
    activeLayer = activeLayer === 'A' ? 'B' : 'A';
  };

  const img = new Image();
  img.onload = () => applyUrl(url);
  img.onerror = () => {
    // Watercolor version missing, try the legacy path
    const fb = new Image();
    fb.onload = () => applyUrl(fallback);
    fb.onerror = () => console.warn(`Background failed to load: ${scene}`);
    fb.src = fallback;
  };
  img.src = url;
}

// Spawn ambient particle effects matching the scene
function setAmbientEffects(scene, weather) {
  const effectsEl = document.getElementById('dynamic-bg-effects');
  if (!effectsEl) return;
  effectsEl.innerHTML = '';

  // Snow
  if (scene === 'winter-snow' || weather.condition === 'snow') {
    spawnParticles(effectsEl, 'snow', 30, '❄');
    return;
  }

  // Rain
  if (weather.condition === 'rain' || scene.includes('rain')) {
    spawnRain(effectsEl, 40);
    return;
  }

  // Night fireflies — these are CSS-drawn glowing dots, not emoji,
  // so they don't break the watercolor aesthetic.
  if (scene === 'night-clear') {
    spawnParticles(effectsEl, 'firefly', 12, '');
    return;
  }

  // Butterflies were removed: 🦋 emoji + simple CSS translate looked
  // cheap on a hand-painted watercolor background. When we have real
  // SVG/PNG butterfly assets we can re-enable via a hand-painted layer.
}

function spawnParticles(parent, type, count, content) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = `bg-fx bg-fx--${type}`;
    if (content) el.textContent = content;
    el.style.left = Math.random() * 100 + '%';
    el.style.top = Math.random() * 100 + '%';
    el.style.animationDelay = (Math.random() * 6) + 's';
    el.style.animationDuration = (4 + Math.random() * 6) + 's';
    parent.appendChild(el);
  }
}

function spawnRain(parent, count) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'bg-fx bg-fx--rain';
    el.style.left = Math.random() * 100 + '%';
    el.style.animationDelay = (Math.random() * 1.5) + 's';
    el.style.animationDuration = (0.6 + Math.random() * 0.6) + 's';
    parent.appendChild(el);
  }
}

// For testing: force a specific scene
export function setSceneOverride(sceneName) {
  if (SCENES.includes(sceneName)) {
    setBackground(sceneName);
    currentScene = sceneName;
  }
}

export function destroyDynamicBackground() {
  if (refreshTimer) clearInterval(refreshTimer);
  weatherListeners = [];
}
