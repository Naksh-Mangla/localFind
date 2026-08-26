import React, { useState, useMemo, useEffect, useRef, useDeferredValue, useCallback } from 'react'
import { calculateDistanceKm, formatDistance } from '../utils/haversine'
import { getRAGStatus } from '../utils/syncRAG'
import { getStoreOpenStatus } from '../utils/storeHours'
import {
  parseQueryDescriptor,
  matchesQueryDescriptor,
  indexProductsList,
  searchLRUCache
} from '../utils/hinglishSearch'
import { getFlashDealInfo } from '../utils/flashDeals'

const CATEGORIES = [
  { label: 'All', icon: 'interests' },
  { label: 'Handmade', icon: 'handyman' },
  { label: 'Groceries', icon: 'local_cafe' },
  { label: 'Fashion', icon: 'checkroom' },
  { label: 'Electronics', icon: 'devices' },
  { label: 'Sale', icon: 'sell' }
]

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'

// ⚡ Isolated Live Flash Deal Countdown Badge (Updates only itself, 0 parent re-renders)
const FlashCountdownBadge = React.memo(function FlashCountdownBadge({ deal }) {
  const [info, setInfo] = useState(() => getFlashDealInfo(deal))

  useEffect(() => {
    if (!deal.is_flash_deal || !deal.flash_deal_ends_at) return
    const interval = setInterval(() => {
      setInfo(getFlashDealInfo(deal))
    }, 1000)
    return () => clearInterval(interval)
  }, [deal])

  if (!info.isLive) return null

  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/20">
      <span className="material-symbols-outlined text-[10px] animate-spin">timer</span>
      <span className="truncate max-w-[65px]">{info.countdownText}</span>
    </span>
  )
})

// 🏪 Isolated Store Opening Status Badge
const StoreStatusBadge = React.memo(function StoreStatusBadge({ openingTime, closingTime }) {
  const openStatus = getStoreOpenStatus(openingTime, closingTime)
  return (
    <span
      title={openStatus.detail}
      className={`flex-shrink-0 text-[8px] sm:text-[9px] font-bold px-1.5 py-0.2 rounded-full border flex items-center gap-0.5 sm:gap-1 ${openStatus.badgeClass}`}
    >
      <span className={`w-1 h-1 rounded-full ${openStatus.dotClass}`}></span>
      <span className="truncate max-w-[48px] sm:max-w-none">{openStatus.label}</span>
    </span>
  )
})

