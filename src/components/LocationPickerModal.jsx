import React, { useState, useEffect } from 'react'

export function LocationPickerModal({
  isOpen,
  onClose,
  currentLocationName,
  onSelectLocation,
  onUseGPS,
  locationStatus,
  isFirstTimeFallback = false
}) {
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
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, isFirstTimeFallback])

  if (!isOpen) return null

  // Geocode address + landmark + pincode using OpenStreetMap Nominatim
  const handleSubmitLocation = async (e) => {
    e.preventDefault()
    if (!pincode || pincode.trim().length !== 6) {
      setSearchError('Please enter a valid 6-digit Pin Code.')
      return
    }
    if (!address.trim()) {
      setSearchError('Please enter your Address / Area name.')
      return
    }

    try {
      setSearching(true)
      setSearchError('')

      // Step 1: Try high-precision query with Address + Pincode
      const fullQuery = [address.trim(), landmark.trim(), pincode.trim(), 'India']
        .filter(Boolean)
        .join(', ')

      let res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          fullQuery
        )}&countrycodes=in&limit=1&addressdetails=1`
      )
      let data = res.ok ? await res.json() : []

      // Step 2: Fallback query if specific address isn't found
      if (!data || data.length === 0) {
        const fallbackQuery = `${pincode.trim()}, India`
        res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            fallbackQuery
          )}&countrycodes=in&limit=1&addressdetails=1`
        )
        data = res.ok ? await res.json() : []
      }

      if (data && data.length > 0) {
        const place = data[0]
        const lat = parseFloat(place.lat)
        const lng = parseFloat(place.lon)
        const areaName = address.trim() + (pincode ? ` (${pincode.trim()})` : '')

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
    { name: 'Gachibowli, Hyderabad', lat: 17.4401, lng: 78.3489, pincode: '500032' },
    { name: 'T. Nagar, Chennai', lat: 13.0418, lng: 80.2341, pincode: '600017' }
  ]

  return (
    <div 
      onClick={isFirstTimeFallback ? undefined : onClose}
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-surface-variant max-h-[94vh] overflow-y-auto my-auto flex flex-col gap-4"
      >
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
                    address: area.name
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

