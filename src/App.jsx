import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePWAInstall } from './hooks/usePWAInstall'
import { useAdmin } from './hooks/useAdmin'
import { useAndroidBackHandler } from './hooks/useAndroidBackHandler'
import { apiFetch, clearApiCache } from './lib/api'
import { Header } from './components/Header'
import { BuyerDiscover } from './components/BuyerDiscover'
import { LocationPickerModal } from './components/LocationPickerModal'
import { AdminAuthModal } from './components/AdminAuthModal'
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
const AdminDashboard = lazyWithRetry(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })))

export default function App() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const { canInstall, promptInstall } = usePWAInstall()
  const { isAdmin, isUnlocked, loginWithPassword, lockAdmin } = useAdmin(user)
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false)
  // Default to buyer product discover screen (honours PWA shortcut ?view=merchant)
  const [activeView, setActiveView] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('view') === 'merchant') return 'merchant'
    } catch {}
    return 'discover'
  })

  // 📱 Android Back Gesture / Button: Return to 'discover' when in sub-views instead of exiting app.
  // Not armed for the launch view: a deep link like ?view=merchant must keep Back
  // returning to the referrer instead of landing inside the app on discover.
  // Unknown views render the discover fallback, so they never arm the handler.
  const initialViewRef = useRef(activeView)
  const isSubView = activeView === 'merchant' || (activeView === 'admin' && isAdmin)
  useAndroidBackHandler(
    isSubView && activeView !== initialViewRef.current,
    () => setActiveView('discover'),
    'app_view'
  )

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
        const lat = Number(parsed.lat)
        const lng = Number(parsed.lng)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const accuracy = Number.isFinite(Number(parsed.accuracy)) ? Number(parsed.accuracy) : 10
          return { lat, lng, accuracy }
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

  // Monotonic id so slow out-of-order Nominatim replies never overwrite a newer fix
  const geoRequestRef = useRef(0)

  // Reverse geocode coordinates to human-readable street/neighborhood name
  const fetchAddressName = useCallback(async (lat, lng, statusPrefix = '', shouldSave = false, reqId = 0) => {
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
        if (reqId && geoRequestRef.current !== reqId) return
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
    if (reqId && geoRequestRef.current !== reqId) return
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

    const savedLat = Number(parsedSaved?.lat)
    const savedLng = Number(parsedSaved?.lng)
    const hasSavedLocation = Number.isFinite(savedLat) && Number.isFinite(savedLng)
    
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
        fetchAddressName(lat, lng, '', true, ++geoRequestRef.current)
        setIsFirstTimeFallback(false)
        setShowLocationPicker(false)
        console.log('✅ Locked high-accuracy live GPS location!')
      } else if (hasSavedLocation) {
        // Keep the previously saved good fix — a worse approx fix must not
        // overwrite it in memory (storage still holds the good one).
        console.warn(`Ignoring approx fix (±${Math.round(accuracy)}m), keeping saved location.`)
      } else {
        // Approximate Wi-Fi / IP Location (Show AMBER, NOT GREEN)
        console.warn(`Approximate IP/Wi-Fi location (±${Math.round(accuracy)}m). Prompting user for exact area.`)
        setUserCoords({ lat, lng, accuracy })
        setLocationStatus('approx')
        fetchAddressName(lat, lng, 'Approx', false, ++geoRequestRef.current)

        setIsFirstTimeFallback(true)
        setShowLocationPicker(true)
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
      if (isManualRefresh) {
        setIsRefreshing(true)
        clearApiCache()
      }
      const data = await apiFetch('/api/products', isManualRefresh ? { bustCache: true } : {})
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

  // Keep the open product modal fresh across background syncs (price/deal edits)
  useEffect(() => {
    if (!selectedProduct) return
    const fresh = products.find((p) => String(p.id) === String(selectedProduct.id))
    if (fresh && fresh !== selectedProduct) {
      setSelectedProduct(fresh)
    }
  }, [products]) // eslint-disable-line react-hooks/exhaustive-deps

  // Honour PWA shortcut ?view=admin once admin status is confirmed
  useEffect(() => {
    if (!isAdmin) return
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('view') === 'admin') {
        setActiveView('admin')
        params.delete('view')
        const queryString = params.toString() ? `?${params.toString()}` : ''
        window.history.replaceState({}, document.title, window.location.pathname + queryString + window.location.hash)
      }
    } catch {}
  }, [isAdmin])

  // Consume one-time ?view=merchant shortcut param so it doesn't linger in the URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('view') === 'merchant') {
        params.delete('view')
        const queryString = params.toString() ? `?${params.toString()}` : ''
        window.history.replaceState({}, document.title, window.location.pathname + queryString + window.location.hash)
      }
    } catch {}
  }, [])

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

    const handleVisibilityOrFocus = () => {
      // Permission may have been revoked in browser settings while away
      setDealAlertsActive(isDealAlertsEnabled())
      maybeFetch(false)
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
      fetchAddressName(lat, lng, isTrueGPS ? '' : 'Approx', isTrueGPS, ++geoRequestRef.current)
      if (isTrueGPS) {
        setIsFirstTimeFallback(false)
      } else {
        // Approx on a fresh device with nothing saved: send the user back to
        // manual entry instead of stranding them on an amber dot.
        let hasSaved = false
        try {
          const s = JSON.parse(localStorage.getItem('localfind_saved_location') || 'null')
          hasSaved = Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng))
        } catch {}
        if (!hasSaved) {
          setIsFirstTimeFallback(true)
          setShowLocationPicker(true)
        }
      }
    } else {
      setLocationStatus('error')
      setShowLocationPicker(true)
    }
  }, [getGPSPosition, fetchAddressName])

  const handleOpenAdmin = () => {
    if (isUnlocked) {
      setActiveView('admin')
    } else {
      setShowAdminAuthModal(true)
    }
  }

  // Unlock is a two-step sequence because history.back() (modal cleanup) is an
  // async traversal while pushState (view entry) is synchronous: pushing the
  // admin entry in the same commit as the modal close interleaves them and can
  // either leak a stale entry or bounce straight back to discover, depending on
  // task ordering. So: close first, wait for the modal's pop to land (or a
  // timeout fallback), and only then push the admin entry.
  const [pendingAdminView, setPendingAdminView] = useState(false)

  const handleAdminUnlockSuccess = async (email, password) => {
    await loginWithPassword(email, password)
    // (The modal's own onClose() afterwards is a harmless no-op.)
    setShowAdminAuthModal(false)
    setPendingAdminView(true)
  }

  useEffect(() => {
    if (!pendingAdminView || showAdminAuthModal) return
    let settled = false
    const go = () => {
      if (settled) return
      settled = true
      setPendingAdminView(false)
      setActiveView('admin')
    }
    const timer = setTimeout(go, 400)
    const onPop = () => {
      window.removeEventListener('popstate', onPop)
      go()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('popstate', onPop)
    }
  }, [pendingAdminView, showAdminAuthModal])

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-body-sm">
      {/* Top Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        isAdmin={isAdmin}
        onOpenAdmin={handleOpenAdmin}
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
        {activeView === 'admin' ? (
          isUnlocked ? (
            <div className="animate-fadeIn">
              <Suspense
                fallback={
                  <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-10 h-10 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mb-3"></div>
                    <span className="text-xs font-bold text-on-surface-variant">Loading Admin Panel...</span>
                  </div>
                }
              >
                <AdminDashboard
                  onClose={() => {
                    clearApiCache()
                    fetchProducts(true)
                    setActiveView('discover')
                  }}
                  onLock={() => {
                    lockAdmin()
                    clearApiCache()
                    fetchProducts(true)
                    setActiveView('discover')
                  }}
                  onDataChanged={() => {
                    clearApiCache()
                    fetchProducts(true)
                  }}
                />
              </Suspense>
            </div>
          ) : (
            <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xl mb-3">
                🔒
              </div>
              <h3 className="text-base font-bold text-on-surface mb-1">Admin Panel Locked</h3>
              <p className="text-xs text-on-surface-variant mb-4">Please enter your admin credentials to continue.</p>
              <button
                onClick={() => setShowAdminAuthModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all"
              >
                Unlock with Password
              </button>
            </div>
          )
        ) : activeView === 'discover' ? (
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
        ) : activeView === 'merchant' ? (
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
                onSwitchToBuyer={() => setActiveView('discover')}
              />
            </Suspense>
          </div>
        ) : (
          // Unknown view (e.g. stale ?view=admin for non-admins) falls back to discover
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

      {/* Admin Password Gatekeeper Modal */}
      <AdminAuthModal
        isOpen={showAdminAuthModal}
        onClose={() => setShowAdminAuthModal(false)}
        onUnlockSuccess={handleAdminUnlockSuccess}
        initialEmail={user?.email || ''}
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

        {isAdmin && (
          <button
            onClick={() => {
              triggerHaptic('selection')
              handleOpenAdmin()
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-full transition-all duration-200 active:scale-95 text-[11px] font-bold ${
              activeView === 'admin'
                ? 'bg-purple-500 text-white shadow-xs scale-[1.02]'
                : 'text-on-surface-variant/80 hover:text-on-surface hover:bg-surface-variant/30'
            }`}
          >
            <svg className="w-[15px] h-[15px]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
            <span className="tracking-tight">Admin</span>
          </button>
        )}
      </nav>
    </div>
  )
}
