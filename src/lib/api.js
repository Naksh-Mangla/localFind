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

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
  return body
}

export async function uploadImage(file) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
  if (!token) throw new Error('Must be logged in to upload an image')

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Upload failed (${res.status})`)
  return body.url
}

