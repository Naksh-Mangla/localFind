import { apiFetch } from '../lib/api'

// Simple YouTube-Studio style event tracking for shopkeepers.
// Logged-in buyers only. Fire-and-forget. Never blocks shopping UI.
// Owner self-views are excluded server-side.

const VALID_TYPES = new Set([
  'impression',
  'detail_open',
  'whatsapp_click',
  'directions_click',
  'share',
  'wishlist',
  'review'
])

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
        shop_id: product.shop_id || null
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
