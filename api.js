/**
 * API Client — handles all backend communication
 */

const API_BASE = '/api';

/**
 * Explore for hidden gems
 */
export async function exploreGems({ lat, lon, interests, radius }) {
  const response = await fetch(`${API_BASE}/explore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, interests, radius }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  return response.json();
}

/**
 * Geocode a location name to coordinates using Nominatim
 */
export async function geocodeLocation(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;

  const response = await fetch(url, {
    headers: { 'Accept-Language': 'en' },
  });

  if (!response.ok) {
    throw new Error('Geocoding failed');
  }

  const results = await response.json();

  if (results.length === 0) {
    throw new Error('Location not found. Please try a different search term.');
  }

  return results.map((r) => ({
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    displayName: r.display_name,
    type: r.type,
  }));
}

/**
 * Fetch user favorites from database
 */
export async function fetchFavorites(userId) {
  const response = await fetch(`${API_BASE}/favorites?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('Failed to fetch favorites');
  return response.json();
}

/**
 * Save gem to user favorites in database
 */
export async function addFavorite(userId, gem) {
  const response = await fetch(`${API_BASE}/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, gem }),
  });
  if (!response.ok) throw new Error('Failed to add favorite');
  return response.json();
}

/**
 * Remove gem from user favorites in database
 */
export async function removeFavorite(userId, gemId) {
  const response = await fetch(`${API_BASE}/favorites/${gemId}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to remove favorite');
  return response.json();
}
