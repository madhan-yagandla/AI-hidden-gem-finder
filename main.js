/**
 * Hidden Gem Explorer — Main Entry Point
 */

import { initMap, addGemMarkers, flyTo, showSearchArea, fitToGems } from './modules/map.js';
import { initSearch } from './modules/search.js';
import { initChat } from './modules/chat.js';
import { renderResults, setActiveCard } from './modules/results.js';
import { focusGem } from './modules/map.js';
import { showToast } from './modules/ui.js';
import { initLanding } from './modules/landing.js';
import { initRouter } from './modules/router.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('💎 Hidden Gem Explorer — Initializing...');

  // Initialize router
  initRouter();

  // Initialize landing page interactions
  initLanding();

  // Initialize the Leaflet map
  initMap();

  // Initialize search functionality
  initSearch();

  // Initialize chatbot with search integration
  initChat((intent, gems) => {
    // When chat finds gems, show them on the map and sidebar too
    if (gems && gems.length > 0) {
      addGemMarkers(gems, (gem, index) => setActiveCard(index));
      renderResults(gems, (gem) => focusGem(gem), (gem, isFav) => {
        if (isFav) showToast(`Saved "${gem.name}" ❤️`, 'success', 2000);
      });
      fitToGems(gems);
      showToast(`Gem Guide found ${gems.length} places! ✨`, 'success');
    }
  });

  console.log('✅ App ready! Start exploring hidden gems.');
});
