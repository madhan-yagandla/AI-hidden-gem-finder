/**
 * UI Helpers — toasts, loading states, utilities
 */

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Show skeleton loading cards
 */
export function showLoadingSkeletons(container, count = 4) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-card';
    skeleton.style.animationDelay = `${i * 0.1}s`;
    skeleton.innerHTML = `
      <div class="skeleton-line h-lg w-60"></div>
      <div class="skeleton-line w-100" style="margin-top: 12px;"></div>
      <div class="skeleton-line w-80"></div>
      <div class="skeleton-line w-40" style="margin-top: 8px;"></div>
    `;
    container.appendChild(skeleton);
  }
}

/**
 * Set the search button loading state
 */
export function setSearchLoading(isLoading) {
  const btn = document.getElementById('search-btn');
  const btnText = btn.querySelector('.search-btn-text');
  const btnLoading = btn.querySelector('.search-btn-loading');

  btn.disabled = isLoading;
  btnText.style.display = isLoading ? 'none' : 'inline';
  btnLoading.style.display = isLoading ? 'inline-flex' : 'none';
}

/**
 * Get the category CSS color variable for a category type
 */
export function getCategoryColor(type) {
  const colors = {
    nature: { bg: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' },
    food: { bg: 'rgba(249, 115, 22, 0.12)', color: '#f97316' },
    art: { bg: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' },
    history: { bg: 'rgba(167, 139, 250, 0.12)', color: '#a78bfa' },
    spiritual: { bg: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' },
    culture: { bg: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' },
    viewpoints: { bg: 'rgba(244, 63, 94, 0.12)', color: '#f43f5e' },
    relaxation: { bg: 'rgba(20, 184, 166, 0.12)', color: '#14b8a6' },
  };
  return colors[type] || { bg: 'rgba(255,255,255,0.05)', color: '#8b92b0' };
}
