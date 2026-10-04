import { getAuth } from 'firebase/auth'
import { firebaseApp } from './firebase'

const API_URL = import.meta.env.VITE_WORKER_URL || ''

const auth = getAuth(firebaseApp)

const inFlightRequests = new Map()
const memoryPayloadCache = new Map()
const memoryEtagCache = new Map()

// Initialize product cache from localStorage for instant offline/0ms boot.
// CAUTION: the persisted copy is always "slim" (inline photos stripped,
// marked with _slim) to fit the ~5MB quota. A slim copy must NEVER seed the
// memory cache: a later 304 would serve imageless products and the UI would
// stick on placeholder images.
// Only the live ?limit=100 key is seeded (nothing else reads the cache).
// Saved ETags are deliberately NOT seeded: a stale ETag without its payload
// can never attach (see the If-None-Match guard below), and a pre-update
// 250-row ETag could never 304-match the 100-row page anyway — first fetch
// after upgrade is one plain 200. A legacy full copy (_slim:false, written
// by older builds) still seeds once and is then refreshed normally —
// sliced to the live 100-row page so first paint never shows 250 rows that
// snap down to 100 (plus a late cap notice) seconds later.
try {
  const savedProducts = localStorage.getItem('localfind_cached_products')
  if (savedProducts) {
    const parsed = JSON.parse(savedProducts)
    if (parsed && !parsed._slim) {
      const sliced = Array.isArray(parsed.products) && parsed.products.length > 100
        ? { ...parsed, products: parsed.products.slice(0, 100) }
        : parsed
      memoryPayloadCache.set('/api/products?limit=100', sliced)
    }
  }
} catch {}

try {
  const savedShopsEtag = localStorage.getItem('localfind_cached_shops_etag')
  const savedShops = localStorage.getItem('localfind_cached_shops')
  if (savedShopsEtag) memoryEtagCache.set('/api/shops', savedShopsEtag)
  if (savedShops) {
    const parsedShops = JSON.parse(savedShops)
    if (parsedShops) memoryPayloadCache.set('/api/shops', parsedShops)
  }
} catch {}

// Lossy copy for localStorage: drops inline base64 photos (remote URLs kept).
function slimProductsForStorage(body) {
  if (!Array.isArray(body?.products)) return body
  return {
    ...body,
    _slim: true,
    products: body.products.map((p) =>
      p && typeof p.image_url === 'string' && p.image_url.startsWith('data:image/')
        ? { ...p, image_url: null }
        : p
    )
  }
}

// Persist the catalog: ALWAYS store the slim copy (base64 photos stripped).
// D1-only: full copies with inline data-URL photos (~45-90KB each) exhaust
// the ~5MB localStorage quota after ~50 products and throw on every boot.
// Text + remote URLs are enough for instant boot; photos load from memory
// cache / network. This never throws for photo-heavy catalogs.
function persistProductsCache(body) {
  if (!body) return
  try {
    localStorage.setItem('localfind_cached_products', JSON.stringify(slimProductsForStorage(body)))
  } catch {}
}

// Clear all cached responses in memory and localStorage for instant refresh
export function clearApiCache() {
  memoryPayloadCache.clear()
  memoryEtagCache.clear()
  try {
    localStorage.removeItem('localfind_cached_products_etag')
    localStorage.removeItem('localfind_cached_products')
    localStorage.removeItem('localfind_cached_shops_etag')
    localStorage.removeItem('localfind_cached_shops')
  } catch {}
}

