/**
 * Map Module — Leaflet map initialization, markers, and interactions
 * Features: light/dark theme toggle, animated drop markers, rich popups
 */

let map = null;
let markersLayer = null;
let searchCircle = null;
let currentTileLayer = null;
let isDarkTheme = false; // Start with light theme

const CATEGORY_COLORS = {
  nature: '#16a34a',
  food: '#ea580c',
  art: '#db2777',
  history: '#7c3aed',
  spiritual: '#d97706',
  culture: '#0284c7',
  viewpoints: '#dc2626',
  relaxation: '#0d9488',
  other: '#6b7280',
};

// Slightly brighter on dark maps
const CATEGORY_COLORS_DARK = {
  nature: '#22c55e',
  food: '#f97316',
  art: '#ec4899',
  history: '#a78bfa',
  spiritual: '#fbbf24',
  culture: '#38bdf8',
  viewpoints: '#f43f5e',
  relaxation: '#14b8a6',
  other: '#8b92b0',
};

const TILE_LAYERS = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    },
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    },
  },
};

/**
 * Initialize the Leaflet map
 */
export function initMap() {
  map = L.map('map', {
    center: [20.5937, 78.9629], // Center of India
    zoom: 5,
    zoomControl: false, // We'll add custom position
    attributionControl: true,
    zoomAnimation: true,
    fadeAnimation: true,
    markerZoomAnimation: true,
  });

  // Add zoom control to top-right (away from sidebar)
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Default: light theme
  setMapTheme('light');

  markersLayer = L.layerGroup().addTo(map);

  // Setup theme toggle
  initThemeToggle();

  return map;
}

/**
 * Set map tile theme
 */
function setMapTheme(theme) {
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer);
  }

  const tileConfig = TILE_LAYERS[theme];
  currentTileLayer = L.tileLayer(tileConfig.url, tileConfig.options).addTo(map);
  isDarkTheme = theme === 'dark';

  // Update body class for CSS hooks
  document.body.classList.toggle('map-dark', isDarkTheme);
  document.body.classList.toggle('map-light', !isDarkTheme);
}

/**
 * Initialize theme toggle button
 */
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');

  if (!btn) return;

  btn.addEventListener('click', () => {
    const newTheme = isDarkTheme ? 'light' : 'dark';
    setMapTheme(newTheme);

    // Toggle icons with rotation animation
    btn.style.transform = 'rotate(360deg)';
    setTimeout(() => { btn.style.transform = ''; }, 400);

    if (isDarkTheme) {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }

    // Re-render markers with updated colors
    if (currentGems.length > 0) {
      addGemMarkers(currentGems, currentGemClickHandler);
    }
  });
}

// Store current gems for re-rendering on theme change
let currentGems = [];
let currentGemClickHandler = null;

/**
 * Fly to a location on the map with smooth animation
 */
export function flyTo(lat, lon, zoom = 13) {
  if (map) {
    map.flyTo([lat, lon], zoom, {
      duration: 2.0,
      easeLinearity: 0.2,
    });
  }
}

/**
 * Show the search area circle
 */
export function showSearchArea(lat, lon, radiusMeters) {
  if (searchCircle) {
    searchCircle.remove();
  }

  const circleColor = isDarkTheme ? '#f59e0b' : '#2563eb';
  const fillColor = isDarkTheme ? 'rgba(245, 158, 11, 0.08)' : 'rgba(37, 99, 235, 0.06)';

  searchCircle = L.circle([lat, lon], {
    radius: radiusMeters,
    color: circleColor,
    fillColor: fillColor,
    fillOpacity: 0.3,
    weight: 1.5,
    dashArray: '8 5',
  }).addTo(map);
}

/**
 * Clear all markers
 */
export function clearMarkers() {
  if (markersLayer) {
    markersLayer.clearLayers();
  }
  if (searchCircle) {
    searchCircle.remove();
    searchCircle = null;
  }
}

/**
 * Get the right color palette based on current theme
 */
function getColors() {
  return isDarkTheme ? CATEGORY_COLORS_DARK : CATEGORY_COLORS;
}

/**
 * Add gem markers to the map with bounce/drop animation
 * @param {Array} gems - Array of gem objects
 * @param {Function} onGemClick - Callback when a gem marker is clicked
 */
