import { categoriesData } from './sampleData.js';
import { showToast } from './ui.js';

let currentData = [];
let filteredData = [];
let currentCategory = '';

export function renderCategoryView(categoryName) {
  currentCategory = categoryName;
  
  // 1. Update Title
  const titleEl = document.getElementById('category-page-title');
  if (titleEl) {
    titleEl.textContent = `${categoryName} Places`;
  }
  
  // 2. Load Data
  currentData = categoriesData[categoryName.toLowerCase()] || [];
  filteredData = [...currentData];
  
  // Reset filters
  const searchInput = document.getElementById('category-search');
  const filterSelect = document.getElementById('category-rating-filter');
  if (searchInput) searchInput.value = '';
  if (filterSelect) filterSelect.value = 'all';

  // Attach Listeners if not already attached
  if (searchInput && !searchInput.dataset.listening) {
    searchInput.addEventListener('input', applyFilters);
    searchInput.dataset.listening = true;
  }
  
  if (filterSelect && !filterSelect.dataset.listening) {
    filterSelect.addEventListener('change', applyFilters);
    filterSelect.dataset.listening = true;
  }
  
  // 3. Render grid
  renderGrid();
}

function applyFilters() {
  const searchTerm = document.getElementById('category-search').value.toLowerCase();
  const ratingFilter = document.getElementById('category-rating-filter').value;
  
  filteredData = currentData.filter(place => {
    // Check search term against multiple fields
    const searchMatch = 
      place.name.toLowerCase().includes(searchTerm) || 
      place.description.toLowerCase().includes(searchTerm) ||
      place.location.toLowerCase().includes(searchTerm) ||
      (place.category && place.category.toLowerCase().includes(searchTerm)) ||
      currentCategory.toLowerCase().includes(searchTerm);
                          
    let matchesRating = true;
    if (ratingFilter === '4plus') matchesRating = place.rating >= 4.0;
    else if (ratingFilter === '4.5plus') matchesRating = place.rating >= 4.5;
    
    return searchMatch && matchesRating;
  });
  
  renderGrid();
}

function renderGrid() {
  const gridEl = document.getElementById('category-grid');
  if (!gridEl) return;
  
  gridEl.innerHTML = ''; // clear
  
  if (filteredData.length === 0) {
    gridEl.innerHTML = `<div class="empty-state">No places found matching your filters.</div>`;
    return;
  }
  
  filteredData.forEach(place => {
    const card = document.createElement('div');
    card.className = 'place-card';
    
    // Fallback image handling using Picsum to ensure it never breaks
    const fallbackImage = `https://picsum.photos/seed/${encodeURIComponent(place.name)}/600/400`;

    card.innerHTML = `
      <div class="place-img-wrapper">
        <img class="place-img" src="${place.imageUrl}" alt="${place.name}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}';"/>
        <div class="place-rating-badge">⭐ ${place.rating.toFixed(1)}</div>
      </div>
      <div class="place-content">
        <h3 class="place-name">${place.name}</h3>
        <div class="place-location">📍 ${place.location}</div>
        <p class="place-desc">${place.description}</p>
        <button class="btn-primary w-full" onclick="window.location.hash='#place/${place.id}'">View Details</button>
      </div>
    `;
    gridEl.appendChild(card);
  });
}
