// Kelly Coins — Service Worker
// Provides offline support via cache-first strategy for assets and
// network-first w/ cache fallback for /api requests so the child UI
// remains usable when temporarily offline.
//
// Bump CACHE_VERSION to invalidate old caches.

const CACHE_VERSION = 'kelly-v3-touch-games';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Critical shell + module assets to precache on install.
// Anything else (icons, future modules) will be lazy-cached on first request
// via the runtime cache so we don't hard-fail if a file is missing.
const PRECACHE_URLS = [
  '/',
  '/child/index.html',
  '/child/manifest.json',
  '/child/css/styles.css',

  // Top-level JS modules
  '/child/js/app.js',
  '/child/js/api.js',
  '/child/js/state.js',
  '/child/js/router.js',
  '/child/js/skin-style.js',

  // Components
  '/child/js/components/animations.js',
  '/child/js/components/background.js',
  '/child/js/components/character.js',
  '/child/js/components/dynamic-background.js',
  '/child/js/components/header.js',
  '/child/js/components/install-prompt.js',
  '/child/js/components/modal.js',
  '/child/js/components/nav.js',
  '/child/js/components/settings-modal.js',
  '/child/js/components/task-progress.js',
  '/child/js/components/toast.js',
  '/child/js/components/voice.js',

  // Pages
  '/child/js/pages/home.js',
  '/child/js/pages/tasks.js',
  '/child/js/pages/rewards.js',
  '/child/js/pages/shop.js',
  '/child/js/pages/games.js',
  '/child/js/pages/alphabet-game.js',
  '/child/js/pages/find-animal-game.js',
  '/child/js/pages/touch-mini-games.js',

  // Character sprites (gacha set)
  '/child/assets/characters/styles/gacha/default.png',
  '/child/assets/characters/styles/gacha/astronaut.png',
  '/child/assets/characters/styles/gacha/fairy.png',
  '/child/assets/characters/styles/gacha/knight.png',
  '/child/assets/characters/styles/gacha/mermaid.png',
  '/child/assets/characters/styles/gacha/princess.png',

  // UI assets
  '/child/assets/ui/btn-gold.png',
  '/child/assets/ui/burst.png',
  '/child/assets/ui/coin.png',
  '/child/assets/ui/map-bg.png',
  '/child/assets/ui/sign-bath.png',
  '/child/assets/ui/sign-garden.png',
  '/child/assets/ui/sign-home.png',
  '/child/assets/ui/sign-kitchen.png',
  '/child/assets/ui/sign-selina.png',
  '/child/assets/ui/ui-panel.png',

  // Reward & task icons
  '/child/assets/icons/rewards/1.png',
  '/child/assets/icons/rewards/2.png',
  '/child/assets/icons/rewards/3.png',
  '/child/assets/icons/rewards/4.png',
  '/child/assets/icons/rewards/5.png',
  '/child/assets/icons/rewards/6.png',
  '/child/assets/icons/rewards/7.png',
  '/child/assets/icons/tasks/1.png',
  '/child/assets/icons/tasks/2.png',
  '/child/assets/icons/tasks/3.png',
  '/child/assets/icons/tasks/4.png',
  '/child/assets/icons/tasks/5.png',
  '/child/assets/icons/tasks/6.png',
  '/child/assets/icons/tasks/7.png',

  // Background scenes
  '/child/assets/backgrounds/fall-day.png',
  '/child/assets/backgrounds/night-clear.png',
  '/child/assets/backgrounds/night-rain.png',
  '/child/assets/backgrounds/spring-morning.png',
  '/child/assets/backgrounds/summer-day.png',
  '/child/assets/backgrounds/summer-rain.png',
  '/child/assets/backgrounds/sunrise-fog.png',
  '/child/assets/backgrounds/winter-snow.png',
];

// ----------------------------------------------------------------------------
// Install: precache the shell. Skip waiting so updates apply on next load.
// ----------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // addAll is atomic — if one request fails the whole thing fails. Use
      // individual adds w/ catch so a missing asset doesn't break install.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const req = new Request(url, { cache: 'reload' });
            const res = await fetch(req);
            if (res && res.ok) await cache.put(url, res.clone());
          } catch (err) {
            // Silent — log but never throw
            console.warn('[sw] precache skipped:', url, err.message);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

// ----------------------------------------------------------------------------
// Activate: clean up stale caches from previous versions.
// ----------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ----------------------------------------------------------------------------
// Fetch: route requests through the right strategy.
//   /api/*           -> network-first, cache fallback (so offline still works)
//   Same-origin GET  -> cache-first, runtime cache fallback for new assets
//   Everything else  -> default network behavior
// ----------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GETs — skip POST/PUT/DELETE etc.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ignore cross-origin requests (Google Fonts, weather/tts upstream APIs).
  // Let the browser handle them normally.
  if (url.origin !== self.location.origin) return;

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // HTML navigations + JS modules: network-first so fresh code ships
  // without a hard reload. Keeps the rest of the assets cache-first.
  if (req.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('.css')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Static assets / shell: cache-first
  event.respondWith(cacheFirst(req));
});

// ----------------------------------------------------------------------------
// Strategy: cache-first for static assets.
// On miss, fetch & store in runtime cache.
// ----------------------------------------------------------------------------
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Last-ditch fallback for navigation requests: serve cached shell
    if (request.mode === 'navigate') {
      const shell = await caches.match('/child/index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

// ----------------------------------------------------------------------------
// Strategy: network-first for API.
// Cache successful responses so the next offline request still has data.
// ----------------------------------------------------------------------------
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return a synthetic JSON failure so client code can detect offline state
    return new Response(
      JSON.stringify({ success: false, error: 'offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ----------------------------------------------------------------------------
// Optional: allow page to trigger an immediate update via postMessage.
// ----------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
