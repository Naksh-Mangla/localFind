import React, { useState, useEffect } from 'react'
import { formatDistance } from '../utils/haversine'
import { getRAGStatus } from '../utils/syncRAG'
import { getStoreOpenStatus } from '../utils/storeHours'
import { getFlashDealInfo } from '../utils/flashDeals'

export function ProductDetailModal({ product, onClose }) {
  if (!product) return null

  const [isWishlisted, setIsWishlisted] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('localfind_wishlist') || '[]')
      return saved.includes(product.id)
    } catch {
      return false
    }
  })

  // Listen to cross-component storage updates for wishlist sync
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('localfind_wishlist') || '[]')
        setIsWishlisted(saved.includes(product.id))
      } catch (e) {}
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [product.id, onClose])

  const productRAG = getRAGStatus(product.updated_at || product.created_at)
  const openStatus = getStoreOpenStatus(product.opening_time, product.closing_time)
  const flashInfo = getFlashDealInfo(product)

  const finalPrice = flashInfo.isLive ? flashInfo.discountedPrice : product.price
  let cleanWhatsapp = (product.whatsapp_number || '').replace(/[^0-9]/g, '')
  if (cleanWhatsapp.length === 10) {
    cleanWhatsapp = `91${cleanWhatsapp}`
  }
  const whatsappMsg = encodeURIComponent(
    flashInfo.isLive
      ? `Hi! I saw your ⚡ Flash Deal for "${product.name}" at ₹${finalPrice} (${flashInfo.discountPercent}% OFF) on LocalFind. Is it available for pickup today?`
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

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-surface rounded-3xl shadow-crisp-xl overflow-y-auto my-auto border border-surface-variant/70 max-h-[92vh] flex flex-col scroll-smooth animate-popIn"
      >
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
            {/* Wishlist Heart Button inside Modal with Heartbeat Animation */}
            <button
              onClick={() => {
                try {
                  const saved = JSON.parse(localStorage.getItem('localfind_wishlist') || '[]')
                  const next = saved.includes(product.id)
                    ? saved.filter((id) => id !== product.id)
                    : [...saved, product.id]
                  localStorage.setItem('localfind_wishlist', JSON.stringify(next))
                  setIsWishlisted(next.includes(product.id))
                  window.dispatchEvent(new Event('storage'))
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
            src={product.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'}
            alt={product.name}
            onError={(e) => {
              e.target.onerror = null
              e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'
            }}
            className="w-full h-full object-cover"
          />
          {flashInfo.isLive && (
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
              {flashInfo.isLive ? (
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

          {/* 💬 1-Tap Hinglish WhatsApp Quick Inquiry Templates */}
          {!product.is_affiliate_fallback && (
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#25D366]">bolt</span>
                <span>1-Tap WhatsApp Quick Inquiries:</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    icon: '📦',
                    chipText: 'Stock me hai?',
                    fullMsg: `Namaste! Kya "${product.name}" abhi aapki shop (${product.shop_name}) par stock me available hai? Maine LocalFind par dekha.`
                  },
                  {
                    icon: '🏷️',
                    chipText: '2 item pe discount?',
                    fullMsg: `Namaste! Agar main 2 pieces "${product.name}" khareedun toh kya kuch extra discount ya best rate mil sakta hai? (LocalFind price: ₹${finalPrice})`
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
                      className="bg-surface-container-high/80 hover:bg-[#25D366]/15 hover:border-[#25D366]/50 text-on-surface hover:text-emerald-700 dark:hover:text-emerald-400 p-3 rounded-2xl text-xs font-semibold border border-surface-variant/70 flex items-center gap-2.5 transition-all shadow-crisp-xs active:scale-95 group text-left"
                    >
                      <span className="text-lg">{template.icon}</span>
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
            {product.is_affiliate_fallback && product.affiliate_link ? (
              <a
                href={product.affiliate_link}
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
