/**
 * Bottom navigation component.
 *
 * The bar holds 8 tabs and is horizontally scrollable on narrow screens
 * via CSS (overflow-x: auto on the container).
 */

const tabs = [
  { id: 'dashboard',       icon: '\uD83D\uDCCA', label: '总览' },
  { id: 'approvals',       icon: '\u23F3',        label: '审批' },
  { id: 'tasks',           icon: '\uD83D\uDCCB', label: '任务' },
  { id: 'rewards',         icon: '\uD83C\uDF81', label: '奖励' },
  { id: 'voice-messages',  icon: '\uD83C\uDFA4', label: '语音' },
  { id: 'photos',          icon: '\uD83D\uDCF7', label: '照片' },
  { id: 'children',        icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66', label: '管理' },
  { id: 'settings',        icon: '\u2699\uFE0F', label: '设置' },
];

let pendingCount = 0;

export function renderNav(container, onNavigate) {
  container.innerHTML = tabs.map(t => `
    <button class="nav-item" data-page="${t.id}">
      <span class="nav-icon">${t.icon}</span>
      <span class="nav-label">${t.label}</span>
      ${t.id === 'approvals' ? '<span class="nav-badge" id="nav-badge-approvals" style="display:none">0</span>' : ''}
    </button>
  `).join('');

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    const page = btn.dataset.page;
    onNavigate(page);
  });
}

export function setActiveNav(pageId) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    const isActive = btn.dataset.page === pageId;
    btn.classList.toggle('active', isActive);
    if (isActive) {
      // Make sure the active tab is visible when nav is scrollable
      try { btn.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (_) {}
    }
  });
}

export function updateBadge(count) {
  pendingCount = count;
  const badge = document.getElementById('nav-badge-approvals');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

export function getBadgeCount() {
  return pendingCount;
}
