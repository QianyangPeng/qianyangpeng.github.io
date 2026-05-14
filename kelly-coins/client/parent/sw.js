// Parent PWA Service Worker
// Responsibilities:
//   1. Receive Web Push notifications when a child creates a pending action
//   2. Show the system notification with the right title / body / icon
//   3. Focus an existing parent PWA window (or open one) when the user taps
//
// Scope is /parent/ so this sw is completely isolated from the child sw.

const VERSION = 'kelly-parent-v1';
const CACHE_NAME = `${VERSION}-shell`;

// Minimal install step — just claim the clients immediately so push events
// fire on first load instead of waiting for a reload.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// ----- Web Push handling -----

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Kelly Coins', body: event.data ? event.data.text() : '有新请求' };
  }

  const title = payload.title || 'Kelly Coins';
  const options = {
    body: payload.body || '有一个新的审批请求',
    icon: '/parent/assets/icon-192.png',
    badge: '/parent/assets/icon-192.png',
    tag: payload.tag || 'kelly-pending',
    // renotify: true means even if a notification with the same tag already
    // exists, a new one replaces it AND re-vibrates/re-sounds. Otherwise iOS
    // would silently collapse duplicates.
    renotify: true,
    data: {
      url: payload.url || '/parent/#approvals',
      actionId: payload.actionId || null,
    },
    // Action buttons shown on the notification itself. iOS supports these
    // when the PWA is installed to the home screen.
    actions: [
      { action: 'approve', title: '批准' },
      { action: 'view',    title: '查看' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/parent/#approvals';
  const action = event.action;

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Prefer an already-open parent window; fall back to opening a new one.
    for (const client of allClients) {
      if (client.url.includes('/parent/')) {
        await client.focus();
        // Tell the page which action was picked so it can jump straight to
        // the right approval and optionally auto-approve.
        client.postMessage({
          type: 'notification-click',
          action,
          actionId: event.notification.data?.actionId || null,
        });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
