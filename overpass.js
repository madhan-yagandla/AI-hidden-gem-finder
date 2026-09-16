import fetch from 'node-fetch';

// Map user-friendly interest names to OSM tag queries
const INTEREST_TAG_MAP = {
  nature: [
    'leisure=park',
    'leisure=garden',
    'leisure=nature_reserve',
    'natural=peak',
    'natural=waterfall',
    'natural=cave_entrance',
    'natural=spring',
    'natural=beach',
    'boundary=national_park',
  ],
  food: [
    'amenity=cafe',
    'amenity=restaurant',
    'amenity=fast_food',
    'amenity=ice_cream',
    'amenity=bar',
    'shop=bakery',
    'shop=pastry',
    'shop=tea',
  ],
  art: [
    'tourism=artwork',
    'tourism=gallery',
    'amenity=arts_centre',
    'amenity=theatre',
    'craft=*',
    'shop=art',
  ],
  history: [
    'historic=monument',
    'historic=memorial',
    'historic=ruins',
    'historic=castle',
    'historic=archaeological_site',
    'historic=fort',
    'historic=wayside_shrine',
    'historic=heritage',
  ],
  spiritual: [
    'amenity=place_of_worship',
    'historic=wayside_shrine',
    'building=temple',
    'building=church',
    'building=mosque',
    'building=shrine',
  ],
  culture: [
    'tourism=museum',
    'amenity=library',
    'amenity=community_centre',
    'amenity=marketplace',
    'shop=books',
    'amenity=public_bookcase',
  ],
  viewpoints: [
    'tourism=viewpoint',
    'natural=peak',
    'natural=cliff',
    'man_made=tower',
    'man_made=lighthouse',
  ],
  relaxation: [
    'leisure=park',
    'leisure=garden',
    'amenity=spa',
    'leisure=swimming_pool',
    'natural=hot_spring',
    'tourism=picnic_site',
  ],
};

// Default tags if no interests selected
const DEFAULT_TAGS = [
  'tourism=attraction',
  'tourism=artwork',
  'tourism=viewpoint',
  'historic=monument',
  'historic=memorial',
  'historic=ruins',
  'leisure=park',
  'leisure=garden',
  'amenity=cafe',
  'amenity=arts_centre',
  'natural=peak',
  'natural=waterfall',
];

/**
 * Build an Overpass QL query for the given parameters
 */
function buildOverpassQuery(lat, lon, interests, radius) {
  let tags;

  if (interests && interests.length > 0) {
    // Collect tags for all selected interests, deduplicate
    const tagSet = new Set();
    interests.forEach((interest) => {
      const mappedTags = INTEREST_TAG_MAP[interest.toLowerCase()];
      if (mappedTags) {
        mappedTags.forEach((tag) => tagSet.add(tag));
      }
    });
    tags = tagSet.size > 0 ? [...tagSet] : DEFAULT_TAGS;
  } else {
    tags = DEFAULT_TAGS;
  }

  // Build Overpass union query
  const queryParts = tags.map((tag) => {
    const [key, value] = tag.split('=');
    const valueFilter = value === '*' ? `["${key}"]` : `["${key}"="${value}"]`;
    return `  nwr${valueFilter}(around:${radius},${lat},${lon});`;
  });

  const query = `
[out:json][timeout:15];
(
${queryParts.join('\n')}
);
out center tags 80;
`;

  return query;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Fetch places from OpenStreetMap via Overpass API
 */
export async function searchPlaces(lat, lon, interests, radius = 5000) {
  const query = buildOverpassQuery(lat, lon, interests, radius);
  let lastError;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          console.log(`   ⚠️ Rate limited on ${endpoint}, trying next...`);
          lastError = new Error(`Overpass API error: 429 Too Many Requests`);
          continue;
        }
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

  // Parse and normalize the elements
  const places = data.elements
    .filter((el) => el.tags && el.tags.name)     // Must have a name
    .map((el) => {
      const placeLat = el.lat || el.center?.lat;
      const placeLon = el.lon || el.center?.lon;

      if (!placeLat || !placeLon) return null;

      // Determine the primary category
      const category = detectCategory(el.tags);

      return {
        id: el.id,
        name: el.tags.name,
        lat: placeLat,
        lon: placeLon,
        category,
        tags: el.tags,
        hasWikipedia: !!(el.tags.wikipedia || el.tags.wikidata),
        website: el.tags.website || el.tags['contact:website'] || null,
        phone: el.tags.phone || el.tags['contact:phone'] || null,
        openingHours: el.tags.opening_hours || null,
        address: buildAddress(el.tags),
      };
      })
      .filter(Boolean);

      // Deduplicate by name (same name within 100m)
      return deduplicatePlaces(places);
    } catch (e) {
      lastError = e;
      console.log(`   ⚠️ Failed on ${endpoint}: ${e.message}`);
    }
  }

  throw lastError || new Error('Overpass API failed completely');
}

/**
 * Detect primary category from OSM tags
 */
function detectCategory(tags) {
  if (tags.natural) return { type: 'nature', label: tags.natural.replace(/_/g, ' '), icon: '🏔️' };
  if (tags.historic) return { type: 'history', label: tags.historic.replace(/_/g, ' '), icon: '🏛️' };
  if (tags.tourism === 'viewpoint') return { type: 'viewpoints', label: 'viewpoint', icon: '🌅' };
  if (tags.tourism === 'artwork') return { type: 'art', label: 'artwork', icon: '🎨' };
  if (tags.tourism === 'museum' || tags.tourism === 'gallery') return { type: 'culture', label: tags.tourism, icon: '🎭' };
  if (tags.tourism) return { type: 'culture', label: tags.tourism.replace(/_/g, ' '), icon: '📍' };
  if (tags.amenity === 'cafe' || tags.amenity === 'restaurant' || tags.amenity === 'bar' || tags.amenity === 'ice_cream') return { type: 'food', label: tags.amenity, icon: '🍜' };
  if (tags.amenity === 'place_of_worship' || tags.building === 'temple' || tags.building === 'church') return { type: 'spiritual', label: 'place of worship', icon: '⛪' };
  if (tags.amenity === 'arts_centre' || tags.amenity === 'theatre') return { type: 'art', label: tags.amenity.replace(/_/g, ' '), icon: '🎨' };
  if (tags.leisure === 'park' || tags.leisure === 'garden') return { type: 'relaxation', label: tags.leisure, icon: '🌿' };
  if (tags.leisure) return { type: 'relaxation', label: tags.leisure.replace(/_/g, ' '), icon: '🌿' };
  if (tags.shop) return { type: 'culture', label: `${tags.shop} shop`, icon: '🛍️' };
  if (tags.craft) return { type: 'art', label: tags.craft, icon: '🎨' };

  return { type: 'other', label: 'place', icon: '📍' };
}

/**
 * Build a readable address from OSM tags
 */
function buildAddress(tags) {
  const parts = [];
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (tags['addr:city']) parts.push(tags['addr:city']);
  if (tags['addr:state']) parts.push(tags['addr:state']);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Remove duplicate places (same name within ~200m)
 */
function deduplicatePlaces(places) {
  const seen = new Map();

  return places.filter((place) => {
    const key = place.name.toLowerCase().trim();
    if (seen.has(key)) {
      const existing = seen.get(key);
      const dist = haversineDistance(place.lat, place.lon, existing.lat, existing.lon);
      if (dist < 200) return false;
    }
    seen.set(key, place);
    return true;
  });
}

/**
 * Calculate distance between two points in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
