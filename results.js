/**
 * Results Module — renders enhanced gem cards with images, travel, and comfort info
 */

import { getCategoryColor } from './ui.js';
import { fetchFavorites, addFavorite, removeFavorite } from './api.js';

let currentGems = [];
let activeCardIndex = -1;
let favorites = new Set();
let userId = getOrCreateUserId();

function getOrCreateUserId() {
  let id = localStorage.getItem('gem-user-id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : 'user-' + Date.now();
    localStorage.setItem('gem-user-id', id);
  }
  return id;
}

// Initialise favorites from remote database
async function initFavorites() {
  try {
    const remoteFavs = await fetchFavorites(userId);
    favorites = new Set(remoteFavs.map(f => String(f.id)));
  } catch (error) {
    console.error('Could not load favorites from database, falling back to local', error);
    try {
      const saved = localStorage.getItem('gem-favorites');
      favorites = new Set(saved ? JSON.parse(saved) : []);
    } catch { favorites = new Set(); }
  }
}
initFavorites();

/**
 * Render gem results in the sidebar
 */
export function renderResults(gems, onCardClick, onFavoriteToggle) {
  currentGems = gems;
  const list = document.getElementById('results-list');
  const stats = document.getElementById('results-stats');
  const countEl = document.getElementById('results-count');

  list.innerHTML = '';

  if (gems.length === 0) {
    stats.style.display = 'none';
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No hidden gems found</h3>
        <p>Try expanding the search radius or selecting different interests.</p>
      </div>
    `;
    return;
  }

  stats.style.display = 'flex';
  countEl.textContent = `💎 ${gems.length} hidden gems discovered`;

  gems.forEach((gem, index) => {
    const card = createGemCard(gem, index, onCardClick, onFavoriteToggle);
    list.appendChild(card);
  });
}

/**
 * Create a single gem card element with image, travel, and comfort info
 */
function createGemCard(gem, index, onCardClick, onFavoriteToggle) {
  const card = document.createElement('div');
  card.className = 'gem-card';
  card.id = `gem-card-${index}`;
  card.style.animationDelay = `${index * 0.08}s`;

  const catColor = getCategoryColor(gem.category.type);
  const isFav = favorites.has(gem.id.toString());
  const scoreClass = gem.gemScore >= 75 ? 'high' : gem.gemScore >= 50 ? 'medium' : 'low';
  const scoreLabel = gem.gemScore >= 75 ? '🔥 Top Gem' : gem.gemScore >= 50 ? '💎 Hidden Gem' : '📍 Worth a Visit';

  // Travel info HTML
  const travelHtml = gem.travel && gem.travel.distance ? `
    <div class="gem-card-travel">
      <span class="travel-mode">${gem.travel.modeIcon} ${gem.travel.modeLabel}</span>
      <span class="travel-divider">·</span>
      <span class="travel-distance">${gem.travel.distanceFormatted}</span>
      <span class="travel-divider">·</span>
      <span class="travel-duration">~${gem.travel.durationFormatted}</span>
    </div>
  ` : '';

  // Comfort & audience HTML
  const comfortHtml = gem.comfort ? `
    <div class="gem-card-comfort">
      <span class="comfort-item" title="Comfort Level">${gem.comfort.comfortIcon} ${gem.comfort.comfortLevel}</span>
      <span class="comfort-item" title="Best For">${gem.comfort.audienceIcon} ${gem.comfort.audience}</span>
    </div>
  ` : '';

  // Image URL (with fallback)
  const imageUrl = gem.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(gem.name)}/600/300`;

  card.innerHTML = `
    <div class="gem-card-image-wrapper">
      <img
        class="gem-card-image"
        src="${imageUrl}"
        alt="${gem.name}"
        loading="lazy"
        onerror="this.onerror=null; this.src='https://picsum.photos/seed/${gem.id}/600/300';"
      />
      <div class="gem-card-image-overlay">
        <span class="gem-card-category" style="--cat-bg: ${catColor.bg}; --cat-color: ${catColor.color}">
          ${gem.category.icon} ${gem.category.label}
        </span>
        <span class="gem-card-score ${scoreClass}">${scoreLabel}</span>
      </div>
      <button class="favorite-btn ${isFav ? 'active' : ''}" data-gem-id="${gem.id}" title="${isFav ? 'Remove from favorites' : 'Save to favorites'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
    </div>

    <div class="gem-card-body">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div class="gem-card-title" style="margin-bottom: 0;">${gem.name}</div>
        <div class="gem-card-rating" style="font-size: 0.85em; font-weight: 600; color: var(--text-accent); display: flex; align-items: center; gap: 4px; background: rgba(251, 191, 36, 0.15); padding: 2px 6px; border-radius: 6px;">⭐ ${(gem.gemScore / 20).toFixed(1)}</div>
      </div>
      <div class="gem-card-description">${gem.aiDescription || ''}</div>
      <div class="gem-card-reason">${gem.gemReason || ''}</div>
      ${travelHtml}
      ${comfortHtml}
      <div class="gem-card-footer">
        <span class="gem-card-time">${gem.bestTime || 'Anytime'}</span>
      </div>
    </div>
  `;

  // Card click → focus on map
  card.addEventListener('click', (e) => {
    if (e.target.closest('.favorite-btn')) return;
    setActiveCard(index);
    if (onCardClick) onCardClick(gem, index);
  });

  // Favorite button
  const favBtn = card.querySelector('.favorite-btn');
  favBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const gemId = gem.id.toString();
    const isCurrentlyFav = favorites.has(gemId);

    // Optimistic UI Update
    if (isCurrentlyFav) {
      favorites.delete(gemId);
      favBtn.classList.remove('active');
      favBtn.querySelector('svg').setAttribute('fill', 'none');
    } else {
      favorites.add(gemId);
      favBtn.classList.add('active');
      favBtn.querySelector('svg').setAttribute('fill', 'currentColor');
      favBtn.style.transform = 'scale(1.4)';
      setTimeout(() => (favBtn.style.transform = ''), 200);
    }
    saveFavorites(favorites); // Keep a local backup

    if (onFavoriteToggle) onFavoriteToggle(gem, !isCurrentlyFav);

    // Background sync with SQLite Database
    try {
      if (isCurrentlyFav) {
        await removeFavorite(userId, gemId);
      } else {
        await addFavorite(userId, gem);
      }
    } catch (error) {
      console.error('Failed to sync favorite with database', error);
    }
  });

  return card;
}

export function setActiveCard(index) {
  if (activeCardIndex >= 0) {
    const prev = document.getElementById(`gem-card-${activeCardIndex}`);
    if (prev) prev.classList.remove('active');
  }
  activeCardIndex = index;
  const card = document.getElementById(`gem-card-${index}`);
  if (card) {
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function saveFavorites(favs) {
  localStorage.setItem('gem-favorites', JSON.stringify([...favs]));
}

export function clearResults() {
  const list = document.getElementById('results-list');
  const stats = document.getElementById('results-stats');
  stats.style.display = 'none';
  list.innerHTML = `
    <div id="empty-state" class="empty-state">
      <div class="empty-icon">🗺️</div>
      <h3>Ready to explore?</h3>
      <p>Enter a location and select your interests to discover amazing hidden gems nearby.</p>
    </div>
  `;
}
