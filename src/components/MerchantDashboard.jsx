import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { Toast } from './Toast'
import { ConfirmModal } from './ConfirmModal'
import { CustomSelect } from './CustomSelect'

export function MerchantDashboard({
  user,
  signInWithGoogle,
  signOut,
  userCoords
}) {
  const [shop, setShop] = useState(null)
  const [loadingShop, setLoadingShop] = useState(true)
  const [shopError, setShopError] = useState('')
  const [toast, setToast] = useState(null)
  const [deleteTargetId, setDeleteTargetId] = useState(null)

  const showToast = (message, type = 'info', title = '') => {
    setToast({ message, type, title })
  }

  // Shop creation state
  const [shopName, setShopName] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [addressText, setAddressText] = useState('')
  const [lat, setLat] = useState(userCoords?.lat || 28.6139)
  const [lng, setLng] = useState(userCoords?.lng || 77.2090)
  const [creatingShop, setCreatingShop] = useState(false)

  // Product management state
  const [products, setProducts] = useState([])
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productCategory, setProductCategory] = useState('General')
  const [productImageUrl, setProductImageUrl] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [isAffiliate, setIsAffiliate] = useState(false)
  const [affiliateLink, setAffiliateLink] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

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
      const myShop = (data.shops || []).find((s) => s.owner_id === user.uid)
      setShop(myShop || null)

      if (myShop) {
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
          () => {},
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        )
      }
    }
  }, [shop, user, lat, lng])

  // Handle Shop Creation — always acquires FRESH GPS before saving
  const handleCreateShop = async (e) => {
    e.preventDefault()
    if (!shopName.trim() || !whatsappNumber.trim()) {
      showToast('Please fill in Shop Name and WhatsApp number.', 'error', 'Validation Error')
      return
    }

    setCreatingShop(true)
    showToast('Locking live GPS position before saving...', 'info', 'GPS Lock')

    // Helper: get fresh high-accuracy GPS (returns a Promise)
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
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        )
      })

    try {
      // 1. Get fresh GPS coordinates
      const gps = await getFreshGPS()
      const finalLat = gps?.lat ?? parseFloat(lat)
      const finalLng = gps?.lng ?? parseFloat(lng)

      // 2. Warn if we're still on the Delhi defaults (GPS failed)
      if (finalLat === 28.6139 && finalLng === 77.209) {
        showToast('Could not get precise GPS! Please tap "Use Current GPS Location" and try again.', 'error', 'GPS Failed')
        setCreatingShop(false)
        return
      }

      // 3. Update local state so lat/lng inputs reflect the locked position
      setLat(finalLat)
      setLng(finalLng)

      // 4. Try to get a readable address via reverse geocoding
      let finalAddress = addressText.trim() || null
      if (!finalAddress) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${finalLat}&lon=${finalLng}&zoom=18&addressdetails=1`
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
            if (fullAddr) {
              finalAddress = fullAddr
              setAddressText(fullAddr)
            }
          }
        } catch (_) {}
      }

      // 5. Save to API with verified GPS coordinates
      await apiFetch('/api/shops', {
        method: 'POST',
        body: JSON.stringify({
          shop_name: shopName.trim(),
          whatsapp_number: whatsappNumber.trim(),
          lat: finalLat,
          lng: finalLng,
          address_text: finalAddress
        })
      })
      showToast(`Shop created with precise GPS!\nLat: ${finalLat}, Lng: ${finalLng}${gps ? `\nAccuracy: ±${Math.round(gps.accuracy)}m` : ''}`, 'success', 'Shop Created')
      await fetchMerchantShop()
    } catch (err) {
      showToast(`Failed to create shop: ${err.message}`, 'error', 'Shop Creation Failed')
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
    setIsAffiliate(false)
    setAffiliateLink('')
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
    setIsAffiliate(Boolean(product.is_affiliate_fallback))
    setAffiliateLink(product.affiliate_link || '')
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
      } catch (_) {}
    }

    // 2. Handle Google Search result links (e.g. google.com/url?url=... or google.com/url?q=...)
    if (cleaned.includes('google.com/url') || cleaned.includes('google.co.in/url')) {
      try {
        const parsed = new URL(cleaned)
        const targetUrl = parsed.searchParams.get('url') || parsed.searchParams.get('q')
        if (targetUrl) return decodeURIComponent(targetUrl)
      } catch (_) {}
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

  // Helper to compress local image files in browser to lightweight base64/JPEG (under 300KB)
  const compressImageFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          const MAX_SIZE = 1000
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

          canvas.toBlob(
            (blob) => {
              resolve(blob)
            },
            'image/jpeg',
            0.82
          )
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  // Upload compressed file to ImgBB (Free API, zero ads, direct clean image link)
  const uploadToImgBB = async (file) => {
    const compressedBlob = await compressImageFile(file)
    const formData = new FormData()
    formData.append('image', compressedBlob, 'product.jpg')

    // Public free ImgBB API key
    const res = await fetch('https://api.imgbb.com/1/upload?key=6d207e02198a847aa98d0a2a901485a5', {
      method: 'POST',
      body: formData
    })

    const data = await res.json()
    if (data && data.success && data.data?.url) {
      return data.data.url // Direct raw image URL, 100% ad-free
    }
    throw new Error(data.error?.message || 'Failed to upload photo to ImgBB')
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
        setUploadProgress('Compressing & uploading photo to free cloud...')
        try {
          finalImageUrl = await uploadToImgBB(imageFile)
        } catch (uploadErr) {
          console.warn('ImgBB upload error:', uploadErr)
          showToast(`Photo upload failed: ${uploadErr.message}. You can still paste an image link.`, 'error', 'Upload Failed')
          setSavingProduct(false)
          setUploadProgress('')
          return
        }
      }

      setUploadProgress('Saving product...')

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
            is_affiliate_fallback: isAffiliate ? 1 : 0,
            affiliate_link: isAffiliate ? affiliateLink.trim() : null
          })
        })
        showToast('Product updated successfully!', 'success', 'Product Updated')
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
            is_affiliate_fallback: isAffiliate ? 1 : 0,
            affiliate_link: isAffiliate ? affiliateLink.trim() : null
          })
        })
        showToast('Product published to live showcase!', 'success', 'Product Published')
      }

      // Reset form and reload products
      setEditingProduct(null)
      setProductName('')
      setProductPrice('')
      setProductCategory('General')
      setProductImageUrl('')
      setImageFile(null)
      setIsAffiliate(false)
      setAffiliateLink('')
      setShowAddProductModal(false)
      await fetchMerchantShop()
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
              if (fullAddr) setAddressText(fullAddr)
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
              whatsapp_number: shop.whatsapp_number,
              lat: latitude,
              lng: longitude,
              address_text: newAddress || null
            })
          })
          showToast(`Shop GPS location updated to your exact position!\nLat: ${latitude}, Lng: ${longitude}\nPrecision: ±${Math.round(pos.coords.accuracy || 10)}m`, 'success', 'GPS Updated')
          await fetchMerchantShop()
        } catch (err) {
          showToast(`Failed to update shop location: ${err.message}`, 'error', 'Update Failed')
        }
      },
      (err) => showToast(`Geolocation error: ${err.message}`, 'error', 'GPS Error'),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    )
  }

  // Screen 1: Unauthenticated Merchant
  if (!user) {
    return (
      <main className="pt-24 px-container-margin max-w-md mx-auto text-center pb-24">
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-surface-variant shadow-lg flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined text-3xl">storefront</span>
          </div>
          <h2 className="font-headline-lg text-2xl font-bold text-on-surface mb-2">Shopkeeper Portal</h2>
          <p className="text-sm text-on-surface-variant mb-6">
            Sign in with Google to display your products to buyers nearby in real-time — 100% free, zero commissions.
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full bg-primary hover:bg-primary-container text-on-primary py-3.5 px-6 rounded-xl font-title-md font-bold shadow-md transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            <span>Sign in with Google</span>
          </button>
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
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Shop Name *</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Earth & Fire Ceramics"
                className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">WhatsApp Phone Number *</label>
              <input
                type="tel"
                required
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. +91 9876543210"
                className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
              />
              <span className="text-[11px] text-on-surface-variant">Buyers will tap this to chat directly with you on WhatsApp.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Address / Landmark</label>
              <input
                type="text"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="e.g. Shop #4, Main Market, Connaught Place"
                className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant/60 flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-on-surface">Store GPS Coordinates</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                      window.open(mapsUrl, '_blank')
                    }}
                    className="text-xs text-secondary font-bold hover:underline flex items-center gap-1"
                    title="Open current coordinates in Google Maps"
                  >
                    <span className="material-symbols-outlined text-sm">map</span>
                    <span>Verify on Maps</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleUseGPS}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">my_location</span>
                    <span>Use Current GPS</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-on-surface-variant">Latitude</span>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full bg-surface-container-high border border-surface-variant rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant">Longitude</span>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full bg-surface-container-high border border-surface-variant rounded-lg p-2 text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingShop}
              className="w-full bg-primary hover:bg-primary-container text-on-primary py-3.5 px-6 rounded-xl font-bold transition-all shadow-md mt-2"
            >
              {creatingShop ? 'Creating Shop...' : 'Save & Continue to Product Catalog'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  // Screen 3: Authenticated Merchant with Active Shop Dashboard
  return (
    <main className="pt-20 md:pt-24 px-container-margin max-w-6xl mx-auto pb-24">
      {/* Merchant Header Bar */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-variant shadow-md mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-headline-lg text-2xl font-bold text-on-surface">{shop.shop_name}</h2>
            <span className="bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full text-xs font-semibold">
              Live Shop Window
            </span>
          </div>
          <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-xs">location_on</span>
            {shop.address_text || 'Local Address'} | WhatsApp: {shop.whatsapp_number}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleUpdateShopGPS}
            title="Update shop location to your current high-precision GPS position"
            className="bg-surface-container-high text-on-surface hover:bg-surface-variant px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all border border-surface-variant flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-primary text-base">my_location</span>
            <span>Update Shop Location</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="bg-primary hover:bg-primary-container text-on-primary px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Add New Product</span>
          </button>
          <button
            onClick={signOut}
            className="bg-surface-container-high text-on-surface hover:bg-surface-variant px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border border-surface-variant"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Product List Grid */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-title-md text-lg font-bold text-on-surface">Your Product Showcase ({products.length})</h3>
      </div>

      {products.length === 0 ? (
        <div className="bg-surface-container-low p-8 rounded-2xl border border-surface-variant text-center my-4">
          <span className="material-symbols-outlined text-4xl text-primary mb-2">add_photo_alternate</span>
          <h4 className="font-title-md text-base font-bold text-on-surface mb-1">No products added yet</h4>
          <p className="text-xs text-on-surface-variant mb-4">
            Showcase your best-selling items so local buyers nearby can discover them!
          </p>
          <button
            onClick={handleOpenAddModal}
            className="bg-primary text-on-primary px-4 py-2 rounded-xl text-xs font-bold shadow-sm"
          >
            + Add First Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-surface-container-lowest rounded-xl border border-surface-variant/60 overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-shadow"
            >
              <div className="w-full aspect-square bg-surface-variant overflow-hidden relative">
                <img
                  src={product.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 flex flex-col flex-1 justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-primary font-bold uppercase tracking-wider">{product.category}</span>
                    <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      v{product.version || 1}
                    </span>
                  </div>
                  <h4 className="font-title-md text-sm font-semibold text-on-surface line-clamp-1">{product.name}</h4>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-bold text-primary text-base">₹{product.price}</span>
                  <div className="flex items-center gap-1.5">
                    {product.is_affiliate_fallback ? (
                      <span className="text-[10px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-md font-semibold">Affiliate</span>
                    ) : (
                      <span className="text-[10px] bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-md font-semibold">Local</span>
                    )}
                    <button
                      onClick={() => handleOpenEditModal(product)}
                      title="Edit Product"
                      className="p-1.5 rounded-lg bg-surface-container-high hover:bg-primary/10 text-on-surface hover:text-primary transition-colors flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      title="Delete Product"
                      className="p-1.5 rounded-lg bg-surface-container-high hover:bg-red-500/10 text-on-surface hover:text-red-500 transition-colors flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/60 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-variant max-h-[90vh] overflow-y-auto">
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

            <form onSubmit={handleSaveProduct} className="flex flex-col gap-4">
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
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setImageFile(file)
                        // Local preview URL
                        setProductImageUrl(URL.createObjectURL(file))
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
                    <div className="text-[11px] text-on-surface-variant overflow-hidden">
                      <span className="font-bold text-on-surface block mb-0.5">
                        {imageFile ? 'Selected Photo from Phone' : 'Image Link Preview'}
                      </span>
                      <span className="truncate block opacity-75">
                        {imageFile ? `${imageFile.name} (${Math.round(imageFile.size / 1024)} KB)` : cleanGoogleImageUrl(productImageUrl)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Affiliate Link Toggle */}
              <div className="flex items-center gap-2 border-t border-surface-variant pt-3">
                <input
                  type="checkbox"
                  id="affiliateToggle"
                  checked={isAffiliate}
                  onChange={(e) => setIsAffiliate(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <label htmlFor="affiliateToggle" className="text-xs font-bold text-on-surface cursor-pointer">
                  Is this an Online Affiliate Fallback Product?
                </label>
              </div>

              {isAffiliate && (
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Affiliate Product Link</label>
                  <input
                    type="url"
                    value={affiliateLink}
                    onChange={(e) => setAffiliateLink(e.target.value)}
                    placeholder="https://amazon.in/dp/..."
                    className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={savingProduct}
                className="w-full bg-primary hover:bg-primary-container text-on-primary py-3.5 px-6 rounded-xl font-bold transition-all shadow-md mt-2"
              >
                {savingProduct
                  ? 'Saving Product...'
                  : editingProduct
                  ? 'Update Product Details'
                  : 'Publish Product to Live App'}
              </button>
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
    </main>
  )
}
