// Hash-based page router with direction-aware slide transitions.
// Navigation "forward" (increasing tab index) slides right; "back" slides left.

const pages = new Map();
let currentPage = null;
let contentEl = null;
let transitioning = false;

// Canonical order of tabs — used to decide slide direction.
// Pages not in this list (achievements, garden) default to forward.
const PAGE_ORDER = ['home', 'tasks', 'games', 'shop', 'story'];

function getPageIndex(id) {
  const i = PAGE_ORDER.indexOf(id);
  return i === -1 ? 0 : i;
}

export function initRouter(containerEl) {
  contentEl = containerEl;
  window.addEventListener('hashchange', () => route());
}

export function registerPage(page) {
  pages.set(page.id, page);
}

export function navigate(pageId) {
  location.hash = '#' + pageId;
}

export function currentPageId() {
  return currentPage ? currentPage.id : null;
}

export function route() {
  const hash = location.hash.slice(1) || 'home';
  const page = pages.get(hash);
  if (!page || transitioning) return;

  if (currentPage && currentPage.id === hash) return; // same page

  const prevIndex = currentPage ? getPageIndex(currentPage.id) : -1;
  const nextIndex = getPageIndex(hash);
  const dir = nextIndex >= prevIndex ? 'forward' : 'back';

  if (currentPage) {
    transitioning = true;
    const exitClass = `content--exit-${dir}`;
    contentEl.classList.add(exitClass);

    setTimeout(() => {
      if (currentPage && currentPage.unmount) currentPage.unmount();
      contentEl.innerHTML = '';
      contentEl.classList.remove(exitClass);
      mountPage(page, dir);
      transitioning = false;
    }, 180);
  } else {
    // First load — no exit animation
    mountPage(page, 'forward');
  }
}

function mountPage(page, dir) {
  currentPage = page;
  const el = page.render();
  if (el) contentEl.appendChild(el);

  // Add enter class; remove after animation completes so it doesn't interfere
  // with any subsequent transforms on the content element.
  const enterClass = `content--enter-${dir}`;
  contentEl.classList.add(enterClass);
  setTimeout(() => contentEl.classList.remove(enterClass), 350);

  if (page.mount) page.mount();
}
