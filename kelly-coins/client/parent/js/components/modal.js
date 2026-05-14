/**
 * Confirmation modal component.
 */

const container = () => document.getElementById('modal-container');

/**
 * Show a confirmation dialog.
 * @param {string} title
 * @param {string} message
 * @param {string} confirmText
 * @param {string} cancelText
 * @returns {Promise<boolean>}
 */
export function confirm(title, message, confirmText = '确认', cancelText = '取消') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">${title}</div>
        <div class="modal-body">${message}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-sm" data-action="cancel">${cancelText}</button>
          <button class="btn btn-primary btn-sm" data-action="confirm">${confirmText}</button>
        </div>
      </div>
    `;

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'confirm') close(true);
      else if (action === 'cancel') close(false);
      else if (e.target === overlay) close(false);
    });

    container().appendChild(overlay);
  });
}
