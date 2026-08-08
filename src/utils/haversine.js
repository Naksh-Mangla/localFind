/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 * @param {number} lat1 Latitude of point 1 in degrees
 * @param {number} lon1 Longitude of point 1 in degrees
 * @param {number} lat2 Latitude of point 2 in degrees
 * @param {number} lon2 Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 === undefined || lat1 === null ||
    lon1 === undefined || lon1 === null ||
    lat2 === undefined || lat2 === null ||
    lon2 === undefined || lon2 === null
  ) {
    return null
  }

  const R = 6371 // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees) {
  return (degrees * Math.PI) / 180
}

/**
 * Formats a distance in kilometers into a human-readable string.
 * @param {number|null} km Distance in kilometers
 * @returns {string} e.g. "0.4 km away", "1.2 km away", or "Distance unknown"
 */
export function formatDistance(km) {
  if (km === null || km === undefined || isNaN(km)) {
    return 'Distance unknown'
  }
  if (km < 1) {
    const meters = Math.round(km * 1000)
    return `${meters}m away`
  }
  return `${km.toFixed(1)} km away`
}
