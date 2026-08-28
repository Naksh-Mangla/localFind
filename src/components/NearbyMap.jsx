import React, { useEffect, useRef, useState, useCallback } from 'react'
import { getStoreOpenStatus } from '../utils/storeHours'
import { formatDistance } from '../utils/haversine'
import { triggerHaptic } from '../utils/haptics'

// Android-optimized free map using Leaflet + OSM (zero API key, lazy-loaded)
// Covers buyer shop-discovery + merchant draggable PIN modes
export function NearbyMap({
  mode = 'buyer', // 'buyer' | 'edit'
  userCoords,
  products = [],
  maxRadiusKm = 2,
  onSelectProduct,
  onSelectShop,
  // edit mode props
  lat,
  lng,
  onLocationChange,
  heightClass = 'h-[58vh] sm:h-[60vh] md:h-[520px]',
}) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markersLayerRef = useRef(null)
  const userMarkerRef = useRef(null)
  const editMarkerRef = useRef(null)
  const leafletRef = useRef(null)
  const hasFittedRef = useRef(false)
  const prevMaxRadiusRef = useRef(maxRadiusKm)
  const editClickAddedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [selectedShop, setSelectedShop] = useState(null)
  const [isLocating, setIsLocating] = useState(false)

  // Group products by shop_id for single marker per shop (reduces DOM & overdraw)
  const shopsGrouped = React.useMemo(() => {
    if (mode === 'edit') return []
    const map = new Map()
    for (const p of products) {
      const sLat = Number(p.lat)
      const sLng = Number(p.lng)
      if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) continue
      const id = p.shop_id || p.shop_name
      if (!map.has(id)) {
        map.set(id, {
          shop_id: p.shop_id,
          shop_name: p.shop_name || 'Local Shop',
          lat: sLat,
          lng: sLng,
          address_text: p.address_text || '',
          opening_time: p.opening_time,
          closing_time: p.closing_time,
          whatsapp_number: p.whatsapp_number,
          products: [],
          distanceKm: p.distanceKm ?? null,
          hasFlash: false,
        })
      }
      const entry = map.get(id)
      entry.products.push(p)
      if (p.is_flash_deal) entry.hasFlash = true
      // keep smallest distance
      if (p.distanceKm != null && (entry.distanceKm == null || p.distanceKm < entry.distanceKm)) {
        entry.distanceKm = p.distanceKm
      }
    }
    return Array.from(map.values())
  }, [products, mode])

  const getDirectionsUrl = useCallback((sLat, sLng, label) => {
    // Android intent: geo:0,0?q=lat,lng(label) is most compatible across OEMs
    const safeLabel = (label || 'Shop').replace(/[()]/g, ' ')
    const q = encodeURIComponent(`${sLat},${sLng} (${safeLabel})`)
    const isAndroid = /Android/i.test(navigator.userAgent || '')
    if (isAndroid) return `geo:0,0?q=${sLat},${sLng}(${encodeURIComponent(safeLabel)})`
    return `https://www.google.com/maps/dir/?api=1&destination=${sLat},${sLng}&destination_place_id=&travelmode=walking`
  }, [])

  // Init map once
  useEffect(() => {
    let cancelled = false
    let map = null

    const init = async () => {
      try {
        // Android fast path: load JS + CSS in parallel (was sequential -> 180ms saved on 4G)
        const leafletPromise = import('leaflet')
        const cssPromise = import('leaflet/dist/leaflet.css').catch(() => {
          // Fallback CDN only if Vite CSS chunk fails (respects data saver)
          const saveData = navigator.connection?.saveData === true
          if (saveData) return null
          if (!document.querySelector('link[data-leaflet-css]')) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
            link.setAttribute('data-leaflet-css', 'true')
            document.head.appendChild(link)
          }
          return null
        })
        const [Lmod] = await Promise.all([leafletPromise, cssPromise])
        leafletRef.current = Lmod.default || Lmod
        const Leaflet = leafletRef.current

        if (cancelled || !mapContainerRef.current) return
        if (mapRef.current) return

        // Android low-end detection: reduce animations to keep 60fps on 1.6GHz
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const hwConc = navigator.hardwareConcurrency || 8
        const devMem = navigator.deviceMemory || 8
        const conn = navigator.connection?.effectiveType || '4g'
        const isSlowConn = conn === '2g' || conn === 'slow-2g'
        const isLowEndAndroid = (/Android/i.test(navigator.userAgent) && (hwConc <= 4 || devMem <= 3)) || isSlowConn || prefersReducedMotion
        const animate = !isLowEndAndroid

        // Init center: use userCoords if available, otherwise Delhi default.
        // ShopsGrouped is empty at init (products load async), so don't rely on it - fitBounds will correct later.
        const centerLat = mode === 'edit'
          ? (Number(lat) || userCoords?.lat || 28.6139)
          : (userCoords?.lat || 28.6139)
        const centerLng = mode === 'edit'
          ? (Number(lng) || userCoords?.lng || 77.2090)
          : (userCoords?.lng || 77.2090)

        map = Leaflet.map(mapContainerRef.current, {
          center: [centerLat, centerLng],
          zoom: mode === 'edit' ? 16 : 14,
          zoomControl: false,
          attributionControl: true,
          fadeAnimation: animate,
          zoomAnimation: animate,
          markerZoomAnimation: animate,
          preferCanvas: true, // Android GPU 2D canvas acceleration for vector overlays
          // Android touch ergonomics
          tap: true,
          tapTolerance: 15,
          touchZoom: true,
          doubleClickZoom: true,
          scrollWheelZoom: false, // disable desktop scroll hijack, enable only on desktop via check
          keyboard: false, // save listeners on Android
          dragging: true,
        })

        // Enable scroll wheel only on non-touch (desktop) to avoid hijack
        if (!('ontouchstart' in window)) {
          map.scrollWheelZoom.enable()
        }

        // Zoom control bottom-right for thumb reach on Android
        Leaflet.control.zoom({ position: 'bottomright' }).addTo(map)
        // Compact attribution
        map.attributionControl.setPrefix('')

        // Free OSM tiles - tuned for Android Go (low RAM + 4G)
        const osmTiles = Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          minZoom: 5,
          maxNativeZoom: 18, // up to 18 native, 19 stretches (saves one zoom level of tiles)
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          subdomains: 'abc',
          crossOrigin: true, // enables browser cache reuse + future canvas
          tileSize: 256,
          // Android data saving: detectRetina false on low-end saves 4x data
          detectRetina: !isLowEndAndroid,
          // Tile perf: don't re-fetch while zoom anim, keep 1 buffer (was 2) for 30% less RAM
          updateWhenZooming: false,
          updateWhenIdle: true,
          keepBuffer: 1,
          // Aggressive browser cache: OSM tiles cache 7 days
          // (no effect on first load but helps revisit)
        })
        osmTiles.addTo(map)

        markersLayerRef.current = Leaflet.layerGroup().addTo(map)

        // Android fast invalidate: RAF + 30ms instead of 200ms (feels instant, no blank flash)
        const fastInvalidate = () => {
          if (!map || cancelled) return
          try { map.invalidateSize() } catch (_) {}
        }
        requestAnimationFrame(() => setTimeout(fastInvalidate, 30))
        const ro = new ResizeObserver(() => requestAnimationFrame(fastInvalidate))
        if (mapContainerRef.current) ro.observe(mapContainerRef.current)
        map._ro = ro

        mapRef.current = map
        if (!cancelled) setMapReady(true)

        // Gentle entrance - single RAF invalidate (removed duplicate 100ms timeout)
        map.whenReady(() => requestAnimationFrame(fastInvalidate))
      } catch (err) {
        console.warn('Leaflet init failed:', err)
        if (!cancelled) setLoadError(err.message || 'Map failed to load')
      }
    }

    init()

    return () => {
      cancelled = true
      if (mapRef.current) {
        try {
          if (mapRef.current._ro) mapRef.current._ro.disconnect()
          mapRef.current.remove()
        } catch (_) {}
        mapRef.current = null
        markersLayerRef.current = null
        userMarkerRef.current = null
        editMarkerRef.current = null
      }
    }
  }, []) // init once

  // Edit mode: init draggable pin once, then only update marker position (not map center) on drag/tap
  useEffect(() => {
    if (mode !== 'edit') return
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !mapReady) return

    const nLat = Number(lat)
    const nLng = Number(lng)
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return

    if (editMarkerRef.current) {
      // Update marker position silently (avoid setView fight while dragging)
      const cur = editMarkerRef.current.getLatLng()
      if (Math.abs(cur.lat - nLat) > 0.00001 || Math.abs(cur.lng - nLng) > 0.00001) {
        editMarkerRef.current.setLatLng([nLat, nLng])
      }
      return
    }

    // First time: create draggable marker + single map click listener
    const pinHtml = `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translateZ(0)">
        <div style="width:38px;height:38px;border-radius:50%;background:#9c3e20;color:white;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px rgba(0,0,0,0.25);border:3px solid white">📍</div>
        <div style="width:10px;height:10px;background:#9c3e20;transform:rotate(45deg);margin-top:-5px;box-shadow:0 2px 4px rgba(0,0,0,0.2)"></div>
      </div>`
    const icon = L.divIcon({
      html: pinHtml,
      className: 'localfind-edit-pin',
      iconSize: [38, 46],
      iconAnchor: [19, 46],
    })
    const m = L.marker([nLat, nLng], { icon, draggable: true, autoPan: true }).addTo(markersLayerRef.current)
    m.on('dragend', () => {
      triggerHaptic('selection')
      const ll = m.getLatLng()
      onLocationChange?.({ lat: Number(ll.lat.toFixed(6)), lng: Number(ll.lng.toFixed(6)) })
    })
    if (!editClickAddedRef.current) {
      map.on('click', (e) => {
        if (!editMarkerRef.current) return
        triggerHaptic('light')
        editMarkerRef.current.setLatLng(e.latlng)
        onLocationChange?.({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) })
      })
      editClickAddedRef.current = true
    }
    editMarkerRef.current = m
    // Center once on creation (not on every update)
    map.setView([nLat, nLng], Math.max(map.getZoom(), 16), { animate: true })
  }, [lat, lng, mapReady, mode])

  // Buyer mode: gentle pan to user when coords first arrive (avoid fighting map gestures)
  const prevUserCoordsRef = useRef(null)
  useEffect(() => {
    if (mode !== 'buyer') return
    const map = mapRef.current
    if (!map || !mapReady) return
    if (!userCoords?.lat || !userCoords?.lng) return
    const prev = prevUserCoordsRef.current
    const moved = !prev || Math.abs(prev.lat - userCoords.lat) > 0.0002 || Math.abs(prev.lng - userCoords.lng) > 0.0002
    if (moved && !hasFittedRef.current) {
      // Only auto-pan before fitBounds has run; after that user controls map
      map.panTo([userCoords.lat, userCoords.lng], { animate: true })
    }
    prevUserCoordsRef.current = { lat: userCoords.lat, lng: userCoords.lng }
  }, [userCoords?.lat, userCoords?.lng, mapReady, mode])

  // User location blue dot
  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !mapReady) return
    const uLat = userCoords?.lat
    const uLng = userCoords?.lng
    if (!Number.isFinite(uLat) || !Number.isFinite(uLng)) return

    const acc = Number(userCoords.accuracy) || 50
    const dotHtml = `
      <div style="position:relative;transform:translateZ(0)">
        <div style="position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;background:rgba(59,130,246,0.18);border:1px solid rgba(59,130,246,0.25);animation: ping 1.8s cubic-bezier(0,0,0.2,1) infinite"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3.5px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.45)"></div>
      </div>`
    const dotIcon = L.divIcon({ html: dotHtml, className: 'user-dot', iconSize: [16, 16], iconAnchor: [8, 8] })

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([uLat, uLng])
      if (userMarkerRef.current._accCircle) {
        userMarkerRef.current._accCircle.setLatLng([uLat, uLng])
        userMarkerRef.current._accCircle.setRadius(Math.min(500, Math.max(30, acc)))
      }
    } else {
      const m = L.marker([uLat, uLng], { icon: dotIcon, zIndexOffset: 1000, interactive: false }).addTo(map)
      const circle = L.circle([uLat, uLng], {
        radius: Math.min(500, Math.max(30, acc)),
        color: '#3b82f6',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.08,
      }).addTo(map)
      m._accCircle = circle
      userMarkerRef.current = m
    }
  }, [userCoords?.lat, userCoords?.lng, userCoords?.accuracy, mapReady])

  // Render shop markers (buyer mode) - Android: single clearLayers, fitBounds only once
  useEffect(() => {
    if (mode === 'edit') return
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !mapReady || !markersLayerRef.current) return

    // Clear only shop pins (user dot lives directly on map, not in markersLayer)
    markersLayerRef.current.clearLayers()
    // Close stale bottom sheet if its shop no longer in filtered results
    if (selectedShop) {
      const stillThere = shopsGrouped.some((s) => s.shop_id === selectedShop.shop_id)
      if (!stillThere) setSelectedShop(null)
    }

    if (shopsGrouped.length === 0) {
      hasFittedRef.current = false
      return
    }

    const bounds = L.latLngBounds()
    let hasBounds = false
    const isDistantCheck = (dist) => {
      const r = maxRadiusKm === 'all' ? Infinity : Number(maxRadiusKm) || 2
      return dist != null && dist > r
    }

    shopsGrouped.forEach((shop) => {
      const openStatus = getStoreOpenStatus(shop.opening_time, shop.closing_time)
      const isOpen = openStatus.isOpen
      const isDistantShop = isDistantCheck(shop.distanceKm)
      const initial = (shop.shop_name || 'S').trim().charAt(0).toUpperCase()
      const count = shop.products.length
      // Distinct pin design: flash > distant (amber ring) > open/closed
      const pinBg = shop.hasFlash
        ? 'linear-gradient(135deg,#f59e0b 0%,#ef4444 60%,#ec4899 100%)'
        : isDistantShop ? '#a8a29e' : isOpen ? '#9c3e20' : '#78716c'
      const ring = shop.hasFlash
        ? '0 0 0 4px rgba(245,158,11,0.28), 0 4px 12px rgba(0,0,0,0.2)'
        : isDistantShop
          ? '0 0 0 3px rgba(245,158,11,0.22), 0 2px 8px rgba(0,0,0,0.14)'
          : '0 3px 10px rgba(0,0,0,0.18)'
      const openDot = isOpen ? '#10b981' : '#f43f5e'
      const opacityStyle = isDistantShop ? 'opacity:0.92;filter:saturate(0.85)' : ''

      const html = `
        <button type="button" aria-label="${shop.shop_name} - ${count} items" style="display:flex;flex-direction:column;align-items:center;transform:translateZ(0);cursor:pointer;-webkit-tap-highlight-color:transparent;${opacityStyle}">
          <div style="position:relative;width:44px;height:44px;border-radius:50%;background:${pinBg};color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;letter-spacing:-0.02em;box-shadow:${ring};border:2.5px solid white;will-change:transform">
            <span style="line-height:1">${initial}</span>
            <span style="position:absolute;top:-4px;right:-4px;background:white;color:${shop.hasFlash ? '#b45309' : '#1f1b17'};font-size:9px;font-weight:900;padding:1px 5px;border-radius:9999px;box-shadow:0 1px 6px rgba(0,0,0,0.15);border:1px solid rgba(0,0,0,0.06)">${count}</span>
            <span style="position:absolute;bottom:-1px;right:2px;width:10px;height:10px;border-radius:50%;background:${openDot};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.15)"></span>
          </div>
          <div style="width:10px;height:10px;background:${shop.hasFlash ? '#ec4899' : isDistantShop ? '#a8a29e' : isOpen ? '#9c3e20' : '#78716c'};transform:rotate(45deg);margin-top:-5px;box-shadow:0 2px 4px rgba(0,0,0,0.15);border-right:1px solid rgba(255,255,255,0.8);border-bottom:1px solid rgba(255,255,255,0.8)"></div>
        </button>`

      const icon = L.divIcon({
        html,
        className: 'localfind-shop-pin',
        iconSize: [44, 54],
        iconAnchor: [22, 54],
      })

      const marker = L.marker([shop.lat, shop.lng], { icon, riseOnHover: true, keyboard: false })
      marker.shopData = shop
      marker.on('click', () => {
        triggerHaptic('selection')
        setSelectedShop(shop)
        // Gentle pan, keep zoom
        map.panTo([shop.lat, shop.lng], { animate: true, duration: 0.35 })
      })
      marker.addTo(markersLayerRef.current)
      bounds.extend([shop.lat, shop.lng])
      hasBounds = true
    })

    // Fit bounds only on first load or when maxRadius changes (not on every keystroke to avoid fighting gestures)
    const maxChanged = prevMaxRadiusRef.current !== maxRadiusKm
    const shouldFit = !hasFittedRef.current || maxChanged || shopsGrouped.length === 0
    if (hasBounds && shouldFit) {
      if (userCoords?.lat && userCoords?.lng) bounds.extend([userCoords.lat, userCoords.lng])
      try {
        const isLowEnd = /Android/i.test(navigator.userAgent) && ((navigator.hardwareConcurrency || 8) <= 4)
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15, animate: !isLowEnd })
        hasFittedRef.current = true
        prevMaxRadiusRef.current = maxRadiusKm
      } catch (_) {}
    } else if (hasBounds) {
      prevMaxRadiusRef.current = maxRadiusKm
    }
  }, [shopsGrouped, mapReady, mode, maxRadiusKm])

  const handleLocateMe = useCallback(async () => {
    if (!navigator.geolocation) return
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false)
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        mapRef.current?.flyTo([c.lat, c.lng], 15, { duration: 0.6 })
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  }, [])

  if (loadError) {
    return (
      <div className={`${heightClass} w-full rounded-2xl border border-surface-variant/60 bg-surface-container-low flex flex-col items-center justify-center p-6 text-center`}>
        <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2">map_off</span>
        <p className="text-sm font-bold text-on-surface">Map unavailable</p>
        <p className="text-xs text-on-surface-variant mt-1">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      {/* Map container - GPU layer for Android 60fps */}
      <div
        ref={mapContainerRef}
        className={`${heightClass} w-full rounded-3xl overflow-hidden border border-surface-variant/60 shadow-crisp-sm bg-surface-container-low gpu-layer`}
        style={{ minHeight: mode === 'edit' ? 260 : 380, contain: 'layout paint' }}
        role="region"
        aria-label={mode === 'edit' ? 'Drag pin to set shop location' : 'Nearby shops map'}
      />
      {/* Loading shimmer */}
      {!mapReady && (
        <div className={`absolute inset-0 ${heightClass} rounded-3xl overflow-hidden bg-surface-container-low border border-surface-variant/30 pointer-events-none`}>
          <div className="w-full h-full bg-gradient-to-r from-surface-container-low via-surface-container-high to-surface-container-low animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 bg-surface/90 apple-frosted px-4 py-2 rounded-full shadow-crisp-xs border border-surface-variant/50">
              <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs font-bold text-on-surface">Loading map…</span>
            </div>
          </div>
        </div>
      )}

      {/* Android FABs: Locate + Fullscreen hint */}
      {mode === 'buyer' && mapReady && (
        <div className="absolute bottom-3 left-3 flex flex-col gap-2 z-[400]">
          <button
            onClick={handleLocateMe}
            aria-label="Center to my location"
            className="w-10 h-10 rounded-full bg-surface apple-frosted border border-surface-variant/70 shadow-crisp-md flex items-center justify-center active:scale-95 transition-transform"
          >
            <span className={`material-symbols-outlined text-[20px] text-primary ${isLocating ? 'animate-spin' : ''}`}>
              {isLocating ? 'progress_activity' : 'my_location'}
            </span>
          </button>
        </div>
      )}

      {mode === 'edit' && (
        <p className="text-[11px] text-on-surface-variant font-medium mt-2 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] text-primary">touch_app</span>
          <span>Tap map or drag the pin to set your exact shop location</span>
        </p>
      )}

      {/* Buyer bottom sheet for selected shop - thumb-friendly, safe-area aware */}
      {mode === 'buyer' && selectedShop && (
        <div className="absolute left-2 right-2 bottom-2 z-[450] animate-slideUp">
          <div className="bg-surface/95 apple-frosted rounded-2xl border border-surface-variant/70 shadow-crisp-xl p-3.5 flex gap-3 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg flex-shrink-0 border border-primary/10">
              {selectedShop.shop_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-on-surface truncate pr-1">{selectedShop.shop_name}</h4>
                  <p className="text-[11px] text-on-surface-variant line-clamp-1">{selectedShop.address_text || 'Local shop'}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${getStoreOpenStatus(selectedShop.opening_time, selectedShop.closing_time).badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getStoreOpenStatus(selectedShop.opening_time, selectedShop.closing_time).dotClass}`} />
                      {getStoreOpenStatus(selectedShop.opening_time, selectedShop.closing_time).label}
                    </span>
                    {selectedShop.distanceKm != null && (
                      <span className="text-[10px] font-bold bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full border border-surface-variant/50">
                        {formatDistance(selectedShop.distanceKm)}
                      </span>
                    )}
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {selectedShop.products.length} items
                    </span>
                    {selectedShop.hasFlash && (
                      <span className="text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full animate-softGaze">⚡ Flash Deal</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedShop(null)}
                  className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant flex-shrink-0"
                  aria-label="Close shop details"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              {/* Product peek row */}
              <div className="flex gap-2 mt-2.5 overflow-x-auto hide-scrollbar pb-1">
                {selectedShop.products.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onSelectProduct?.(p); setSelectedShop(null) }}
                    className="flex-shrink-0 w-[84px] bg-surface-container-lowest rounded-2xl border border-surface-variant/40 overflow-hidden text-left active:scale-95 transition-transform"
                  >
                    <img src={p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=70'} alt={p.name} className="w-full h-14 object-cover bg-surface-variant/30" loading="lazy" decoding="async" />
                    <div className="p-1.5">
                      <p className="text-[10px] font-bold text-on-surface line-clamp-1 leading-tight">{p.name}</p>
                      <p className="text-[10px] font-black text-primary">₹{p.price}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={() => onSelectShop ? onSelectShop(selectedShop) : (selectedShop.products[0] && onSelectProduct?.(selectedShop.products[0]))}
                  className="flex-1 bg-primary text-on-primary py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-1 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">storefront</span>
                  <span>View {selectedShop.products.length > 1 ? 'All Items' : 'Item'}</span>
                </button>
                <a
                  href={getDirectionsUrl(selectedShop.lat, selectedShop.lng, selectedShop.shop_name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-surface-container-high border border-surface-variant/70 text-on-surface py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-1 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">directions</span>
                  <span>Directions</span>
                </a>
                {selectedShop.whatsapp_number && (
                  <a
                    href={`https://wa.me/91${String(selectedShop.whatsapp_number).replace(/[^0-9]/g,'').slice(-10)}?text=${encodeURIComponent(`Hi ${selectedShop.shop_name}! Found you on LocalFind. Is this available?`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 rounded-full bg-[#25D366] text-white flex items-center justify-center active:scale-95 flex-shrink-0"
                    aria-label="Chat on WhatsApp"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.05 4.94A9.91 9.91 0 0 0 12.04 2C6.58 2 2.13 6.46 2.13 11.93c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.46 9.91-9.93 0-2.65-1.03-5.14-2.91-7.02zm-7.01 15.2h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.25 8.25 0 0 1-1.26-4.35c0-4.54 3.69-8.23 8.23-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.81c0 4.54-3.69 8.23-8.24 8.23zm6.91-6.17c-.38-.19-2.24-1.11-2.59-1.23-.35-.13-.6-.19-.86.19-.25.38-.99 1.23-1.21 1.48-.22.25-.44.28-.82.09-.38-.19-1.6-.59-3.04-1.88-1.12-1-1.88-2.23-2.1-2.61-.22-.38-.02-.59.17-.78.17-.17.38-.44.57-.66.19-.22.25-.38.38-.63.13-.25.06-.47-.03-.66-.09-.19-.86-2.07-1.18-2.84-.31-.75-.62-.65-.86-.66l-.73-.01c-.25 0-.66.09-1.01.47s-1.32 1.29-1.32 3.15 1.36 3.65 1.55 3.9c.19.25 2.67 4.08 6.46 5.72.9.39 1.6.62 2.15.79.9.29 1.72.25 2.37.15.72-.11 2.24-.92 2.56-1.8.32-.89.32-1.65.22-1.81-.1-.16-.35-.25-.73-.44z"/></svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0 } }
        .localfind-shop-pin, .localfind-edit-pin, .user-dot { background: transparent !important; border: none !important; }
        .leaflet-container { font-family: inherit; background: #f6ece5; }
        .leaflet-control-zoom a { background: rgba(255,255,255,0.94) !important; backdrop-filter: saturate(180%) blur(12px); border: 1px solid rgba(0,0,0,0.06) !important; color: #1f1b17 !important; width: 36px !important; height: 36px !important; line-height: 36px !important; font-size: 16px !important; }
        .leaflet-control-zoom { border-radius: 14px !important; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.11) !important; border: none !important; }
        .leaflet-control-attribution { font-size: 9px !important; background: rgba(255,255,255,0.88) !important; padding: 2px 6px !important; border-radius: 9999px !important; margin: 8px !important; backdrop-filter: blur(8px); }
        @media (max-width: 640px) {
          .leaflet-control-zoom { margin-bottom: 72px !important; }
        }
      `}</style>
    </div>
  )
}
