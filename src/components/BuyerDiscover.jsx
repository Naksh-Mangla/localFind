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

// 📦 Memoized 60+ FPS Product Card with Soft Aesthetics & CSS Virtual Containment
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
      className={`product-card-contain soft-card-hover bg-surface-container-lowest rounded-2xl sm:rounded-3xl shadow-crisp-xs overflow-hidden border flex flex-col group cursor-pointer transition-all duration-300 touch-press ${
        isDistant 
          ? 'border-amber-500/30 hover:border-amber-500/60' 
          : 'border-surface-variant/50 hover:border-primary/40 hover:shadow-crisp-md'
      }`}
    >
      <div className="relative w-full aspect-square overflow-hidden bg-surface-variant/50">
        <img
          src={product.image_url || DEFAULT_IMG}
          alt={product.name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={(e) => {
            e.target.onerror = null
            e.target.src = DEFAULT_IMG
          }}
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
        />

        {/* Soft Glassmorphic Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none gap-1">
          {flashInfo.isLive ? (
            <span className="bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black shadow-sm flex items-center gap-1 pointer-events-auto animate-softGaze">
              <span className="text-[10px]">⚡</span>
              <span>{flashInfo.discountPercent}% OFF</span>
            </span>
          ) : (
            <span className="bg-surface/85 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] font-bold shadow-crisp-xs border border-surface-variant/30 flex items-center gap-1 pointer-events-auto">
              <span className={`w-1.5 h-1.5 rounded-full ${itemRAG.dotClass}`}></span>
              <span className={itemRAG.textClass}>{itemRAG.label}</span>
            </span>
          )}

          <div className="flex items-center gap-1.5 ml-auto pointer-events-auto">
            {product.distanceKm !== null && (
              <span
                className={`backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold shadow-crisp-xs border flex items-center gap-0.5 ${
                  isDistant
                    ? 'bg-amber-600/90 text-white border-amber-600/60'
                    : 'bg-surface/85 text-on-surface border-surface-variant/40'
                }`}
              >
                <span className={`material-symbols-outlined text-[12px] ${isDistant ? '' : 'text-primary'}`}>
                  directions_walk
                </span>
                <span>{formatDistance(product.distanceKm)}</span>
              </span>
            )}

            {/* Animated 1-Tap Wishlist Heart Button */}
            <button
              onClick={(e) => onToggleWishlist(product.id, e)}
              title={isWishlisted ? 'Remove from Saved Wishlist' : 'Save to Wishlist'}
              className={`w-7 h-7 rounded-full flex items-center justify-center shadow-crisp-xs transition-all active:scale-75 ${
                isWishlisted
                  ? 'bg-rose-500 text-white shadow-rose-500/25 ring-2 ring-rose-500/20'
                  : 'bg-surface/85 backdrop-blur-md text-on-surface-variant hover:text-rose-500 border border-surface-variant/40 hover:bg-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[15px] transition-transform ${isWishlisted ? 'fill-current animate-heartBeat' : ''}`}>
                favorite
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-3.5 sm:p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-title-md text-xs sm:text-sm md:text-base font-bold text-on-surface line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
        </div>

        <div className="flex items-center justify-between gap-1 mb-2.5">
          <p className="font-body-sm text-[11px] sm:text-xs text-on-surface-variant line-clamp-1 flex-1">
            {product.shop_name}
          </p>
          <StoreStatusBadge openingTime={product.opening_time} closingTime={product.closing_time} />
        </div>

        <div className="mt-auto flex items-end justify-between pt-1.5 border-t border-surface-variant/30">
          <div>
            {flashInfo.isLive ? (
              <div className="flex flex-col">
                <FlashCountdownBadge deal={product} />
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-headline-lg-mobile text-sm sm:text-lg md:text-xl font-bold text-rose-600">
                    ₹{flashInfo.discountedPrice}
                  </span>
                  <span className="text-[10px] sm:text-xs text-on-surface-variant line-through opacity-70 font-medium">
                    ₹{flashInfo.originalPrice}
                  </span>
                </div>
              </div>
            ) : (
              <span className="font-headline-lg-mobile text-sm sm:text-lg md:text-xl font-black text-primary">
                ₹{product.price}
              </span>
            )}
          </div>

          <button
            className={`px-3 sm:px-4 py-1.5 rounded-xl font-label-caps text-[10px] sm:text-xs font-bold transition-all shadow-crisp-xs flex items-center gap-1 active:scale-95 group-hover:translate-x-0.5 ${
              isDistant
                ? 'bg-surface-container-high hover:bg-surface-variant text-on-surface border border-surface-variant'
                : 'bg-primary hover:bg-primary/90 text-on-primary shadow-sm hover:shadow-primary/20'
            }`}
          >
            <span className="hidden sm:inline">Details</span>
            <span className="sm:hidden">View</span>
            <span className="material-symbols-outlined text-[13px] sm:text-[15px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
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
      {/* Search and Filter Section */}
      <section className="mb-5 bg-surface py-2">
        <div className="relative w-full flex items-center gap-2 sm:gap-2.5">
          {/* Main Search Input with Soft Ambient Glow */}
          <div className="relative flex-1 group">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg group-focus-within:text-primary transition-colors">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 'Cheeni', 'Charger'..."
              className="w-full bg-surface-container-high/80 backdrop-blur-sm border border-surface-variant/70 focus:border-primary focus:ring-4 focus:ring-primary/15 rounded-2xl py-2.5 sm:py-3 pl-10 sm:pl-12 pr-8 sm:pr-10 text-xs sm:text-sm md:text-base text-on-surface placeholder-on-surface-variant transition-all shadow-crisp-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors"
              >
                <span className="material-symbols-outlined text-xs sm:text-sm">close</span>
              </button>
            )}
          </div>

          {/* Hindi / English Voice Search Button */}
          <button
            onClick={toggleVoiceSearch}
            title={isListening ? 'Stop listening' : `Tap to speak (${speechLanguage === 'hi-IN' ? 'Hindi / Hinglish' : 'English'})`}
            className={`flex-shrink-0 flex items-center justify-center p-2.5 sm:p-3 rounded-2xl transition-all shadow-crisp-xs active:scale-90 border ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30 border-rose-600 shadow-rose-500/20'
                : 'bg-primary text-on-primary hover:bg-primary/90 border-white/20 hover:shadow-primary/20 shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-lg sm:text-xl">
              {isListening ? 'graphic_eq' : 'mic'}
            </span>
          </button>

          {/* Language Toggle (हिन्दी / Eng) */}
          <button
            onClick={() => setSpeechLanguage((prev) => (prev === 'hi-IN' ? 'en-IN' : 'hi-IN'))}
            title="Switch voice search language"
            className="flex-shrink-0 bg-surface-container-high/90 hover:bg-surface-variant text-on-surface border border-surface-variant/70 px-2.5 sm:px-3 py-2.5 rounded-2xl text-[10px] sm:text-[11px] font-bold transition-all shadow-crisp-xs active:scale-95 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[13px] text-primary">translate</span>
            <span>{speechLanguage === 'hi-IN' ? 'हिन्दी' : 'ENG'}</span>
          </button>

          {/* ❤️ Wishlist Quick Toggle Button with Badge Glow */}
          <button
            onClick={() => setShowOnlyWishlist((prev) => !prev)}
            title={showOnlyWishlist ? 'Show all products' : `View saved wishlist (${wishlistIds.length} items)`}
            className={`flex-shrink-0 flex items-center justify-center gap-1 p-2.5 sm:p-3 rounded-2xl transition-all shadow-crisp-xs active:scale-90 border ${
              showOnlyWishlist
                ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-500/30 font-bold shadow-rose-500/20'
                : 'bg-surface-container-high/90 hover:bg-surface-variant text-on-surface border-surface-variant/70'
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
              className={`flex-shrink-0 flex items-center justify-center gap-1 p-2.5 sm:p-3 rounded-2xl transition-all shadow-crisp-xs active:scale-90 border ${
                showFiltersDropdown || selectedCategory !== 'All' || maxRadiusKm !== 2
                  ? 'bg-secondary text-on-secondary border-secondary ring-2 ring-secondary/20 font-bold'
                  : 'bg-surface-container-high/90 hover:bg-surface-variant text-on-surface border-surface-variant/70'
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
              <div className="absolute right-0 top-full mt-2.5 w-72 sm:w-80 bg-surface/95 backdrop-blur-xl border border-surface-variant/80 rounded-3xl shadow-crisp-xl p-4.5 z-50 animate-popIn">
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
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-label-caps text-[11px] transition-all text-left ${
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
                          className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all text-center ${
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
                    className="w-full bg-primary hover:bg-primary/90 text-on-primary py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-95 text-center"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Category Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-1.5 mt-1.5">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.label
            return (
              <button
                key={`chip-${cat.label}`}
                onClick={() => setSelectedCategory(cat.label)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 flex-shrink-0 ${
                  isActive
                    ? 'bg-primary text-on-primary font-bold shadow-crisp-sm ring-2 ring-primary/20 scale-[1.02]'
                    : 'bg-surface-container-high/80 hover:bg-surface-variant text-on-surface border border-surface-variant/60 shadow-crisp-xs'
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

      {/* Hyperlocal Product Feed */}
      {!loading && (
        <section className="mb-stack-lg">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">store</span>
              <h2 className="font-headline-lg-mobile text-base sm:text-lg font-bold text-on-surface">
                {maxRadiusKm === 'all'
                  ? 'All Stores'
                  : `Nearby Stores (${maxRadiusKm} km)`}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-on-surface-variant font-semibold">
                {hyperlocalProducts.length} items
              </span>
              {onRefreshProducts && (
                <button
                  onClick={onRefreshProducts}
                  disabled={refreshing}
                  title="Refresh products list"
                  className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-variant transition-colors flex items-center justify-center border border-surface-variant/70 active:scale-95 shadow-2xs"
                >
                  <span className={`material-symbols-outlined text-sm ${refreshing ? 'animate-spin text-primary' : ''}`}>
                    refresh
                  </span>
                </button>
              )}
            </div>
          </div>

          {hyperlocalProducts.length === 0 ? (
            <div className="bg-surface-container-low p-8 rounded-2xl border border-surface-variant text-center my-6">
              <span className="material-symbols-outlined text-4xl text-primary mb-2">near_me_disabled</span>
              <h3 className="font-title-md text-lg font-bold text-on-surface mb-1">
                No Local Products Within {maxRadiusKm === 'all' ? 'Range' : `${maxRadiusKm} km`}
              </h3>
              <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-4">
                {distantLocalProducts.length > 0
                  ? `Found ${distantLocalProducts.length} store items slightly further away (beyond ${maxRadiusKm} km). Try widening your radius filter to 5 km or 10 km above!`
                  : 'No nearby shopkeeper has listed this item yet. Check out online fallback options below!'}
              </p>
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                {distantLocalProducts.length > 0 && (
                  <button
                    onClick={() => setMaxRadiusKm('all')}
                    className="bg-primary text-on-primary px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
                  >
                    Show All Distances
                  </button>
                )}
                {onChangeLocation && (
                  <button
                    onClick={onChangeLocation}
                    className="bg-surface-container-high hover:bg-surface-variant text-on-surface border border-surface-variant/80 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm text-primary">edit_location_alt</span>
                    <span>Change Pin Code / Area</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-gutter">
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

      {/* Stores Beyond Selected Radius */}
      {!loading && distantLocalProducts.length > 0 && (
        <section className="mb-stack-lg mt-8 pt-6 border-t border-surface-variant/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-headline-lg-mobile text-xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">location_off</span>
                <span>Stores Beyond {maxRadiusKm} km Radius</span>
              </h2>
              <p className="text-xs text-on-surface-variant">
                These shops are further away from your current location.
              </p>
            </div>
            <span className="text-xs text-on-surface-variant font-medium">
              {distantLocalProducts.length} further items
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-gutter">
            {distantLocalProducts.map((product, index) => (
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

      {/* Online Fallback Options */}
      {fallbackProducts.length > 0 && (
        <section className="mt-10 pt-6 border-t border-surface-variant/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-headline-lg-mobile text-xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">shopping_bag</span>
                <span>Online Fallback Options</span>
              </h2>
              <p className="text-xs text-on-surface-variant">
                Items not currently in stock nearby can be ordered online.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {fallbackProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="bg-surface-container-low rounded-xl border border-secondary-fixed-dim/40 p-4 flex gap-4 cursor-pointer hover:bg-surface-container-high transition-colors"
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
                  className="w-20 h-20 rounded-lg object-cover bg-surface-variant"
                />
                <div className="flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="font-title-md text-sm font-semibold text-on-surface">{product.name}</h3>
                    <span className="text-xs text-secondary font-medium">Online Affiliate Deal</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary text-base">₹{product.price}</span>
                    <span className="text-xs text-primary underline">Buy Online &rarr;</span>
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

