import React, { useState, useMemo } from 'react'
import { calculateDistanceKm, formatDistance } from '../utils/haversine'

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
  loading
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

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

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return productsWithDistance.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        item.category?.toLowerCase() === selectedCategory.toLowerCase()

      const matchesSearch =
        !searchQuery.trim() ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesCategory && matchesSearch
    })
  }, [productsWithDistance, selectedCategory, searchQuery])

  // Split local products vs affiliate fallback products
  const localProducts = useMemo(() => {
    return filteredProducts
      .filter((p) => !p.is_affiliate_fallback)
      .sort((a, b) => {
        if (a.distanceKm === null) return 1
        if (b.distanceKm === null) return -1
        return a.distanceKm - b.distanceKm
      })
  }, [filteredProducts])

  const fallbackProducts = useMemo(() => {
    return filteredProducts.filter((p) => p.is_affiliate_fallback)
  }, [filteredProducts])

  return (
    <main class="pt-20 md:pt-28 px-container-margin max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Search and Category Filter Section */}
      <section class="mb-stack-lg sticky top-16 md:top-20 bg-surface z-30 py-3">
        <div class="relative w-full mb-4">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for local goods, shops, or categories..."
            class="w-full bg-surface-container-high border border-surface-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-10 font-body-lg text-on-surface placeholder-on-surface-variant transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface"
            >
              <span class="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div class="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.label
            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                class={`flex items-center gap-2 px-4 py-2 rounded-full font-label-caps text-xs shadow-sm whitespace-nowrap active:scale-95 transition-all ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-bold ring-2 ring-secondary'
                    : 'bg-surface-container-high border border-surface-variant text-on-surface hover:bg-surface-variant'
                }`}
              >
                <span class="material-symbols-outlined text-[18px]">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Loading Skeleton */}
      {loading && (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} class="bg-surface-container-lowest rounded-xl h-80 animate-pulse border border-surface-variant/40"></div>
          ))}
        </div>
      )}

      {/* Local Product Feed (Bento / Grid) */}
      {!loading && (
        <section class="mb-stack-lg">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-headline-lg-mobile text-xl font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">store</span>
              <span>Available in Offline Stores Nearby</span>
            </h2>
            <span class="text-xs text-on-surface-variant">
              {localProducts.length} local items
            </span>
          </div>

          {localProducts.length === 0 ? (
            <div class="bg-surface-container-low p-8 rounded-2xl border border-surface-variant text-center my-6">
              <span class="material-symbols-outlined text-4xl text-primary mb-2">search_off</span>
              <h3 class="font-title-md text-lg font-bold text-on-surface mb-1">No Local Products Found</h3>
              <p class="text-sm text-on-surface-variant max-w-md mx-auto mb-4">
                No nearby shopkeeper has listed this item yet. Check out online fallback options below!
              </p>
            </div>
          ) : (
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
              {localProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  class="bg-surface-container-lowest rounded-xl shadow-[0px_4px_20px_rgba(31,27,23,0.04)] overflow-hidden border border-surface-variant/50 flex flex-col group cursor-pointer hover:shadow-[0px_8px_24px_rgba(156,62,32,0.12)] hover:border-primary/40 transition-all duration-300"
                >
                  <div class="relative w-full aspect-square overflow-hidden bg-surface-variant">
                    <img
                      src={product.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'}
                      alt={product.name}
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {product.distanceKm !== null && (
                      <div class="absolute top-3 right-3 bg-secondary text-on-secondary px-2.5 py-1 rounded-full font-label-caps text-[11px] flex items-center gap-1 shadow-sm backdrop-blur-md bg-opacity-95 font-semibold">
                        <span class="material-symbols-outlined text-[14px]">directions_walk</span>
                        <span>{formatDistance(product.distanceKm)}</span>
                      </div>
                    )}
                  </div>
                  <div class="p-4 flex flex-col flex-grow">
                    <div class="flex justify-between items-start mb-1">
                      <h3 class="font-title-md text-base font-semibold text-on-surface line-clamp-1">
                        {product.name}
                      </h3>
                    </div>
                    <p class="font-body-sm text-xs text-on-surface-variant mb-3 line-clamp-1">
                      {product.shop_name}
                    </p>
                    <div class="mt-auto flex items-end justify-between">
                      <div>
                        <span class="font-headline-lg-mobile text-xl font-bold text-primary">
                          ₹{product.price}
                        </span>
                      </div>
                      <button class="bg-primary text-on-primary px-3 py-1.5 rounded-lg font-label-caps text-xs hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1">
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Online Fallback Options */}
      {fallbackProducts.length > 0 && (
        <section class="mt-10 pt-6 border-t border-surface-variant/60">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="font-headline-lg-mobile text-xl font-bold text-on-surface flex items-center gap-2">
                <span class="material-symbols-outlined text-secondary">shopping_bag</span>
                <span>Online Fallback Options</span>
              </h2>
              <p class="text-xs text-on-surface-variant">
                Items not currently in stock nearby can be ordered online.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {fallbackProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                class="bg-surface-container-low rounded-xl border border-secondary-fixed-dim/40 p-4 flex gap-4 cursor-pointer hover:bg-surface-container-high transition-colors"
              >
                <img
                  src={product.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&auto=format&fit=crop&q=80'}
                  alt={product.name}
                  class="w-20 h-20 rounded-lg object-cover bg-surface-variant"
                />
                <div class="flex flex-col justify-between flex-1">
                  <div>
                    <h3 class="font-title-md text-sm font-semibold text-on-surface">{product.name}</h3>
                    <span class="text-xs text-secondary font-medium">Online Affiliate Deal</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-primary text-base">₹{product.price}</span>
                    <span class="text-xs text-primary underline">Buy Online &rarr;</span>
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
