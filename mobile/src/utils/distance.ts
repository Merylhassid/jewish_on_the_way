/**
 * Calculate distance between two coordinates using the Haversine formula
 * @param lat1 - User latitude
 * @param lon1 - User longitude
 * @param lat2 - Synagogue latitude
 * @param lon2 - Synagogue longitude
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance in a user-friendly way
 * @param meters - Distance in meters
 * @returns Formatted distance string (e.g., "1.4 km" or "250 m")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Extract latitude and longitude from synagogue location object
 * @param location - Location object from backend (PostGIS Point as GeoJSON)
 * @returns Tuple of [latitude, longitude] or null if invalid
 */
export function extractCoordinates(
  location: any
): [number, number] | null {
  if (!location) return null;

  // Handle GeoJSON format: { type: 'Point', coordinates: [lon, lat] }
  if (location.type === 'Point' && Array.isArray(location.coordinates)) {
    const [lon, lat] = location.coordinates;
    if (typeof lon === 'number' && typeof lat === 'number') {
      return [lat, lon];
    }
  }

  // Handle direct array format: [lon, lat]
  if (Array.isArray(location) && location.length === 2) {
    const [lon, lat] = location;
    if (typeof lon === 'number' && typeof lat === 'number') {
      return [lat, lon];
    }
  }

  return null;
}
