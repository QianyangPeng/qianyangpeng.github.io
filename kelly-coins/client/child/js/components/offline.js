// Global offline banner
// Slides in from the top when navigator.onLine is false.
// Tapping "重试" reloads the page so all pending fetches retry.

let bannerEl = null;

export function initOfflineBanner() {
  bannerEl = document.createElement('div');
  bannerEl.className = 'offline-banner';
  bannerEl.setAttribute('role', 'alert');
  bannerEl.setAttribute('aria-live', 'assertive');
  bannerEl.innerHTML = `
    <span>📡</span>
    <span class="offline-banner__text">没有网络，正在等待连接…</span>
    <button class="offline-banner__retry">重试</button>
  `;
  document.getElementById('app').appendChild(bannerEl);

  bannerEl.querySelector('.offline-banner__retry').addEventListener('click', () => {
    window.location.reload();
  });

  const update = () => {
    const offline = !navigator.onLine;
    bannerEl.classList.toggle('offline-banner--visible', offline);
  };

  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update(); // set initial state
}
