import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useAuth } from './hooks/useAuth'
import { apiFetch } from './lib/api'
import { Header } from './components/Header'
import { BuyerDiscover } from './components/BuyerDiscover'
import { LocationPickerModal } from './components/LocationPickerModal'
import { isDealAlertsEnabled, enableDealAlerts, disableDealAlerts, checkAndNotifyNewDeals } from './utils/notifications'

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
      if (saved) return 'success'
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
      const enabled = await enableDealAlerts()
      setDealAlertsActive(enabled)
    }
  }

  // Products state & sync tracking
  const [products, setProducts] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now())

  // Listen for notification click event to open product detail modal
  useEffect(() => {
    const handleOpenProduct = (e) => {
      const prodId = e.detail?.productId
      if (prodId && products.length > 0) {
        const found = products.find((p) => p.id === prodId)
        if (found) setSelectedProduct(found)
      }
    }
    window.addEventListener('openProductDetail', handleOpenProduct)
    return () => window.removeEventListener('openProductDetail', handleOpenProduct)
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
        
        setUserLocationName(statusPrefix ? `${statusPrefix} - ${name}` : name)
        
        if (shouldSave) {
          let existingData = {}
          try {
            existingData = JSON.parse(localStorage.getItem('localfind_saved_location') || '{}')
          } catch {}
          localStorage.setItem(
            'localfind_saved_location',
            JSON.stringify({
              ...existingData,
              lat,
              lng,
              locationName: name,
              isGPS: true
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
      let existingData = {}
      try {
        existingData = JSON.parse(localStorage.getItem('localfind_saved_location') || '{}')
      } catch {}
      localStorage.setItem(
        'localfind_saved_location',
        JSON.stringify({
          ...existingData,
          lat,
          lng,
          locationName: fallbackName,
          isGPS: true
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
              // Ignore low-accuracy positions if accuracy radius is unrealistically huge (> 50,000 meters / 50 km)
              if (pos.coords.accuracy > 50000) {
                console.warn(`Low-accuracy GPS rejected due to huge accuracy radius: ±${Math.round(pos.coords.accuracy)}m`)
                resolve({ pos: null, mode: null })
              } else {
                resolve({ pos, mode: 'low' })
              }
            },
            () => resolve({ pos: null, mode: null }), // Both failed
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          )
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      )
    })
  }, [])

  // Main location detection — auto-runs on app launch and preserves saved manual location
  const detectLocation = useCallback(async () => {
    const savedLocationStr = localStorage.getItem('localfind_saved_location')
    let parsedSaved = null
    try {
      if (savedLocationStr) parsedSaved = JSON.parse(savedLocationStr)
    } catch {}

    const hasSavedLocation = Boolean(parsedSaved?.lat && parsedSaved?.lng)
    
    if (hasSavedLocation) {
      setUserCoords({ lat: parsedSaved.lat, lng: parsedSaved.lng, accuracy: 10 })
      setUserLocationName(parsedSaved.locationName || parsedSaved.address || 'Saved Location')
      setLocationStatus('success')
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
      
      // True high-accuracy GPS (typically <= 1500m on mobile devices)
      const isAccurateGPS = Number.isFinite(accuracy) && accuracy <= 1500

      // Only switch automatically if accurate GPS is acquired AND user hasn't explicitly locked a manual location
      if (isAccurateGPS && (!hasSavedLocation || parsedSaved?.isGPS)) {
        setUserCoords({ lat, lng, accuracy })
        setLocationStatus('success')
        fetchAddressName(lat, lng, '', true)
        setIsFirstTimeFallback(false)
        setShowLocationPicker(false)
        console.log('✅ Locked high-accuracy live GPS location!')
      } else if (!hasSavedLocation) {
        // First time user with broad IP location: Open manual location modal to get exact pincode/area
        console.warn('Inaccurate/broad IP location (±' + Math.round(accuracy) + 'm). Prompting user for Pincode/Area.')
        setIsFirstTimeFallback(true)
        setShowLocationPicker(true)
        setLocationStatus('approx')
        setUserLocationName('Enter your area')
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

  // Periodic background sync (every 30s) + Instant Sync on tab focus
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProducts(false)
    }, 30000)

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchProducts(false)
      }
    }
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
    const displayName = locationName || address || 'Custom Location'
    setUserCoords(newCoords)
    setUserLocationName(displayName)
    setLocationStatus('success')
    setIsFirstTimeFallback(false)

    // Persist to localStorage for 100% reliability
    try {
      localStorage.setItem(
        'localfind_saved_location',
        JSON.stringify({
          lat,
          lng,
          locationName: displayName,
          pincode,
          address,
          landmark,
          isGPS: false
        })
      )
    } catch (e) {
      console.warn('Could not save location to localStorage', e)
    }
  }, [])

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
          />
        </Suspense>
      )}

      {/* Manual Location Search / Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        currentLocationName={userLocationName}
        onSelectLocation={handleSelectManualLocation}
        onUseGPS={detectLocation}
        locationStatus={locationStatus}
        isFirstTimeFallback={isFirstTimeFallback}
      />

      {/* 🍎 Apple-Style Floating Frosted Glass Dock */}
      <nav className="md:hidden fixed bottom-3 left-6 right-6 z-40 max-w-xs mx-auto bg-surface/85 apple-frosted shadow-crisp-lg border border-surface-variant/40 rounded-full p-1 flex justify-around items-center transition-all duration-300">
        <button
          onClick={() => setActiveView('discover')}
          className={`flex items-center justify-center gap-1.5 py-2 px-5 rounded-full transition-all duration-200 active:scale-95 ${
            activeView === 'discover'
              ? 'bg-primary text-on-primary font-bold shadow-crisp-xs scale-[1.02]'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">explore</span>
          <span className="font-label-caps text-[11px] font-bold">Explore</span>
        </button>

        <button
          onClick={() => setActiveView('merchant')}
          className={`flex items-center justify-center gap-1.5 py-2 px-5 rounded-full transition-all duration-200 active:scale-95 ${
            activeView === 'merchant'
              ? 'bg-primary text-on-primary font-bold shadow-crisp-xs scale-[1.02]'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">storefront</span>
          <span className="font-label-caps text-[11px] font-bold">My Shop</span>
        </button>
      </nav>
    </div>
  )
}
