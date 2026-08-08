import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'

export function MerchantDashboard({
  user,
  signInWithGoogle,
  signOut,
  userCoords
}) {
  const [shop, setShop] = useState(null)
  const [loadingShop, setLoadingShop] = useState(true)
  const [shopError, setShopError] = useState('')

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

  // Handle Shop Creation
  const handleCreateShop = async (e) => {
    e.preventDefault()
    if (!shopName.trim() || !whatsappNumber.trim()) {
      alert('Please fill in Shop Name and WhatsApp number.')
      return
    }
    try {
      setCreatingShop(true)
      await apiFetch('/api/shops', {
        method: 'POST',
        body: JSON.stringify({
          shop_name: shopName.trim(),
          whatsapp_number: whatsappNumber.trim(),
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          address_text: addressText.trim() || null
        })
      })
      await fetchMerchantShop()
    } catch (err) {
      alert(`Failed to create shop: ${err.message}`)
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

  // Handle Product Delete
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product from your store catalog?')) return
    try {
      await apiFetch(`/api/products?id=${productId}`, {
        method: 'DELETE'
      })
      await fetchMerchantShop()
    } catch (err) {
      alert(`Failed to delete product: ${err.message}`)
    }
  }

  // Handle Product Creation / Editing
  const handleSaveProduct = async (e) => {
    e.preventDefault()
    if (!productName.trim() || !productPrice || !shop) {
      alert('Please enter Product Name and Price.')
      return
    }

    try {
      setSavingProduct(true)
      let finalImageUrl = productImageUrl.trim()

      if (imageFile) {
        setUploadProgress('Uploading image to Cloudflare R2...')
        try {
          finalImageUrl = await uploadImage(imageFile)
        } catch (uploadErr) {
          if (uploadErr.message?.includes('R2 bucket binding') || uploadErr.message?.includes('500')) {
            alert('Cloudflare R2 Image Storage is not enabled on your Cloudflare dashboard yet.\n\nTo save this product right now, please clear the file selection and paste an image URL in the "Paste Image URL" field!')
            setSavingProduct(false)
            setUploadProgress('')
            return
          }
          throw uploadErr
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
      alert(`Failed to save product: ${err.message}`)
    } finally {
      setSavingProduct(false)
      setUploadProgress('')
    }
  }

  // Use Browser GPS for shop location
  const handleUseGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude)
          setLng(pos.coords.longitude)
          alert('Updated shop coordinates with current GPS location!')
        },
        (err) => alert(`Geolocation error: ${err.message}`)
      )
    } else {
      alert('Geolocation is not supported by your browser.')
    }
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
            Sign in with Google to display your products to buyers nearby in real-time â€” 100% free, zero commissions.
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">Store GPS Coordinates</span>
                <button
                  type="button"
                  onClick={handleUseGPS}
                  className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">my_location</span>
                  <span>Use Current GPS Location</span>
                </button>
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

        <div className="flex items-center gap-3">
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
                  <label className="block text-xs font-bold text-on-surface mb-1">Price (â‚¹) *</label>
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
                  <label className="block text-xs font-bold text-on-surface mb-1">Category *</label>
                  <select
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary"
                  >
                    <option value="General">General</option>
                    <option value="Handmade">Handmade</option>
                    <option value="Groceries">Groceries</option>
                    <option value="Fashion">Fashion</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Sale">Sale</option>
                  </select>
                </div>
              </div>

              {/* Image URL (optional) */}
              <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant/60 flex flex-col gap-3">
                <span className="text-xs font-bold text-on-surface">Product Photo (optional)</span>
                <p className="text-[11px] text-on-surface-variant">
                  Paste a photo link from the internet. If you skip this, a placeholder image will be shown automatically.
                </p>
                <div>
                  <input
                    type="url"
                    value={productImageUrl}
                    onChange={(e) => setProductImageUrl(e.target.value)}
                    placeholder="https://example.com/item.jpg"
                    className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-2.5 text-xs"
                  />
                </div>
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
    </main>
  )
}
