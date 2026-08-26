import { getAuth } from 'firebase/auth'
import { firebaseApp } from './firebase'

const API_URL = import.meta.env.VITE_WORKER_URL || ''

const auth = getAuth(firebaseApp)

const inFlightRequests = new Map()

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

      if (!isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      }

      // NOTE: no cache-buster query param here. The worker serves GET /api/products with
      // Cache-Control (max-age=15, s-maxage=30) so the browser + Cloudflare edge cache can
      // absorb polls. A unique `_t` param per request would bypass both and send every poll
      // straight to D1.
      const url = `${API_URL}${path}`

      const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'omit'
      })

      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
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


