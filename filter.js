/**
 * Hidden Gem Filtering Engine
 *
 * Scores and ranks places based on how "hidden" they are.
 * Adds travel mode, distance, comfort, and audience recommendations.
 */

/**
 * Filter and score places to identify hidden gems
 * @param {Array} places - Raw places from Overpass API
 * @param {number} searchLat - User's search latitude
 * @param {number} searchLon - User's search longitude
 * @returns {Array} - Filtered and scored hidden gems with travel info
 */
export function filterHiddenGems(places, maxResults = 15, searchLat = null, searchLon = null) {
  const scored = places.map((place) => {
    let score = 50;

    // 1. No Wikipedia = less famous
    if (!place.hasWikipedia) {
      score += 25;
    } else {
      score -= 15;
    }

    // 2. Category uniqueness bonus
    score += getCategoryBonus(place.category.type);

    // 3. Name uniqueness
    if (place.name.length > 20) score += 5;
    if (place.name.length > 35) score += 5;

    // 4. Additional details
    if (place.openingHours) score += 5;
    if (place.website) score += 3;
    if (place.address) score += 3;

    // 5. Penalize generic chains
    const genericPatterns = /\b(mcdonalds|starbucks|subway|kfc|dominos|pizza hut|burger king|dunkin|costa|hotel|inn|lodge|motel)\b/i;
    if (genericPatterns.test(place.name)) {
      score -= 40;
    }

    // 6. Interesting OSM tags
    const interestingTags = ['historic', 'natural', 'artwork_type', 'heritage', 'architect', 'artist_name'];
    interestingTags.forEach((tag) => {
      if (place.tags[tag]) score += 5;
    });

    // 7. Description bonus
    if (place.tags.description) score += 10;

    // 8. Rare tag bonus
    const rareTags = ['cave_entrance', 'waterfall', 'hot_spring', 'ruins', 'archaeological_site', 'artwork', 'viewpoint'];
    if (rareTags.includes(place.tags.natural) || rareTags.includes(place.tags.historic) || rareTags.includes(place.tags.tourism)) {
      score += 15;
    }

    // --- Travel Mode Calculation ---
    let travel = { distance: null, duration: null, mode: 'car', modeIcon: '🚗', modeLabel: 'Drive' };
    if (searchLat !== null && searchLon !== null) {
      const distMeters = haversineDistance(searchLat, searchLon, place.lat, place.lon);
      travel.distance = distMeters;

      if (distMeters < 1500) {
        travel.mode = 'walk';
        travel.modeIcon = '🚶';
        travel.modeLabel = 'Walk';
        travel.duration = Math.round(distMeters / 80); // ~80m/min walking
      } else if (distMeters < 5000) {
        travel.mode = 'bike';
        travel.modeIcon = '🚲';
        travel.modeLabel = 'Bike';
        travel.duration = Math.round(distMeters / 250); // ~250m/min biking
      } else if (distMeters < 15000) {
        travel.mode = 'car';
        travel.modeIcon = '🚗';
        travel.modeLabel = 'Drive';
        travel.duration = Math.round(distMeters / 500); // ~30km/h city driving
      } else {
        travel.mode = 'car';
        travel.modeIcon = '🚗';
        travel.modeLabel = 'Drive';
        travel.duration = Math.round(distMeters / 700); // ~42km/h highway
      }

      travel.distanceFormatted = distMeters < 1000
        ? `${Math.round(distMeters)} m`
        : `${(distMeters / 1000).toFixed(1)} km`;
      travel.durationFormatted = travel.duration < 60
        ? `${travel.duration} min`
        : `${Math.floor(travel.duration / 60)}h ${travel.duration % 60}min`;
    }

    // --- Comfort & Audience ---
    const comfort = getComfortInfo(place);

    return {
      ...place,
      gemScore: Math.max(0, Math.min(100, score)),
      travel,
      comfort,
    };
  });

  return scored
    .sort((a, b) => b.gemScore - a.gemScore)
    .slice(0, maxResults);
}

/**
 * Determine comfort level and audience suitability from category/tags
 */
function getComfortInfo(place) {
  const type = place.category.type;
  const tags = place.tags;

  // Comfort level
  let comfortLevel = 'Moderate';
  let comfortIcon = '😊';
  if (['nature', 'relaxation', 'spiritual', 'viewpoints'].includes(type)) {
    comfortLevel = 'Peaceful';
    comfortIcon = '🧘';
  } else if (['food'].includes(type) && (tags.amenity === 'restaurant' || tags.amenity === 'cafe')) {
    comfortLevel = 'Comfortable';
    comfortIcon = '☕';
  } else if (tags.amenity === 'marketplace' || tags.tourism === 'attraction') {
    comfortLevel = 'Busy';
    comfortIcon = '🏃';
  }

  // Audience
  let audience = 'Everyone';
  let audienceIcon = '👥';
  if (['nature', 'viewpoints'].includes(type)) {
    audience = 'Solo / Couples';
    audienceIcon = '🧑‍🤝‍🧑';
  } else if (['food', 'culture'].includes(type)) {
    audience = 'Friends / Family';
    audienceIcon = '👨‍👩‍👧';
  } else if (['spiritual'].includes(type)) {
    audience = 'Solo / Family';
    audienceIcon = '🙏';
  } else if (['art', 'history'].includes(type)) {
    audience = 'Solo / Friends';
    audienceIcon = '🎒';
  } else if (['relaxation'].includes(type)) {
    audience = 'Couples / Family';
    audienceIcon = '💑';
  }

  return { comfortLevel, comfortIcon, audience, audienceIcon };
}

/**
 * Category bonuses
 */
function getCategoryBonus(categoryType) {
  const bonuses = {
    nature: 10, art: 12, history: 10, viewpoints: 15,
    spiritual: 8, culture: 5, food: -5, relaxation: 8, other: 0,
  };
  return bonuses[categoryType] || 0;
}

/**
 * Haversine distance in meters
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
