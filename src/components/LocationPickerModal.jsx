import React, { useState, useEffect } from 'react'
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler'
import { triggerHaptic } from '../utils/haptics'

export function LocationPickerModal({
  isOpen,
  onClose,
  currentLocationName,
  onSelectLocation,
  onUseGPS,
  locationStatus,
  isFirstTimeFallback = false
}) {
  // Sync with Android back gesture
  useAndroidBackHandler(isOpen, onClose, 'location_picker')

  const [pincode, setPincode] = useState('')
  const [address, setAddress] = useState('')
  const [landmark, setLandmark] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Load previous values if available
  useEffect(() => {
    try {
      const savedAddress = localStorage.getItem('localfind_user_address')
      if (savedAddress) {
        const parsed = JSON.parse(savedAddress)
        if (parsed.pincode) setPincode(parsed.pincode)
        if (parsed.address) setAddress(parsed.address)
        if (parsed.landmark) setLandmark(parsed.landmark)
        return
      }
      const saved = localStorage.getItem('localfind_saved_location')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.pincode) setPincode(parsed.pincode)
        if (parsed.address) setAddress(parsed.address)
        if (parsed.landmark) setLandmark(parsed.landmark)
      }
    } catch {}
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isFirstTimeFallback) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    // Lock body scroll while modal is open
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen, onClose, isFirstTimeFallback])

  if (!isOpen) return null

  // Geocode address + landmark + pincode using OpenStreetMap Nominatim
  const handleSubmitLocation = async (e) => {
    e.preventDefault()
    if (!pincode || pincode.trim().length !== 6) {
      setSearchError('Please enter a valid 6-digit Indian Pincode.')
      return
    }

    setSearching(true)
    setSearchError('')

    try {
      // 1. First attempt exact query: Address + Landmark + Pincode
      const fullQuery = `${address ? address + ', ' : ''}${landmark ? landmark + ', ' : ''}${pincode}, India`
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=1&q=${encodeURIComponent(fullQuery)}`
      
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' }
      })
      const data = await res.json()

      let lat, lng, areaName
      if (data && data.length > 0) {
        lat = parseFloat(data[0].lat)
        lng = parseFloat(data[0].lon)
        areaName = data[0].display_name.split(',')[0]
      } else {
        // 2. Fallback attempt with just Pincode
        const pinUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&postalcode=${pincode.trim()}&limit=1`
        const pinRes = await fetch(pinUrl, { headers: { 'Accept-Language': 'en' } })
        const pinData = await pinRes.json()
        if (pinData && pinData.length > 0) {
          lat = parseFloat(pinData[0].lat)
          lng = parseFloat(pinData[0].lon)
          areaName = `${pinData[0].display_name.split(',')[0]} (Pincode ${pincode})`
        }
      }

      if (lat && lng) {
        // Save manual address for next time
        try {
          localStorage.setItem(
            'localfind_user_address',
            JSON.stringify({
              pincode: pincode.trim(),
              address: address.trim(),
              landmark: landmark.trim()
            })
          )
        } catch {}

        onSelectLocation({
          lat,
          lng,
          accuracy: 10,
          locationName: areaName,
          pincode: pincode.trim(),
          address: address.trim(),
          landmark: landmark.trim(),
          isManual: true
        })
        onClose()
      } else {
        setSearchError('Could not verify this Pincode / Address on map. Please check spelling.')
      }
    } catch (err) {
      console.warn('Geocoding error:', err)
      setSearchError('Network error while locating address. Please check your connection.')
    } finally {
      setSearching(false)
    }
  }

  // Quick popular Indian hubs for 1-tap select
  const POPULAR_AREAS = [
    { name: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167, pincode: '110001' },
    { name: 'Bandra, Mumbai', lat: 19.0596, lng: 72.8295, pincode: '400050' },
    { name: 'Indiranagar, Bengaluru', lat: 12.9784, lng: 77.6408, pincode: '560038' },
    { name: 'Sector 18, Noida', lat: 28.5708, lng: 77.3271, pincode: '201301' },
    { name: 'Park Street, Kolkata', lat: 22.5535, lng: 88.3519, pincode: '700016' },
    { name: 'T Nagar, Chennai', lat: 13.0418, lng: 80.2341, pincode: '600017' }
  ]

  return (
    <div 
      onClick={isFirstTimeFallback ? undefined : onClose}
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md overflow-hidden overscroll-none select-none animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-t-[32px] sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-surface-variant max-h-[90dvh] overflow-y-auto overscroll-contain flex flex-col gap-4 animate-slide-up-sheet sm:animate-popIn select-auto pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
      >
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1 bg-on-surface/20 rounded-full mx-auto -mt-1 mb-0.5 sm:hidden"></div>

        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-surface-variant/40">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <span className="material-symbols-outlined text-2xl">location_on</span>
            </div>
            <div>
              <h3 className="font-headline-lg text-lg font-bold text-on-surface">
                {isFirstTimeFallback ? "Set Your Location" : "Choose Your Location"}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Enter your area to discover physical shops within 2 km
              </p>
            </div>
          </div>
          {!isFirstTimeFallback && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* GPS Inaccurate / Denied Explanation Notice */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl flex-shrink-0 mt-0.5">
            wrong_location
          </span>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-on-surface mb-0.5">
              Sorry, we couldn't get your exact live GPS location
            </h4>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              IP or approximate location can be far away. Please enter your Pincode and Address below to lock in nearby stores:
            </p>
          </div>
        </div>

        {/* 3-Field Location Form */}
        <form onSubmit={handleSubmitLocation} className="flex flex-col gap-3.5">
          {/* 1. Pin Code (6 digits) */}
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              1. Pin Code * <span className="text-[10px] text-on-surface-variant font-normal">(6 digits)</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                tag
              </span>
              <input
                type="text"
                required
                maxLength={6}
                value={pincode}
                onChange={(e) => {
                  const onlyNums = e.target.value.replace(/[^0-9]/g, '')
                  if (onlyNums.length <= 6) setPincode(onlyNums)
                }}
                placeholder="e.g. 110001"
                className="w-full bg-surface-container-high border border-surface-variant rounded-xl py-2.5 pl-9 pr-3 text-xs font-bold text-on-surface focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* 2. Address / Area */}
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              2. Address / Area / Colony *
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                home
              </span>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Main Market, Sector 14, Indirapuram"
                className="w-full bg-surface-container-high border border-surface-variant rounded-xl py-2.5 pl-9 pr-3 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* 3. Landmark (Optional) */}
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              3. Landmark <span className="text-[10px] text-on-surface-variant font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                storefront
              </span>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Opposite SBI Bank / Near Metro Pillar 42"
                className="w-full bg-surface-container-high border border-surface-variant rounded-xl py-2.5 pl-9 pr-3 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {searchError && (
            <p className="text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 font-medium">
              {searchError}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={searching || !pincode || pincode.length !== 6 || !address.trim()}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-on-primary py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 mt-1"
          >
            {searching ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                <span>Locating Your Area...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>Save Location & Discover Nearby Shops</span>
              </>
            )}
          </button>
        </form>

        {/* Option B: Try GPS Again */}
        <div className="pt-3 border-t border-surface-variant/40 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-on-surface">Standing outside?</span>
            <span className="text-[10px] text-on-surface-variant">Tap to retry high-accuracy phone GPS</span>
          </div>
          <button
            onClick={() => {
              onUseGPS()
              onClose()
            }}
            className="bg-surface-container-high hover:bg-surface-variant text-on-surface px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-surface-variant/70 flex items-center gap-1.5 shadow-2xs active:scale-95"
          >
            <span className="material-symbols-outlined text-sm text-primary">gps_fixed</span>
            <span>Try GPS Again</span>
          </button>
        </div>

        {/* Quick Select Common Areas */}
        <div className="pt-2 border-t border-surface-variant/40">
          <span className="text-[10px] font-bold uppercase text-on-surface-variant tracking-wider block mb-2">
            Or Pick Popular City Hub
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {POPULAR_AREAS.map((area) => (
              <button
                key={area.name}
                onClick={() => {
                  onSelectLocation({
                    lat: area.lat,
                    lng: area.lng,
                    accuracy: 10,
                    locationName: area.name.split(',')[0],
                    pincode: area.pincode,
                    address: area.name,
                    isManual: true,
                    isGPS: false
                  })
                  onClose()
                }}
                className="bg-surface-container-high hover:bg-surface-variant text-left p-2 rounded-xl border border-surface-variant/60 text-xs font-semibold text-on-surface transition-all active:scale-95 truncate flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-xs text-primary">location_city</span>
                <span className="truncate">{area.name.split(',')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

