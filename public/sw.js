// LocalFind High-Performance Offline Service Worker
const CACHE_NAME = 'localfind-v2.3.0'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/badge-96.png',
  '/manifest.json'
]

// Install event - precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    }).then(() => self.skipWaiting())
  )
})

// Activate event - cleanup stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event - Cache strategy by resource type:
//  - Navigations (HTML): network-first, cache fallback (stays fresh across deployments)
//  - Same-origin static assets + webfonts: cache-first (hashed/immutable content)
//  - /api/* and other cross-origin requests: network only (the worker sends its own
//    Cache-Control headers; caching polled API data or unbounded geocode/image URLs here
//    made the Cache Storage grow forever and served stale data offline).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Ignore non-GET and chrome-extension / non-http requests
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) return

  // Never intercept API traffic — let the browser HTTP cache + CDN edge handle freshness
  if (url.pathname.startsWith('/api/')) return

  const isWebfont =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'

  const isSameOriginStatic =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      /\.(?:svg|png|jpg|jpeg|webp|gif|ico|json|txt|xml)$/.test(url.pathname))

  if (!isWebfont && !isSameOriginStatic) {
    if (event.request.mode === 'navigate') {
      // Network-first for page navigations with offline fallback to the cached shell
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
            }
            return response
          })
          .catch(async () => (await caches.match('/index.html')) || (await caches.match('/')) || new Response(null, { status: 503, statusText: 'Offline' }))
      )
    }
    return
  }

  // Cache-first for immutable static assets & fonts
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => cached || new Response('', { status: 404, statusText: 'Not Found' }))
    })
  )
})

// Android Push & Local Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const productId = event.notification.data?.productId

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if (productId) {
            client.postMessage({ type: 'OPEN_PRODUCT_DETAIL', productId })
          }
          return
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(productId ? `/?product=${productId}` : '/')
      }
    })
  )
})

