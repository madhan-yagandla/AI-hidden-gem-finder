import { categoriesData } from './sampleData.js';

let flatPlaces = [];
let cachedMapInstance = null;

/**
 * Searches the categoriesData architecture for a matching ID.
 */
function findPlaceById(id) {
  if (flatPlaces.length === 0) {
    // build flat cache once
    Object.keys(categoriesData).forEach(cat => {
      categoriesData[cat].forEach(place => {
        flatPlaces.push({...place, category: cat});
      });
    });
  }
  return flatPlaces.find(p => p.id === id);
}

/**
 * Augment a place with generic missing fields conditionally to save redundant JSON data
 */
function enrichPlaceData(place) {
  const isNature = place.category === 'nature';
  const isFood = place.category === 'food';
  const isArt = place.category === 'art';
  
  // Simulate heavy text without huge JSON
  const fakeContent = `Located in the heart of the ${place.location}, this spot offers an incredible experience for those willing to venture off the beaten path. Unlike the typical tourist crowded destinations, "${place.name}" preserves an authentic atmosphere that has delighted locals for decades. 
  
As you explore the area, you'll immediately sense why it has preserved a stellar ${place.rating} rating from our AI Engine. Whether you're coming for the beautiful scenery, the rich history embedded in its foundations, or simply to get away from the noise, this is truly a hidden gem.`;

  // Simulating realistic but slightly randomized coords for each mock location
  // We can seed it using character codes of the ID so it's consistent per place
  const seedLat = 35 + (place.id.charCodeAt(0) + place.id.charCodeAt(1)) % 15;
  const seedLng = -100 + (place.id.charCodeAt(0) * 2) % 30;

  return {
    ...place,
    lat: place.lat || seedLat,
    lng: place.lng || seedLng,
    fullDescription: place.fullDescription || fakeContent,
    highlights: place.highlights || [
      { icon: '🕒', title: 'Best Time to Visit', text: isNature ? 'Early Morning' : 'Late Afternoon' },
      { icon: '💡', title: 'Famous For', text: isFood ? 'Authentic Flavors' : (isArt ? 'Unique Exhibits' : 'Breathtaking Views') },
      { icon: '👥', title: 'Crowd Level', text: 'Low / Peaceful' },
    ],
    gallery: place.gallery || [
      `https://picsum.photos/seed/${place.id}1/400/300`,
      `https://picsum.photos/seed/${place.id}2/400/300`,
      `https://picsum.photos/seed/${place.id}3/400/300`
    ]
  };
}


export function renderPlaceView(placeId) {
  const container = document.getElementById('place-view');
  if (!container) return;
  
  const rawPlace = findPlaceById(placeId);
  if (!rawPlace) {
    container.innerHTML = `<div class="section-container" style="padding-top:100px;">
      <h2>Place not found!</h2>
      <a href="#" class="btn-primary" style="display:inline-block; margin-top:20px;">Return Home</a>
    </div>`;
    return;
  }
  
  const place = enrichPlaceData(rawPlace);
  
  const fallbackImage = `https://picsum.photos/seed/${encodeURIComponent(place.name)}/800/600`;
  
  // Render structure
  container.innerHTML = `
    <!-- Top Hero Banner -->
    <div class="place-hero">
      <img src="${place.imageUrl}" alt="${place.name}" class="place-hero-img" onerror="this.onerror=null;this.src='${fallbackImage}';">
      <div class="place-hero-overlay">
        
        <div class="place-hero-top">
           <a href="#category/${place.category}" class="back-btn" title="Back to Category">←</a>
        </div>
        
        <div class="place-hero-content">
          <div class="place-badge-group">
             <span class="place-category-badge">${place.category}</span>
             <span class="place-hero-rating">⭐ ${place.rating.toFixed(1)} Rating</span>
          </div>
          <h1 class="place-hero-title">${place.name}</h1>
          <div class="place-hero-location">📍 ${place.location}</div>
        </div>
      </div>
    </div>
    
    <!-- Content Layout -->
    <div class="place-details-layout">
      <!-- Left Column -->
      <div class="place-main">
      
        <!-- Overview -->
        <section class="place-section">
          <h2>Overview</h2>
          <div class="place-long-desc">
            <p>${place.description}</p>
            <p>${place.fullDescription}</p>
          </div>
        </section>
        
        <!-- Highlights -->
        <section class="place-section">
          <h2>Highlights</h2>
          <div class="highlights-grid">
            ${place.highlights.map(h => `
              <div class="highlight-item">
                <span class="highlight-icon">${h.icon}</span>
                <div class="highlight-text">
                  <h4>${h.title}</h4>
                  <p>${h.text}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
        
        <!-- Gallery -->
        <section class="place-section">
          <h2>Photo Gallery</h2>
          <div class="place-gallery">
            ${place.gallery.map(imgSrc => `
              <img src="${imgSrc}" loading="lazy" alt="Gallery Photo" onerror="this.onerror=null;this.src='${fallbackImage}';">
            `).join('')}
          </div>
        </section>
        
      </div>
      
      <!-- Right Column Sidebar -->
      <aside class="place-sidebar">
        <!-- Map Embed -->
        <div class="place-map-card">
          <div class="place-map-header">
            <h3 style="font-size: 1.1rem; font-weight: 600;">Location</h3>
          </div>
          <div id="place-dynamic-map" style="width: 100%; height: 300px; background: var(--bg-tertiary); position: relative; z-index: 1;">
            <!-- Rendered by Leaflet -->
          </div>
          <div style="padding: 16px;">
             <a href="https://www.google.com/maps?q=${place.lat},${place.lng}" target="_blank" class="btn-primary w-full" style="display:block; text-align:center; text-decoration:none;">Get Directions</a>
          </div>
        </div>
      </aside>
    </div>
  `;
  
  // Init map safely after DOM flush
  setTimeout(() => {
    initLeafletMap(place.lat, place.lng);
  }, 100);
}

function initLeafletMap(lat, lng) {
  const mapEl = document.getElementById('place-dynamic-map');
  if (!mapEl) return;
  
  // Clean up previous instance if revisiting
  if (cachedMapInstance) {
    cachedMapInstance.remove();
    cachedMapInstance = null;
  }
  
  try {
    cachedMapInstance = L.map('place-dynamic-map').setView([lat, lng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(cachedMapInstance);
    
    L.marker([lat, lng]).addTo(cachedMapInstance);
  } catch (err) {
    console.error("Map failed to load. Showing fallback.", err);
    mapEl.innerHTML = `<img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=400&fit=crop" style="width:100%;height:100%;object-fit:cover;" alt="Map Fallback"/>`;
  }
}
