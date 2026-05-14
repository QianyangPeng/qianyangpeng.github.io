// Toast notification component
// Usage: showToast('Message here', 'success' | 'error' | 'info')

let toastEl = null;
let timer = null;

function ensureEl() {
  if (toastEl) return;
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  document.getElementById('app').appendChild(toastEl);
}

export function showToast(message, type = 'success', duration = 2500) {
  ensureEl();
  toastEl.textContent = message;
  toastEl.className = 'toast toast--' + type + ' toast--visible';
  clearTimeout(timer);
  timer = setTimeout(() => {
    toastEl.classList.remove('toast--visible');
  }, duration);
}
