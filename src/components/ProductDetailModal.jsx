import React, { useState, useEffect } from 'react'
import { formatDistance } from '../utils/haversine'
import { getRAGStatus } from '../utils/syncRAG'
import { getStoreOpenStatus } from '../utils/storeHours'
import { getFlashDealInfo } from '../utils/flashDeals'
import { sanitizeHttpUrl, sanitizeImageUrl } from '../utils/safeUrl'
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler'
import { triggerHaptic } from '../utils/haptics'
import { useAuth } from '../hooks/useAuth'
import { apiFetch } from '../lib/api'
import { ReviewStars } from './ReviewStars'

export function ProductDetailModal({ product, onClose, onReviewSubmitted }) {
  // Sync with Android hardware & gesture back button
  useAndroidBackHandler(Boolean(product), onClose, 'product_detail')

  const { user, signInWithGoogle } = useAuth()
  const [reviews, setReviews] = useState([])
  const [reviewStats, setReviewStats] = useState(null)
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [showAllReviews, setShowAllReviews] = useState(false)

  // Hooks must run unconditionally on every render (Rules of Hooks).
  const [isWishlisted, setIsWishlisted] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('localfind_wishlist') || '[]')
      return saved.includes(product?.id)
    } catch {
      return false
    }
  })

  // Listen to cross-component storage updates for wishlist sync
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('localfind_wishlist') || '[]')
        setIsWishlisted(saved.includes(product?.id))
      } catch (e) {}
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('keydown', handleKeyDown)
    
    // Lock body scroll while modal is open to prevent page drift
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [product?.id, onClose])

  // Fetch live shop reviews (shop-level, live avg)
  useEffect(() => {
    if (!product?.shop_id) return
    let cancelled = false
    const fetchReviews = async () => {
      try {
        setLoadingReviews(true)
        setReviewError('')
        const data = await apiFetch(`/api/reviews?shop_id=${encodeURIComponent(product.shop_id)}`)
        if (cancelled) return
        setReviews(Array.isArray(data.reviews) ? data.reviews : [])
        setReviewStats(data.stats || null)
        // Prefill my review if already exists
        if (user?.uid) {
          const mine = (data.reviews || []).find((r) => r.user_id === user.uid)
          if (mine) {
            setMyRating(mine.rating || 0)
            setMyComment(mine.comment || '')
          } else {
            setMyRating(0)
            setMyComment('')
          }
        }
      } catch (e) {
        if (!cancelled) setReviewError(e.message || 'Failed to load reviews')
      } finally {
        if (!cancelled) setLoadingReviews(false)
      }
    }
    fetchReviews()
    return () => { cancelled = true }
  }, [product?.shop_id, user?.uid])

  // Also update when product avg changes live (from polling)
  useEffect(() => {
    if (product?.avg_rating && reviewStats && product.avg_rating !== reviewStats.avg_rating) {
      setReviewStats((prev) => prev ? { ...prev, avg_rating: product.avg_rating, total_reviews: product.review_count } : prev)
    }
  }, [product?.avg_rating, product?.review_count])

  if (!product) return null

  // Android Native Web Share Handler
  const handleShareProduct = async () => {
    triggerHaptic('selection')
    const shareData = {
      title: `${product.name} | LocalFind`,
      text: `Check out "${product.name}" at ₹${product.price} at ${product.shop_name || 'local shop'} on LocalFind!`,
      url: window.location.href
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        triggerHaptic('success')
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Native share failed, fallback to copy', err)
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href)
        alert('Product link copied to clipboard!')
      } catch (err) {
        console.warn('Failed to copy link', err)
      }
    }
  }

  const cleanWhatsapp = product.whatsapp_number ? product.whatsapp_number.replace(/[^0-9]/g, '') : ''
  const isFlash = product.is_flash_deal && product.flash_deal_ends_at && new Date(product.flash_deal_ends_at).getTime() > Date.now()
  const flashInfo = isFlash ? getFlashDealInfo(product) : null

  const whatsappMsg = encodeURIComponent(
    isFlash
      ? `Hi, I saw the Flash Deal for "${product.name}" at ₹${flashInfo?.discountedPrice} (${flashInfo?.discountPercent}% OFF) at ${product.shop_name} on LocalFind! Is it still in stock?`
      : `Hi, is "${product.name}" (₹${product.price}) currently available at ${product.shop_name}? I found it on LocalFind.`
  )
  const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${whatsappMsg}`
  
  const pLat = Number(product.lat)
  const pLng = Number(product.lng)
  const hasShopCoords = Number.isFinite(pLat) && Number.isFinite(pLng)
  const destinationParam = hasShopCoords
    ? `${pLat},${pLng}`
    : encodeURIComponent(`${product.shop_name || 'Local Shop'} ${product.address_text || ''}`.trim())
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationParam}`

  const productRAG = getRAGStatus(product.updated_at || product.created_at)
  const openStatus = getStoreOpenStatus(product.opening_time, product.closing_time)
  
  // Server data is sanitized again at render time (defense-in-depth against
  // javascript:/data: URLs injected into the DB by any writer).
  const safeImageSrc = sanitizeImageUrl(product.image_url) || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'
  const safeAffiliateLink = product.is_affiliate_fallback ? sanitizeHttpUrl(product.affiliate_link) : null

  const myExistingReview = user?.uid ? reviews.find((r) => r.user_id === user.uid) : null
  const isOwnShop = user?.uid && product.shop_owner_id === user.uid

  const handleSubmitReview = async () => {
    if (!user) {
      triggerHaptic('warning')
      try { await signInWithGoogle() } catch (e) { console.warn(e) }
      return
    }
    if (isOwnShop) {
      setReviewError('Shop owners cannot review their own shop')
      return
    }
    if (!myRating || myRating < 1 || myRating > 5) {
      setReviewError('Please select 1-5 stars')
      return
    }
    try {
      setSubmittingReview(true)
      setReviewError('')
      triggerHaptic('selection')
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          shop_id: product.shop_id,
          rating: myRating,
          comment: myComment.trim() || null,
          user_name: user.displayName || user.email?.split('@')[0] || 'Neighbor'
        })
      })
      triggerHaptic('success')
      // Refresh reviews + products live avg
      const data = await apiFetch(`/api/reviews?shop_id=${encodeURIComponent(product.shop_id)}`)
      setReviews(Array.isArray(data.reviews) ? data.reviews : [])
      setReviewStats(data.stats || null)
      if (onReviewSubmitted) onReviewSubmitted()
    } catch (e) {
      setReviewError(e.message || 'Failed to save review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleDeleteMyReview = async () => {
    if (!user || !myExistingReview) return
    try {
      setSubmittingReview(true)
      await apiFetch(`/api/reviews?shop_id=${encodeURIComponent(product.shop_id)}`, { method: 'DELETE' })
      triggerHaptic('warning')
      setMyRating(0)
      setMyComment('')
      const data = await apiFetch(`/api/reviews?shop_id=${encodeURIComponent(product.shop_id)}`)
      setReviews(Array.isArray(data.reviews) ? data.reviews : [])
      setReviewStats(data.stats || null)
      if (onReviewSubmitted) onReviewSubmitted()
    } catch (e) {
      setReviewError(e.message || 'Failed to delete')
    } finally {
      setSubmittingReview(false)
    }
  }

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md overflow-hidden overscroll-none select-none animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-surface rounded-t-[32px] sm:rounded-3xl shadow-crisp-xl overflow-y-auto overscroll-contain border border-surface-variant/70 max-h-[90dvh] flex flex-col scroll-smooth animate-slide-up-sheet sm:animate-popIn select-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
      >
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1 bg-on-surface/20 rounded-full mx-auto mt-2.5 mb-1 sm:hidden"></div>

        {/* Floating Action Buttons (Sticky at top of modal) */}
        <div className="sticky top-3 left-0 right-0 z-20 flex justify-between items-center px-4 pointer-events-none -mb-14">
          <button
            onClick={onClose}
            className="pointer-events-auto w-10 h-10 rounded-full bg-surface/85 backdrop-blur-md shadow-crisp-sm flex items-center justify-center text-on-surface hover:bg-surface transition-transform active:scale-90 border border-surface-variant/40"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          
          <div className="flex items-center gap-2 pointer-events-auto">
            {product.isOwner ? (
              <div className="bg-primary text-on-primary px-3.5 py-1.5 rounded-full text-xs font-bold shadow-crisp-sm flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">storefront</span>
                <span>Your Shop (0m)</span>
              </div>
            ) : product.distanceKm !== null && product.distanceKm !== undefined && (
              <div className="bg-secondary text-on-secondary px-3.5 py-1.5 rounded-full text-xs font-bold shadow-crisp-sm flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">directions_walk</span>
                <span>{formatDistance(product.distanceKm)}</span>
              </div>
            )}
            {/* Android Web Share Button */}
            <button
              onClick={handleShareProduct}
              title="Share Product"
              className="w-10 h-10 rounded-full bg-surface/85 backdrop-blur-md shadow-crisp-sm flex items-center justify-center transition-all active:scale-90 border border-surface-variant/40 text-on-surface-variant hover:text-primary hover:bg-surface"
            >
              <span className="material-symbols-outlined text-xl">share</span>
            </button>

            {/* Wishlist Heart Button inside Modal with Heartbeat Animation */}
            <button
              onClick={() => {
                triggerHaptic('light')
                try {
                  const saved = JSON.parse(localStorage.getItem('localfind_wishlist') || '[]')
                  const next = saved.includes(product.id)
                    ? saved.filter((id) => id !== product.id)
                    : [...saved, product.id]
                  localStorage.setItem('localfind_wishlist', JSON.stringify(next))
                  setIsWishlisted(next.includes(product.id))
                  window.dispatchEvent(new Event('storage'))
                  if (next.includes(product.id)) triggerHaptic('selection')
                } catch (e) {
                  console.warn(e)
                }
              }}
              title="Save to Wishlist"
              className={`w-10 h-10 rounded-full backdrop-blur-md shadow-crisp-sm flex items-center justify-center transition-all active:scale-90 border ${
                isWishlisted
                  ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/20'
                  : 'bg-surface/85 text-on-surface-variant hover:text-rose-500 hover:bg-surface border-surface-variant/40'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${isWishlisted ? 'fill-current animate-heartBeat' : ''}`}>
                favorite
              </span>
            </button>
          </div>
        </div>

        {/* Hero Product Image */}
        <div className="relative w-full aspect-video md:aspect-[16/9] bg-surface-container-high overflow-hidden shrink-0">
          <img
            src={safeImageSrc}
            alt={product.name}
            onError={(e) => {
              e.target.onerror = null
              e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'
            }}
            className="w-full h-full object-cover"
          />
          {flashInfo?.isLive && (
            <div className="absolute bottom-3 left-3 bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600 text-white px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-crisp-md border border-white/40 animate-softGaze">
              <span className="animate-bounce">⚡</span>
              <span>AAJ KA OFFER: {flashInfo.discountPercent}% OFF ({flashInfo.countdownText})</span>
            </div>
          )}
        </div>

        {/* Product Information Body */}
        <div className="p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="inline-block bg-primary-container/20 text-primary px-3 py-1 rounded-full text-xs font-bold">
                  {product.category || 'General'}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${productRAG.colorClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${productRAG.dotClass}`}></span>
                  <span>Updated {productRAG.label}</span>
                </span>
              </div>
              <h2 className="font-headline-lg text-2xl font-bold text-on-surface leading-tight">
                {product.name}
              </h2>
            </div>
            <div className="text-right flex-shrink-0">
              {flashInfo?.isLive ? (
                <div className="flex flex-col items-end">
                  <span className="font-display-lg text-3xl font-bold text-rose-600">₹{flashInfo.discountedPrice}</span>
                  <span className="text-sm text-on-surface-variant line-through opacity-70 font-medium">₹{flashInfo.originalPrice}</span>
                </div>
              ) : (
                <span className="font-display-lg text-3xl font-black text-primary">₹{product.price}</span>
              )}
            </div>
          </div>

          {/* Shopkeeper Details Box */}
          <div className="bg-surface-container-low/80 p-4.5 rounded-2xl border border-surface-variant/60 flex flex-col gap-3 shadow-crisp-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 mt-0.5 shadow-crisp-xs">
                <span className="material-symbols-outlined">storefront</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-title-md font-bold text-on-surface text-base">{product.shop_name}</h3>
                  {product.owner_name && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold">
                      Owner: {product.owner_name}
                    </span>
                  )}
                  {!product.is_affiliate_fallback && (
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${openStatus.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${openStatus.dotClass} ${openStatus.isOpen ? 'animate-pulse' : ''}`}></span>
                      <span>{openStatus.badgeLabel || `${openStatus.label} (${openStatus.timingText || '9 AM – 9 PM'})`}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant flex items-center gap-1 mb-1">
                  <span className="material-symbols-outlined text-xs text-primary">location_on</span>
                  <span>{product.address_text || 'Local Shop Address'}</span>
                </p>
                {product.description && (
                  <p className="text-xs text-on-surface-variant/90 italic bg-surface/90 p-3 rounded-xl border border-surface-variant/40 mt-2">
                    "{product.description}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ⭐ Live Shop Reviews - shop-level, 1 per user, editable */}
          <div className="bg-surface-container-low/60 p-4.5 rounded-2xl border border-surface-variant/60 shadow-crisp-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-amber-500">rate_review</span>
                <span>Shop Reviews</span>
                {reviewStats?.total_reviews > 0 && (
                  <span className="text-xs font-normal text-on-surface-variant">({reviewStats.total_reviews})</span>
                )}
              </h4>
              {reviewStats?.avg_rating && (
                <div className="flex items-center gap-1.5">
                  <ReviewStars rating={reviewStats.avg_rating} size="sm" showValue reviewCount={reviewStats.total_reviews} />
                </div>
              )}
            </div>

            {/* Breakdown bars - live */}
            {reviewStats?.total_reviews > 0 && (
              <div className="grid grid-cols-5 gap-1 mb-3">
                {[5,4,3,2,1].map((star) => {
                  const count = reviewStats.breakdown?.[star] || 0
                  const pct = reviewStats.total_reviews ? Math.round((count / reviewStats.total_reviews) * 100) : 0
                  return (
                    <div key={star} className="text-center">
                      <div className="text-[10px] font-bold text-on-surface-variant">{star}★</div>
                      <div className="h-1.5 bg-surface-variant/50 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-on-surface-variant mt-0.5">{count}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {loadingReviews ? (
              <div className="flex items-center justify-center py-6 text-xs text-on-surface-variant">
                <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin mr-2" />
                Loading reviews...
              </div>
            ) : (
              <>
                {/* Recent reviews list - live, newest first */}
                {reviews.length > 0 ? (
                  <div className="flex flex-col gap-3 mb-4 max-h-[220px] overflow-y-auto overscroll-contain pr-1">
                    {(showAllReviews ? reviews : reviews.slice(0, 3)).map((r) => (
                      <div key={r.id} className={`p-3 rounded-xl border ${r.user_id === user?.uid ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface border-surface-variant/40'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-on-surface">{r.user_name || 'Neighbor'}</span>
                          <ReviewStars rating={r.rating} size="sm" />
                        </div>
                        {r.comment && <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">"{r.comment}"</p>}
                        <p className="text-[10px] text-on-surface-variant/70 mt-1">{new Date(r.updated_at || r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    ))}
                    {reviews.length > 3 && (
                      <button onClick={() => setShowAllReviews((v) => !v)} className="text-xs font-bold text-primary hover:underline self-center">
                        {showAllReviews ? 'Show less' : `View all ${reviews.length} reviews`}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant text-center py-3">No reviews yet — be the first to rate this shop!</p>
                )}

                {/* Leave / Edit review form */}
                {isOwnShop ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-center">You cannot review your own shop</p>
                ) : !user ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-on-surface-variant text-center">Sign in to leave a shop review — others can see your stars live</p>
                    <button onClick={async () => { triggerHaptic('selection'); try{ await signInWithGoogle() } catch(e){} }} className="w-full bg-primary text-on-primary py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95">
                      <span className="material-symbols-outlined text-sm">login</span>
                      <span>Sign in with Google to Review</span>
                    </button>
                    <div className="flex justify-center opacity-60"><ReviewStars rating={0} size="sm" /></div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 bg-surface/80 p-3.5 rounded-xl border border-surface-variant/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface">{myExistingReview ? 'Your review (tap stars to update)' : 'Tap stars to rate'}</span>
                      {myExistingReview && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">1 per shop • editable</span>}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <ReviewStars rating={myRating} size="lg" interactive onChange={(v) => { setReviewError(''); setMyRating(v); triggerHaptic('selection') }} />
                      <span className={`text-[10px] font-medium ${myRating ? 'text-amber-600' : 'text-rose-500'}`}>
                        {myRating ? `${myRating} / 5 selected — tap another star to change` : 'No stars selected — tap 1 to 5 stars (48px targets)'}
                      </span>
                    </div>
                    <textarea
                      value={myComment}
                      onChange={(e) => setMyComment(e.target.value.slice(0, 500))}
                      placeholder="Shop is really good and excellent quality... (optional)"
                      rows={2}
                      className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-xs text-on-surface placeholder-on-surface-variant focus:ring-1 focus:ring-primary focus:border-primary resize-none touch-manipulation"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-on-surface-variant">{myComment.length}/500</span>
                      {reviewError && <span className="text-[11px] text-rose-600 font-bold animate-fadeIn">{reviewError}</span>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSubmitReview}
                        disabled={submittingReview}
                        className={`flex-1 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all ${submittingReview ? 'bg-primary/70 text-on-primary' : myRating < 1 ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' : 'bg-primary hover:bg-primary/90 text-on-primary shadow-primary/20'}`}
                      >
                        {submittingReview ? <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <span className="material-symbols-outlined text-sm">star</span>}
                        <span>{myExistingReview ? 'Update Review' : myRating < 1 ? 'Tap stars then Post' : 'Post Review'}</span>
                      </button>
                      {myExistingReview && (
                        <button onClick={handleDeleteMyReview} disabled={submittingReview} className="px-4 py-2.5 rounded-full text-xs font-bold bg-surface-container-high border border-surface-variant text-on-surface hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30 disabled:opacity-50">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 💬 1-Tap Hinglish WhatsApp Quick Inquiry Templates */}
          {!product.is_affiliate_fallback && (
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#25D366]">bolt</span>
                <span>1-Tap WhatsApp Quick Inquiries:</span>
              </label>

              <div className="flex sm:grid sm:grid-cols-3 gap-2 overflow-x-auto pb-1.5 sm:pb-0 hide-scrollbar snap-x">
                {[
                  {
                    icon: '📦',
                    chipText: 'Stock me hai?',
                    fullMsg: `Namaste! Kya "${product.name}" abhi aapki shop (${product.shop_name}) par stock me available hai? Maine LocalFind par dekha.`
                  },
                  {
                    icon: '🏷️',
                    chipText: '2 item pe discount?',
                    fullMsg: `Namaste! Agar main 2 pieces "${product.name}" khareedun toh kya kuch extra discount ya best rate mil sakta hai? (LocalFind price: ₹${flashInfo?.discountedPrice ?? product.price})`
                  },
                  {
                    icon: '🛵',
                    chipText: 'Home delivery milegi?',
                    fullMsg: `Namaste! Kya "${product.name}" ke liye mere address par nearby home delivery available hai? Main LocalFind se contact kar raha hoon.`
                  }
                ].map((template) => {
                  const queryUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(template.fullMsg)}`
                  return (
                    <a
                      key={template.chipText}
                      href={queryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-surface-container-high/80 hover:bg-[#25D366]/15 hover:border-[#25D366]/50 text-on-surface hover:text-emerald-700 dark:hover:text-emerald-400 p-2.5 sm:p-3 rounded-2xl text-xs font-semibold border border-surface-variant/70 flex items-center gap-2 transition-all shadow-crisp-xs active:scale-95 group text-left flex-shrink-0 w-[200px] sm:w-auto snap-start"
                    >
                      <span className="text-base sm:text-lg">{template.icon}</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[11px] truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {template.chipText}
                        </span>
                        <span className="text-[9px] text-on-surface-variant truncate">Tap to send on WhatsApp</span>
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Zero-Cost Direct Connect Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            {safeAffiliateLink ? (
              <a
                href={safeAffiliateLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-secondary text-on-secondary hover:bg-secondary/90 py-3.5 px-6 rounded-2xl font-title-md text-center font-bold transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 active:scale-98 border border-white/20"
              >
                <span className="material-symbols-outlined text-xl">shopping_cart</span>
                <span>Buy Online (Affiliate Fallback)</span>
              </a>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-3.5 px-4 rounded-2xl font-bold text-center transition-all shadow-crisp-sm hover:shadow-md flex items-center justify-center gap-2 text-sm active:scale-98 border border-white/20 hover:shadow-[#25D366]/20"
                >
                  <span className="material-symbols-outlined text-lg">chat</span>
                  <span>Ask Custom on WhatsApp</span>
                </a>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-primary text-on-primary hover:bg-primary/90 py-3.5 px-4 rounded-2xl font-bold text-center transition-all shadow-crisp-sm hover:shadow-md flex items-center justify-center gap-2 text-sm active:scale-98 border border-white/20 hover:shadow-primary/20"
                >
                  <span className="material-symbols-outlined text-lg">near_me</span>
                  <span>Get Directions</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
