import { getAuth } from 'firebase/auth'
import { firebaseApp } from './firebase'

const API_URL = import.meta.env.VITE_WORKER_URL || ''

const auth = getAuth(firebaseApp)

export async function apiFetch(path, options = {}) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null

  const isFormData = options.body instanceof FormData

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {})
  }

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  // Avoid stale browser cache on GET requests
  const url = options.method && options.method !== 'GET' 
    ? `${API_URL}${path}`
    : `${API_URL}${path}${path.includes('?') ? '&' : '?'}_t=${Date.now()}`

  const res = await fetch(url, {
    ...options,
    headers
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
  return body
}

