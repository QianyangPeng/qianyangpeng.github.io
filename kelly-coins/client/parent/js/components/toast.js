/**
 * Toast notification component.
 */

const container = () => document.getElementById('toast-container');

export function showToast(message, duration = 2500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container().appendChild(el);
  setTimeout(() => el.remove(), duration);
}
