import { getAuth } from 'firebase/auth'
import { firebaseApp } from './firebase'

const API_URL = import.meta.env.VITE_WORKER_URL || ''

const auth = getAuth(firebaseApp)

const inFlightRequests = new Map()
const memoryPayloadCache = new Map()
const memoryEtagCache = new Map()

// Initialize product cache from localStorage for instant offline/0ms boot.
// CAUTION: the persisted copy may be "slim" (inline photos stripped, marked
// with _slim) to fit the ~5MB quota. A slim copy must NEVER seed the memory
// cache: a later 304 would serve imageless products and the UI would stick on
// placeholder images. Slim boots force one unconditional fetch instead (below).
try {
  const savedEtag = localStorage.getItem('localfind_cached_products_etag')
  const savedProducts = localStorage.getItem('localfind_cached_products')
  if (savedEtag) memoryEtagCache.set('/api/products', savedEtag)
  if (savedProducts) {
    const parsed = JSON.parse(savedProducts)
    if (parsed && !parsed._slim) memoryPayloadCache.set('/api/products', parsed)
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

// Persist the catalog: prefer the FULL copy (photos included) so later boots
// can serve 304s with images; fall back to the slim copy only on quota errors.
// A single data-URL photo (~200KB) can otherwise exhaust the ~5MB quota and
// silently kill instant boot for photo-heavy catalogs.
function persistProductsCache(body) {
  if (!body) return
  try {
    localStorage.setItem('localfind_cached_products', JSON.stringify({ ...body, _slim: false }))
  } catch {
    try {
      localStorage.setItem('localfind_cached_products', JSON.stringify(slimProductsForStorage(body)))
    } catch {}
  }
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

  // In-flight GET request deduplication: reuse active Promise if identical request is already running
  if (isGet && inFlightRequests.has(path) && !options.bustCache) {
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
      if (isGet && !options.bustCache && !headers['If-None-Match'] && memoryEtagCache.has(path)) {
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
            if (path === '/api/products') {
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
          if (path === '/api/products') {
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

      // Save fresh ETag and payload into fast memory & localStorage
      if (isGet && body) {
        const etag = res.headers.get('ETag')
        if (etag) {
          memoryEtagCache.set(path, etag)
          if (path === '/api/products') {
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
        if (path === '/api/products') {
          persistProductsCache(body)
        } else if (path === '/api/shops') {
          try {
            localStorage.setItem('localfind_cached_shops', JSON.stringify(body))
          } catch {}
        }
      }

      return body
    } finally {
      if (isGet) {
        // Clear from in-flight cache after short window
        setTimeout(() => inFlightRequests.delete(path), 300)
      }
    }
  })()

  if (isGet) {
    inFlightRequests.set(path, fetchPromise)
  }

  return fetchPromise
}
