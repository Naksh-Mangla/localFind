import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePWAInstall } from './hooks/usePWAInstall'
import { apiFetch } from './lib/api'
import { Header } from './components/Header'
import { BuyerDiscover } from './components/BuyerDiscover'
import { LocationPickerModal } from './components/LocationPickerModal'
import { isDealAlertsEnabled, enableDealAlerts, disableDealAlerts, checkAndNotifyNewDeals } from './utils/notifications'
import { triggerHaptic } from './utils/haptics'

// Performance optimization: Robust lazy loader with automatic deployment chunk-stale retry
const lazyWithRetry = (importFn) =>
  lazy(async () => {
    try {
      return await importFn()
    } catch (err) {
      console.warn('Failed to load dynamic chunk (new deployment detected). Auto-reloading...', err)
      const refreshed = sessionStorage.getItem('chunk_retry_refreshed')
      if (!refreshed) {
        sessionStorage.setItem('chunk_retry_refreshed', 'true')
        window.location.reload()
        return new Promise(() => {})
      }
      sessionStorage.removeItem('chunk_retry_refreshed')
      throw err
    }
  })

const MerchantDashboard = lazyWithRetry(() => import('./components/MerchantDashboard').then(m => ({ default: m.MerchantDashboard })))
const ProductDetailModal = lazyWithRetry(() => import('./components/ProductDetailModal').then(m => ({ default: m.ProductDetailModal })))

