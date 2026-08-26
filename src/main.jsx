import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import './index.css'

// ⚡ Auto-recover from stale dynamic chunk imports on new deployments
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite chunk preload error detected. Auto-refreshing to fetch latest version...', event)
  event.preventDefault()
  window.location.reload()
})

// Register Service Worker for offline PWA & Instant Edge Caching in production only
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err)
      })
    })
  } else {
    // In dev mode, unregister old service workers to prevent stale HMR caching conflicts
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => reg.unregister())
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
