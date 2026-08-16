import React, { useState, useMemo, useEffect, useRef } from 'react'
import { calculateDistanceKm, formatDistance } from '../utils/haversine'
import { getRAGStatus } from '../utils/syncRAG'
import { getStoreOpenStatus } from '../utils/storeHours'
import { matchesQueryWithHinglish, normalizeVoiceQuery } from '../utils/hinglishSearch'

const CATEGORIES = [
  { label: 'All', icon: 'interests' },
  { label: 'Handmade', icon: 'handyman' },
  { label: 'Groceries', icon: 'local_cafe' },
  { label: 'Fashion', icon: 'checkroom' },
  { label: 'Electronics', icon: 'devices' },
  { label: 'Sale', icon: 'sell' }
]

export function BuyerDiscover({
  products = [],
  userCoords,
  onSelectProduct,
  loading,
  onRefreshProducts,
  refreshing,
  lastSyncedAt
}) {
  const syncRAG = getRAGStatus(lastSyncedAt)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [maxRadiusKm, setMaxRadiusKm] = useState(2) // Default to 2km Hyperlocal radius

  // Voice Search States (Hindi & Hinglish Web Speech API)
  const [isListening, setIsListening] = useState(false)
  const [speechLanguage, setSpeechLanguage] = useState('hi-IN') // 'hi-IN' or 'en-IN'
  const [voiceToast, setVoiceToast] = useState('')
  const recognitionRef = useRef(null)

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = speechLanguage

      recognition.onstart = () => {
        setIsListening(true)
        setVoiceToast(speechLanguage === 'hi-IN' ? 'सुन रहे हैं... बोलिए (Listening in Hindi/Hinglish)' : 'Listening... Speak now')
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

  // Toggle Voice Recognition
  const toggleVoiceSearch = () => {
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
  }

  // Calculate distance for all products and sort by distance
  const productsWithDistance = useMemo(() => {
    return products.map((prod) => {
      let distanceKm = null
      if (userCoords && prod.lat && prod.lng) {
        distanceKm = calculateDistanceKm(userCoords.lat, userCoords.lng, prod.lat, prod.lng)
      }
      return { ...prod, distanceKm }
    })
  }, [products, userCoords])

  // Filter products by smart Hindi/Hinglish search and category
  const filteredProducts = useMemo(() => {
    return productsWithDistance.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        item.category?.toLowerCase() === selectedCategory.toLowerCase()

      const matchesSearch = matchesQueryWithHinglish(item, searchQuery)

      return matchesCategory && matchesSearch
    })
  }, [productsWithDistance, selectedCategory, searchQuery])

  // Local products strictly within the selected radius (Default: 2 km)
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

  // Local products beyond the selected radius (e.g. 16 km away)
  const distantLocalProducts = useMemo(() => {
    if (maxRadiusKm === 'all') return []
    return filteredProducts
      .filter((p) => !p.is_affiliate_fallback)
      .filter((p) => p.distanceKm !== null && p.distanceKm > maxRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [filteredProducts, maxRadiusKm])

  const fallbackProducts = useMemo(() => {
    return filteredProducts.filter((p) => p.is_affiliate_fallback)
  }, [filteredProducts])

  return (
    <main className="pt-20 md:pt-28 px-container-margin max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Search and Category Filter Section */}
      <section className="mb-stack-lg sticky top-16 md:top-20 bg-surface z-30 py-3">
        <div className="relative w-full mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or tap mic for 'Cheeni chahiye', 'Charger'..."
              className="w-full bg-surface-container-high border border-surface-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-2xl py-3 pl-12 pr-10 font-body-lg text-on-surface placeholder-on-surface-variant transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Hindi / English Voice Search Button */}
          <button
            onClick={toggleVoiceSearch}
            title={isListening ? 'Stop listening' : `Tap to speak (${speechLanguage === 'hi-IN' ? 'Hindi / Hinglish' : 'English'})`}
            className={`flex-shrink-0 flex items-center justify-center p-3 rounded-2xl transition-all shadow-sm active:scale-90 border ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30 border-rose-600'
                : 'bg-primary text-on-primary hover:bg-primary/90 border-white/20'
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {isListening ? 'graphic_eq' : 'mic'}
            </span>
          </button>

          {/* Language Toggle (हिन्दी / Eng) */}
          <button
            onClick={() => setSpeechLanguage((prev) => (prev === 'hi-IN' ? 'en-IN' : 'hi-IN'))}
            title="Switch voice search language"
            className="flex-shrink-0 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-surface-variant px-2.5 py-2.5 rounded-2xl text-[11px] font-bold transition-all shadow-2xs active:scale-95 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm text-primary">translate</span>
            <span>{speechLanguage === 'hi-IN' ? 'हिन्दी' : 'ENG'}</span>
          </button>
        </div>

        {/* Live Voice Status Feedback Banner */}
        {voiceToast && (
          <div className="mb-3 p-2.5 px-4 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between text-xs font-semibold text-primary animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full bg-primary ${isListening ? 'animate-ping' : ''}`}></span>
              <span>{voiceToast}</span>
            </div>
            {isListening && (
              <button
                onClick={toggleVoiceSearch}
                className="text-[10px] bg-primary text-on-primary px-2 py-0.5 rounded-full font-bold"
              >
                Done
              </button>
            )}
          </div>
        )}

        {/* Category Filter Chips */}
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.label
            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-label-caps text-xs shadow-sm whitespace-nowrap active:scale-95 transition-all ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-bold ring-2 ring-secondary'
                    : 'bg-surface-container-high border border-surface-variant text-on-surface hover:bg-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Hyperlocal Distance Radius Filter Bar */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-variant/40 overflow-x-auto hide-scrollbar">
          <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-sm text-primary">near_me</span>
            <span>Hyperlocal Radius:</span>
          </span>
          {[
            { label: '2 km (Hyperlocal)', value: 2 },
            { label: '5 km', value: 5 },
            { label: '10 km', value: 10 },
            { label: 'All Distances', value: 'all' }
          ].map((rad) => {
            const isActive = maxRadiusKm === rad.value
            return (
              <button
                key={rad.label}
                onClick={() => setMaxRadiusKm(rad.value)}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm font-bold'
                    : 'bg-surface-container-high border border-surface-variant text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                {rad.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-surface-container-lowest rounded-xl h-80 animate-pulse border border-surface-variant/40"></div>
          ))}
        </div>
      )}

      {/* Hyperlocal 2km Product Feed */}
      {!loading && (
        <section className="mb-stack-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-headline-lg-mobile text-xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">store</span>
                <span>
                  {maxRadiusKm === 'all'
                    ? 'Available in Offline Stores'
                    : `Available Nearby (Within ${maxRadiusKm} km)`}
                </span>
              </h2>
              {onRefreshProducts && (
                <button
                  onClick={onRefreshProducts}
                  disabled={refreshing}
                  title="Refresh products list"
                  className="p-1.5 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-variant transition-colors flex items-center justify-center border border-surface-variant active:scale-95"
                >
                  <span className={`material-symbols-outlined text-base ${refreshing ? 'animate-spin text-primary' : ''}`}>
                    refresh
                  </span>
                </button>
              )}
            </div>
            <span className="text-xs text-on-surface-variant font-medium">
              {hyperlocalProducts.length} local items
            </span>
          </div>

          {hyperlocalProducts.length === 0 ? (
            <div className="bg-surface-container-low p-8 rounded-2xl border border-surface-variant text-center my-6">
              <span className="material-symbols-outlined text-4xl text-primary mb-2">near_me_disabled</span>
              <h3 className="font-title-md text-lg font-bold text-on-surface mb-1">No Local Products Within {maxRadiusKm === 'all' ? 'Range' : `${maxRadiusKm} km`}</h3>
              <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-4">
                {distantLocalProducts.length > 0
                  ? `Found ${distantLocalProducts.length} store items slightly further away (beyond ${maxRadiusKm} km). Try widening your radius filter to 5 km or 10 km above!`
                  : 'No nearby shopkeeper has listed this item yet. Check out online fallback options below!'}
              </p>
              {distantLocalProducts.length > 0 && (
                <button
                  onClick={() => setMaxRadiusKm('all')}
                  className="bg-primary text-on-primary px-4 py-2 rounded-xl text-xs font-bold shadow-sm"
                >
                  Show All Distances
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
              {hyperlocalProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="bg-surface-container-lowest rounded-xl shadow-[0px_4px_20px_rgba(31,27,23,0.04)] overflow-hidden border border-surface-variant/50 flex flex-col group cursor-pointer hover:shadow-[0px_8px_24px_rgba(156,62,32,0.12)] hover:border-primary/40 transition-all duration-300"
                >
                  <div className="relative w-full aspect-square overflow-hidden bg-surface-variant">
                    <img
                      src={product.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'}
                      alt={product.name}
                      onError={(e) => {
                        e.target.onerror = null
                        e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {product.distanceKm !== null && (
                      <div className="absolute top-3 right-3 bg-secondary text-on-secondary px-2.5 py-1 rounded-full font-label-caps text-[11px] flex items-center gap-1 shadow-sm backdrop-blur-md bg-opacity-95 font-semibold">
                        <span className="material-symbols-outlined text-[14px]">directions_walk</span>
                        <span>{formatDistance(product.distanceKm)}</span>
                      </div>
                    )}
                    {/* Live RAG Update Status Pill on Product Photo */}
                    {(() => {
                      const itemRAG = getRAGStatus(product.updated_at || product.created_at)
                      return (
                        <div className="absolute top-3 left-3 bg-surface/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm border border-surface-variant/40">
                          <span className={`w-1.5 h-1.5 rounded-full ${itemRAG.dotClass}`}></span>
                          <span className={itemRAG.textClass}>{itemRAG.label}</span>
                        </div>
                      )
                    })()}
                  </div>
                  <div className="p-4 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-title-md text-base font-semibold text-on-surface line-clamp-1">
                        {product.name}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <p className="font-body-sm text-xs text-on-surface-variant line-clamp-1 flex-1">
                        {product.shop_name}
                      </p>
                      {(() => {
                        const openStatus = getStoreOpenStatus(product.opening_time, product.closing_time)
                        return (
                          <span
                            title={openStatus.detail}
                            className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.2 rounded-full border flex items-center gap-1 ${openStatus.badgeClass}`}
                          >
                            <span className={`w-1 h-1 rounded-full ${openStatus.dotClass}`}></span>
                            <span>{openStatus.label}</span>
                          </span>
                        )
                      })()}
                    </div>
                    <div className="mt-auto flex items-end justify-between pt-2">
                      <div>
                        <span className="font-headline-lg-mobile text-xl font-bold text-primary">
                          ₹{product.price}
                        </span>
                      </div>
                      <button className="bg-primary hover:bg-primary-container text-on-primary px-3.5 py-1.5 rounded-xl font-label-caps text-xs font-bold transition-all shadow-xs hover:shadow-sm flex items-center gap-1 active:scale-95">
                        <span>View Details</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Stores Beyond Selected Radius (e.g. 16 km away) */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
            {distantLocalProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-amber-500/30 flex flex-col group cursor-pointer hover:shadow-md transition-all duration-300"
              >
                <div className="relative w-full aspect-square overflow-hidden bg-surface-variant">
                  <img
                    src={product.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                  />
                  {product.distanceKm !== null && (
                    <div className="absolute top-3 right-3 bg-amber-600 text-white px-2.5 py-1 rounded-full font-label-caps text-[11px] flex items-center gap-1 shadow-sm backdrop-blur-md bg-opacity-95 font-semibold">
                      <span className="material-symbols-outlined text-[14px]">map</span>
                      <span>{formatDistance(product.distanceKm)} (Beyond {maxRadiusKm}km)</span>
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-title-md text-base font-semibold text-on-surface line-clamp-1">
                      {product.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="font-body-sm text-xs text-on-surface-variant line-clamp-1 flex-1">
                      {product.shop_name}
                    </p>
                    {(() => {
                      const openStatus = getStoreOpenStatus(product.opening_time, product.closing_time)
                      return (
                        <span
                          title={openStatus.detail}
                          className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.2 rounded-full border flex items-center gap-1 ${openStatus.badgeClass}`}
                        >
                          <span className={`w-1 h-1 rounded-full ${openStatus.dotClass}`}></span>
                          <span>{openStatus.label}</span>
                        </span>
                      )
                    })()}
                  </div>
                    <div className="mt-auto flex items-end justify-between pt-2">
                      <div>
                        <span className="font-headline-lg-mobile text-xl font-bold text-primary">
                          ₹{product.price}
                        </span>
                      </div>
                      <button className="bg-surface-container-high hover:bg-surface-variant text-on-surface px-3.5 py-1.5 rounded-xl font-label-caps text-xs font-bold transition-all shadow-xs flex items-center gap-1 border border-surface-variant active:scale-95">
                        <span>View Details</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
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
                  src={product.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&auto=format&fit=crop&q=80'}
                  alt={product.name}
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
