import React from 'react'
import { formatDistance } from '../utils/haversine'

export function ProductDetailModal({ product, onClose }) {
  if (!product) return null

  const cleanWhatsapp = (product.whatsapp_number || '').replace(/[^0-9]/g, '')
  const whatsappMsg = encodeURIComponent(
    `Hi, is "${product.name}" (₹${product.price}) currently available at ${product.shop_name}? I found it on LocalFind.`
  )
  const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${whatsappMsg}`
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${product.lat},${product.lng}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-surface rounded-2xl shadow-2xl overflow-hidden my-8 border border-surface-variant max-h-[90vh] flex flex-col">
        {/* Floating Action Buttons */}
        <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center pointer-events-none">
          <button
            onClick={onClose}
            className="pointer-events-auto w-10 h-10 rounded-full bg-surface/90 backdrop-blur-md shadow-md flex items-center justify-center text-on-surface hover:bg-surface-variant transition-transform active:scale-95 border border-surface-variant"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          {product.distanceKm !== null && product.distanceKm !== undefined && (
            <div className="pointer-events-auto bg-secondary text-on-secondary px-3 py-1.5 rounded-full text-xs font-semibold shadow-md flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">directions_walk</span>
              <span>{formatDistance(product.distanceKm)}</span>
            </div>
          )}
        </div>

        {/* Hero Product Image */}
        <div className="relative w-full aspect-video md:aspect-[16/9] bg-surface-container-high overflow-hidden">
          <img
            src={product.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'}
            alt={product.name}
            onError={(e) => {
              e.target.onerror = null
              e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'
            }}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Product Information Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block bg-primary-container/20 text-primary px-3 py-1 rounded-full text-xs font-semibold mb-2">
                {product.category || 'General'}
              </span>
              <h2 className="font-headline-lg text-2xl font-bold text-on-surface leading-tight">
                {product.name}
              </h2>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="font-display-lg text-3xl font-bold text-primary">₹{product.price}</span>
            </div>
          </div>

          {/* Shopkeeper Details Box */}
          <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant/60 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0 mt-0.5">
                <span className="material-symbols-outlined">storefront</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h3 className="font-title-md font-bold text-on-surface text-base">{product.shop_name}</h3>
                  {product.owner_name && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                      Owner: {product.owner_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant flex items-center gap-1 mb-1">
                  <span className="material-symbols-outlined text-xs text-primary">location_on</span>
                  <span>{product.address_text || 'Local Shop Address'}</span>
                </p>
                {product.description && (
                  <p className="text-xs text-on-surface-variant/90 italic bg-surface p-2.5 rounded-lg border border-surface-variant/40 mt-2">
                    "{product.description}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Zero-Cost Direct Connect Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            {product.is_affiliate_fallback && product.affiliate_link ? (
              <a
                href={product.affiliate_link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-secondary text-on-secondary hover:bg-secondary/90 py-3.5 px-6 rounded-xl font-title-md text-center font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">shopping_cart</span>
                <span>Buy Online (Affiliate Fallback)</span>
              </a>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-3.5 px-4 rounded-xl font-bold text-center transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                >
                  <span className="material-symbols-outlined">chat</span>
                  <span>Ask Seller on WhatsApp</span>
                </a>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-primary text-on-primary hover:bg-primary-container py-3.5 px-4 rounded-xl font-bold text-center transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                >
                  <span className="material-symbols-outlined">near_me</span>
                  <span>Get Store Directions</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
