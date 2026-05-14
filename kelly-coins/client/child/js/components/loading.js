// Shared loading state helpers: skeleton shimmer cards and grid error states.
// Used by tasks, rewards, and shop pages so all grids behave consistently.

/**
 * Fill containerEl with shimmer skeleton placeholder cards.
 * @param {HTMLElement} containerEl - the grid/list container
 * @param {number}      count       - how many skeleton cards to show
 * @param {'grid'|'row'|'inv'|'skin'} layout - which skeleton variant to use
 */
export function showSkeleton(containerEl, count = 4, layout = 'grid') {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const wrapClass = layout === 'row' ? 'skeleton-row' : 'skeleton-grid';
  const wrapper = document.createElement('div');
  wrapper.className = wrapClass;

  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = layout === 'skin' ? 'skeleton-card skeleton-card--skin'
                   : layout === 'inv'  ? 'skeleton-card skeleton-card--inv'
                   : 'skeleton-card';
    wrapper.appendChild(card);
  }

  containerEl.appendChild(wrapper);
}

/**
 * Replace containerEl contents with an inline error state + retry button.
 * @param {HTMLElement} containerEl - the container to render into
 * @param {Function}    retryFn     - called when the user taps retry
 */
export function showGridError(containerEl, retryFn) {
  if (!containerEl) return;
  containerEl.innerHTML = `
    <div class="grid-error">
      <div class="grid-error__icon">😢</div>
      <div class="grid-error__text">加载失败了</div>
      <button class="grid-error__retry">重试 🔄</button>
    </div>
  `;
  containerEl.querySelector('.grid-error__retry').addEventListener('click', retryFn);
}
