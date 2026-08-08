import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from './hooks/useAuth'
import { apiFetch } from './lib/api'
import { Header } from './components/Header'
import { BuyerDiscover } from './components/BuyerDiscover'
import { ProductDetailModal } from './components/ProductDetailModal'
import { MerchantDashboard } from './components/MerchantDashboard'

export default function App() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [activeView, setActiveView] = useState('discover') // 'discover' | 'merchant'
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Geolocation state
  const [userCoords, setUserCoords] = useState(null)
  const [userLocationName, setUserLocationName] = useState('Detecting Location...')

  // Products state
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Reverse geocode coordinates to human-readable street/neighborhood name
  const fetchAddressName = useCallback(async (lat, lng) => {
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
        setUserLocationName(name)
        return
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err)
    }
    setUserLocationName(`GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`)
  }, [])

  // Detect and continuously track user GPS location in real time with high accuracy
  const detectLocation = useCallback(() => {
    setUserLocationName('Detecting High-Precision GPS...')
    if (!navigator.geolocation) {
      setUserCoords({ lat: 28.6139, lng: 77.2090 })
      setUserLocationName('Connaught Place, Delhi (Default)')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setUserCoords({ lat, lng, accuracy })
        fetchAddressName(lat, lng)
      },
      (err) => {
        console.warn('Geolocation failed or permission denied:', err.message)
        setUserCoords({ lat: 28.6139, lng: 77.2090 })
        setUserLocationName('Connaught Place, Delhi (Default)')
      },
      { timeout: 30000, enableHighAccuracy: true, maximumAge: 0 }
    )
  }, [fetchAddressName])

  // Continuous watchPosition for live satellite lock refinement
  useEffect(() => {
    detectLocation()
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setUserCoords({ lat, lng, accuracy })
        fetchAddressName(lat, lng)
      },
      (err) => console.warn('GPS Watch error:', err.message),
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
    } catch (err) {
      console.error('Failed to fetch products from worker:', err)
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-body-sm">
      {/* Top Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        userLocationName={userLocationName}
        onDetectLocation={detectLocation}
        onOpenSignIn={() => {
          if (!user) {
            signInWithGoogle()
          }
          setActiveView('merchant')
        }}
        onRefreshProducts={fetchProducts}
        refreshing={loadingProducts}
      />

      {/* View Router */}
      <div className="flex-1">
        {activeView === 'discover' ? (
          <BuyerDiscover
            products={products}
            userCoords={userCoords}
            onSelectProduct={(p) => setSelectedProduct(p)}
            loading={loadingProducts}
            onRefreshProducts={fetchProducts}
            refreshing={loadingProducts}
          />
        ) : (
          <MerchantDashboard
            user={user}
            signInWithGoogle={signInWithGoogle}
            signOut={signOut}
            userCoords={userCoords}
          />
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden bg-surface/90 backdrop-blur-md shadow-[0px_-4px_20px_rgba(0,0,0,0.06)] fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-4 pb-4 pt-2 border-t border-surface-variant/40">
        <button
          onClick={() => setActiveView('discover')}
          className={`flex flex-col items-center justify-center px-4 py-1 rounded-full transition-all duration-200 ${
            activeView === 'discover'
              ? 'bg-secondary-container text-on-secondary-container font-bold shadow-sm'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined">explore</span>
          <span className="font-label-caps text-[10px] mt-0.5">Discover</span>
        </button>

        <button
          onClick={() => {
            if (!user) {
              signInWithGoogle()
            }
            setActiveView('merchant')
          }}
          className={`flex flex-col items-center justify-center px-4 py-1 rounded-full transition-all duration-200 ${
            activeView === 'merchant'
              ? 'bg-secondary-container text-on-secondary-container font-bold shadow-sm'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined">storefront</span>
          <span className="font-label-caps text-[10px] mt-0.5">My Shop</span>
        </button>
      </nav>
    </div>
  )
}
