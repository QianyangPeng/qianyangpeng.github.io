/**
 * Icon picker — modal that lets a parent browse the watercolor icon
 * library and pick one. Returns a Promise<string|null> resolving to the
 * chosen icon_file key (e.g. "bath") or null if cancelled.
 *
 * Catalog is fetched once per page load and cached on the module.
 *
 * Usage:
 *   import { pickIcon } from '../components/icon-picker.js';
 *   const key = await pickIcon('tasks'); // or 'rewards' or 'shop'
 *   if (key) task.icon_file = key;
 */

let catalogCache = null;

async function loadCatalog() {
  if (catalogCache) return catalogCache;
  const res = await fetch('/api/icon-catalog');
  const data = await res.json();
  if (!data.success) throw new Error('failed to load icon catalog');
  catalogCache = data.data;
  return catalogCache;
}

function iconAssetUrl(kind, key) {
  // Server-side: tasks live in /tasks/, rewards in /rewards/, shop in /shop/.
  return `/child/assets/icons/${kind}/${key}.png`;
}

/**
 * Open the picker. `kind` is 'tasks' | 'rewards' | 'shop'.
 * `currentKey` highlights the currently-selected icon if provided.
 * Returns the chosen icon key, or null if the user cancels.
 */
export function pickIcon(kind, currentKey = null) {
  return new Promise(async (resolve) => {
    let catalog;
    try {
      catalog = await loadCatalog();
    } catch (e) {
      console.error('icon-picker: catalog load failed', e);
      resolve(null);
      return;
    }

    const entries = catalog[kind] || [];
    if (entries.length === 0) {
      resolve(null);
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'icon-picker-backdrop';
    backdrop.innerHTML = `
      <div class="icon-picker" role="dialog" aria-label="选择图标">
        <div class="icon-picker__header">
          <div class="icon-picker__title">选择图标</div>
          <button class="icon-picker__close" aria-label="关闭">✕</button>
        </div>
        <div class="icon-picker__body">
          <div class="icon-picker__grid">
            ${entries.map(entry => `
              <button class="icon-picker__cell ${currentKey === entry.key ? 'is-selected' : ''}"
                      data-key="${entry.key}"
                      aria-label="${entry.label}">
                <img src="${iconAssetUrl(kind, entry.key)}" alt="${entry.label}" loading="lazy">
                <span class="icon-picker__label">${entry.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const close = (chosen) => {
      backdrop.remove();
      resolve(chosen);
    };

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(null);
    });
    backdrop.querySelector('.icon-picker__close').addEventListener('click', () => close(null));
    backdrop.querySelectorAll('.icon-picker__cell').forEach(cell => {
      cell.addEventListener('click', () => close(cell.dataset.key));
    });

    document.body.appendChild(backdrop);
  });
}

/** Small helper: return an `<img>`/fallback HTML snippet for a row view. */
export function iconThumbHtml(kind, iconFile, fallbackEmoji) {
  if (iconFile) {
    return `<img src="${iconAssetUrl(kind, iconFile)}" alt=""
                 class="icon-thumb"
                 onerror="this.outerHTML='${(fallbackEmoji || '📌').replace(/'/g, '&#39;')}'">`;
  }
  return fallbackEmoji || '📌';
}