// 🍎 Apple Museum Gallery Style Product Card with 60+ FPS Virtual Containment
const ProductCard = React.memo(function ProductCard({
  product,
  onSelectProduct,
  isWishlisted,
  onToggleWishlist,
  priority = false,
  isDistant = false
}) {
  const flashInfo = getFlashDealInfo(product)
  const itemRAG = getRAGStatus(product.updated_at || product.created_at)

  return (
    <div
      onClick={() => onSelectProduct(product)}
      className={`product-card-contain bg-surface-container-lowest rounded-3xl shadow-crisp-xs hover:apple-product-shadow overflow-hidden border flex flex-col group cursor-pointer transition-all duration-300 touch-press ${
        isDistant 
          ? 'border-amber-500/30 hover:border-amber-500/60' 
          : 'border-surface-variant/40 hover:border-primary/40'
      }`}
    >
      <div className="relative w-full aspect-square overflow-hidden bg-surface-variant/40">
        <img
          src={product.image_url || DEFAULT_IMG}
          alt={product.name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={(e) => {
            e.target.onerror = null
            e.target.src = DEFAULT_IMG
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Apple Translucent Capsule Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none gap-1">
          {flashInfo.isLive ? (
            <span className="bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 text-white px-3 py-1 rounded-full text-[9px] font-black shadow-crisp-xs flex items-center gap-1 pointer-events-auto animate-softGaze">
              <span className="text-[10px]">⚡</span>
              <span>{flashInfo.discountPercent}% OFF</span>
            </span>
          ) : (
            <span className="bg-surface/80 apple-frosted px-3 py-1 rounded-full text-[9px] font-bold shadow-crisp-xs border border-surface-variant/30 flex items-center gap-1 pointer-events-auto">
              <span className={`w-1.5 h-1.5 rounded-full ${itemRAG.dotClass}`}></span>
              <span className={itemRAG.textClass}>{itemRAG.label}</span>
            </span>
          )}

          <div className="flex items-center gap-1.5 ml-auto pointer-events-auto">
            {product.distanceKm !== null && (
              <span
                className={`apple-frosted px-2.5 py-1 rounded-full text-[9px] font-bold shadow-crisp-xs border flex items-center gap-0.5 ${
                  isDistant
                    ? 'bg-amber-600/90 text-white border-amber-600/60'
                    : 'bg-surface/80 text-on-surface border-surface-variant/40'
                }`}
              >
                <span className={`material-symbols-outlined text-[12px] ${isDistant ? '' : 'text-primary'}`}>
                  directions_walk
                </span>
                <span>{formatDistance(product.distanceKm)}</span>
              </span>
            )}

            {/* Apple Circular Action Chip */}
            <button
              onClick={(e) => onToggleWishlist(product.id, e)}
              title={isWishlisted ? 'Remove from Saved Wishlist' : 'Save to Wishlist'}
              className={`w-7 h-7 rounded-full flex items-center justify-center shadow-crisp-xs transition-all active:scale-75 ${
                isWishlisted
                  ? 'bg-rose-500 text-white shadow-rose-500/25 ring-2 ring-rose-500/20'
                  : 'bg-surface/80 apple-frosted text-on-surface-variant hover:text-rose-500 border border-surface-variant/40 hover:bg-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[15px] transition-transform ${isWishlisted ? 'fill-current animate-heartBeat' : ''}`}>
                favorite
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-title-md text-sm sm:text-base font-bold text-on-surface line-clamp-1 group-hover:text-primary transition-colors tracking-tight">
            {product.name}
          </h3>
        </div>

        <div className="flex items-center justify-between gap-1 mb-3">
          <p className="font-body-sm text-[11px] sm:text-xs text-on-surface-variant line-clamp-1 flex-1">
            {product.shop_name}
          </p>
          <StoreStatusBadge openingTime={product.opening_time} closingTime={product.closing_time} />
        </div>

        <div className="mt-auto flex items-end justify-between pt-2 border-t border-surface-variant/25">
          <div>
            {flashInfo.isLive ? (
              <div className="flex flex-col">
                <FlashCountdownBadge deal={product} />
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-headline-lg-mobile text-base sm:text-lg md:text-xl font-bold text-rose-600">
                    ₹{flashInfo.discountedPrice}
                  </span>
                  <span className="text-xs text-on-surface-variant line-through opacity-70 font-medium">
                    ₹{flashInfo.originalPrice}
                  </span>
                </div>
              </div>
            ) : (
              <span className="font-headline-lg-mobile text-base sm:text-lg md:text-xl font-black text-primary">
                ₹{product.price}
              </span>
            )}
          </div>

          {/* Apple Signature Pill CTA */}
          <button
            className={`px-4 py-1.5 rounded-full font-label-caps text-xs font-bold transition-all shadow-crisp-xs flex items-center gap-1 active:scale-95 ${
              isDistant
                ? 'bg-surface-container-high hover:bg-surface-variant text-on-surface border border-surface-variant'
                : 'bg-primary hover:bg-primary/90 text-on-primary shadow-sm hover:shadow-primary/20'
            }`}
          >
            <span className="hidden sm:inline">Details</span>
            <span className="sm:hidden">View</span>
            <span className="material-symbols-outlined text-[14px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
})

export function BuyerDiscover({
  products = [],
  userCoords,
  onSelectProduct,
  loading,
  onRefreshProducts,
  refreshing,
  lastSyncedAt,
  onChangeLocation,
  locationStatus
}) {
  const [searchQuery, setSearchQuery] = useState('')
  // ⚡ Non-blocking deferred search query for 60+ FPS responsive typing on 1.6 GHz processors
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const [selectedCategory, setSelectedCategory] = useState('All')
  const [maxRadiusKm, setMaxRadiusKm] = useState(2) // Default to 2km Hyperlocal radius
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false)
  const [showOnlyWishlist, setShowOnlyWishlist] = useState(false)
  const dropdownRef = useRef(null)

  // Wishlist state
  const [wishlistIds, setWishlistIds] = useState(() => {
    try {
      const saved = localStorage.getItem('localfind_wishlist')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Quick set for O(1) wishlist membership check
  const wishlistSet = useMemo(() => new Set(wishlistIds), [wishlistIds])

  const toggleWishlist = useCallback((productId, e) => {
    if (e) e.stopPropagation()
    setWishlistIds((prev) => {
      const isSaved = prev.includes(productId)
      const next = isSaved ? prev.filter((id) => id !== productId) : [...prev, productId]
      try {
        localStorage.setItem('localfind_wishlist', JSON.stringify(next))
        window.dispatchEvent(new Event('storage'))
      } catch (err) {
        console.warn('Could not save wishlist to localStorage', err)
      }
      return next
    })
  }, [])

  // Sync wishlist across tabs/windows
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('localfind_wishlist')
        if (saved) setWishlistIds(JSON.parse(saved))
      } catch (err) {
        console.warn('Failed to parse wishlist from storage event', err)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowFiltersDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Voice Search Web Speech API
  const [isListening, setIsListening] = useState(false)
  const [speechLanguage, setSpeechLanguage] = useState('hi-IN')
  const [voiceToast, setVoiceToast] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = speechLanguage

      recognition.onstart = () => {
        setIsListening(true)
        setVoiceToast(
          speechLanguage === 'hi-IN'
            ? 'सुन रहे हैं... बोलिए (Listening in Hindi/Hinglish)'
            : 'Listening... Speak now'
        )
      }

      recognition.onresult = (event) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        if (transcript) {
          setSearchQuery(transcript)
          setVoiceToast(`" ${transcript} "`)
        }
      }

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error)
        setIsListening(false)
        if (event.error === 'not-allowed') {
          setVoiceToast('Microphone access denied. Please allow mic permission.')
        } else {
          setVoiceToast('Could not hear clearly. Please tap mic again.')
        }
        setTimeout(() => setVoiceToast(''), 4000)
      }

      recognition.onend = () => {
        setIsListening(false)
        setTimeout(() => setVoiceToast(''), 2500)
      }

      recognitionRef.current = recognition

      return () => {
        try {
          recognition.abort()
        } catch (_) {}
      }
    }
  }, [speechLanguage])

  const toggleVoiceSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice Search is not supported on this browser. Please use Chrome, Edge, or Safari.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.lang = speechLanguage
          recognitionRef.current.start()
        }
      } catch (err) {
        console.warn('Recognition start error:', err)
      }
    }
  }, [isListening, speechLanguage])

  // 1. Pre-index products once on data change & attach distance in O(N)
  const indexedProductsWithDistance = useMemo(() => {
    searchLRUCache.clear() // Invalidate LRU query cache when product list updates
    const indexed = indexProductsList(products)

    return indexed.map((prod) => {
      let distanceKm = null
      if (userCoords && prod.lat && prod.lng) {
        distanceKm = calculateDistanceKm(userCoords.lat, userCoords.lng, prod.lat, prod.lng)
      }
      return { ...prod, distanceKm }
    })
  }, [products, userCoords])

  // 2. High-Performance Query Filter with LRU Caching
  const filteredProducts = useMemo(() => {
    const queryDesc = parseQueryDescriptor(deferredSearchQuery)
    const categoryLower = selectedCategory.toLowerCase()

    // Generate cache key
    const cacheKey = `${deferredSearchQuery}::${selectedCategory}::${showOnlyWishlist ? wishlistIds.join(',') : 'all'}`
    const cached = searchLRUCache.get(cacheKey)
    if (cached) return cached

    const results = indexedProductsWithDistance.filter((item) => {
      // Wishlist check
      if (showOnlyWishlist && !wishlistSet.has(item.id)) {
        return false
      }

      // Category check
      if (selectedCategory !== 'All' && item.category?.toLowerCase() !== categoryLower) {
        return false
      }

      // Hinglish / English search check
      if (queryDesc && !matchesQueryDescriptor(item, queryDesc)) {
        return false
      }

      return true
    })

    searchLRUCache.set(cacheKey, results)
    return results
  }, [indexedProductsWithDistance, selectedCategory, deferredSearchQuery, showOnlyWishlist, wishlistSet, wishlistIds])

  // 3. Hyperlocal Products (within selected radius)
  const hyperlocalProducts = useMemo(() => {
    return filteredProducts
      .filter((p) => !p.is_affiliate_fallback)
      .filter((p) => {
        if (maxRadiusKm === 'all' || p.distanceKm === null) return true
        return p.distanceKm <= maxRadiusKm
      })
      .sort((a, b) => {
        if (a.distanceKm === null) return 1
        if (b.distanceKm === null) return -1
        return a.distanceKm - b.distanceKm
      })
  }, [filteredProducts, maxRadiusKm])

  // 4. Distant Products (outside selected radius)
  const distantLocalProducts = useMemo(() => {
    if (maxRadiusKm === 'all') return []
    return filteredProducts
      .filter((p) => !p.is_affiliate_fallback)
      .filter((p) => p.distanceKm !== null && p.distanceKm > maxRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [filteredProducts, maxRadiusKm])

  // 5. Active Flash Deals
  const activeFlashDeals = useMemo(() => {
    return indexedProductsWithDistance
      .filter((p) => {
        if (!p.is_flash_deal || !p.flash_deal_ends_at) return false
        const info = getFlashDealInfo(p)
        return info.isLive
      })
      .sort((a, b) => {
        if (a.distanceKm === null) return 1
        if (b.distanceKm === null) return -1
        return a.distanceKm - b.distanceKm
      })
  }, [indexedProductsWithDistance])

  // 6. Online Fallback Options
  const fallbackProducts = useMemo(() => {
    return filteredProducts.filter((p) => p.is_affiliate_fallback)
  }, [filteredProducts])

  return (
    <main className="pt-4 md:pt-6 px-container-margin max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Search and Filter Section - Apple Capsule System */}
      <section className="mb-5 bg-surface py-2">
        <div className="relative w-full flex items-center gap-2 sm:gap-2.5">
          {/* Main Search Input - Apple Pill Design */}
          <div className="relative flex-1 group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg group-focus-within:text-primary transition-colors">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 'Cheeni', 'Charger'..."
              className="w-full bg-surface-container-high/80 apple-frosted border border-surface-variant/60 focus:border-primary focus:ring-4 focus:ring-primary/15 rounded-full py-2.5 sm:py-3 pl-11 sm:pl-12 pr-8 sm:pr-10 text-xs sm:text-sm md:text-base text-on-surface placeholder-on-surface-variant transition-all shadow-crisp-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors"
              >
                <span className="material-symbols-outlined text-xs sm:text-sm">close</span>
              </button>
            )}
          </div>

          {/* Hindi / English Voice Search Button - Apple Capsule */}
          <button
            onClick={toggleVoiceSearch}
            title={isListening ? 'Stop listening' : `Tap to speak (${speechLanguage === 'hi-IN' ? 'Hindi / Hinglish' : 'English'})`}
            className={`flex-shrink-0 flex items-center justify-center p-2.5 sm:p-3 rounded-full transition-all shadow-crisp-xs active:scale-90 border ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30 border-rose-600 shadow-rose-500/20'
                : 'bg-primary text-on-primary hover:bg-primary/90 border-white/20 hover:shadow-primary/20 shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-lg sm:text-xl">
              {isListening ? 'graphic_eq' : 'mic'}
            </span>
          </button>

          {/* Language Toggle (हिन्दी / Eng) - Apple Pill */}
          <button
            onClick={() => setSpeechLanguage((prev) => (prev === 'hi-IN' ? 'en-IN' : 'hi-IN'))}
            title="Switch voice search language"
            className="flex-shrink-0 bg-surface-container-high/90 hover:bg-surface-variant text-on-surface border border-surface-variant/60 px-3 sm:px-3.5 py-2.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all shadow-crisp-xs active:scale-95 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[13px] text-primary">translate</span>
            <span>{speechLanguage === 'hi-IN' ? 'हिन्दी' : 'ENG'}</span>
          </button>

          {/* ❤️ Wishlist Quick Toggle Button with Apple Pill */}
          <button
            onClick={() => setShowOnlyWishlist((prev) => !prev)}
            title={showOnlyWishlist ? 'Show all products' : `View saved wishlist (${wishlistIds.length} items)`}
            className={`flex-shrink-0 flex items-center justify-center gap-1 p-2.5 sm:p-3 rounded-full transition-all shadow-crisp-xs active:scale-90 border ${
              showOnlyWishlist
                ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-500/30 font-bold shadow-rose-500/20'
                : 'bg-surface-container-high/90 hover:bg-surface-variant text-on-surface border-surface-variant/60'
            }`}
          >
            <span className={`material-symbols-outlined text-lg sm:text-xl ${showOnlyWishlist ? 'fill-current animate-heartBeat' : 'text-rose-500'}`}>
              favorite
            </span>
            {wishlistIds.length > 0 && !showOnlyWishlist && (
              <span className="text-[10px] font-extrabold bg-rose-500 text-white px-1.5 py-0.2 rounded-full shadow-2xs">
                {wishlistIds.length}
              </span>
            )}
          </button>

          {/* 🔘 Minimal Filter Dropdown Trigger Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowFiltersDropdown((prev) => !prev)}
              title="Filter Categories & Radius"
              className={`flex-shrink-0 flex items-center justify-center gap-1 p-2.5 sm:p-3 rounded-full transition-all shadow-crisp-xs active:scale-90 border ${
                showFiltersDropdown || selectedCategory !== 'All' || maxRadiusKm !== 2
                  ? 'bg-secondary text-on-secondary border-secondary ring-2 ring-secondary/20 font-bold'
                  : 'bg-surface-container-high/90 hover:bg-surface-variant text-on-surface border-surface-variant/60'
              }`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">
                tune
              </span>
              {(selectedCategory !== 'All' || maxRadiusKm !== 2) && (
                <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              )}
            </button>

            {/* Popover Dropdown Menu */}
            {showFiltersDropdown && (
              <div className="absolute right-0 top-full mt-2.5 w-72 sm:w-80 bg-surface/95 apple-frosted border border-surface-variant/80 rounded-3xl shadow-crisp-xl p-4.5 z-50 animate-popIn">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-variant/40">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-sm">tune</span>
                    <span className="font-title-md text-xs font-bold text-on-surface">Filter Products</span>
                  </div>
                  {(selectedCategory !== 'All' || maxRadiusKm !== 2) && (
                    <button
                      onClick={() => {
                        setSelectedCategory('All')
                        setMaxRadiusKm(2)
                      }}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                <div className="mb-3.5">
                  <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                    Category ({selectedCategory})
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CATEGORIES.map((cat) => {
                      const isActive = selectedCategory === cat.label
                      return (
                        <button
                          key={cat.label}
                          onClick={() => setSelectedCategory(cat.label)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-label-caps text-[11px] transition-all text-left ${
                            isActive
                              ? 'bg-primary text-on-primary font-bold shadow-crisp-xs ring-2 ring-primary/20'
                              : 'bg-surface-container-high/80 hover:bg-surface-variant text-on-surface border border-surface-variant/40'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
                          <span className="truncate">{cat.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                    Search Radius
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: '2 km (Nearby)', value: 2 },
                      { label: '5 km', value: 5 },
                      { label: '10 km', value: 10 },
                      { label: 'All Distances', value: 'all' }
                    ].map((rad) => {
                      const isActive = maxRadiusKm === rad.value
                      return (
                        <button
                          key={rad.label}
                          onClick={() => setMaxRadiusKm(rad.value)}
                          className={`px-3 py-2 rounded-full text-[11px] font-bold transition-all text-center ${
                            isActive
                              ? 'bg-primary text-on-primary shadow-crisp-xs ring-2 ring-primary/20'
                              : 'bg-surface-container-high/80 hover:bg-surface-variant text-on-surface border border-surface-variant/40'
                          }`}
                        >
                          {rad.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-surface-variant/40">
                  <button
                    onClick={() => setShowFiltersDropdown(false)}
                    className="w-full bg-primary hover:bg-primary/90 text-on-primary py-2.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95 text-center"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Category Pills Bar - Apple Capsule Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-1.5 mt-1.5">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.label
            return (
              <button
                key={`chip-${cat.label}`}
                onClick={() => setSelectedCategory(cat.label)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 flex-shrink-0 ${
                  isActive
                    ? 'bg-primary text-on-primary font-bold shadow-crisp-sm ring-2 ring-primary/20 scale-[1.02]'
                    : 'bg-surface-container-high/80 hover:bg-surface-variant text-on-surface border border-surface-variant/50 shadow-crisp-xs'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Live Voice Status Feedback */}
        {voiceToast && (
          <div className="mt-2.5 p-2.5 px-4 bg-primary/10 border border-primary/30 rounded-2xl flex items-center justify-between text-xs font-semibold text-primary animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full bg-primary ${isListening ? 'animate-ping' : ''}`}></span>
              <span>{voiceToast}</span>
            </div>
            {isListening && (
              <button
                onClick={toggleVoiceSearch}
                className="text-[10px] bg-primary text-on-primary px-2.5 py-0.5 rounded-full font-bold shadow-2xs"
              >
                Done
              </button>
            )}
          </div>
        )}

        {/* Active Filter Indicators */}
        {(selectedCategory !== 'All' || maxRadiusKm !== 2) && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto hide-scrollbar text-[11px]">
            <span className="text-[10px] text-on-surface-variant font-bold">Active:</span>
            {selectedCategory !== 'All' && (
              <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold border border-primary/20 flex items-center gap-1 shadow-2xs">
                <span>{selectedCategory}</span>
                <button onClick={() => setSelectedCategory('All')} className="hover:text-primary-container font-bold">×</button>
              </span>
            )}
            {maxRadiusKm !== 2 && (
              <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold border border-primary/20 flex items-center gap-1 shadow-2xs">
                <span>{maxRadiusKm === 'all' ? 'All Distances' : `${maxRadiusKm} km`}</span>
                <button onClick={() => setMaxRadiusKm(2)} className="hover:text-primary-container font-bold">×</button>
              </span>
            )}
          </div>
        )}

        {/* Approximate Location Notice */}
        {locationStatus === 'approx' && onChangeLocation && (
          <div className="mt-2.5 p-2.5 px-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300 shadow-crisp-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-base flex-shrink-0 text-amber-500">
                info
              </span>
              <span className="truncate text-[11px] font-medium">
                Using approximate internet location. Far away?
              </span>
            </div>
            <button
              onClick={onChangeLocation}
              className="text-[10px] font-bold bg-amber-500 text-white px-3 py-1 rounded-xl shadow-crisp-xs hover:bg-amber-600 active:scale-95 flex-shrink-0"
            >
              Set My Area
            </button>
          </div>
        )}
      </section>

      {/* ⚡ 24-Hour Flash Deals Carousel */}
      {!loading && activeFlashDeals.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <h2 className="font-headline-lg-mobile text-sm sm:text-base md:text-lg font-bold text-on-surface flex items-center gap-1.5">
                <span>Aaj Ka Offer • Deals</span>
                <span className="text-[9px] bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 text-white font-black px-2 py-0.5 rounded-full shadow-crisp-xs animate-bounceSubtle">
                  HOT
                </span>
              </h2>
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {activeFlashDeals.length} Live
            </span>
          </div>

          <div className="flex gap-3.5 overflow-x-auto hide-scrollbar pb-2.5 pt-0.5">
            {activeFlashDeals.map((deal) => {
              const info = getFlashDealInfo(deal)
              return (
                <div
                  key={`flash-${deal.id}`}
                  onClick={() => onSelectProduct(deal)}
                  className="flash-card-contain flex-shrink-0 w-64 sm:w-72 bg-gradient-to-br from-amber-500/15 via-surface-container-lowest to-surface-container-lowest rounded-3xl border border-amber-500/35 p-3 shadow-crisp-sm hover:shadow-crisp-lg transition-all cursor-pointer group active:scale-[0.98]"
                >
                  <div className="flex gap-3">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-surface-variant relative flex-shrink-0">
                      <img
                        src={deal.image_url || DEFAULT_IMG}
                        alt={deal.name}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.target.onerror = null
                          e.target.src = DEFAULT_IMG
                        }}
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                      />
                      <span className="absolute top-1 left-1 bg-gradient-to-r from-rose-600 to-pink-600 text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-crisp-xs">
                        {info.discountPercent}% OFF
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider truncate">
                            {deal.shop_name}
                          </span>
                          <span className="text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded-md shrink-0">
                            {formatDistance(deal.distanceKm)}
                          </span>
                        </div>
                        <h4 className="font-title-md text-[11px] sm:text-xs font-bold text-on-surface line-clamp-1 sm:line-clamp-2 mt-0.5 group-hover:text-primary transition-colors">
                          {deal.name}
                        </h4>
                      </div>

                      <div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="font-black text-rose-600 text-sm sm:text-base">
                            ₹{info.discountedPrice}
                          </span>
                          <span className="text-[10px] text-on-surface-variant line-through opacity-70 font-medium">
                            ₹{info.originalPrice}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between">
                          <FlashCountdownBadge deal={deal} />
                          <span className="text-[9px] sm:text-[10px] font-bold text-primary flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            <span>Grab</span>
                            <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 📍 Zone 3: Hyperlocal Nearby Products Grid */}
      {!loading && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3.5 px-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-lg">storefront</span>
              </div>
              <div>
                <h2 className="section-header-title flex items-center gap-2">
                  <span>{maxRadiusKm === 'all' ? 'All Local Stores' : `Nearby Stores (${maxRadiusKm} km)`}</span>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                    {hyperlocalProducts.length} items
                  </span>
                </h2>
              </div>
            </div>

            {onRefreshProducts && (
              <button
                onClick={onRefreshProducts}
                disabled={refreshing}
                title="Refresh products list"
                className="w-8 h-8 rounded-full bg-surface-container-high/80 text-on-surface hover:bg-surface-variant transition-all flex items-center justify-center border border-surface-variant/60 active:scale-90 shadow-crisp-xs"
              >
                <span className={`material-symbols-outlined text-[16px] ${refreshing ? 'animate-spin text-primary' : ''}`}>
                  refresh
                </span>
              </button>
            )}
          </div>

          {hyperlocalProducts.length === 0 ? (
            <div className="bg-surface-container-low/80 p-8 sm:p-10 rounded-3xl border border-surface-variant/60 text-center my-4 shadow-crisp-xs">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-3xl">near_me_disabled</span>
              </div>
              <h3 className="font-title-md text-lg font-bold text-on-surface mb-1.5 tracking-tight">
                No Local Products Within {maxRadiusKm === 'all' ? 'Range' : `${maxRadiusKm} km`}
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-md mx-auto mb-5 leading-relaxed">
                {distantLocalProducts.length > 0
                  ? `Found ${distantLocalProducts.length} store items slightly further away (beyond ${maxRadiusKm} km). Try widening your radius filter to 5 km or 10 km!`
                  : 'No nearby shopkeeper has listed this item yet. Check out online fallback options below!'}
              </p>
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                {distantLocalProducts.length > 0 && (
                  <button
                    onClick={() => setMaxRadiusKm('all')}
                    className="bg-primary hover:bg-primary/90 text-on-primary px-5 py-2.5 rounded-full text-xs font-bold shadow-crisp-xs active:scale-95 transition-all"
                  >
                    Show All Distances
                  </button>
                )}
                {onChangeLocation && (
                  <button
                    onClick={onChangeLocation}
                    className="bg-surface-container-high/90 hover:bg-surface-variant text-on-surface border border-surface-variant/70 px-5 py-2.5 rounded-full text-xs font-bold shadow-crisp-xs active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm text-primary">edit_location_alt</span>
                    <span>Change Pin Code / Area</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
              {hyperlocalProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelectProduct={onSelectProduct}
                  isWishlisted={wishlistSet.has(product.id)}
                  onToggleWishlist={toggleWishlist}
                  priority={index < 4}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 🚗 Zone 4: Stores Beyond Selected Radius */}
      {!loading && distantLocalProducts.length > 0 && (
        <section className="mb-8 mt-10 pt-7 border-t border-surface-variant/40">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-lg">location_off</span>
              </div>
              <div>
                <h2 className="section-header-title flex items-center gap-2">
                  <span>Stores Beyond {maxRadiusKm} km Radius</span>
                  <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full">
                    {distantLocalProducts.length} further items
                  </span>
                </h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Available in the wider city area.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {distantLocalProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelectProduct={onSelectProduct}
                isWishlisted={wishlistSet.has(product.id)}
                onToggleWishlist={toggleWishlist}
                priority={false}
                isDistant={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* 📦 Zone 5: Online Fallback Options */}
      {fallbackProducts.length > 0 && (
        <section className="mt-10 pt-7 border-t border-surface-variant/40">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-lg">shopping_bag</span>
              </div>
              <div>
                <h2 className="section-header-title">Online Fallback Options</h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Items not currently in stock nearby can be ordered online.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fallbackProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="bg-surface-container-low/80 hover:bg-surface-container-high rounded-3xl border border-secondary-fixed-dim/40 p-4 flex gap-4 cursor-pointer transition-all shadow-crisp-xs hover:apple-product-shadow active:scale-[0.98]"
              >
                <img
                  src={product.image_url || DEFAULT_IMG}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.target.onerror = null
                    e.target.src = DEFAULT_IMG
                  }}
                  className="w-20 h-20 rounded-2xl object-cover bg-surface-variant flex-shrink-0"
                />
                <div className="flex flex-col justify-between flex-1 min-w-0">
                  <div>
                    <h3 className="font-title-md text-sm font-bold text-on-surface truncate">{product.name}</h3>
                    <span className="text-[11px] text-secondary font-semibold">Online Affiliate Deal</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-black text-primary text-base">₹{product.price}</span>
                    <span className="text-xs font-bold text-primary flex items-center gap-0.5 hover:translate-x-0.5 transition-transform">
                      <span>Buy Online</span>
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

