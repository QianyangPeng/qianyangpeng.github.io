// PWA install prompt
// Shows a small floating "Add to home screen" button when the browser fires
// `beforeinstallprompt`. On iOS Safari that event never fires, so we just stay
// hidden — parents will use Safari's "Add to Home Screen" share-sheet action.
//
// Persists dismissal in localStorage so we don't pester the user every load.

const DISMISS_KEY = 'kelly.installPrompt.dismissed';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

let deferredPrompt = null;
let buttonEl = null;

function isStandalone() {
  // PWA already installed (Android/desktop)
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) {
    return true;
  }
  // iOS Safari home-screen launch
  if (typeof navigator.standalone !== 'undefined' && navigator.standalone) {
    return true;
  }
  return false;
}

function recentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* localStorage may be unavailable in private mode */
  }
}

function createButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'install-prompt';
  btn.setAttribute('aria-label', '安装到主屏幕');
  btn.innerHTML = `
    <span class="install-prompt__icon" aria-hidden="true">📱</span>
    <span class="install-prompt__text">安装到主屏幕</span>
    <span class="install-prompt__close" aria-hidden="true">×</span>
  `;

  // Tap on the X dismisses without prompting
  btn.addEventListener('click', async (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('install-prompt__close')) {
      e.stopPropagation();
      hideButton();
      rememberDismiss();
      return;
    }

    if (!deferredPrompt) {
      hideButton();
      return;
    }
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      // 'accepted' or 'dismissed' — either way clear and hide
      if (choice && choice.outcome === 'dismissed') {
        rememberDismiss();
      }
    } catch (err) {
      console.warn('install prompt failed:', err);
    } finally {
      deferredPrompt = null;
      hideButton();
    }
  });

  return btn;
}

function showButton() {
  if (!buttonEl) {
    buttonEl = createButton();
    document.body.appendChild(buttonEl);
  }
  // Trigger fade-in on next frame for the CSS transition
  requestAnimationFrame(() => {
    buttonEl.classList.add('install-prompt--visible');
  });
}

function hideButton() {
  if (!buttonEl) return;
  buttonEl.classList.remove('install-prompt--visible');
  // Remove from DOM after fade
  setTimeout(() => {
    if (buttonEl && buttonEl.parentNode) {
      buttonEl.parentNode.removeChild(buttonEl);
      buttonEl = null;
    }
  }, 400);
}

export function setupInstallPrompt() {
  if (isStandalone()) return;
  if (recentlyDismissed()) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Hold the event so we can fire it on user gesture
    e.preventDefault();
    deferredPrompt = e;
    showButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideButton();
    rememberDismiss();
  });
}
