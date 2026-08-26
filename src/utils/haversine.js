/**
 * Ultra-Fast Great-Circle Distance Calculator & Formatter
 * Engineered for low-end mobile CPU efficiency (eliminating unnecessary trigonometry).
 */

const DEG_TO_RAD = Math.PI / 180
const EARTH_RADIUS_KM = 6371
const APPROX_KM_PER_LAT_DEG = 111.0 // ~111km per 1 deg latitude
const APPROX_KM_PER_LNG_DEG = 96.0  // ~96km per 1 deg longitude around India (20-30 deg N)

/**
 * Fast Bounding-Box Rejection Check
 * Returns false if points are definitely further apart than maxRadiusKm without computing sin/cos/sqrt.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @param {number} maxRadiusKm
 * @returns {boolean} true if inside candidate bounding box
 */
export function isWithinBoundingBox(lat1, lon1, lat2, lon2, maxRadiusKm) {
  const maxLatDelta = maxRadiusKm / APPROX_KM_PER_LAT_DEG
  if (Math.abs(lat2 - lat1) > maxLatDelta) return false

  const maxLngDelta = maxRadiusKm / APPROX_KM_PER_LNG_DEG
  if (Math.abs(lon2 - lon1) > maxLngDelta) return false

  return true
}

/**
 * Calculates the exact great-circle distance in kilometers using the Haversine formula.
 * @param {number} lat1 Latitude of point 1 in degrees
 * @param {number} lon1 Longitude of point 1 in degrees
 * @param {number} lat2 Latitude of point 2 in degrees
 * @param {number} lon2 Longitude of point 2 in degrees
 * @returns {number|null} Distance in kilometers rounded to 2 decimal places, or null if invalid
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1)
  const nLon1 = Number(lon1)
  const nLat2 = Number(lat2)
  const nLon2 = Number(lon2)

  if (
    !Number.isFinite(nLat1) ||
    !Number.isFinite(nLon1) ||
    !Number.isFinite(nLat2) ||
    !Number.isFinite(nLon2)
  ) {
    return null
  }

  // Fast path: identical points
  if (nLat1 === nLat2 && nLon1 === nLon2) return 0

  const dLat = (nLat2 - nLat1) * DEG_TO_RAD
  const dLon = (nLon2 - nLon1) * DEG_TO_RAD
  const radLat1 = nLat1 * DEG_TO_RAD
  const radLat2 = nLat2 * DEG_TO_RAD

  const sinDLat2 = Math.sin(dLat * 0.5)
  const sinDLon2 = Math.sin(dLon * 0.5)

  const a =
    sinDLat2 * sinDLat2 +
    Math.cos(radLat1) * Math.cos(radLat2) * sinDLon2 * sinDLon2

  // Clamp 'a' to [0, 1] to prevent NaN due to floating point inaccuracies
  const clampedA = a > 1 ? 1 : a < 0 ? 0 : a
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA))

  return EARTH_RADIUS_KM * c
}

/**
 * Formats distance in kilometers into a clean, human-readable string.
 * @param {number|null} km Distance in kilometers
 * @returns {string} e.g. "400m away", "1.2 km away", or "Distance unknown"
 */
export function formatDistance(km) {
  const nKm = Number(km)
  if (km === null || km === undefined || !Number.isFinite(nKm) || nKm < 0) {
    return 'Distance unknown'
  }
  if (nKm < 0.05) {
    return 'Very close (< 50m)'
  }
  if (nKm < 1) {
    const meters = Math.round(nKm * 1000)
    return `${meters}m away`
  }
  return `${nKm.toFixed(1)} km away`
}

