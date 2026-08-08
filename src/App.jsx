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

  // Detect user GPS location
  const detectLocation = useCallback(() => {
    setUserLocationName('Locating...')
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }
          setUserCoords(coords)
          setUserLocationName('Current GPS Location')
        },
        (err) => {
          console.warn('Geolocation failed/denied, defaulting to NYC/Delhi:', err.message)
          // Default fallback coordinates (e.g. 28.6139, 77.2090)
          setUserCoords({ lat: 28.6139, lng: 77.2090 })
          setUserLocationName('Connaught Place, Delhi')
        },
        { timeout: 8000, enableHighAccuracy: true }
      )
    } else {
      setUserCoords({ lat: 28.6139, lng: 77.2090 })
      setUserLocationName('Connaught Place, Delhi')
    }
  }, [])

  useEffect(() => {
    detectLocation()
  }, [detectLocation])

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
      />

      {/* View Router */}
      <div className="flex-1">
        {activeView === 'discover' ? (
          <BuyerDiscover
            products={products}
            userCoords={userCoords}
            onSelectProduct={(p) => setSelectedProduct(p)}
            loading={loadingProducts}
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
