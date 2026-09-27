import { getAuth } from 'firebase/auth'
import { firebaseApp } from './firebase'

const API_URL = import.meta.env.VITE_WORKER_URL || ''

const auth = getAuth(firebaseApp)

const inFlightRequests = new Map()
const memoryPayloadCache = new Map()
const memoryEtagCache = new Map()

// Initialize product cache from localStorage for instant offline/0ms boot
try {
  const savedEtag = localStorage.getItem('localfind_cached_products_etag')
  const savedProducts = localStorage.getItem('localfind_cached_products')
  if (savedEtag) memoryEtagCache.set('/api/products', savedEtag)
  if (savedProducts) memoryPayloadCache.set('/api/products', JSON.parse(savedProducts))
} catch {}

// Clear all cached responses in memory and localStorage for instant refresh
export function clearApiCache() {
  memoryPayloadCache.clear()
  memoryEtagCache.clear()
  try {
    localStorage.removeItem('localfind_cached_products_etag')
    localStorage.removeItem('localfind_cached_products')
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

      // 🏷️ HTTP 304 Not Modified: Return locally cached payload instantly
      if (res.status === 304 && isGet && !options.bustCache && memoryPayloadCache.has(path)) {
        return memoryPayloadCache.get(path)
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
          }
        }
        memoryPayloadCache.set(path, body)
        if (path === '/api/products') {
          try {
            // Strip inline base64 photos before persisting: a single data-URL image
            // (~200KB) can exhaust the ~5MB localStorage quota and silently kill
            // instant boot for photo-heavy catalogs. Remote http(s) URLs are tiny
            // and safe to keep; data URLs re-download on next fetch anyway.
            const slim = Array.isArray(body?.products)
              ? {
                  ...body,
                  products: body.products.map((p) =>
                    p && typeof p.image_url === 'string' && p.image_url.startsWith('data:image/')
                      ? { ...p, image_url: null }
                      : p
                  )
                }
              : body
            localStorage.setItem('localfind_cached_products', JSON.stringify(slim))
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
