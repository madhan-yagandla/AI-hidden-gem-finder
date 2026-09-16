/**
 * Search Module — handles user input, geocoding, and triggering exploration
 */

import { geocodeLocation, exploreGems } from './api.js';
import { showToast, showLoadingSkeletons, setSearchLoading } from './ui.js';
import { flyTo, addGemMarkers, showSearchArea, fitToGems, clearMarkers } from './map.js';
import { renderResults, setActiveCard } from './results.js';

let selectedInterests = ['nature']; // Default selected interest
let isSearchDebounced = null; // Stored debounced function

/**
 * Debounce utility to prevent rapid API calls
 */
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Initialize search functionality
 */
export function initSearch() {
  const searchBtn = document.getElementById('search-btn');
  const locationInput = document.getElementById('location-input');
  const geolocateBtn = document.getElementById('geolocate-btn');
  const radiusSlider = document.getElementById('radius-slider');
  const radiusValue = document.getElementById('radius-value');

  // Interest chip toggles
  const chips = document.querySelectorAll('#interest-chips .chip');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const interest = chip.dataset.interest;
      chip.classList.toggle('active');

      if (selectedInterests.includes(interest)) {
        selectedInterests = selectedInterests.filter((i) => i !== interest);
      } else {
        selectedInterests.push(interest);
      }
    });
  });

  // Radius slider
  radiusSlider.addEventListener('input', () => {
    radiusValue.textContent = `${radiusSlider.value} km`;
  });

  // Initialise debounced search (800ms)
  isSearchDebounced = debounce((query) => triggerSearch(query), 800);

  // Search button
  searchBtn.addEventListener('click', () => {
    isSearchDebounced(locationInput.value);
  });

  // Enter key on input
  locationInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      isSearchDebounced(locationInput.value);
    }
  });

  // Geolocation button
  geolocateBtn.addEventListener('click', () => {
    useCurrentLocation(locationInput);
  });

  // Mobile toggle
  const mobileToggle = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('sidebar');

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

/**
 * Trigger a search with the given location query
 */
async function triggerSearch(locationQuery) {
  if (!locationQuery.trim()) {
    showToast('Please enter a location to explore', 'warning');
    document.getElementById('location-input').focus();
    return;
  }

  if (selectedInterests.length === 0) {
    showToast('Select at least one interest category', 'warning');
    return;
  }

  const radiusKm = parseInt(document.getElementById('radius-slider').value);
  const radiusMeters = radiusKm * 1000;
  const resultsList = document.getElementById('results-list');

  try {
    setSearchLoading(true);
    showLoadingSkeletons(resultsList, 5);

    // Step 1: Geocode the location
    showToast(`Looking up "${locationQuery}"...`, 'info', 2000);
    const locations = await geocodeLocation(locationQuery);
    const location = locations[0];

    // Step 2: Fly to the location on the map
    flyTo(location.lat, location.lon, getZoomForRadius(radiusKm));
    showSearchArea(location.lat, location.lon, radiusMeters);

    // Step 3: Call backend to explore
    showToast('Discovering hidden gems...', 'info', 3000);
    const data = await exploreGems({
      lat: location.lat,
      lon: location.lon,
      interests: selectedInterests,
      radius: radiusMeters,
    });

    // Step 4: Display results
    if (data.gems && data.gems.length > 0) {
      addGemMarkers(data.gems, handleGemMapClick);
      renderResults(data.gems, handleGemCardClick, handleFavoriteToggle);
      fitToGems(data.gems);
      showToast(`Found ${data.gems.length} hidden gems! ✨`, 'success');

      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
    } else {
      renderResults([], null, null);
      clearMarkers();
      showToast(data.message || 'No hidden gems found in this area', 'info');
    }
  } catch (error) {
    console.error('Search error:', error);
    showToast(error.message || 'Something went wrong. Please try again.', 'error');
    resultsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😕</div>
        <h3>Oops!</h3>
        <p>${error.message || 'Something went wrong. Please try again.'}</p>
      </div>
    `;
  } finally {
    setSearchLoading(false);
  }
}

/**
 * Use the browser's geolocation API
 */
function useCurrentLocation(inputEl) {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'error');
    return;
  }

  showToast('Getting your location...', 'info', 2000);

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;

      // Reverse geocode to get a display name
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`
        );
        const data = await response.json();
        const displayName = data.address?.city || data.address?.town || data.address?.village || data.display_name?.split(',')[0];
        inputEl.value = displayName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      } catch {
        inputEl.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }

      showToast('Location found! Click search to explore.', 'success');
    },
    (error) => {
      const messages = {
        1: 'Location access denied. Please enable location permissions.',
        2: 'Location unavailable. Please try again.',
        3: 'Location request timed out. Please try again.',
      };
      showToast(messages[error.code] || 'Could not get location', 'error');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/**
 * Handle clicking a gem on the map
 */
function handleGemMapClick(gem, index) {
  setActiveCard(index);
}

/**
 * Handle clicking a gem card in the sidebar
 */
import { focusGem } from './map.js';

function handleGemCardClick(gem, index) {
  focusGem(gem);
}

/**
 * Handle favorite toggle
 */
function handleFavoriteToggle(gem, isFavorited) {
  if (isFavorited) {
    showToast(`Saved "${gem.name}" to favorites ❤️`, 'success', 2000);
  }
}

/**
 * Get appropriate zoom level for a radius
 */
function getZoomForRadius(radiusKm) {
  if (radiusKm <= 2) return 15;
  if (radiusKm <= 5) return 13;
  if (radiusKm <= 10) return 12;
  if (radiusKm <= 15) return 11;
  return 10;
}
