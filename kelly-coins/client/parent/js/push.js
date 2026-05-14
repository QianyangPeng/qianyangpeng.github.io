/**
 * Parent PWA Web Push subscription helper.
 *
 * Flow:
 *   1. After the parent successfully logs in, call enablePush().
 *   2. enablePush() asks for Notification permission (once), then uses the
 *      registered service worker to create a PushSubscription with the
 *      server's VAPID public key, then POSTs the subscription to
 *      /api/parent/push/subscribe so the server can fire pushes later.
 *   3. On logout call disablePush() to drop the subscription both locally
 *      and on the server (avoids dead endpoints piling up).
 *
 * iOS 16.4+ notes:
 *   - Must be invoked in response to a user gesture the first time.
 *   - Only works if the PWA has been added to the home screen.
 *   - Only works over HTTPS (or localhost for dev).
 */

import { subscribeToPush, unsubscribeFromPush } from './api.js';

const DEVICE_ID_KEY = 'parent-device-id';

function deviceId() {
  let id = sessionStorage.getItem(DEVICE_ID_KEY) || localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function deviceName() {
  // Use the UA to guess something human-readable so the server-side
  // session list is legible ("iPhone", "iPad", "Mac", etc.).
  const ua = navigator.userAgent || '';
  if (/iPhone/i.test(ua))  return 'iPhone';
  if (/iPad/i.test(ua))    return 'iPad';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'Browser';
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Is the browser capable of web push at all? Returns false in private mode,
 * on old iOS, and anywhere the Notification API is missing.
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
}

/**
 * Ensure the parent service worker is registered and ready, and return its
 * ServiceWorkerRegistration. Returns null if service workers aren't supported.
 */
async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // The index.html already calls register() on load; this call deduplicates.
    const reg = await navigator.serviceWorker.register('/parent/sw.js', { scope: '/parent/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn('[push] sw register failed', e);
    return null;
  }
}

/**
 * Ask for permission, create a push subscription, and send it to the server.
 * `vapidPublicKey` comes from /api/parent/auth/status.
 * Returns { ok, reason? }.
 */
export async function enablePush(vapidPublicKey) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!vapidPublicKey)    return { ok: false, reason: 'no_vapid_key' };

  if (Notification.permission === 'denied') {
    return { ok: false, reason: 'permission_denied' };
  }
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'permission_denied' };
  }

  const reg = await getRegistration();
  if (!reg) return { ok: false, reason: 'no_sw' };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    } catch (e) {
      console.error('[push] subscribe failed', e);
      return { ok: false, reason: 'subscribe_failed' };
    }
  }

  try {
    await subscribeToPush(sub.toJSON(), {
      deviceId: deviceId(),
      deviceName: deviceName(),
    });
    return { ok: true };
  } catch (e) {
    console.error('[push] server-side subscribe failed', e);
    return { ok: false, reason: 'server_rejected' };
  }
}

/**
 * Drop the push subscription on both client and server.
 */
export async function disablePush() {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/parent/');
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await sub.unsubscribe().catch(() => {});
    await unsubscribeFromPush(sub.endpoint).catch(() => {});
  } catch (e) {
    // Best-effort cleanup; don't block logout on this.
  }
}
