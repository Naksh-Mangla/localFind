import { apiFetch } from '../lib/api'

// Simple YouTube-Studio style event tracking for shopkeepers.
// Logged-in buyers only. Fire-and-forget. Never blocks shopping UI.
// Owner self-views are excluded server-side.

const VALID_TYPES = new Set([
  'impression',
  'detail_open',
  'whatsapp_click',
  'directions_click',
  'call_click',
  'flash_claim',
  'share',
  'wishlist',
  'review'
])

// Buyer pincode from the saved manual location (coarse area only, no GPS
// trail). Absent for GPS-only buyers — those events simply carry no pincode.
function readBuyerPincode() {
  try {
    const saved = JSON.parse(localStorage.getItem('localfind_saved_location') || 'null')
    const pin = String(saved?.pincode || '').replace(/[^0-9]/g, '').slice(0, 6)
    return pin.length === 6 ? pin : null
  } catch {
    return null
  }
}

// Client-side throttle: max 1 identical event per product per 10s (avoids double taps)
const lastSentAt = new Map()

export function trackProductEvent(eventType, product, user) {
  try {
    if (!VALID_TYPES.has(eventType)) return
    if (!user) return // logged-in only (privacy + anti-spam choice)
    if (!product || (!product.id && !product.shop_id)) return
    // Never track the owner's own browsing (extra client guard; server enforces too)
    const uid = user.uid || user.sub
    if (uid && product.owner_id && String(product.owner_id) === String(uid)) return

    const key = `${eventType}:${product.id || product.shop_id}`
    const now = Date.now()
    if (now - (lastSentAt.get(key) || 0) < 10000) return
    lastSentAt.set(key, now)

    apiFetch('/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify({
        event_type: eventType,
        product_id: product.id || null,
        shop_id: product.shop_id || null,
        buyer_pincode: readBuyerPincode()
      })
    }).catch(() => {})
  } catch {}
}

// Search attribution: one debounced call per query with the shop IDs shown.
// Throttled per query text (60s) so typing doesn't spam the endpoint.
const lastSearchSent = new Map()

export function trackSearchView(query, shopIds, user) {
  try {
    if (!user) return
    const q = typeof query === 'string' ? query.trim().toLowerCase().slice(0, 80) : ''
    if (q.length < 2) return
    const ids = [...new Set((shopIds || []).map(String))].slice(0, 5)
    if (ids.length === 0) return
    const now = Date.now()
    if (now - (lastSearchSent.get(q) || 0) < 60000) return
    lastSearchSent.set(q, now)

    apiFetch('/api/analytics/track-search', {
      method: 'POST',
      body: JSON.stringify({
        query: q,
        shop_ids: ids,
        buyer_pincode: readBuyerPincode()
      })
    }).catch(() => {})
  } catch {}
}

export function trackImpression(product, user) {
  trackProductEvent('impression', product, user)
}

export function trackDetailOpen(product, user) {
  trackProductEvent('detail_open', product, user)
}
