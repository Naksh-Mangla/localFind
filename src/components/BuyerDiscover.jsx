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
    if (!deal?.is_flash_deal || !deal?.flash_deal_ends_at) return
    const interval = setInterval(() => {
      setInfo(getFlashDealInfo(deal))
    }, 1000)
    return () => clearInterval(interval)
  }, [deal])

  if (!info.isLive) return null

  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
      <span className="truncate max-w-[80px]">{info.countdownText}</span>
    </span>
  )
})

// ⏱️ Retro-Modern Digital HUD Timer with Live Ticking Numerals
const LiveHUDTimer = React.memo(function LiveHUDTimer({ deal }) {
  const [info, setInfo] = useState(() => getFlashDealInfo(deal))

  useEffect(() => {
    if (!deal?.is_flash_deal || !deal?.flash_deal_ends_at) return
    const interval = setInterval(() => {
      setInfo(getFlashDealInfo(deal))
    }, 1000)
    return () => clearInterval(interval)
  }, [deal])

  if (!info.isLive) return null

  const pad = (n) => String(n || 0).padStart(2, '0')

  return (
    <div className="inline-flex items-center gap-1 bg-black/85 dark:bg-black/95 text-amber-400 border border-amber-500/40 px-2.5 py-1 rounded-full shadow-crisp-xs hud-digital-clock font-mono text-[10px] sm:text-[11px] font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping mr-0.5"></span>
      <span>{pad(info.hours)}</span>
      <span className="opacity-60 animate-pulse">:</span>
      <span>{pad(info.minutes)}</span>
      <span className="opacity-60 animate-pulse">:</span>
      <span className="text-rose-400">{pad(info.seconds)}</span>
      <span className="text-[9px] text-amber-300/80 uppercase font-sans ml-0.5 font-extrabold">left</span>
    </div>
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
          {product.isOwner ? (
            <span
              className="apple-frosted px-2.5 py-1 rounded-full text-[9px] font-bold shadow-crisp-xs border border-primary/40 bg-primary/15 text-primary flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-[12px] text-primary">
                storefront
              </span>
              <span>Your Shop (0m)</span>
            </span>
          ) : product.distanceKm !== null && (
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

          <div className="flex items-center gap-1.5 ml-auto pointer-events-auto">
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
  currentUser,
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

    const uLat = userCoords ? Number(userCoords.lat) : null
    const uLng = userCoords ? Number(userCoords.lng) : null
    const hasUserGPS = Number.isFinite(uLat) && Number.isFinite(uLng)
    const currentUid = currentUser?.uid || currentUser?.sub

    return indexed.map((prod) => {
      let distanceKm = null
      const isOwner = Boolean(currentUid && (prod.owner_id === currentUid || prod.shop_owner_id === currentUid))
      if (isOwner) {
        distanceKm = 0 // Exactly 0 distance for merchant's own shop
      } else {
        const pLat = Number(prod.lat)
        const pLng = Number(prod.lng)
        if (hasUserGPS && Number.isFinite(pLat) && Number.isFinite(pLng)) {
          distanceKm = calculateDistanceKm(uLat, uLng, pLat, pLng)
        }
      }
      return { ...prod, distanceKm, isOwner }
    })
  }, [products, userCoords, currentUser])

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
          {/* Main Integrated Search Bar with Embedded Mic & Language Switcher */}
          <div className="relative flex-1 group flex items-center">
            {/* Search Magnifying Glass Icon */}
            <span className="material-symbols-outlined absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-base sm:text-lg group-focus-within:text-primary transition-colors pointer-events-none">
              search
            </span>

            {/* Main Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 'Cheeni', 'Milk', 'Charger'..."
              className="w-full bg-surface-container-high/80 apple-frosted border border-surface-variant/60 focus:border-primary focus:ring-4 focus:ring-primary/15 rounded-full py-2.5 sm:py-3 pl-10 sm:pl-11 pr-24 sm:pr-28 text-xs sm:text-sm md:text-base text-on-surface placeholder-on-surface-variant transition-all shadow-crisp-xs"
            />

            {/* Embedded Action Controls (Clear + Language Toggle + Mic) */}
            <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-1.5">
              {/* Clear search text */}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  title="Clear search text"
                  className="p-1 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors"
                >
                  <span className="material-symbols-outlined text-xs sm:text-sm">close</span>
                </button>
              )}

              {/* Language Switcher Capsule Inside Search Bar */}
              <button
                type="button"
                onClick={() => setSpeechLanguage((prev) => (prev === 'hi-IN' ? 'en-IN' : 'hi-IN'))}
                title={`Switch voice language (${speechLanguage === 'hi-IN' ? 'Hindi / Hinglish' : 'English'})`}
                className="bg-surface/85 hover:bg-surface text-on-surface border border-surface-variant/70 hover:border-primary/40 px-2 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-extrabold transition-all shadow-2xs active:scale-95 flex items-center gap-0.5"
              >
                <span>{speechLanguage === 'hi-IN' ? 'हिन्दी' : 'ENG'}</span>
              </button>

              {/* Embedded Mic Button with Glowing Pulse State */}
              <button
                type="button"
                onClick={toggleVoiceSearch}
                title={isListening ? 'Stop listening' : `Voice search (${speechLanguage === 'hi-IN' ? 'बोलकर खोजें' : 'Speak to search'})`}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shadow-crisp-xs active:scale-90 ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30 shadow-rose-500/30'
                    : 'bg-primary hover:bg-primary/90 text-on-primary shadow-sm hover:shadow-primary/20'
                }`}
              >
                <span className="material-symbols-outlined text-sm sm:text-base">
                  {isListening ? 'graphic_eq' : 'mic'}
                </span>
              </button>
            </div>
          </div>

          {/* 🔘 Minimal Filter Dropdown Trigger Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowFiltersDropdown((prev) => !prev)}
              title="Filter Categories, Radius & Wishlist"
              className={`flex-shrink-0 flex items-center justify-center gap-1.5 p-2.5 sm:p-3 rounded-full transition-all shadow-crisp-xs active:scale-90 border ${
                showFiltersDropdown || selectedCategory !== 'All' || maxRadiusKm !== 2 || showOnlyWishlist
                  ? 'bg-secondary text-on-secondary border-secondary ring-2 ring-secondary/20 font-bold'
                  : 'bg-surface-container-high/90 hover:bg-surface-variant text-on-surface border-surface-variant/60'
              }`}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">
                tune
              </span>
              {(selectedCategory !== 'All' || maxRadiusKm !== 2 || showOnlyWishlist) && (
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
                  {(selectedCategory !== 'All' || maxRadiusKm !== 2 || showOnlyWishlist) && (
                    <button
                      onClick={() => {
                        setSelectedCategory('All')
                        setMaxRadiusKm(2)
                        setShowOnlyWishlist(false)
                      }}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                {/* ❤️ Saved Wishlist Filter Toggle Inside Dropdown */}
                <div className="mb-3.5 pb-3 border-b border-surface-variant/40">
                  <button
                    type="button"
                    onClick={() => setShowOnlyWishlist((prev) => !prev)}
                    className={`w-full flex items-center justify-between p-2.5 px-3 rounded-2xl border transition-all text-xs font-bold ${
                      showOnlyWishlist
                        ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/20 shadow-sm'
                        : 'bg-surface-container-high/80 hover:bg-surface-variant text-on-surface border-surface-variant/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-base ${showOnlyWishlist ? 'fill-current animate-heartBeat' : 'text-rose-500'}`}>
                        favorite
                      </span>
                      <span>Show Saved Wishlist</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                      showOnlyWishlist ? 'bg-white text-rose-600' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    }`}>
                      {wishlistIds.length} {wishlistIds.length === 1 ? 'item' : 'items'}
                    </span>
                  </button>
                </div>

                {/* Category Selection */}
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

                {/* Distance Radius Selection */}
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
        {(selectedCategory !== 'All' || maxRadiusKm !== 2 || showOnlyWishlist) && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto hide-scrollbar text-[11px]">
            <span className="text-[10px] text-on-surface-variant font-bold">Active:</span>
            {showOnlyWishlist && (
              <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded-full font-bold border border-rose-500/20 flex items-center gap-1 shadow-2xs">
                <span className="material-symbols-outlined text-[12px] fill-current">favorite</span>
                <span>Wishlist ({wishlistIds.length})</span>
                <button onClick={() => setShowOnlyWishlist(false)} className="hover:text-rose-700 font-bold">×</button>
              </span>
            )}
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

      {/* ⚡ 24-Hour Flash Deals Psychological Aurora Banner */}
      {!loading && activeFlashDeals.length > 0 && (
        <section className="mb-8 relative">
          {/* Main Aurora Glass Container */}
          <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 flash-aurora-bg p-4 sm:p-5 md:p-6 shadow-crisp-md backdrop-blur-md">
            {/* Shimmer Light Sweep */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
              <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white to-transparent transform -skew-x-12 animate-shimmer-sweep"></div>
            </div>

            {/* Banner Header Ribbon */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-rose-500 to-pink-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0 animate-flame">
                  <span className="text-xl">⚡</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-lg text-base sm:text-lg md:text-xl font-black text-on-surface tracking-tight flex items-center gap-1.5">
                      <span>Aaj Ka Offer • Flash Deals</span>
                      <span className="text-[10px] bg-gradient-to-r from-amber-500 to-rose-500 text-white font-black px-2 py-0.5 rounded-full shadow-crisp-xs animate-pulse">
                        LIVE
                      </span>
                    </h2>
                  </div>
                  <p className="text-[11px] sm:text-xs text-on-surface-variant font-medium">
                    Limited-time discounted bargains from verified local shops in your area
                  </p>
                </div>
              </div>

              {/* Header Right: Live Deals Count & Urgency Badge */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {activeFlashDeals[0] && <LiveHUDTimer deal={activeFlashDeals[0]} />}
                <span className="text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30">
                  {activeFlashDeals.length} {activeFlashDeals.length === 1 ? 'Deal' : 'Deals'} Live
                </span>
              </div>
            </div>

            {/* Horizontal Flash Deals Scroller */}
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-1 pt-1 relative z-10 -mx-1 px-1">
              {activeFlashDeals.map((deal) => {
                const info = getFlashDealInfo(deal)
                return (
                  <div
                    key={`flash-${deal.id}`}
                    onClick={() => onSelectProduct(deal)}
                    className="flash-card-contain flex-shrink-0 w-72 sm:w-80 bg-surface/90 apple-frosted rounded-3xl border border-amber-500/30 p-3.5 shadow-crisp-sm hover:shadow-crisp-xl hover:border-amber-500/60 transition-all duration-300 cursor-pointer group active:scale-[0.98] flex flex-col justify-between"
                  >
                    <div className="flex gap-3.5">
                      {/* Image with Discount Overlay */}
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-surface-variant relative flex-shrink-0 border border-surface-variant/50">
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
                        <span className="absolute top-1.5 left-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-crisp-xs animate-softGaze">
                          {info.discountPercent}% OFF
                        </span>
                      </div>

                      {/* Content Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider truncate">
                              {deal.shop_name}
                            </span>
                            <span className="text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded-md shrink-0">
                              {deal.isOwner ? 'Your Shop' : formatDistance(deal.distanceKm)}
                            </span>
                          </div>

                          <h4 className="font-title-md text-xs sm:text-sm font-bold text-on-surface line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                            {deal.name}
                          </h4>
                        </div>

                        <div>
                          {/* Price Tag with Savings Highlight */}
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="font-display-lg text-base sm:text-lg font-black text-rose-600">
                              ₹{info.discountedPrice}
                            </span>
                            <span className="text-xs text-on-surface-variant line-through opacity-70 font-medium">
                              ₹{info.originalPrice}
                            </span>
                            {info.savings > 0 && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/15 px-1.5 py-0.2 rounded">
                                Save ₹{info.savings}
                              </span>
                            )}
                          </div>

                          {/* Countdown & Action */}
                          <div className="mt-2 flex items-center justify-between gap-1">
                            <FlashCountdownBadge deal={deal} />
                            <span className="bg-primary hover:bg-primary/90 text-on-primary text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-0.5 shadow-2xs group-hover:translate-x-0.5 transition-transform">
                              <span>Claim</span>
                              <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
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