export async function apiFetch(path, options = {}) {
  const isGet = !options.method || options.method.toUpperCase() === 'GET'
  // Delta polls (?since= on the products feed) carry a fresh timestamp per
  // call, so caching them by exact URL would grow memoryEtagCache /
  // memoryPayloadCache forever with never-reused entries. They are tiny
  // anyway — bypass all caches. Scoped to the products feed so a future
  // endpoint with its own `since` param isn't silently uncached.
  const isDeltaPoll = isGet && path.startsWith('/api/products') && path.includes('since=')

  // In-flight GET request deduplication: reuse active Promise if identical request is already running
  if (isGet && !isDeltaPoll && inFlightRequests.has(path) && !options.bustCache) {
    return inFlightRequests.get(path)
  }

  const fetchPromise = (async () => {
    try {
      if (options.bustCache) {
        memoryPayloadCache.delete(path)
        memoryEtagCache.delete(path)
      }

      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
      const adminToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('localfind_admin_token') : null
      const isFormData = options.body instanceof FormData

      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : (adminToken ? { Authorization: `Bearer ${adminToken}` } : {})),
        ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
        ...(options.headers ?? {})
      }

      // Attach ETag for 304 Not Modified zero-bandwidth validation on GET queries
      // (skipped for delta polls — timestamp-unique URLs would never 304-hit).
      // Also skipped when memory holds no usable payload (slim boot cache):
      // a 304 would be unusable and force an immediate retry, costing two
      // round-trips instead of one plain 200.
      if (isGet && !isDeltaPoll && !options.bustCache && !headers['If-None-Match'] && memoryEtagCache.has(path) && memoryPayloadCache.has(path)) {
        headers['If-None-Match'] = memoryEtagCache.get(path)
      }

      if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      }

      const sep = path.includes('?') ? '&' : '?'
      const resolvedPath = options.bustCache ? `${path}${sep}_cb=${Date.now()}` : path
      const url = `${API_URL}${resolvedPath}`

      const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'omit'
      })

      // 🏷️ HTTP 304 Not Modified: Return locally cached payload instantly.
      // If memory holds no full copy (slim boot cache), the 304 is unusable —
      // refetch unconditionally instead of serving imageless products.
      if (res.status === 304 && isGet) {
        if (memoryPayloadCache.has(path)) {
          return memoryPayloadCache.get(path)
        }
        const retryHeaders = { ...headers }
        delete retryHeaders['If-None-Match']
        const retry = await fetch(url, { ...options, headers: retryHeaders, credentials: 'omit' })
        const retryBody = await retry.json().catch(() => null)
        if (!retry.ok) throw new Error(retryBody?.error ?? `Request failed (${retry.status})`)
        if (retryBody) {
          const retryEtag = retry.headers.get('ETag')
          if (retryEtag) {
            memoryEtagCache.set(path, retryEtag)
            if (path === '/api/products' || path === '/api/products?limit=100') {
              try {
                localStorage.setItem('localfind_cached_products_etag', retryEtag)
              } catch {}
            } else if (path === '/api/shops') {
              try {
                localStorage.setItem('localfind_cached_shops_etag', retryEtag)
              } catch {}
            }
          }
          memoryPayloadCache.set(path, retryBody)
          if (path === '/api/products' || path === '/api/products?limit=100') {
            persistProductsCache(retryBody)
          } else if (path === '/api/shops') {
            try {
              localStorage.setItem('localfind_cached_shops', JSON.stringify(retryBody))
            } catch {}
          }
        }
        return retryBody
      }

      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)

      // Save fresh ETag and payload into fast memory & localStorage.
      // Delta polls (?since=) are never cached: timestamp-unique URLs would
      // accumulate forever, and a delta must never overwrite the
      // full-catalog ETag/payload — it is a patch, not the catalog.
      if (isGet && body && !isDeltaPoll) {
        const etag = res.headers.get('ETag')
        if (etag) {
          memoryEtagCache.set(path, etag)
          if (path === '/api/products' || path === '/api/products?limit=100') {
            try {
              localStorage.setItem('localfind_cached_products_etag', etag)
            } catch {}
          } else if (path === '/api/shops') {
            try {
              localStorage.setItem('localfind_cached_shops_etag', etag)
            } catch {}
          }
        }
        memoryPayloadCache.set(path, body)
        if (path === '/api/products' || path === '/api/products?limit=100') {
          persistProductsCache(body)
        } else if (path === '/api/shops') {
          try {
            localStorage.setItem('localfind_cached_shops', JSON.stringify(body))
          } catch {}
        }
      }

      return body
    } finally {
      if (isGet && !isDeltaPoll) {
        // Clear from in-flight cache after short window
        setTimeout(() => inFlightRequests.delete(path), 300)
      }
    }
  })()

  if (isGet && !isDeltaPoll) {
    inFlightRequests.set(path, fetchPromise)
  }

  return fetchPromise
}
