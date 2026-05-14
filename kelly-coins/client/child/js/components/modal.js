// Reusable modal dialog component
// Usage: showModal({ title, body, confirmText, onConfirm, onCancel })

let backdropEl = null;

function ensureBackdrop() {
  if (backdropEl) return;
  backdropEl = document.createElement('div');
  backdropEl.className = 'modal-backdrop';
  backdropEl.addEventListener('click', (e) => {
    if (e.target === backdropEl) hideModal();
  });
  document.getElementById('app').appendChild(backdropEl);
}

export function showModal({ title, body, confirmText = '确定', cancelText = '取消', onConfirm, onCancel, emoji = '' }) {
  ensureBackdrop();
  backdropEl.innerHTML = `
    <div class="modal">
      ${emoji ? `<div class="modal__emoji">${emoji}</div>` : ''}
      <div class="modal__title">${title}</div>
      <div class="modal__body">${body}</div>
      <div class="modal__actions">
        <button class="modal__btn modal__btn--cancel">${cancelText}</button>
        <button class="modal__btn modal__btn--confirm">${confirmText}</button>
      </div>
    </div>
  `;
  backdropEl.classList.add('modal-backdrop--visible');

  backdropEl.querySelector('.modal__btn--confirm').addEventListener('click', () => {
    hideModal();
    if (onConfirm) onConfirm();
  });
  backdropEl.querySelector('.modal__btn--cancel').addEventListener('click', () => {
    hideModal();
    if (onCancel) onCancel();
  });
}

export function hideModal() {
  if (backdropEl) {
    backdropEl.classList.remove('modal-backdrop--visible');
  }
}
