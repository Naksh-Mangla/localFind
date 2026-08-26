import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { Toast } from './Toast'
import { ConfirmModal } from './ConfirmModal'
import { CustomSelect } from './CustomSelect'
import { StoreQRStandeeModal } from './StoreQRStandeeModal'
import { getRAGStatus } from '../utils/syncRAG'
import { getStoreOpenStatus } from '../utils/storeHours'
import { getFlashDealInfo } from '../utils/flashDeals'

export function MerchantDashboard({
  user,
  signInWithGoogle,
  signOut,
  userCoords,
  onRefreshProducts,
  lastSyncedAt
}) {
  const syncRAG = getRAGStatus(lastSyncedAt)
  const [shop, setShop] = useState(null)
  const [loadingShop, setLoadingShop] = useState(true)
  const [shopError, setShopError] = useState('')
  const [toast, setToast] = useState(null)
  const [deleteTargetId, setDeleteTargetId] = useState(null)

  const showToast = (message, type = 'info', title = '') => {
    setToast({ message, type, title })
  }

  // Shop creation / edit state
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState(user?.displayName || '')
  const [shopDescription, setShopDescription] = useState('')
  const [openingTime, setOpeningTime] = useState('09:00')
  const [closingTime, setClosingTime] = useState('21:00')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [landmarkText, setLandmarkText] = useState('')
  const [pincodeText, setPincodeText] = useState('')
  const [lat, setLat] = useState(userCoords?.lat || 28.6139)
  const [lng, setLng] = useState(userCoords?.lng || 77.2090)
  const [creatingShop, setCreatingShop] = useState(false)
  const [showEditShopModal, setShowEditShopModal] = useState(false)
  const [showQRStandeeModal, setShowQRStandeeModal] = useState(false)

  // Product management state
  const [products, setProducts] = useState([])
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productCategory, setProductCategory] = useState('General')
  const [productImageUrl, setProductImageUrl] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [isFlashDeal, setIsFlashDeal] = useState(false)
  const [flashDiscount, setFlashDiscount] = useState(20) // Default 20% OFF
  const [flashDurationHours, setFlashDurationHours] = useState(6) // Default 6 hours
  const [savingProduct, setSavingProduct] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  // Close modals on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAddProductModal(false)
        setShowEditShopModal(false)
        setShowQRStandeeModal(false)
        setDeleteTargetId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Load shop data for logged-in merchant
  const fetchMerchantShop = useCallback(async () => {
    if (!user) {
      setLoadingShop(false)
      return
    }
    try {
      setLoadingShop(true)
      setShopError('')
      const data = await apiFetch('/api/shops')
      // Find shop owned by current user
      const currentUid = user.uid || user.sub
      const myShop = (data.shops || []).find((s) => s.owner_id === currentUid)
      setShop(myShop || null)

      if (myShop) {
        setShopName(myShop.shop_name || '')
        setOwnerName(myShop.owner_name || user?.displayName || '')
        setShopDescription(myShop.description || '')
        setOpeningTime(myShop.opening_time || '09:00')
        setClosingTime(myShop.closing_time || '21:00')
        setWhatsappNumber(myShop.whatsapp_number || '')
        setLat(myShop.lat || userCoords?.lat || 28.6139)
        setLng(myShop.lng || userCoords?.lng || 77.2090)

        // Parse formatted address string into fields if possible
        if (myShop.address_text) {
          const parts = myShop.address_text.split(', Near ')
          if (parts.length === 2) {
            setStreetAddress(parts[0].trim())
            const landmarkParts = parts[1].split(', Pin - ')
            setLandmarkText(landmarkParts[0]?.trim() || '')
            setPincodeText(landmarkParts[1]?.trim() || '')
          } else {
            setStreetAddress(myShop.address_text)
          }
        }

        // Fetch products for this shop
        const prodData = await apiFetch('/api/products')
        const myProducts = (prodData.products || []).filter(
          (p) => p.shop_id === myShop.id
        )
        setProducts(myProducts)
      }
    } catch (err) {
      console.error('Failed to load merchant shop:', err)
      setShopError(err.message)
    } finally {
      setLoadingShop(false)
    }
  }, [user])

  useEffect(() => {
    fetchMerchantShop()
  }, [fetchMerchantShop])

  // Set default coordinates if user location changes
  useEffect(() => {
    if (userCoords?.lat && userCoords?.lng) {
      setLat(userCoords.lat)
      setLng(userCoords.lng)
    }
  }, [userCoords])

  // Auto-detect high-accuracy GPS when Shopkeeper Registration opens
  useEffect(() => {
    if (!shop && user && (lat === 28.6139 || lng === 77.2090)) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLat(Number(pos.coords.latitude.toFixed(6)))
            setLng(Number(pos.coords.longitude.toFixed(6)))
          },
          () => { },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        )
      }
    }
  }, [shop, user, lat, lng])

  // 🎯 1-Tap Live GPS Capture for Shopkeepers
  const handleCaptureLiveGPS = async () => {
    if (!navigator.geolocation) {
      showToast('GPS is not supported on this browser.', 'error', 'GPS Error')
      return
    }
    showToast('Locking high-accuracy satellite GPS coordinates...', 'info', 'Detecting GPS')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const freshLat = Number(pos.coords.latitude.toFixed(6))
        const freshLng = Number(pos.coords.longitude.toFixed(6))
        setLat(freshLat)
        setLng(freshLng)
        showToast(`✅ Store GPS updated to your exact spot!\n${freshLat}, ${freshLng} (±${Math.round(pos.coords.accuracy)}m)`, 'success', 'GPS Updated')
      },
      (err) => {
        showToast(`Could not access GPS: ${err.message}. Please allow location permission in browser.`, 'error', 'GPS Denied')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }

  // Handle Shop Creation — strictly validates mandatory fields & acquires FRESH GPS from device
  const handleCreateShop = async (e) => {
    e.preventDefault()

    // 1. Shop Name Validation (min 4 characters)
    const cleanShopName = shopName.trim()
    if (!cleanShopName || cleanShopName.length < 4) {
      showToast('Shop Name must be at least 4 characters long.', 'error', 'Validation Error')
      return
    }

    // 2. WhatsApp Number Validation (exactly 10 digits)
    const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '')
    if (cleanPhone.length !== 10) {
      showToast('WhatsApp number must be exactly 10 digits (e.g. 9876543210).', 'error', 'Validation Error')
      return
    }

    // 3. Street Address Validation (required)
    const cleanAddress = streetAddress.trim()
    if (!cleanAddress) {
      showToast('Please enter your Shop Street Address.', 'error', 'Validation Error')
      return
    }

    // 4. Landmark Validation (required)
    const cleanLandmark = landmarkText.trim()
    if (!cleanLandmark) {
      showToast('Please enter a nearby Landmark.', 'error', 'Validation Error')
      return
    }

    // 5. Pin Code Validation (required, 6 digits)
    const cleanPincode = pincodeText.trim().replace(/[^0-9]/g, '')
    if (!cleanPincode || cleanPincode.length !== 6) {
      showToast('Pin Code must be a 6-digit number (e.g. 110001).', 'error', 'Validation Error')
      return
    }

    setCreatingShop(true)

    // Helper: acquire fresh satellite GPS lock from device hardware
    const getFreshGPS = () =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null)
          return
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            accuracy: pos.coords.accuracy
          }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
      })

    try {
      let finalLat = lat || shop?.lat || userCoords?.lat
      let finalLng = lng || shop?.lng || userCoords?.lng

      // If initial shop setup, attempt fresh GPS lock from device hardware
      if (!shop && (!finalLat || !finalLng || (finalLat === 28.6139 && finalLng === 77.209))) {
        showToast('Locking high-accuracy GPS position automatically...', 'info', 'GPS Lock')
        const gps = await getFreshGPS()
        if (gps?.lat && gps?.lng) {
          finalLat = gps.lat
          finalLng = gps.lng
        }
      }

      // If device GPS is unavailable or blocked, geocode shop's entered Pincode & Address
      if (!finalLat || !finalLng || (finalLat === 28.6139 && finalLng === 77.209 && !shop?.lat)) {
        try {
          const geoQuery = `${cleanAddress}, ${cleanLandmark}, ${cleanPincode}, India`
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(geoQuery)}&countrycodes=in&limit=1`
          )
          const data = res.ok ? await res.json() : []
          if (data && data.length > 0) {
            finalLat = parseFloat(data[0].lat)
            finalLng = parseFloat(data[0].lon)
          } else {
            // Fallback to 6-digit Pincode query
            const pinRes = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${cleanPincode}, India`)}&countrycodes=in&limit=1`
            )
            const pinData = pinRes.ok ? await pinRes.json() : []
            if (pinData && pinData.length > 0) {
              finalLat = parseFloat(pinData[0].lat)
              finalLng = parseFloat(pinData[0].lon)
            }
          }
        } catch (geoErr) {
          console.warn('Fallback geocoding error:', geoErr)
        }
      }

      if (!finalLat || !finalLng) {
        showToast('Please enable GPS or check your Pincode so we can locate your store on the map.', 'error', 'Location Needed')
        setCreatingShop(false)
        return
      }

      // Format complete readable address string combining Address, Landmark & Pincode
      const fullFormattedAddress = `${cleanAddress}, Near ${cleanLandmark}, Pin - ${cleanPincode}`

      // Save to API with verified GPS coordinates locked by device
      await apiFetch('/api/shops', {
        method: 'POST',
        body: JSON.stringify({
          shop_name: cleanShopName,
          owner_name: ownerName.trim() || user?.displayName || 'Store Owner',
          description: shopDescription.trim() || null,
          opening_time: openingTime || '09:00',
          closing_time: closingTime || '21:00',
          whatsapp_number: cleanPhone,
          lat: finalLat,
          lng: finalLng,
          address_text: fullFormattedAddress
        })
      })

      showToast(shop ? 'Shop profile updated successfully!' : `Shop created with verified GPS!\nLat: ${finalLat}, Lng: ${finalLng}`, 'success', shop ? 'Profile Updated' : 'Shop Setup Complete')
      setShowEditShopModal(false)
      await fetchMerchantShop()
      if (onRefreshProducts) {
        onRefreshProducts()
      }
    } catch (err) {
      showToast(`Failed to save shop details: ${err.message}`, 'error', 'Save Failed')
    } finally {
      setCreatingShop(false)
    }
  }

  // Open Add Product Modal
  const handleOpenAddModal = () => {
    setEditingProduct(null)
    setProductName('')
    setProductPrice('')
    setProductCategory('General')
    setProductImageUrl('')
    setImageFile(null)
    setIsFlashDeal(false)
    setFlashDiscount(20)
    setFlashDurationHours(6)
    setShowAddProductModal(true)
  }

  // Open Edit Product Modal
  const handleOpenEditModal = (product) => {
    setEditingProduct(product)
    setProductName(product.name || '')
    setProductPrice(product.price ? product.price.toString() : '')
    setProductCategory(product.category || 'General')
    setProductImageUrl(product.image_url || '')
    setImageFile(null)

    // Check if flash deal is currently active or expired
    const isCurrentlyActive = Boolean(
      product.is_flash_deal &&
      product.flash_deal_ends_at &&
      new Date(product.flash_deal_ends_at).getTime() > Date.now()
    )

    setIsFlashDeal(isCurrentlyActive)
    setFlashDiscount(product.flash_deal_discount || 20)

    // Calculate remaining hours if already active, else default 6
    if (isCurrentlyActive && product.flash_deal_ends_at) {
      const remainingHours = Math.max(1, Math.round((new Date(product.flash_deal_ends_at).getTime() - Date.now()) / (1000 * 60 * 60)))
      setFlashDurationHours(remainingHours > 24 ? 24 : remainingHours)
    } else {
      setFlashDurationHours(6)
    }

    setShowAddProductModal(true)
  }

  // Handle Product Delete Trigger
  const handleDeleteProduct = (productId) => {
    setDeleteTargetId(productId)
  }

  // Execute Product Deletion
  const confirmDeleteProduct = async () => {
    if (!deleteTargetId) return
    const idToDelete = deleteTargetId
    setDeleteTargetId(null)
    try {
      await apiFetch(`/api/products?id=${idToDelete}`, {
        method: 'DELETE'
      })
      showToast('Product successfully removed from catalog.', 'success', 'Product Deleted')
      await fetchMerchantShop()
      if (onRefreshProducts) onRefreshProducts()
    } catch (err) {
      showToast(`Failed to delete product: ${err.message}`, 'error', 'Delete Error')
    }
  }

  // Helper to convert Google Search / Google Images viewer URLs to direct raw image URLs
  const cleanGoogleImageUrl = (url) => {
    if (!url) return ''
    let cleaned = url.trim()

    // 1. Handle Google Images viewer search page links (e.g. google.com/imgres?imgurl=...)
    if (cleaned.includes('google.com/imgres') || cleaned.includes('google.co.in/imgres')) {
      try {
        const parsed = new URL(cleaned)
        const directImgUrl = parsed.searchParams.get('imgurl')
        if (directImgUrl) return decodeURIComponent(directImgUrl)
      } catch (_) { }
    }

    // 2. Handle Google Search result links (e.g. google.com/url?url=... or google.com/url?q=...)
    if (cleaned.includes('google.com/url') || cleaned.includes('google.co.in/url')) {
      try {
        const parsed = new URL(cleaned)
        const targetUrl = parsed.searchParams.get('url') || parsed.searchParams.get('q')
        if (targetUrl) return decodeURIComponent(targetUrl)
      } catch (_) { }
    }

    // 3. Handle Google Drive view links (drive.google.com/file/d/XYZ/view)
    if (cleaned.includes('drive.google.com/file/d/')) {
      const match = cleaned.match(/\/file\/d\/([^\/]+)/)
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`
      }
    }

    return cleaned
  }

  // Compress local image file to lightweight compressed Base64 Data URL (JPEG, < 150KB)
  // This stores the image directly inside the app database — 100% reliable, 0 external API keys needed, 0 ads!
  const compressImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Failed to read image file'))
      reader.onload = (event) => {
        const img = new Image()
        img.onerror = () => reject(new Error('Failed to load image preview'))
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          const MAX_SIZE = 800
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width)
              width = MAX_SIZE
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height)
              height = MAX_SIZE
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          // WebP format offers 25-35% smaller file sizes than JPEG at identical quality
          let base64Data = canvas.toDataURL('image/webp', 0.75)
          // Fallback to JPEG if browser canvas doesn't support WebP export
          if (!base64Data.startsWith('data:image/webp')) {
            base64Data = canvas.toDataURL('image/jpeg', 0.75)
          }
          resolve(base64Data)
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  // Handle Product Creation / Editing
  const handleSaveProduct = async (e) => {
    e.preventDefault()
    if (!productName.trim() || !productPrice || !shop) {
      showToast('Please enter Product Name and Price.', 'error', 'Missing Information')
      return
    }

    try {
      setSavingProduct(true)
      let finalImageUrl = cleanGoogleImageUrl(productImageUrl)

      if (imageFile) {
        setUploadProgress('Compressing photo for instant save...')
        try {
          finalImageUrl = await compressImageToBase64(imageFile)
        } catch (uploadErr) {
          console.warn('Image compression error:', uploadErr)
          showToast(`Photo processing failed: ${uploadErr.message}. You can still paste an image link.`, 'error', 'Processing Failed')
          setSavingProduct(false)
          setUploadProgress('')
          return
        }
      }

      setUploadProgress('Saving product...')

      // Calculate flash deal expiration timestamp
      let flashEndsAt = null
      if (isFlashDeal) {
        const expires = new Date(Date.now() + (Number(flashDurationHours) || 6) * 60 * 60 * 1000)
        flashEndsAt = expires.toISOString()
      }

      if (editingProduct) {
        // PUT update product
        await apiFetch('/api/products', {
          method: 'PUT',
          body: JSON.stringify({
            id: editingProduct.id,
            name: productName.trim(),
            price: parseFloat(productPrice),
            category: productCategory,
            image_url: finalImageUrl || null,
            is_flash_deal: isFlashDeal ? 1 : 0,
            flash_deal_discount: isFlashDeal ? Number(flashDiscount) : 0,
            flash_deal_ends_at: flashEndsAt
          })
        })
        showToast(isFlashDeal ? '⚡ Flash Deal activated successfully!' : 'Product updated successfully!', 'success', isFlashDeal ? 'Flash Deal Live!' : 'Product Updated')
      } else {
        // POST create product
        await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify({
            shop_id: shop.id,
            name: productName.trim(),
            price: parseFloat(productPrice),
            category: productCategory,
            image_url: finalImageUrl || null,
            is_flash_deal: isFlashDeal ? 1 : 0,
            flash_deal_discount: isFlashDeal ? Number(flashDiscount) : 0,
            flash_deal_ends_at: flashEndsAt
          })
        })
        showToast(isFlashDeal ? '⚡ Flash Deal published to neighborhood!' : 'Product published to live showcase!', 'success', isFlashDeal ? 'Flash Deal Live!' : 'Product Published')
      }

      // Reset form and reload products
      setEditingProduct(null)
      setProductName('')
      setProductPrice('')
      setProductCategory('General')
      setProductImageUrl('')
      setImageFile(null)
      setIsFlashDeal(false)
      setFlashDiscount(20)
      setFlashDurationHours(6)
      setShowAddProductModal(false)
      await fetchMerchantShop()
      if (onRefreshProducts) onRefreshProducts()
    } catch (err) {
      showToast(`Failed to save product: ${err.message}`, 'error', 'Save Error')
    } finally {
      setSavingProduct(false)
      setUploadProgress('')
    }
  }

  // Use High-Precision Browser GPS for shop location
  const handleUseGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const latitude = Number(pos.coords.latitude.toFixed(6))
          const longitude = Number(pos.coords.longitude.toFixed(6))
          setLat(latitude)
          setLng(longitude)

          // Try reverse geocoding to pre-fill address
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
            )
            if (res.ok) {
              const data = await res.json()
              const addr = data.address || {}
              const fullAddr = [
                addr.amenity || addr.shop || addr.building,
                addr.road,
                addr.suburb || addr.neighbourhood,
                addr.city || addr.town
              ].filter(Boolean).join(', ')
              if (fullAddr) setStreetAddress(fullAddr)
            }
          } catch (e) {
            console.warn('Reverse geocode failed:', e)
          }

          showToast(`Accurate GPS location locked!\nLat: ${latitude}, Lng: ${longitude}\nPrecision: ±${Math.round(pos.coords.accuracy || 10)}m`, 'success', 'GPS Locked')
        },
        (err) => showToast(`Geolocation error: ${err.message}`, 'error', 'GPS Error'),
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      )
    } else {
      showToast('Geolocation is not supported by your browser.', 'error', 'Unsupported')
    }
  }

  // Update existing shop location to current live high-precision GPS
  const handleUpdateShopGPS = async () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error', 'Unsupported')
      return
    }
    showToast('Getting live GPS location...', 'info', 'Locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = Number(pos.coords.latitude.toFixed(6))
        const longitude = Number(pos.coords.longitude.toFixed(6))
        setLat(latitude)
        setLng(longitude)

        let newAddress = shop?.address_text || ''
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          )
          if (res.ok) {
            const data = await res.json()
            const addr = data.address || {}
            const fullAddr = [
              addr.amenity || addr.shop || addr.building,
              addr.road,
              addr.suburb || addr.neighbourhood,
              addr.city || addr.town
            ].filter(Boolean).join(', ')
            if (fullAddr) newAddress = fullAddr
          }
        } catch (e) {
          console.warn('Reverse geocode failed:', e)
        }

        try {
          await apiFetch('/api/shops', {
            method: 'POST',
            body: JSON.stringify({
              shop_name: shop.shop_name,
              owner_name: shop.owner_name || null,
              description: shop.description || null,
              opening_time: shop.opening_time || '09:00',
              closing_time: shop.closing_time || '21:00',
              whatsapp_number: shop.whatsapp_number,
              lat: latitude,
              lng: longitude,
              address_text: newAddress || null
            })
          })
          showToast(`Shop GPS location updated to your exact position!\nLat: ${latitude}, Lng: ${longitude}\nPrecision: ±${Math.round(pos.coords.accuracy || 10)}m`, 'success', 'GPS Updated')
          await fetchMerchantShop()
          if (onRefreshProducts) onRefreshProducts()
        } catch (err) {
          showToast(`Failed to update shop location: ${err.message}`, 'error', 'Update Failed')
        }
      },
      (err) => showToast(`Geolocation error: ${err.message}`, 'error', 'GPS Error'),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    )
  }

  // Screen 1: Unauthenticated Merchant Onboarding Experience
  if (!user) {
    return (
      <main className="pt-20 md:pt-28 px-container-margin max-w-2xl mx-auto text-center pb-24 animate-fadeIn">
        <div className="bg-surface-container-lowest p-8 md:p-10 rounded-3xl border border-surface-variant/70 shadow-2xl flex flex-col items-center relative overflow-hidden">
          {/* Subtle Background Glow */}
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Animated Header Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded-full text-xs font-bold mb-6 animate-popIn">
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            <span>Grow Your Local Business Today</span>
          </div>

          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary mb-6 shadow-inner border border-primary/20">
            <span className="material-symbols-outlined text-4xl">storefront</span>
          </div>

          <h2 className="font-headline-lg text-3xl font-bold text-on-surface mb-3 tracking-tight">
            Become a Seller on LocalFind
          </h2>

          <p className="text-sm md:text-base text-on-surface-variant max-w-lg mb-8 leading-relaxed">
            Showcase your products to buyers walking or driving within a <span className="font-bold text-primary">2 km radius</span> of your store. Zero commissions, direct customer WhatsApp leads, and 100% free!
          </p>

          {/* 3 Selling Points Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left mb-8">
            <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-variant/40 flex flex-col items-start">
              <span className="material-symbols-outlined text-primary mb-2">near_me</span>
              <h4 className="font-bold text-xs text-on-surface mb-1">Hyperlocal Reach</h4>
              <p className="text-[11px] text-on-surface-variant">Target customers right around your market block.</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-variant/40 flex flex-col items-start">
              <span className="material-symbols-outlined text-emerald-500 mb-2">chat</span>
              <h4 className="font-bold text-xs text-on-surface mb-1">Direct WhatsApp</h4>
              <p className="text-[11px] text-on-surface-variant">Buyers chat directly with you to buy items.</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-variant/40 flex flex-col items-start">
              <span className="material-symbols-outlined text-amber-500 mb-2">payments</span>
              <h4 className="font-bold text-xs text-on-surface mb-1">0% Commission</h4>
              <p className="text-[11px] text-on-surface-variant">Keep 100% of your earnings. Always free.</p>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={signInWithGoogle}
            className="w-full sm:w-auto bg-primary hover:bg-primary-container text-on-primary py-4 px-8 rounded-2xl font-title-md font-bold shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 active:scale-95 text-base border border-white/20"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In with Google to Start Selling</span>
          </button>

          <p className="text-[11px] text-on-surface-variant mt-4">
            Takes less than 30 seconds to set up your shop profile.
          </p>

          {/* Credits footer tag */}
          <div className="mt-8 pt-4 border-t border-surface-variant/40 w-full flex items-center justify-center gap-1.5 text-[11px] text-on-surface-variant">
            <span>Powered by</span>
            <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              NAKSH
            </span>
          </div>
        </div>
      </main>
    )
  }

  if (loadingShop) {
    return (
      <main className="pt-24 px-container-margin max-w-2xl mx-auto text-center">
        <div className="p-8 bg-surface-container-low rounded-xl animate-pulse">
          <p className="text-on-surface-variant font-medium">Loading your shop details...</p>
        </div>
      </main>
    )
  }

  // Screen 2: Authenticated but No Shop Setup Yet
  if (!shop) {
    return (
      <main className="pt-20 md:pt-24 px-container-margin max-w-xl mx-auto pb-24">
        <div className="bg-surface-container-lowest p-6 md:p-8 rounded-2xl border border-surface-variant shadow-lg">
          <h2 className="font-headline-lg text-2xl font-bold text-on-surface mb-1">Set Up Your Shop</h2>
          <p className="text-xs text-on-surface-variant mb-6">
            Welcome, {user.displayName}! Fill out your store details to start showcasing your products locally.
          </p>

          <form onSubmit={handleCreateShop} className="flex flex-col gap-4">
            {/* 1. Shop Name Field (Min 4 chars) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Shop Name * <span className="text-[10px] text-on-surface-variant font-normal">(Min 4 chars)</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Earth & Fire Ceramics"
                  className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Owner Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Shop About / Description Field */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                About Shop / Business Description (optional)
              </label>
              <textarea
                rows={2}
                value={shopDescription}
                onChange={(e) => setShopDescription(e.target.value)}
                placeholder="Tell local buyers what makes your shop special..."
                className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Shop Timings (Opening & Closing Hours) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-primary">schedule</span>
                  <span>Opening Time *</span>
                </label>
                <input
                  type="time"
                  required
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-primary">schedule</span>
                  <span>Closing Time *</span>
                </label>
                <input
                  type="time"
                  required
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* 2. WhatsApp Number Field (Exactly 10 digits) */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                WhatsApp Phone Number * <span className="text-[10px] text-on-surface-variant font-normal">(Exactly 10 digits)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={whatsappNumber}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/[^0-9]/g, '')
                    if (onlyNums.length <= 10) setWhatsappNumber(onlyNums)
                  }}
                  placeholder="9876543210"
                  className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 pl-12 text-sm focus:ring-1 focus:ring-primary"
                />
              </div>
              <span className="text-[11px] text-on-surface-variant mt-0.5 block">
                Buyers will tap this to chat directly with you on WhatsApp.
              </span>
            </div>

            {/* 3. Separate Street Address Field (Mandatory) */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                Street Address / Shop No. *
              </label>
              <input
                type="text"
                required
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="e.g. Shop #4, Main Commercial Complex"
                className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 4. Separate Landmark & Pin Code Fields (Mandatory) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Landmark *
                </label>
                <input
                  type="text"
                  required
                  value={landmarkText}
                  onChange={(e) => setLandmarkText(e.target.value)}
                  placeholder="e.g. Opposite State Bank"
                  className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Pin Code * <span className="text-[10px] text-on-surface-variant font-normal">(6 digits)</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={pincodeText}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/[^0-9]/g, '')
                    if (onlyNums.length <= 6) setPincodeText(onlyNums)
                  }}
                  placeholder="110001"
                  className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* 5. Live GPS Coordinates & Sync Button */}
            <div className="bg-primary/10 p-3.5 rounded-2xl border border-primary/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 my-1">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-2xl">my_location</span>
                <div>
                  <strong className="text-xs font-bold text-on-surface block">Store GPS Coordinates</strong>
                  <span className="text-[11px] text-on-surface-variant font-mono font-semibold">
                    {lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Detecting GPS...'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCaptureLiveGPS}
                className="bg-primary hover:bg-primary/90 text-on-primary px-4 py-2 rounded-full text-xs font-bold shadow-crisp-xs active:scale-95 transition-all flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
              >
                <span className="material-symbols-outlined text-sm">near_me</span>
                <span>Set to My Live Spot</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={creatingShop}
              className="w-full bg-primary hover:bg-primary-container text-on-primary py-3.5 px-6 rounded-xl font-bold transition-all shadow-md mt-2 flex items-center justify-center gap-2 active:scale-95"
            >
              {creatingShop ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  <span>Locking GPS & Creating Shop...</span>
                </>
              ) : (
                <span>Save & Continue to Product Catalog</span>
              )}
            </button>
          </form>
        </div>
      </main>
    )
  }

  // Screen 3: Authenticated Merchant with Active Shop Dashboard
  return (
    <main className="pt-4 md:pt-6 px-container-margin max-w-6xl mx-auto pb-24">
      {/* 🏛️ Merchant Header Bar - Structured Apple Card */}
      <div className="bg-surface-container-lowest p-6 sm:p-7 rounded-3xl border border-surface-variant/50 shadow-crisp-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <h2 className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">{shop.shop_name}</h2>
              <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-bold">
                Live Window
              </span>
              {(() => {
                const openStatus = getStoreOpenStatus(shop.opening_time, shop.closing_time)
                return (
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${openStatus.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${openStatus.dotClass} ${openStatus.isOpen ? 'animate-pulse' : ''}`}></span>
                    <span>{openStatus.badgeLabel || `${openStatus.label} (${openStatus.timingText || '9 AM – 9 PM'})`}</span>
                  </span>
                )
              })()}
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-on-surface-variant mt-2.5">
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary flex-shrink-0">location_on</span>
                <span className="line-clamp-1">{shop.address_text || 'Local Address'}</span>
              </p>
              <div className="flex items-center gap-3 flex-wrap text-xs mt-0.5">
                <span className="flex items-center gap-1 font-semibold text-on-surface">
                  <span className="material-symbols-outlined text-[15px] text-emerald-600">call</span>
                  <span>WhatsApp: {shop.whatsapp_number}</span>
                </span>
                <span>•</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold border ${syncRAG.colorClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${syncRAG.dotClass}`}></span>
                  <span>Synced {syncRAG.label}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex items-center gap-2.5 flex-wrap self-start">
            <div className="bg-surface-container-high/80 px-4 py-2 rounded-2xl border border-surface-variant/40 flex flex-col text-center">
              <span className="text-base font-black text-on-surface">{products.length}</span>
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Products</span>
            </div>
            <div className="bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/30 flex flex-col text-center">
              <span className="text-base font-black text-amber-600 dark:text-amber-400">
                {products.filter(p => getFlashDealInfo(p).isLive).length}
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold uppercase tracking-wider">Deals</span>
            </div>
          </div>
        </div>

        {/* Structured Action Bar Grid */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 mt-6 pt-5 border-t border-surface-variant/30">
          <button
            onClick={() => setShowAddProductModal(true)}
            className="col-span-2 sm:col-span-1 bg-primary hover:bg-primary/90 text-on-primary px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-crisp-xs flex items-center justify-center gap-2 active:scale-95 border border-white/20 hover:shadow-primary/20"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            <span>Add Product</span>
          </button>

          <button
            onClick={() => setShowEditShopModal(true)}
            className="bg-surface-container-high text-on-surface hover:bg-surface-variant px-4 py-2.5 rounded-full text-xs font-bold transition-all border border-surface-variant/70 flex items-center justify-center gap-1.5 shadow-crisp-xs active:scale-95 hover:border-primary/40"
          >
            <span className="material-symbols-outlined text-sm text-primary">edit_square</span>
            <span>Edit Profile</span>
          </button>

          {/* 📄 Download Store QR Standee Button */}
          <button
            onClick={() => setShowQRStandeeModal(true)}
            className="bg-surface-container-high text-on-surface hover:bg-surface-variant px-4 py-2.5 rounded-full text-xs font-bold transition-all border border-surface-variant/70 flex items-center justify-center gap-1.5 shadow-crisp-xs active:scale-95 hover:border-primary/40 text-primary"
            title="Generate and print physical QR standee for your billing counter"
          >
            <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
            <span>Store QR Standee</span>
          </button>

          <button
            onClick={signOut}
            className="col-span-2 sm:col-span-1 bg-surface-container-high hover:bg-rose-500/10 text-on-surface hover:text-rose-600 px-4 py-2.5 rounded-full text-xs font-bold transition-all border border-surface-variant/70 flex items-center justify-center gap-1.5 shadow-crisp-xs active:scale-95 sm:ml-auto"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Product List Grid */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="section-header-title">Your Product Showcase ({products.length})</h3>
      </div>

      {products.length === 0 ? (
        <div className="bg-surface-container-low/80 p-8 sm:p-10 rounded-3xl border border-surface-variant/60 text-center my-4 shadow-crisp-xs">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
          </div>
          <h4 className="font-title-md text-lg font-bold text-on-surface mb-1.5 tracking-tight">No products added yet</h4>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-md mx-auto mb-5 leading-relaxed">
            Showcase your best-selling items so local buyers nearby can discover them!
          </p>
          <button
            onClick={handleOpenAddModal}
            className="bg-primary hover:bg-primary/90 text-on-primary px-5 py-2.5 rounded-full text-xs font-bold shadow-crisp-xs active:scale-95 transition-all"
          >
            + Add First Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {products.map((product) => {
            const flashInfo = getFlashDealInfo(product)
            return (
              <div
                key={product.id}
                className="bg-surface-container-lowest rounded-3xl border border-surface-variant/40 overflow-hidden shadow-crisp-xs hover:apple-product-shadow flex flex-col group transition-all duration-300"
              >
                <div className="w-full aspect-square bg-surface-variant/40 overflow-hidden relative">
                  <img
                    src={product.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80'}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80'
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {flashInfo.isLive && (
                    <div className="absolute top-2.5 left-2.5 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 shadow-crisp-xs border border-white/40">
                      <span>⚡</span>
                      <span>{flashInfo.discountPercent}% OFF • {flashInfo.countdownText}</span>
                    </div>
                  )}
                  {flashInfo.isExpired && (
                    <div className="absolute top-2.5 left-2.5 bg-surface-variant/90 text-on-surface-variant px-2.5 py-0.5 rounded-full text-[9px] font-bold border border-surface-variant">
                      Deal Expired
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1 justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-primary font-bold uppercase tracking-wider">{product.category}</span>
                      <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        v{product.version || 1}
                      </span>
                    </div>
                    <h4 className="font-title-md text-sm font-semibold text-on-surface line-clamp-1">{product.name}</h4>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      {flashInfo.isLive ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-rose-600 text-base">
                            ₹{flashInfo.discountedPrice}
                          </span>
                          <span className="text-xs text-on-surface-variant line-through opacity-70">
                            ₹{flashInfo.originalPrice}
                          </span>
                        </div>
                      ) : (
                        <span className="font-bold text-primary text-base">₹{product.price}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(product)}
                        title="Edit Product"
                        className="p-2 rounded-xl bg-surface-container-high hover:bg-primary/15 text-on-surface hover:text-primary transition-all flex items-center justify-center border border-surface-variant/50 active:scale-95 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        title="Delete Product"
                        className="p-2 rounded-xl bg-surface-container-high hover:bg-rose-500/15 text-on-surface hover:text-rose-600 transition-all flex items-center justify-center border border-surface-variant/50 active:scale-95 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showAddProductModal && (
        <div
          onClick={() => setShowAddProductModal(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-surface-variant max-h-[92vh] overflow-y-auto my-auto animate-fadeIn"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline-lg text-xl font-bold text-on-surface">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="p-1 rounded-full text-on-surface-variant hover:bg-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Basic Info & Photo */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Handmade Leather Wallet"
                    className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      placeholder="299"
                      className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <CustomSelect
                      label="Category *"
                      value={productCategory}
                      onChange={(val) => setProductCategory(val)}
                      options={[
                        { label: 'General', value: 'General' },
                        { label: 'Handmade', value: 'Handmade' },
                        { label: 'Groceries', value: 'Groceries' },
                        { label: 'Fashion', value: 'Fashion' },
                        { label: 'Electronics', value: 'Electronics' },
                        { label: 'Sale', value: 'Sale' }
                      ]}
                    />
                  </div>
                </div>

                {/* Product Photo: Direct Phone Gallery/Camera Upload + URL Fallback */}
                <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant/60 flex flex-col gap-3">
                  <span className="text-xs font-bold text-on-surface">Product Photo (Direct Upload or Link)</span>
                  <p className="text-[11px] text-on-surface-variant">
                    Choose a photo directly from your phone gallery/camera, OR paste an image link from Google!
                  </p>

                  {/* Option A: Direct File Upload */}
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">📷 Upload Photo from Phone</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          try {
                            showToast('Compressing photo instantly...', 'info', 'Image Compression')
                            const compressedBase64 = await compressImageToBase64(file)
                            setImageFile(file)
                            setProductImageUrl(compressedBase64)
                            const origKB = Math.round(file.size / 1024)
                            const newKB = Math.round((compressedBase64.length * 0.75) / 1024)
                            showToast(`Photo compressed by ${Math.round((1 - newKB / origKB) * 100)}% (${origKB} KB ➔ ${newKB} KB)!`, 'success', 'Photo Compressed')
                          } catch (err) {
                            setImageFile(file)
                            setProductImageUrl(URL.createObjectURL(file))
                          }
                        }
                      }}
                      className="w-full text-xs text-on-surface-variant file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary file:text-on-primary hover:file:bg-primary-container cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-2 my-1">
                    <div className="h-px bg-surface-variant flex-1"></div>
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold">OR PASTE LINK</span>
                    <div className="h-px bg-surface-variant flex-1"></div>
                  </div>

                  {/* Option B: Image URL */}
                  <div>
                    <input
                      type="url"
                      value={imageFile ? '' : productImageUrl}
                      onChange={(e) => {
                        setImageFile(null)
                        setProductImageUrl(e.target.value)
                      }}
                      onBlur={(e) => {
                        if (!imageFile) {
                          const cleaned = cleanGoogleImageUrl(e.target.value)
                          if (cleaned !== e.target.value) {
                            setProductImageUrl(cleaned)
                            showToast('Extracted direct image URL from Google link!', 'info', 'URL Cleaned')
                          }
                        }
                      }}
                      placeholder="https://images.unsplash.com/... or Google Image Link"
                      className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-2.5 text-xs"
                    />
                  </div>

                  {/* Live Image Preview */}
                  {productImageUrl && (
                    <div className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-surface-variant/40">
                      <img
                        src={imageFile ? productImageUrl : cleanGoogleImageUrl(productImageUrl)}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-md bg-surface-variant flex-shrink-0"
                        onError={(e) => {
                          e.target.onerror = null
                          e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=80'
                        }}
                      />
                      <div className="text-[11px] text-on-surface-variant overflow-hidden flex-1">
                        <span className="font-bold text-on-surface flex items-center justify-between gap-1 mb-0.5">
                          <span>{imageFile ? 'Compressed Photo Preview' : 'Image Link Preview'}</span>
                          {imageFile && (
                            <span className="text-[9px] bg-emerald-500/15 text-emerald-600 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                              ~{Math.round((productImageUrl.length * 0.75) / 1024)} KB
                            </span>
                          )}
                        </span>
                        <span className="truncate block opacity-75">
                          {imageFile ? `${imageFile.name} (Original: ${Math.round(imageFile.size / 1024)} KB)` : cleanGoogleImageUrl(productImageUrl)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Flash Deal & Actions */}
              <div className="flex flex-col gap-4 justify-between">
                {/* ⚡ 24-Hour Flash Deal / "Aaj Ka Offer" Settings Box */}
                <div className={`p-4 rounded-2xl border transition-all ${isFlashDeal
                    ? 'bg-amber-500/10 border-amber-500/40 shadow-xs'
                    : 'bg-surface-container-high/50 border-surface-variant/60'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚡</span>
                      <div>
                        <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                          <span>Aaj Ka Offer / Flash Deal</span>
                          <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                            BOOST SALES
                          </span>
                        </h4>
                        <p className="text-[11px] text-on-surface-variant">
                          Feature this item with a countdown timer & discount banner!
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      id="flashDealToggle"
                      checked={isFlashDeal}
                      onChange={(e) => setIsFlashDeal(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>

                  {isFlashDeal && (
                    <div className="mt-3 pt-3 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                      <div>
                        <label className="block text-[11px] font-bold text-on-surface mb-1">
                          Discount Percentage (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="5"
                            max="90"
                            value={flashDiscount}
                            onChange={(e) => setFlashDiscount(e.target.value)}
                            className="w-full bg-surface border border-surface-variant rounded-xl p-2.5 pl-3 pr-8 text-xs font-bold text-primary"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
                            %
                          </span>
                        </div>
                        {productPrice && (
                          <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                            Offer Price: ₹{Math.round(parseFloat(productPrice || 0) * (1 - (Number(flashDiscount) || 0) / 100))}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-on-surface mb-1">
                          Deal Duration (Hours)
                        </label>
                        <select
                          value={flashDurationHours}
                          onChange={(e) => setFlashDurationHours(Number(e.target.value))}
                          className="w-full bg-surface border border-surface-variant rounded-xl p-2.5 text-xs font-semibold text-on-surface"
                        >
                          <option value="3">3 Hours (Urgent)</option>
                          <option value="6">6 Hours (Half Day)</option>
                          <option value="12">12 Hours (Full Day)</option>
                          <option value="24">24 Hours (Aaj Ka Offer)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4">
                  <button
                    type="submit"
                    disabled={savingProduct}
                    className="w-full bg-primary hover:bg-primary-container text-on-primary py-3.5 px-6 rounded-xl font-bold transition-all shadow-md active:scale-95"
                  >
                    {savingProduct
                      ? 'Saving Product...'
                      : editingProduct
                        ? 'Update Product Details'
                        : 'Publish Product to Live App'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Shop Profile Modal */}
      {showEditShopModal && (
        <div
          onClick={() => setShowEditShopModal(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[100] overflow-y-auto animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest p-5 sm:p-6 md:p-8 rounded-2xl border border-surface-variant shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto my-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-headline-lg text-xl font-bold text-on-surface">Edit Shop Profile</h3>
                <p className="text-xs text-on-surface-variant">Update your store details displayed to nearby buyers.</p>
              </div>
              <button
                onClick={() => setShowEditShopModal(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateShop} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Basic Details & Timings */}
              <div className="flex flex-col gap-4">
                {/* 1. Shop Name Field (Min 4 chars) & Owner Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      Shop Name * <span className="text-[10px] text-on-surface-variant font-normal">(Min 4 chars)</span>
                    </label>
                    <input
                      type="text"
                      required
                      minLength={4}
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Earth & Fire Ceramics"
                      className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      Owner Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Shop About / Description Field */}
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    About Shop / Business Description (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={shopDescription}
                    onChange={(e) => setShopDescription(e.target.value)}
                    placeholder="Tell local buyers what makes your shop special..."
                    className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Shop Timings (Opening & Closing Hours) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-primary">schedule</span>
                      <span>Opening Time *</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={openingTime}
                      onChange={(e) => setOpeningTime(e.target.value)}
                      className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-primary">schedule</span>
                      <span>Closing Time *</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={closingTime}
                      onChange={(e) => setClosingTime(e.target.value)}
                      className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Contact & Location & Actions */}
              <div className="flex flex-col gap-4 justify-between">
                {/* 2. WhatsApp Number Field (Exactly 10 digits) */}
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    WhatsApp Phone Number * <span className="text-[10px] text-on-surface-variant font-normal">(Exactly 10 digits)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={whatsappNumber}
                      onChange={(e) => {
                        const onlyNums = e.target.value.replace(/[^0-9]/g, '')
                        if (onlyNums.length <= 10) setWhatsappNumber(onlyNums)
                      }}
                      placeholder="9876543210"
                      className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 pl-12 text-sm focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* 3. Separate Street Address Field (Mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Street Address / Shop No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="e.g. Shop #4, Main Commercial Complex"
                    className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* 4. Separate Landmark & Pin Code Fields (Mandatory) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      Landmark *
                    </label>
                    <input
                      type="text"
                      required
                      value={landmarkText}
                      onChange={(e) => setLandmarkText(e.target.value)}
                      placeholder="e.g. Opposite State Bank"
                      className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      Pin Code * <span className="text-[10px] text-on-surface-variant font-normal">(6 digits)</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={pincodeText}
                      onChange={(e) => {
                        const onlyNums = e.target.value.replace(/[^0-9]/g, '')
                        if (onlyNums.length <= 6) setPincodeText(onlyNums)
                      }}
                      placeholder="110001"
                      className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* 5. Live GPS Coordinates & Sync Button */}
                <div className="bg-primary/10 p-3.5 rounded-2xl border border-primary/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 my-1">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-primary text-2xl">my_location</span>
                    <div>
                      <strong className="text-xs font-bold text-on-surface block">Store GPS Coordinates</strong>
                      <span className="text-[11px] text-on-surface-variant font-mono font-semibold">
                        {lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Detecting GPS...'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCaptureLiveGPS}
                    className="bg-primary hover:bg-primary/90 text-on-primary px-4 py-2 rounded-full text-xs font-bold shadow-crisp-xs active:scale-95 transition-all flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
                  >
                    <span className="material-symbols-outlined text-sm">near_me</span>
                    <span>Sync to Live Spot</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 mt-auto pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditShopModal(false)}
                    className="w-1/3 bg-surface-container-high text-on-surface py-3 rounded-xl font-bold text-xs hover:bg-surface-variant"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingShop}
                    className="w-2/3 bg-primary text-on-primary py-3 rounded-xl font-bold text-xs hover:bg-primary-container shadow-md flex items-center justify-center gap-2"
                  >
                    {creatingShop ? 'Saving Profile...' : 'Save Profile Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Toast Notifications */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Custom Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Delete Product"
        message="Are you sure you want to delete this product from your store catalog?"
        confirmText="Delete Product"
        cancelText="Cancel"
        type="danger"
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteProduct}
      />

      {/* 📄 Printable Store QR Standee Generator Modal */}
      {showQRStandeeModal && shop && (
        <StoreQRStandeeModal
          shop={shop}
          products={products}
          onClose={() => setShowQRStandeeModal(false)}
        />
      )}
    </main>
  )
}
