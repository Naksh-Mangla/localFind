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
import { getFlashDealInfo, useFlashDeal } from '../utils/flashDeals'
import { triggerHaptic } from '../utils/haptics'
import { ReviewStars } from './ReviewStars'
import { apiFetch } from '../lib/api'

// Android-optimized: lazy-load free map only when user opens Map tab (saves 140KB on List view)
const NearbyMap = React.lazy(() => import('./NearbyMap').then(m => ({ default: m.NearbyMap })))

const CATEGORIES = [
  { label: 'All', icon: 'interests' },
  { label: 'Handmade', icon: 'handyman' },
  { label: 'Groceries', icon: 'local_cafe' },
  { label: 'Fashion', icon: 'checkroom' },
  { label: 'Electronics', icon: 'devices' },
  { label: 'Sale', icon: 'sell' }
]

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'

// ⚡ Isolated Live Flash Deal Countdown Badge (Subscribes to shared 1s ticker, 0 timer storms)
const FlashCountdownBadge = React.memo(function FlashCountdownBadge({ deal }) {
  const info = useFlashDeal(deal)

  if (!info.isLive) return null

  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
      <span className="truncate max-w-[80px]">{info.countdownText}</span>
    </span>
  )
})

// ⏱️ Retro-Modern Digital HUD Timer with Live Ticking Numerals (Shared ticker)
const LiveHUDTimer = React.memo(function LiveHUDTimer({ deal }) {
  const info = useFlashDeal(deal)

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

// 🍎 Apple Museum Gallery Style Product Card with Clean Visual Hierarchy
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
      className={`product-card-contain bg-surface-container-lowest rounded-2xl sm:rounded-3xl shadow-crisp-xs hover:apple-product-shadow overflow-hidden border flex flex-col group cursor-pointer transition-all duration-300 touch-press ${
        isDistant 
          ? 'border-amber-500/30 hover:border-amber-500/60' 
          : 'border-surface-variant/40 hover:border-primary/40'
      }`}
    >
      {/* Product Image Area with Separated Top Badges */}
      <div className="relative w-full aspect-square overflow-hidden bg-surface-variant/40">
        <img
          src={product.image_url || DEFAULT_IMG}
          alt={product.name}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'low'}
          decoding="async"
          onError={(e) => {
            e.target.onerror = null
            e.target.src = DEFAULT_IMG
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Top Floating Badge Bar - Clean Separated Architecture */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
          {/* Left Badge: Flash discount OR Live freshness dot */}
          <div>
            {flashInfo.isLive ? (
              <span className="bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black shadow-crisp-xs flex items-center gap-1 pointer-events-auto animate-softGaze">
                <span>⚡</span>
                <span>{flashInfo.discountPercent}% OFF</span>
              </span>
            ) : (
              <span className="bg-black/50 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[8px] font-bold shadow-crisp-xs border border-white/10 flex items-center gap-1 pointer-events-auto">
                <span className={`w-1.5 h-1.5 rounded-full ${itemRAG.dotClass}`}></span>
                <span className="text-white/90">{itemRAG.label}</span>
              </span>
            )}
          </div>

          {/* Right Action: Clean Frosted Glass Wishlist Heart */}
          <button
            onClick={(e) => onToggleWishlist(product.id, e)}
            title={isWishlisted ? 'Remove from Saved Wishlist' : 'Save to Wishlist'}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-crisp-xs transition-all active:scale-75 pointer-events-auto backdrop-blur-md ${
              isWishlisted
                ? 'bg-rose-500 text-white shadow-rose-500/25 ring-2 ring-rose-500/20'
                : 'bg-black/40 text-white/90 hover:text-rose-400 hover:bg-black/60 border border-white/20'
            }`}
          >
            <span className={`material-symbols-outlined text-[15px] sm:text-[16px] transition-transform ${isWishlisted ? 'fill-current animate-heartBeat' : ''}`}>
              favorite
            </span>
          </button>
        </div>
      </div>

      {/* Product Content Body with Clean Structured Rows */}
      <div className="p-2.5 sm:p-4 flex flex-col flex-grow">
        {/* Title */}
        <h3 className="font-title-md text-xs sm:text-sm md:text-base font-bold text-on-surface line-clamp-1 group-hover:text-primary transition-colors tracking-tight mb-1">
          {product.name}
        </h3>

        {/* Shop Name + Distance & Opening Status Row */}
        <div className="flex items-center justify-between gap-1 mb-1.5 min-w-0">
          <p className="font-body-sm text-[10px] sm:text-xs text-on-surface-variant truncate flex-1 font-medium">
            {product.shop_name}
          </p>
          <StoreStatusBadge openingTime={product.opening_time} closingTime={product.closing_time} />
        </div>

        {/* Distance & Rating Metadata Pill in Body (Never overlaps photo) */}
        <div className="mb-2 flex items-center gap-1.5 flex-wrap">
          {product.isOwner ? (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              <span className="material-symbols-outlined text-[11px]">storefront</span>
              <span>Your Shop (0m)</span>
            </span>
          ) : product.distanceKm !== null ? (
            <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
              isDistant
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-surface-container-high text-on-surface-variant border-surface-variant/50'
            }`}>
              <span className={`material-symbols-outlined text-[11px] ${isDistant ? 'text-amber-600' : 'text-primary'}`}>
                directions_walk
              </span>
              <span>{formatDistance(product.distanceKm)}</span>
            </span>
          ) : null}

          {/* Rating Pill - live shop average (1 per shop, editable) */}
          {Boolean(product.avg_rating && Number(product.review_count) > 0) && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/30">
              <span className="material-symbols-outlined text-[10px] text-amber-500">star</span>
              <span>{Number(product.avg_rating).toFixed(1)}</span>
              <span className="opacity-70 font-normal">({product.review_count})</span>
            </span>
          )}
        </div>

        {/* Price & Action Bottom Row */}
        <div className="mt-auto flex items-end justify-between pt-2 border-t border-surface-variant/25">
          <div>
            {flashInfo.isLive ? (
              <div className="flex flex-col">
                <FlashCountdownBadge deal={product} />
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-headline-lg-mobile text-sm sm:text-base md:text-lg font-bold text-rose-600">
                    ₹{flashInfo.discountedPrice}
                  </span>
                  <span className="text-[10px] sm:text-xs text-on-surface-variant line-through opacity-70 font-medium">
                    ₹{flashInfo.originalPrice}
                  </span>
                </div>
              </div>
            ) : (
              <span className="font-headline-lg-mobile text-sm sm:text-base md:text-lg font-black text-primary">
                ₹{product.price}
              </span>
            )}
          </div>

          {/* Apple Signature View CTA */}
          <button
            className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full font-label-caps text-[10px] sm:text-xs font-bold transition-all shadow-crisp-xs flex items-center gap-0.5 sm:gap-1 active:scale-95 ${
              isDistant
                ? 'bg-surface-container-high hover:bg-surface-variant text-on-surface border border-surface-variant'
                : 'bg-primary hover:bg-primary/90 text-on-primary shadow-sm hover:shadow-primary/20'
            }`}
          >
            <span>View</span>
            <span className="material-symbols-outlined text-[12px] sm:text-[14px]">arrow_forward</span>
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
  locationStatus,
  dealAlertsActive = false,
  onToggleDealAlerts
}) {
  const [searchQuery, setSearchQuery] = useState('')
  // ⚡ Non-blocking deferred search query for 60+ FPS responsive typing on 1.6 GHz processors
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const [selectedCategory, setSelectedCategory] = useState('All')
  const [maxRadiusKm, setMaxRadiusKm] = useState(2) // Default to 2km Hyperlocal radius
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false)
  const [showOnlyWishlist, setShowOnlyWishlist] = useState(false)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'map' - Android Map toggle
  const dropdownRef = useRef(null)

  // 📱 Target Shop Filter (from QR Standee scan)
  const [targetShopId, setTargetShopId] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      return params.get('shopId') || null
    } catch {
      return null
    }
  })

  // Wishlist state
  const [wishlistIds, setWishlistIds] = useState(() => {
    try {
      const saved = localStorage.getItem('localfind_wishlist')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Android perf: idle-prefetch free map chunk so tap on "Map" feels instant (saves 400ms on 4G)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isLowData = navigator.connection?.saveData === true
    const isSlow = navigator.connection?.effectiveType === '2g' || navigator.connection?.effectiveType === 'slow-2g'
    if (isLowData || isSlow) return // respect data saver, never prefetch
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 2200))
    const id = idle(() => {
      import('./NearbyMap').catch(() => {})
      // Warm tile DNS via tiny fetch (no render)
      if ('connection' in navigator && !isSlow) {
        // Pre-warm OSM tile connection with a 1x1 pixel (cached)
        const img = new Image()
        img.src = 'https://a.tile.openstreetmap.org/0/0/0.png'
      }
    }, { timeout: 3000 })
    return () => {
      if (window.cancelIdleCallback) cancelIdleCallback(id)
      else clearTimeout(id)
    }
  }, [])

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

    triggerHaptic('medium')
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

  // 1. High-Performance Indexing & Real GPS Distance Matrix
  const indexedProductsWithDistance = useMemo(() => {
    searchLRUCache.clear() // Invalidate LRU query cache when product list updates
    const indexed = indexProductsList(products)
    const hasUserGPS = userCoords?.latitude && userCoords?.longitude
    const uLat = hasUserGPS ? userCoords.latitude : null
    const uLng = hasUserGPS ? userCoords.longitude : null
    const currentUid = currentUser?.uid

    return indexed.map((prod) => {
      const isOwner = Boolean(currentUid && prod.owner_id && prod.owner_id === currentUid)
      let distanceKm = null
      if (isOwner) {
        distanceKm = 0 // Exactly 0 distance for merchant's own shop
      } else {
        const pLat = Number(prod.lat)
        const pLng = Number(prod.lng)
        if (uLat !== null && uLng !== null && Number.isFinite(pLat) && Number.isFinite(pLng)) {
          distanceKm = calculateDistanceKm(uLat, uLng, pLat, pLng)
        }
      }
      return { ...prod, distanceKm, isOwner }
    })
  }, [products, userCoords, currentUser])

  // Find shop details if arriving via QR Standee scan
  const targetShop = useMemo(() => {
    if (!targetShopId) return null
    if (indexedProductsWithDistance && indexedProductsWithDistance.length > 0) {
      const matchedProduct = indexedProductsWithDistance.find((p) => String(p.shop_id) === String(targetShopId))
      if (matchedProduct) {
        return {
          id: matchedProduct.shop_id,
          name: matchedProduct.shop_name,
          address: matchedProduct.address_text || '',
          whatsapp: matchedProduct.whatsapp_number,
          openingTime: matchedProduct.opening_time,
          closingTime: matchedProduct.closing_time,
          distanceKm: matchedProduct.distanceKm,
          avgRating: matchedProduct.avg_rating ? Number(matchedProduct.avg_rating) : null,
          reviewCount: matchedProduct.review_count ? Number(matchedProduct.review_count) : 0
        }
      }
    }
    if (directShopInfo) {
      let distanceKm = null
      if (userCoords?.latitude && userCoords?.longitude && directShopInfo.lat && directShopInfo.lng) {
        distanceKm = calculateDistanceKm(userCoords.latitude, userCoords.longitude, Number(directShopInfo.lat), Number(directShopInfo.lng))
      }
      return {
        ...directShopInfo,
        distanceKm
      }
    }
    return null
  }, [targetShopId, indexedProductsWithDistance, directShopInfo, userCoords])

  // 2. High-Performance Query Filter with LRU Caching
  const filteredProducts = useMemo(() => {
    const queryDesc = parseQueryDescriptor(deferredSearchQuery)
    const categoryLower = selectedCategory.toLowerCase()

    // Generate cache key
    const cacheKey = `${deferredSearchQuery}::${selectedCategory}::${targetShopId || 'all'}::${showOnlyWishlist ? wishlistIds.join(',') : 'all'}`
    const cached = searchLRUCache.get(cacheKey)
    if (cached) return cached

    const results = indexedProductsWithDistance.filter((item) => {
      // 📱 Target Shop check (from QR Standee scan) - ignore global category and wishlist filters in store mode
      if (targetShopId) {
        if (String(item.shop_id) !== String(targetShopId)) return false
        if (queryDesc && !matchesQueryDescriptor(item, queryDesc)) return false
        return true
      }

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
  }, [indexedProductsWithDistance, selectedCategory, deferredSearchQuery, targetShopId, showOnlyWishlist, wishlistSet, wishlistIds])

  // 3. Hyperlocal Products (within selected radius)
  const hyperlocalProducts = useMemo(() => {
    return filteredProducts
      .filter((p) => !p.is_affiliate_fallback)
      .filter((p) => {
        if (targetShopId || maxRadiusKm === 'all' || p.distanceKm === null) return true
        return p.distanceKm <= maxRadiusKm
      })
      .sort((a, b) => {
        if (a.distanceKm === null) return 1
        if (b.distanceKm === null) return -1
        return a.distanceKm - b.distanceKm
      })
  }, [filteredProducts, maxRadiusKm, targetShopId])

  // 4. Distant Products (outside selected radius)
  const distantLocalProducts = useMemo(() => {
    if (targetShopId || maxRadiusKm === 'all') return []
    return filteredProducts
      .filter((p) => !p.is_affiliate_fallback)
      .filter((p) => p.distanceKm !== null && p.distanceKm > maxRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [filteredProducts, maxRadiusKm, targetShopId])

  // 5. Active Flash Deals
  const activeFlashDeals = useMemo(() => {
    return indexedProductsWithDistance
      .filter((p) => {
        if (targetShopId && String(p.shop_id) !== String(targetShopId)) return false
        if (!p.is_flash_deal || !p.flash_deal_ends_at) return false
        const info = getFlashDealInfo(p)
        return info.isLive
      })
      .sort((a, b) => {
        if (a.distanceKm === null) return 1
        if (b.distanceKm === null) return -1
        return a.distanceKm - b.distanceKm
      })
  }, [indexedProductsWithDistance, targetShopId])

  // 6. Online Fallback Options
  const fallbackProducts = useMemo(() => {
    return filteredProducts.filter((p) => p.is_affiliate_fallback)
  }, [filteredProducts])

  // 7. Map-ready products (all local, non-affiliate)
  const mapProducts = useMemo(() => {
    return filteredProducts.filter((p) => !p.is_affiliate_fallback)
  }, [filteredProducts])

  const handleWhatsAppShop = (e) => {
    if (e) e.stopPropagation()
    if (!targetShop?.whatsapp) return
    const cleanPhone = String(targetShop.whatsapp).replace(/[^0-9]/g, '')
    const intlPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`
    const message = encodeURIComponent(`Hi ${targetShop.name}! I scanned your counter QR on LocalFind and would like to ask about your products.`)
    window.open(`https://wa.me/${intlPhone}?text=${message}`, '_blank')
  }

  return (
    <main className="pt-4 md:pt-6 px-container-margin max-w-7xl mx-auto pb-24 md:pb-12">
      {/* 🏪 MODE 1: Dedicated Clean Store Showcase (When QR Standee is Scanned) */}
      {targetShopId ? (
        <div className="space-y-5 animate-fadeIn">
          {/* Shop Profile Header at the Very Top */}
          <div className="bg-surface apple-frosted border border-surface-variant/70 rounded-3xl p-5 sm:p-6 shadow-crisp-sm relative overflow-hidden">
            {targetShop ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary to-orange-600 text-white flex items-center justify-center shadow-crisp-sm flex-shrink-0">
                    <span className="material-symbols-outlined text-3xl sm:text-4xl">storefront</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h1 className="font-display-lg text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                        {targetShop.name}
                      </h1>
                      <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        ✨ Verified Store
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap text-xs text-on-surface-variant">
                      {targetShop.avgRating !== null && targetShop.avgRating !== undefined && targetShop.avgRating > 0 && (
                        <ReviewStars rating={targetShop.avgRating} reviewCount={targetShop.reviewCount} size="sm" showValue={true} />
                      )}
                      {targetShop.address && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                          <span className="line-clamp-1">{targetShop.address}</span>
                        </span>
                      )}
                      {targetShop.distanceKm !== null && targetShop.distanceKm !== undefined && (
                        <span className="flex items-center gap-1 font-semibold text-primary">
                          <span>•</span>
                          <span>{formatDistance(targetShop.distanceKm)}</span>
                        </span>
                      )}
                      <StoreStatusBadge openingTime={targetShop.openingTime} closingTime={targetShop.closingTime} />
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Direct WhatsApp Order + Explore Others */}
                <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
                  {targetShop.whatsapp && (
                    <button
                      onClick={handleWhatsAppShop}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-crisp-xs flex items-center gap-1.5 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">chat</span>
                      <span>WhatsApp Shop</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setTargetShopId(null)
                      const params = new URLSearchParams(window.location.search)
                      params.delete('shopId')
                      params.delete('shop')
                      const q = params.toString() ? `?${params.toString()}` : ''
                      window.history.replaceState({}, '', window.location.pathname + q)
                    }}
                    className="bg-surface-container-high hover:bg-surface-variant text-on-surface px-4 py-2.5 rounded-full text-xs font-bold border border-surface-variant/70 shadow-crisp-xs active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm text-primary">explore</span>
                    <span>Explore All Stores</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Loading Skeleton for Store Header */
              <div className="animate-pulse flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-variant"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-surface-variant rounded-full w-48"></div>
                  <div className="h-3 bg-surface-variant rounded-full w-32"></div>
                </div>
              </div>
            )}
          </div>

          {/* Clean Dedicated Search Bar Directly Below Shop Details (No Category Tags) */}
          <div className="relative w-full group flex items-center">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg group-focus-within:text-primary transition-colors pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={targetShop ? `Search items in ${targetShop.name}...` : 'Search products in store...'}
              className="w-full bg-surface-container-high/80 apple-frosted border border-surface-variant/60 focus:border-primary focus:ring-4 focus:ring-primary/15 rounded-full py-3 sm:py-3.5 pl-11 pr-28 text-xs sm:text-sm md:text-base text-on-surface placeholder-on-surface-variant transition-all shadow-crisp-xs font-medium"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSpeechLanguage((prev) => (prev === 'hi-IN' ? 'en-IN' : 'hi-IN'))}
                className="bg-surface/85 text-on-surface border border-surface-variant/70 px-2 py-1 rounded-full text-[10px] font-extrabold"
              >
                <span>{speechLanguage === 'hi-IN' ? 'हिन्दी' : 'ENG'}</span>
              </button>
              <button
                type="button"
                onClick={toggleVoiceSearch}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-crisp-xs active:scale-90 ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-primary text-on-primary'
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {isListening ? 'graphic_eq' : 'mic'}
                </span>
              </button>
            </div>
          </div>

          {/* Voice Toast if active */}
          {voiceToast && (
            <div className="p-2.5 px-4 bg-primary/10 border border-primary/30 rounded-2xl flex items-center justify-between text-xs font-semibold text-primary animate-fadeIn">
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

          {/* Active Store Flash Deals */}
          {activeFlashDeals.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-orange-500/10 border border-amber-500/30 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <h3 className="font-title-md text-sm sm:text-base font-bold text-on-surface">
                    Counter Flash Deals
                  </h3>
                </div>
                {activeFlashDeals[0] && <LiveHUDTimer deal={activeFlashDeals[0]} />}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {activeFlashDeals.map((deal) => (
                  <ProductCard
                    key={`store-flash-${deal.id}`}
                    product={deal}
                    onSelectProduct={onSelectProduct}
                    isWishlisted={wishlistSet.has(deal.id)}
                    onToggleWishlist={toggleWishlist}
                    priority={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Store Products List */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="font-title-md text-sm sm:text-base font-bold text-on-surface">
                Store Catalog ({filteredProducts.length})
              </h3>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                {filteredProducts.map((p, idx) => (
                  <ProductCard
                    key={`shop-p-${p.id}`}
                    product={p}
                    onSelectProduct={onSelectProduct}
                    isWishlisted={wishlistSet.has(p.id)}
                    onToggleWishlist={toggleWishlist}
                    priority={idx < 4}
                  />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center bg-surface-container-low/50 rounded-3xl border border-surface-variant/40">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">search_off</span>
                <p className="text-sm font-bold text-on-surface">No products matching "{searchQuery}"</p>
                <p className="text-xs text-on-surface-variant mt-1">Try another keyword or clear the search bar</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 bg-primary text-on-primary text-xs font-bold px-4 py-1.5 rounded-full shadow-crisp-xs"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 🏙️ MODE 2: General Neighborhood Explore View (Full Catalog with Categories & Filters) */
        <>
          {/* Search and Filter Section - Apple Capsule System */}
          <section className="mb-5 bg-surface py-2">
            <div className="relative w-full flex items-center gap-2 sm:gap-2.5">
              {/* Main Integrated Search Bar with Embedded Mic & Language Switcher */}
              <div className="relative flex-1 group flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-base sm:text-lg group-focus-within:text-primary transition-colors pointer-events-none">
                  search
                </span>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 'Cheeni', 'Milk', 'Charger'..."
                  className="w-full bg-surface-container-high/80 apple-frosted border border-surface-variant/60 focus:border-primary focus:ring-4 focus:ring-primary/15 rounded-full py-2.5 sm:py-3 pl-10 sm:pl-11 pr-28 sm:pr-32 text-xs sm:text-sm md:text-base text-on-surface placeholder-on-surface-variant transition-all shadow-crisp-xs"
                />

                <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-1.5">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      title="Clear search text"
                      className="p-1 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs sm:text-sm">close</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSpeechLanguage((prev) => (prev === 'hi-IN' ? 'en-IN' : 'hi-IN'))}
                    title={`Switch voice language (${speechLanguage === 'hi-IN' ? 'Hindi / Hinglish' : 'English'})`}
                    className="bg-surface/85 hover:bg-surface text-on-surface border border-surface-variant/70 hover:border-primary/40 px-1.5 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-extrabold transition-all shadow-2xs active:scale-95 flex items-center gap-0.5"
                  >
                    <span>{speechLanguage === 'hi-IN' ? 'हिन्दी' : 'ENG'}</span>
                  </button>

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

              {/* Filter Button & Modal */}
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

                {showFiltersDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[600] md:hidden animate-fadeIn"
                      onClick={() => setShowFiltersDropdown(false)}
                    />

                    <div className="fixed md:absolute bottom-0 md:bottom-auto left-0 md:left-auto right-0 md:right-0 md:top-full md:mt-2.5 w-full md:w-80 bg-surface md:bg-surface/95 apple-frosted border-t md:border border-surface-variant/80 rounded-t-[32px] md:rounded-3xl shadow-crisp-xl p-5 md:p-4.5 z-[600] animate-slide-up-sheet md:animate-popIn max-h-[85vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] md:pb-4.5">
                      <div className="w-12 h-1 bg-on-surface/20 rounded-full mx-auto -mt-2 mb-3.5 md:hidden"></div>

                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-variant/40">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-base">tune</span>
                          <span className="font-title-md text-sm md:text-xs font-bold text-on-surface">Filter & Customize</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(selectedCategory !== 'All' || maxRadiusKm !== 2 || showOnlyWishlist) && (
                            <button
                              onClick={() => {
                                setSelectedCategory('All')
                                setMaxRadiusKm(2)
                                setShowOnlyWishlist(false)
                              }}
                              className="text-[11px] md:text-[10px] font-bold text-primary hover:underline px-2 py-0.5"
                            >
                              Reset
                            </button>
                          )}
                          <button
                            onClick={() => setShowFiltersDropdown(false)}
                            className="p-1 text-on-surface-variant hover:text-on-surface rounded-full"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </div>
                      </div>

                      {/* Wishlist Toggle */}
                      <div className="mb-4">
                        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                          Saved Items
                        </label>
                        <button
                          onClick={() => setShowOnlyWishlist((prev) => !prev)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                            showOnlyWishlist
                              ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/20 shadow-sm'
                              : 'bg-surface-container-high/80 hover:bg-surface-variant text-on-surface border-surface-variant/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-lg ${showOnlyWishlist ? 'fill-current animate-heartBeat' : 'text-rose-500'}`}>
                              favorite
                            </span>
                            <span>Show Saved Wishlist</span>
                          </div>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                            showOnlyWishlist ? 'bg-white text-rose-600' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}>
                            {wishlistIds.length} {wishlistIds.length === 1 ? 'item' : 'items'}
                          </span>
                        </button>
                      </div>

                      {/* Distance Radius */}
                      <div className="mb-4">
                        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                          Search Radius
                        </label>
                        <div className="grid grid-cols-2 gap-2">
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
                                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center ${
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

                      {/* Category Selection */}
                      <div className="mb-4">
                        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                          Category ({selectedCategory})
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {CATEGORIES.map((cat) => {
                            const isActive = selectedCategory === cat.label
                            return (
                              <button
                                key={cat.label}
                                onClick={() => setSelectedCategory(cat.label)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-label-caps text-xs transition-all text-left ${
                                  isActive
                                    ? 'bg-primary text-on-primary font-bold shadow-crisp-xs ring-2 ring-primary/20'
                                    : 'bg-surface-container-high/80 hover:bg-surface-variant text-on-surface border border-surface-variant/40'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                                <span className="truncate">{cat.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-surface-variant/40">
                        <button
                          onClick={() => setShowFiltersDropdown(false)}
                          className="w-full bg-primary hover:bg-primary/90 text-on-primary py-3 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95 text-center flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-base">check</span>
                          <span>Apply Filters</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Category Pills Bar */}
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-2 mt-1">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.label
                return (
                  <button
                    key={`chip-${cat.label}`}
                    onClick={() => setSelectedCategory(cat.label)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 flex-shrink-0 ${
                      isActive
                        ? 'bg-primary text-on-primary font-bold shadow-crisp-xs'
                        : 'bg-surface-container-high/60 hover:bg-surface-container-high text-on-surface border border-surface-variant/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px] opacity-85">{cat.icon}</span>
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

          {/* List | Map Toggle */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center bg-surface-container-high/70 p-1 rounded-full border border-surface-variant/50 shadow-crisp-xs">
              <button
                onClick={() => { triggerHaptic('selection'); setViewMode('list') }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all min-h-[36px] ${viewMode === 'list' ? 'bg-surface text-primary shadow-crisp-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                aria-pressed={viewMode === 'list'}
              >
                <span className="material-symbols-outlined text-[16px]">view_module</span>
                <span>List</span>
                <span className="hidden xs:inline text-[10px] opacity-60">({hyperlocalProducts.length})</span>
              </button>
              <button
                onClick={() => { triggerHaptic('selection'); setViewMode('map') }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all min-h-[36px] ${viewMode === 'map' ? 'bg-primary text-on-primary shadow-crisp-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                aria-pressed={viewMode === 'map'}
              >
                <span className="material-symbols-outlined text-[16px]">map</span>
                <span>Map</span>
                {mapProducts.length > 0 && <span className="bg-white/20 text-[10px] px-1.5 py-0.2 rounded-full">{mapProducts.length}</span>}
              </button>
            </div>
            {viewMode === 'map' && (
              <span className="text-[11px] font-medium text-on-surface-variant hidden sm:flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {mapProducts.length > 0 ? `${new Set(mapProducts.map(p=>p.shop_id)).size} shops on map` : 'No shops'}
              </span>
            )}
          </div>

          {/* Map View */}
          {viewMode === 'map' && (
            <section className="mb-8 animate-fadeIn">
              <React.Suspense fallback={
                <div className="h-[58vh] sm:h-[60vh] md:h-[520px] w-full rounded-3xl border border-surface-variant/30 bg-surface-container-low flex items-center justify-center">
                  <div className="flex items-center gap-2 bg-surface/90 apple-frosted px-4 py-2 rounded-full shadow-crisp-xs border border-surface-variant/50">
                    <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span className="text-xs font-bold text-on-surface">Loading free map…</span>
                  </div>
                </div>
              }>
                <NearbyMap
                  mode="buyer"
                  userCoords={userCoords}
                  products={mapProducts}
                  maxRadiusKm={maxRadiusKm}
                  onSelectProduct={onSelectProduct}
                  onSelectShop={(shop) => {
                    const first = shop.products?.[0]
                    if (first) onSelectProduct(first)
                  }}
                />
              </React.Suspense>
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px] text-primary">info</span>
                <span>Tap a shop pin → view items → get free directions</span>
              </div>
            </section>
          )}

          {/* ⚡ 24-Hour Flash Deals Section */}
          {!loading && activeFlashDeals.length > 0 && (
            <section className="mb-8 relative">
              <div className="relative overflow-hidden rounded-3xl border border-surface-variant/70 bg-surface-container-low/70 p-4 sm:p-5 shadow-crisp-xs backdrop-blur-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-base flex-shrink-0">
                      ⚡
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-title-md text-sm sm:text-base font-bold text-on-surface tracking-tight flex items-center gap-1.5">
                          <span>Aaj Ka Offer • Flash Deals</span>
                          <span className="text-[9px] bg-rose-500 text-white font-extrabold px-2 py-0.5 rounded-full">
                            LIVE
                          </span>
                        </h2>
                      </div>
                      <p className="text-[11px] text-on-surface-variant font-medium">
                        Limited-time neighborhood bargains from verified local shops
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {activeFlashDeals[0] && <LiveHUDTimer deal={activeFlashDeals[0]} />}
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/30">
                      {activeFlashDeals.length} {activeFlashDeals.length === 1 ? 'Deal' : 'Deals'}
                    </span>
                    {onToggleDealAlerts && (
                      <button
                        type="button"
                        onClick={onToggleDealAlerts}
                        title={dealAlertsActive ? 'Local Deal Alerts Active (Tap to mute)' : 'Get notified when new flash deals launch'}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
                          dealAlertsActive
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-surface hover:bg-surface-variant text-on-surface-variant border-surface-variant/60'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {dealAlertsActive ? 'notifications_active' : 'notifications'}
                        </span>
                        <span>{dealAlertsActive ? 'Alerts On' : 'Notify'}</span>
                      </button>
                    )}
                  </div>
                </div>

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

          {/* Hyperlocal Nearby Products Grid */}
          {viewMode === 'list' && !loading && (
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

          {/* Stores Beyond Selected Radius */}
          {viewMode === 'list' && !loading && distantLocalProducts.length > 0 && (
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

          {/* Online Fallback Options */}
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
        </>
      )}

      {/* 🌟 Minimalist Linear-Style Footer */}
      <footer className="mt-10 pt-4 border-t border-surface-variant/20 text-center pb-6 flex flex-col items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-on-surface-variant/80 font-medium flex-wrap">
          <span className="tracking-tight">LocalFind • Hyperlocal Physical Commerce</span>
          <span className="opacity-30">•</span>
          <span className="inline-flex items-center gap-1 text-on-surface/90">
            <span>Crafted with</span>
            <span className="text-rose-500 text-[10px]">❤️</span>
            <span>by <strong className="text-primary font-bold">NAKSH</strong></span>
          </span>
          <span className="opacity-30">•</span>
          <span className="text-[9px] font-mono font-bold bg-surface-container-high/80 text-on-surface-variant px-1.5 py-0.2 rounded border border-surface-variant/50">
            v2.3.0
          </span>
        </div>
      </footer>
    </main>
  )
}
