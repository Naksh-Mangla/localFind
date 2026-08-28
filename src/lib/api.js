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

export async function apiFetch(path, options = {}) {
  const isGet = !options.method || options.method.toUpperCase() === 'GET'

  // In-flight GET request deduplication: reuse active Promise if identical request is already running
  if (isGet && inFlightRequests.has(path)) {
    return inFlightRequests.get(path)
  }

  const fetchPromise = (async () => {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
      const isFormData = options.body instanceof FormData

      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {})
      }

      // Attach ETag for 304 Not Modified zero-bandwidth validation on GET queries
      if (isGet && !headers['If-None-Match'] && memoryEtagCache.has(path)) {
        headers['If-None-Match'] = memoryEtagCache.get(path)
      }

      if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      }

      const url = `${API_URL}${path}`

      const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'omit'
      })

      // 🏷️ HTTP 304 Not Modified: Return locally cached payload instantly
      if (res.status === 304 && isGet && memoryPayloadCache.has(path)) {
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
            localStorage.setItem('localfind_cached_products', JSON.stringify(body))
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