export function addGemMarkers(gems, onGemClick) {
  clearMarkers();
  currentGems = gems;
  currentGemClickHandler = onGemClick;
  const colors = getColors();

  gems.forEach((gem, index) => {
    const color = colors[gem.category.type] || colors.other;
    const shadowColor = isDarkTheme ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)';
    const borderColor = isDarkTheme ? 'white' : 'white';

    // Create custom animated marker with drop + pulse
    const markerHtml = `
      <div class="gem-marker gem-marker-drop" style="animation-delay: ${index * 60}ms">
        <div class="gem-marker-pulse" style="background: ${color}"></div>
        <div class="gem-marker-dot" style="background: ${color}; border-color: ${borderColor}; box-shadow: 0 2px 8px ${shadowColor}">
          <span class="gem-marker-icon">${gem.category.icon}</span>
        </div>
        <div class="gem-marker-pin" style="border-top-color: ${color}"></div>
      </div>
    `;

    const icon = L.divIcon({
      html: markerHtml,
      className: 'gem-marker-container',
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -44],
    });

    const marker = L.marker([gem.lat, gem.lon], { icon })
      .addTo(markersLayer);

    // Rich popup content
    const scoreClass = gem.gemScore >= 75 ? 'high' : gem.gemScore >= 50 ? 'medium' : 'low';
    const scoreLabel = gem.gemScore >= 75 ? '🔥 Top Gem' : gem.gemScore >= 50 ? '💎 Hidden Gem' : '📍 Worth a Visit';
    const scoreColorMap = { high: '#16a34a', medium: '#d97706', low: '#6b7280' };

    const popupContent = `
      <div class="popup-content">
        <div class="popup-header">
          <span class="popup-emoji">${gem.category.icon}</span>
          <div class="popup-header-text">
            <div class="popup-title">${gem.name}</div>
            <div class="popup-category-badge" style="background: ${color}15; color: ${color};">${gem.category.label}</div>
          </div>
        </div>
        <div class="popup-description">${gem.aiDescription || ''}</div>
        <div class="popup-reason">💎 ${gem.gemReason || ''}</div>
        <div class="popup-footer">
          <span class="popup-time">🕐 ${gem.bestTime || 'Anytime'}</span>
          <span class="popup-score" style="background: ${scoreColorMap[scoreClass]}18; color: ${scoreColorMap[scoreClass]};">${scoreLabel}</span>
        </div>
        ${gem.address ? `<div class="popup-address">📍 ${gem.address}</div>` : ''}
        ${gem.website ? `<a class="popup-link" href="${gem.website}" target="_blank" rel="noopener">🌐 Visit Website</a>` : ''}
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 320,
      minWidth: 240,
      closeButton: true,
      className: 'gem-popup',
    });

    marker.on('click', () => {
      if (onGemClick) onGemClick(gem, index);
    });

    // Add hover bounce effect
    marker.on('mouseover', () => {
      const el = marker.getElement();
      if (el) el.classList.add('gem-marker-hover');
    });
    marker.on('mouseout', () => {
      const el = marker.getElement();
      if (el) el.classList.remove('gem-marker-hover');
    });
  });
}

/**
 * Focus on a specific gem on the map with smooth zoom
 */
export function focusGem(gem) {
  map.flyTo([gem.lat, gem.lon], 16, {
    duration: 1.2,
    easeLinearity: 0.2,
  });

  // Find and open the marker popup
  setTimeout(() => {
    markersLayer.eachLayer((layer) => {
      if (layer.getLatLng) {
        const latlng = layer.getLatLng();
        if (Math.abs(latlng.lat - gem.lat) < 0.0001 && Math.abs(latlng.lng - gem.lon) < 0.0001) {
          layer.openPopup();
        }
      }
    });
  }, 800);
}

/**
 * Fit map bounds to show all gems with smooth animation
 */
export function fitToGems(gems) {
  if (gems.length === 0) return;

  const bounds = L.latLngBounds(gems.map((g) => [g.lat, g.lon]));
  map.flyToBounds(bounds, {
    padding: [60, 60],
    maxZoom: 15,
    duration: 1.5,
  });
}

/**
 * Get the map instance
 */
export function getMap() {
  return map;
}
