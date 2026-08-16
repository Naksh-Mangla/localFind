import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useAuth } from './hooks/useAuth'
import { apiFetch } from './lib/api'
import { Header } from './components/Header'
import { BuyerDiscover } from './components/BuyerDiscover'

// Performance optimization: Lazy load heavy Seller Dashboard & Modals
const MerchantDashboard = lazy(() => import('./components/MerchantDashboard').then(m => ({ default: m.MerchantDashboard })))
const ProductDetailModal = lazy(() => import('./components/ProductDetailModal').then(m => ({ default: m.ProductDetailModal })))

export default function App() {
  const { user, signInWithGoogle, signOut } = useAuth()
  // Remember active view preference in localStorage so sellers return directly to their dashboard when opening the app
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('localfind_active_view') || 'discover'
  })
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Save active view tab to localStorage when changed
  useEffect(() => {
    localStorage.setItem('localfind_active_view', activeView)
  }, [activeView])

  // Geolocation state
  const [userCoords, setUserCoords] = useState(null)
  const [userLocationName, setUserLocationName] = useState('Detecting Location...')
  const [locationStatus, setLocationStatus] = useState('loading') // 'success' | 'approx' | 'error' | 'loading'

  // Products state & sync tracking
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now())

  // Reverse geocode coordinates to human-readable street/neighborhood name
  const fetchAddressName = useCallback(async (lat, lng, statusPrefix = '') => {
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
        return
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err)
    }
    setUserLocationName(statusPrefix ? `${statusPrefix} - GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})` : `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`)
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
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
          )
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }, [])

  // Main location detection — auto-runs on app launch
  const detectLocation = useCallback(async () => {
    setUserLocationName('📍 Getting your location...')
    setLocationStatus('loading')

    const { pos, mode } = await getGPSPosition()

    if (pos) {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords
      console.log(`📍 GPS locked: ${lat}, ${lng} (±${Math.round(accuracy)}m), mode: ${mode}`)
      setUserCoords({ lat, lng, accuracy })
      
      let statusMsg = ''
      if (mode === 'high' && accuracy <= 100) {
        statusMsg = 'Success'
        setLocationStatus('success')
      } else {
        statusMsg = 'Low accuracy, approximate location'
        setLocationStatus('approx')
      }
      setUserLocationName(statusMsg)
      
      fetchAddressName(lat, lng, statusMsg)
    } else {
      // GPS completely unavailable — show exact failure message requested
      console.error('GPS completely unavailable')
      setUserLocationName("Can't get your location")
      setLocationStatus('error')
    }
  }, [getGPSPosition, fetchAddressName])

  // Auto-detect on app launch + continuous background refinement via watchPosition
  useEffect(() => {
    // Immediately request permission and detect location
    detectLocation()

    if (!navigator.geolocation) return

    // Continuous background refinement — keeps improving accuracy as GPS satellites lock
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        console.log(`📍 GPS refined: ${lat}, ${lng} (±${Math.round(accuracy)}m)`)
        setUserCoords({ lat, lng, accuracy })
        const statusMsg = accuracy <= 100 ? 'Success' : 'Low accuracy, approximate location'
        setLocationStatus(accuracy <= 100 ? 'success' : 'approx')
        fetchAddressName(lat, lng, statusMsg)
      },
      () => {}, // Silently ignore watch errors — initial detectLocation already handled the user-facing error
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [detectLocation, fetchAddressName])

  // Fetch products from Cloudflare Worker
  const fetchProducts = useCallback(async () => {
    try {
      setLoadingProducts(true)
      const data = await apiFetch('/api/products')
      setProducts(data.products || [])
      setLastSyncedAt(Date.now())
    } catch (err) {
      console.error('Failed to fetch products from worker:', err)
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Periodic background sync (every 60s) + Sync on tab visibility focus
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProducts()
    }, 60000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchProducts()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchProducts])

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-body-sm">
      {/* Top Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        userLocationName={userLocationName}
        locationStatus={locationStatus}
        onDetectLocation={detectLocation}
        onOpenSignIn={() => {
          setActiveView('merchant')
        }}
        onRefreshProducts={fetchProducts}
        refreshing={loadingProducts}
        lastSyncedAt={lastSyncedAt}
      />

      {/* View Router with Smooth Transitions */}
      <div className="flex-1 transition-all duration-300">
        {activeView === 'discover' ? (
          <div className="animate-fadeIn">
            <BuyerDiscover
              products={products}
              userCoords={userCoords}
              onSelectProduct={(p) => setSelectedProduct(p)}
              loading={loadingProducts}
              onRefreshProducts={fetchProducts}
              refreshing={loadingProducts}
              lastSyncedAt={lastSyncedAt}
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
                onRefreshProducts={fetchProducts}
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

      {/* Mobile Bottom Navigation Bar - Structured Floating Dock */}
      <nav className="md:hidden bg-surface/95 backdrop-blur-xl shadow-[0px_-4px_24px_rgba(0,0,0,0.08)] fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-6 pb-4 pt-2.5 border-t border-surface-variant/50">
        <button
          onClick={() => setActiveView('discover')}
          className={`flex flex-col items-center justify-center py-1.5 px-6 rounded-2xl transition-all duration-200 active:scale-90 ${
            activeView === 'discover'
              ? 'bg-primary text-on-primary font-bold shadow-sm'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">explore</span>
          <span className="font-label-caps text-[10px] font-bold mt-0.5">Explore</span>
        </button>

        <button
          onClick={() => {
            if (!user) {
              signInWithGoogle()
            }
            setActiveView('merchant')
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-6 rounded-2xl transition-all duration-200 active:scale-90 ${
            activeView === 'merchant'
              ? 'bg-primary text-on-primary font-bold shadow-sm'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">storefront</span>
          <span className="font-label-caps text-[10px] font-bold mt-0.5">My Shop</span>
        </button>
      </nav>
    </div>
  )
}
