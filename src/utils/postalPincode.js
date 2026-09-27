// In-memory cache for fast, instant lookups of Indian Pincodes
const pincodeCache = new Map()

/**
 * Fetch City (District), State, Region, and Areas for an Indian 6-digit PIN code.
 * Uses the free India Postal API (api.postalpincode.in).
 * 
 * @param {string} pincode - 6-digit Indian Postal PIN code
 * @returns {Promise<{
 *   success: boolean,
 *   pincode: string,
 *   city: string,
 *   state: string,
 *   district: string,
 *   areas: string[],
 *   error?: string
 * }>}
 */
export async function lookupPincode(pincode) {
  const cleanPin = (pincode || '').toString().trim().replace(/[^0-9]/g, '')
  if (cleanPin.length !== 6) {
    return { success: false, error: 'Pincode must be 6 digits' }
  }

  // Check cache first for 0ms instant response
  if (pincodeCache.has(cleanPin)) {
    return pincodeCache.get(cleanPin)
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const response = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Postal API responded with status ${response.status}`)
    }

    const data = await response.json()

    if (Array.isArray(data) && data[0]?.Status === 'Success' && Array.isArray(data[0]?.PostOffice) && data[0].PostOffice.length > 0) {
      const postOffices = data[0].PostOffice
      const primary = postOffices[0]
      const district = primary.District || primary.Block || primary.Region || ''
      const state = primary.State || ''
      const city = district || state
      const areas = Array.from(new Set(postOffices.map((po) => po.Name).filter(Boolean)))

      const result = {
        success: true,
        pincode: cleanPin,
        city,
        state,
        district,
        areas,
        formattedLocation: `${city}, ${state}`
      }

      pincodeCache.set(cleanPin, result)
      return result
    }

    return {
      success: false,
      pincode: cleanPin,
      error: 'Pincode not found in Indian Postal Registry'
    }
  } catch (err) {
    console.warn(`Pincode lookup error for ${cleanPin}:`, err)
    return {
      success: false,
      pincode: cleanPin,
      error: err.name === 'AbortError' ? 'Lookup timed out' : 'Network error'
    }
  }
}