export default function App() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const { canInstall, promptInstall } = usePWAInstall()
  // Default to buyer product discover screen
  const [activeView, setActiveView] = useState('discover')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [isFirstTimeFallback, setIsFirstTimeFallback] = useState(false)
  const hasAutoDetectedRef = useRef(false)

  // Geolocation state — initialize with saved accurate location if present
  const [userCoords, setUserCoords] = useState(() => {
    try {
      const saved = localStorage.getItem('localfind_saved_location')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.lat && parsed.lng) {
          return { lat: parsed.lat, lng: parsed.lng, accuracy: 10 }
        }
      }
    } catch {}
    return null
  })

  const [userLocationName, setUserLocationName] = useState(() => {
    try {
      const saved = localStorage.getItem('localfind_saved_location')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.locationName) return parsed.locationName
      }
    } catch {}
    return 'Detecting Location...'
  })

  const [locationStatus, setLocationStatus] = useState(() => {
    try {
      const saved = localStorage.getItem('localfind_saved_location')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.isManual || parsed.isGPS === false) return 'manual'
        if (parsed.isGPS) return 'gps'
        return 'manual'
      }
    } catch {}
    return 'loading'
  })

  // 🔔 Local Flash Deal Alerts Notification State
  const [dealAlertsActive, setDealAlertsActive] = useState(() => isDealAlertsEnabled())

  const handleToggleDealAlerts = async () => {
    if (dealAlertsActive) {
      disableDealAlerts()
      setDealAlertsActive(false)
    } else {
      const enabled = await enableDealAlerts(products)
      setDealAlertsActive(enabled)
    }
  }

  // Products state & sync tracking (0ms instant startup from local storage)
  const [products, setProducts] = useState(() => {
    try {
      const cached = localStorage.getItem('localfind_cached_products')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && Array.isArray(parsed.products)) {
          return parsed.products
        }
      }
    } catch {}
    return []
  })
  const [initialLoading, setInitialLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('localfind_cached_products')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && Array.isArray(parsed.products) && parsed.products.length > 0) {
          return false
        }
      }
    } catch {}
    return true
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now())

  // Listen for notification click events across Service Worker messages, custom events, and URL query params
  useEffect(() => {
    // 1. Desktop Notification onclick custom event
    const handleOpenProduct = (e) => {
      const prodId = e.detail?.productId
      if (prodId && products.length > 0) {
        const found = products.find((p) => String(p.id) === String(prodId))
        if (found) {
          setSelectedProduct(found)
          setActiveView('discover')
        }
      }
    }

    // 2. Mobile Service Worker notificationclick postMessage handler
    const handleSWMessage = (e) => {
      if (e.data?.type === 'OPEN_PRODUCT_DETAIL' && e.data?.productId) {
        const prodId = e.data.productId
        if (products.length > 0) {
          const found = products.find((p) => String(p.id) === String(prodId))
          if (found) {
            setSelectedProduct(found)
            setActiveView('discover')
          }
        }
      }
    }

    // 3. Cold launch via notification URL (?product=xyz)
    try {
      const params = new URLSearchParams(window.location.search)
      const urlProdId = params.get('product')
      if (urlProdId && products.length > 0) {
        const found = products.find((p) => String(p.id) === String(urlProdId))
        if (found) {
          setSelectedProduct(found)
          setActiveView('discover')
          // Clean only product param without removing shopId or other params
          const currentParams = new URLSearchParams(window.location.search)
          currentParams.delete('product')
          const queryString = currentParams.toString() ? `?${currentParams.toString()}` : ''
          const cleanUrl = window.location.pathname + queryString + window.location.hash
          window.history.replaceState({}, document.title, cleanUrl)
        }
      }
    } catch {}

    window.addEventListener('openProductDetail', handleOpenProduct)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage)
    }

    return () => {
      window.removeEventListener('openProductDetail', handleOpenProduct)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage)
      }
    }
  }, [products])

  // Reverse geocode coordinates to human-readable street/neighborhood name
  const fetchAddressName = useCallback(async (lat, lng, statusPrefix = '', shouldSave = false) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      )
      if (res.ok) {
        const data = await res.json()
        const addr = data.address || {}
        const name =
          addr.suburb ||
          addr.neighbourhood ||
          addr.residential ||
          addr.road ||
          addr.city_district ||
          addr.city ||
          addr.town ||
          'Live GPS Location'
        
        const displayName = statusPrefix ? `${statusPrefix} - ${name}` : name
        setUserLocationName(displayName)
        
        if (shouldSave) {
          localStorage.setItem(
            'localfind_saved_location',
            JSON.stringify({
              lat,
              lng,
              locationName: displayName,
              isGPS: true,
              isManual: false
            })
          )
        }
        return
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err)
    }
    const fallbackName = `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    setUserLocationName(statusPrefix ? `${statusPrefix} - ${fallbackName}` : fallbackName)
    if (shouldSave) {
      localStorage.setItem(
        'localfind_saved_location',
        JSON.stringify({
          lat,
          lng,
          locationName: fallbackName,
          isGPS: true,
          isManual: false
        })
      )
    }
  }, [])

  // Get GPS position as a Promise — returns position object + mode ('high' | 'low' | null)
  const getGPSPosition = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ pos: null, mode: null })
        return
      }

      // Phase 1: Try HIGH accuracy (real GPS satellite lock)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ pos, mode: 'high' }),
        () => {
          // Phase 2: HIGH accuracy failed → try LOW accuracy (cell tower / Wi-Fi)
          console.warn('High-accuracy GPS failed, trying low-accuracy fallback...')
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (pos.coords.accuracy > 50000) {
                console.warn(`Low-accuracy GPS rejected due to huge accuracy radius: ±${Math.round(pos.coords.accuracy)}m`)
                resolve({ pos: null, mode: null })
              } else {
                resolve({ pos, mode: 'low' })
              }
            },
            () => resolve({ pos: null, mode: null }),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          )
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      )
    })
  }, [])

  // Main location detection — auto-runs on app launch and strictly preserves saved manual location
  const detectLocation = useCallback(async () => {
    const savedLocationStr = localStorage.getItem('localfind_saved_location')
    let parsedSaved = null
    try {
      if (savedLocationStr) parsedSaved = JSON.parse(savedLocationStr)
    } catch {}

    const hasSavedLocation = Boolean(parsedSaved?.lat && parsedSaved?.lng)
    
    // 🔒 Priority 1: User explicitly entered a manual location -> strictly preserve it!
    if (hasSavedLocation && (parsedSaved?.isManual || parsedSaved?.isGPS === false)) {
      setUserCoords({ lat: parsedSaved.lat, lng: parsedSaved.lng, accuracy: parsedSaved.accuracy || 10 })
      setUserLocationName(parsedSaved.locationName || parsedSaved.address || 'Saved Area')
      setLocationStatus('manual')
      setIsFirstTimeFallback(false)
      setShowLocationPicker(false)
      console.log('📍 Preserved user manual location:', parsedSaved.locationName)
      return
    }

    // 🔒 Priority 2: User had saved GPS
    if (hasSavedLocation && parsedSaved?.isGPS) {
      setUserCoords({ lat: parsedSaved.lat, lng: parsedSaved.lng, accuracy: parsedSaved.accuracy || 10 })
      setUserLocationName(parsedSaved.locationName || 'GPS Location')
      setLocationStatus('gps')
      setIsFirstTimeFallback(false)
      setShowLocationPicker(false)
    } else {
      setUserLocationName('📍 Getting your location...')
      setLocationStatus('loading')
    }

    const { pos, mode } = await getGPSPosition()

    if (pos) {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords
      console.log(`📍 Location retrieved: ${lat}, ${lng} (±${Math.round(accuracy)}m), mode: ${mode}`)
      
      // True high-accuracy physical device GPS (satellite lock <= 250m on high accuracy)
      const isTrueGPS = Number.isFinite(accuracy) && accuracy <= 250 && mode === 'high'

      if (isTrueGPS) {
        setUserCoords({ lat, lng, accuracy })
        setLocationStatus('gps')
        fetchAddressName(lat, lng, '', true)
        setIsFirstTimeFallback(false)
        setShowLocationPicker(false)
        console.log('✅ Locked high-accuracy live GPS location!')
      } else {
        // Approximate Wi-Fi / IP Location (Show AMBER, NOT GREEN)
        console.warn(`Approximate IP/Wi-Fi location (±${Math.round(accuracy)}m). Prompting user for exact area.`)
        setUserCoords({ lat, lng, accuracy })
        setLocationStatus('approx')
        fetchAddressName(lat, lng, 'Approx', false)

        if (!hasSavedLocation) {
          setIsFirstTimeFallback(true)
          setShowLocationPicker(true)
        }
      }
    } else {
      // GPS completely unavailable / denied
      if (!hasSavedLocation) {
        console.warn('GPS unavailable on first visit, requesting manual location entry')
        setIsFirstTimeFallback(true)
        setShowLocationPicker(true)
        setLocationStatus('error')
        setUserLocationName('Enter your area')
      }
    }
  }, [getGPSPosition, fetchAddressName])

  // Auto-detect on app launch (once only)
  useEffect(() => {
    if (hasAutoDetectedRef.current) return
    hasAutoDetectedRef.current = true
    detectLocation()
  }, [detectLocation])

  // Fetch products from Cloudflare Worker (Silent background updates without unmounting UI)
  const fetchProducts = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true)
      const data = await apiFetch('/api/products')
      if (data && Array.isArray(data.products)) {
        setProducts(data.products)
        checkAndNotifyNewDeals(data.products, userCoords)
      }
      setLastSyncedAt(Date.now())
    } catch (err) {
      console.error('Failed to fetch products from worker:', err)
    } finally {
      setInitialLoading(false)
      setIsRefreshing(false)
    }
  }, [userCoords])

  useEffect(() => {
    fetchProducts(false)
  }, [fetchProducts])

  // Periodic background sync (every 60s) + Instant Sync on tab focus with Smart Visibility Pause
  useEffect(() => {
    let lastAutoSync = 0

    const maybeFetch = (isPolling = false) => {
      // ⏸️ Smart Tab Polling: Skip all network work while the tab/phone screen is hidden or locked
      if (document.visibilityState !== 'visible') return
      // Throttle: avoid double-fetch when visibilitychange + focus fire together
      const now = Date.now()
      if (now - lastAutoSync < (isPolling ? 50000 : 10000)) return
      lastAutoSync = now
      fetchProducts(false)
    }

    const interval = setInterval(() => maybeFetch(true), 60000)

    const handleVisibilityOrFocus = () => maybeFetch(false)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
    }
  }, [fetchProducts])

  // Handle manual location selection from LocationPickerModal
  const handleSelectManualLocation = useCallback(({ lat, lng, accuracy, locationName, pincode, address, landmark }) => {
    const newCoords = { lat, lng, accuracy: accuracy || 10 }
    const displayName = locationName || address || 'Custom Area'
    setUserCoords(newCoords)
    setUserLocationName(displayName)
    setLocationStatus('manual')
    setIsFirstTimeFallback(false)
    setShowLocationPicker(false)

    // Persist to localStorage for 100% reliability
    try {
      localStorage.setItem(
        'localfind_saved_location',
        JSON.stringify({
          lat,
          lng,
          accuracy: 10,
          locationName: displayName,
          pincode,
          address,
          landmark,
          isGPS: false,
          isManual: true
        })
      )
    } catch (e) {
      console.warn('Could not save location to localStorage', e)
    }
  }, [])

  // Explicit user action to override manual location with live device GPS
  const handleForceLiveGPS = useCallback(async () => {
    setUserLocationName('📍 Acquiring live GPS...')
    setLocationStatus('loading')
    setShowLocationPicker(false)

    const { pos, mode } = await getGPSPosition()
    if (pos) {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords
      const isTrueGPS = Number.isFinite(accuracy) && accuracy <= 250 && mode === 'high'
      setUserCoords({ lat, lng, accuracy })
      setLocationStatus(isTrueGPS ? 'gps' : 'approx')
      fetchAddressName(lat, lng, isTrueGPS ? '' : 'Approx', isTrueGPS)
      if (isTrueGPS) {
        setIsFirstTimeFallback(false)
      }
    } else {
      setLocationStatus('error')
      setShowLocationPicker(true)
    }
  }, [getGPSPosition, fetchAddressName])

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-body-sm">
      {/* Top Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        userLocationName={userLocationName}
        locationStatus={locationStatus}
        onDetectLocation={() => setShowLocationPicker(true)}
        onOpenSignIn={() => {
          setActiveView('merchant')
        }}
        onRefreshProducts={() => fetchProducts(true)}
        refreshing={isRefreshing}
        lastSyncedAt={lastSyncedAt}
        dealAlertsActive={dealAlertsActive}
        onToggleDealAlerts={handleToggleDealAlerts}
        canInstall={canInstall}
        onInstall={promptInstall}
      />

      {/* View Router with Smooth Transitions */}
      <div className="flex-1 transition-all duration-300">
        {activeView === 'discover' ? (
          <div className="animate-fadeIn">
            <BuyerDiscover
              products={products}
              userCoords={userCoords}
              currentUser={user}
              onSelectProduct={(p) => setSelectedProduct(p)}
              loading={initialLoading && products.length === 0}
              onRefreshProducts={() => fetchProducts(true)}
              refreshing={isRefreshing}
              lastSyncedAt={lastSyncedAt}
              onChangeLocation={() => setShowLocationPicker(true)}
              locationStatus={locationStatus}
              dealAlertsActive={dealAlertsActive}
              onToggleDealAlerts={handleToggleDealAlerts}
            />
          </div>
        ) : (
          <div className="animate-fadeIn">
            <Suspense
              fallback={
                <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3"></div>
                  <span className="text-xs font-bold text-on-surface-variant">Opening Shop Dashboard...</span>
                </div>
              }
            >
              <MerchantDashboard
                user={user}
                signInWithGoogle={signInWithGoogle}
                signOut={signOut}
                userCoords={userCoords}
                onRefreshProducts={() => fetchProducts(true)}
                lastSyncedAt={lastSyncedAt}
              />
            </Suspense>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <Suspense fallback={null}>
          <ProductDetailModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onReviewSubmitted={() => fetchProducts(false)}
          />
        </Suspense>
      )}

      {/* Manual Location Search / Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        currentLocationName={userLocationName}
        onSelectLocation={handleSelectManualLocation}
        onUseGPS={handleForceLiveGPS}
        locationStatus={locationStatus}
        isFirstTimeFallback={isFirstTimeFallback}
      />

      {/* 🍎 Ultra-Sleek Floating Pill Dock for Mobile & Android */}
      <nav className="md:hidden fixed bottom-2.5 left-1/2 -translate-x-1/2 z-40 bg-surface/90 dark:bg-zinc-900/90 apple-frosted shadow-[0_6px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] border border-surface-variant/50 rounded-full p-1 inline-flex items-center gap-1 transition-all duration-300 mb-[env(safe-area-inset-bottom,0px)]">
        <button
          onClick={() => {
            triggerHaptic('selection')
            setActiveView('discover')
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-full transition-all duration-200 active:scale-95 text-[11px] font-bold ${
            activeView === 'discover'
              ? 'bg-primary text-white shadow-xs scale-[1.02]'
              : 'text-on-surface-variant/80 hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">explore</span>
          <span className="tracking-tight">Explore</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('selection')
            setActiveView('merchant')
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-full transition-all duration-200 active:scale-95 text-[11px] font-bold ${
            activeView === 'merchant'
              ? 'bg-primary text-white shadow-xs scale-[1.02]'
              : 'text-on-surface-variant/80 hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">storefront</span>
          <span className="tracking-tight">My Shop</span>
        </button>
      </nav>
    </div>
  )
}
