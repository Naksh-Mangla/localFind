import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch, clearApiCache } from '../lib/api'
import { Toast } from './Toast'
import { ConfirmModal } from './ConfirmModal'
import { ReviewStars } from './ReviewStars'
import { ShopBadgePill, HeroShopBadge } from './ShopBadge'
import { triggerHaptic } from '../utils/haptics'

/* ────────────────────────────────────────────
   Reusable Card & Pill Components
   Matching LocalFind Warm Apple/Linear UI
   ──────────────────────────────────────────── */

function StatCard({ icon, label, value, sub, accent = 'primary' }) {
  const accentStyles = {
    primary: 'border-primary/20 bg-primary/5 text-primary',
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    red: 'border-error/20 bg-error/5 text-error',
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-600 dark:text-purple-400',
  }

  return (
    <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-crisp-xs flex flex-col justify-between transition-all hover:border-surface-variant">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${accentStyles[accent]}`}>
          <span className="material-symbols-outlined text-lg">{icon}</span>
        </div>
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-display-lg font-bold text-on-surface tracking-tight">
          {value ?? '—'}
        </div>
        {sub && <div className="text-[11px] text-on-surface-variant mt-1 font-medium">{sub}</div>}
      </div>
    </div>
  )
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative flex-1">
      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
        search
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="w-full pl-10 pr-4 py-2.5 bg-surface-container-high border border-surface-variant/60 dark:border-zinc-800 rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
      />
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB 1: Overview Tab
   ──────────────────────────────────────────── */
function OverviewTab({ onDataChanged }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/api/admin/stats', { bustCache: true })
      setStats(data)
    } catch (e) {
      console.error('Failed to load admin stats:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon="storefront"
          label="Total Shops"
          value={stats?.totalShops}
          sub={`${stats?.newShopsThisWeek ?? 0} new this week`}
          accent="primary"
        />
        <StatCard
          icon="inventory_2"
          label="Total Products"
          value={stats?.totalProducts}
          sub={`${stats?.newProductsThisWeek ?? 0} added this week`}
          accent="emerald"
        />
        <StatCard
          icon="reviews"
          label="Total Reviews"
          value={stats?.totalReviews}
          sub="Customer feedback"
          accent="amber"
        />
        <StatCard
          icon="block"
          label="Banned Shops"
          value={stats?.bannedShops}
          sub={stats?.bannedShops ? 'Restricted from public' : 'All shops active'}
          accent="red"
        />
      </div>

      {/* Control Summary Box */}
      <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-crisp-xs">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary text-xl">bolt</span>
          <h3 className="font-headline-lg text-base font-bold text-on-surface">Real-Time Control Hub</h3>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
          Actions taken in this admin console immediately update your live database and purge edge caches. Any shop you ban or product you remove will instantly disappear from the public buyer view and shop showcases.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-surface-container-high border border-surface-variant/50 text-xs">
            <div className="font-bold text-on-surface mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">visibility</span>
              Instant Visibility
            </div>
            <div className="text-on-surface-variant text-[11px]">Banned stores are filtered from the map and product feed instantly.</div>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-high border border-surface-variant/50 text-xs">
            <div className="font-bold text-on-surface mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-emerald-600">cleaning_services</span>
              Zero Orphan Cleanup
            </div>
            <div className="text-on-surface-variant text-[11px]">Deleting a shop automatically cleans up its products and reviews.</div>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-high border border-surface-variant/50 text-xs">
            <div className="font-bold text-on-surface mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-purple-600">history_edu</span>
              Audit Trail
            </div>
            <div className="text-on-surface-variant text-[11px]">Every ban, deletion, or login is permanently recorded in the audit log.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB 2: Shops Management
   ──────────────────────────────────────────── */
function ShopsTab({ onDataChanged, showToast }) {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [confirmDeleteShop, setConfirmDeleteShop] = useState(null)
  const [banTargetShop, setBanTargetShop] = useState(null)
  const [banReason, setBanReason] = useState('')
  const [banDays, setBanDays] = useState(7) // 7 | 15 | 30 | null (permanent)

  // Expiry-aware ban check (mirrors worker): expired bans read as unbanned.
  // Fail-closed like the worker: a malformed banned_until counts as banned.
  const isShopBanned = (s) => {
    if (!s?.is_banned) return false
    if (!s?.banned_until) return true
    const ms = Date.parse(s.banned_until)
    return !Number.isFinite(ms) || ms > Date.now()
  }

  const banRemainingText = (s) => {
    if (!s?.banned_until) return 'Permanent'
    const ms = Date.parse(s.banned_until) - Date.now()
    if (!Number.isFinite(ms) || ms <= 0) return 'Expired'
    const days = Math.ceil(ms / 86400000)
    return days <= 1 ? '1 day left' : `${days} days left`
  }

  const loadShops = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch(`/api/admin/shops?filter=${filter}&search=${encodeURIComponent(search)}`, { bustCache: true })
      setShops(data?.shops || [])
    } catch (e) {
      showToast?.(`Failed to load shops: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, search, showToast])

  useEffect(() => {
    const t = setTimeout(loadShops, 250)
    return () => clearTimeout(t)
  }, [loadShops])

  const handleToggleBan = async (shop) => {
    const isCurrentlyBanned = isShopBanned(shop)
    if (!isCurrentlyBanned) {
      setBanTargetShop(shop)
      setBanReason('')
      setBanDays(7)
      return
    }

    try {
      await apiFetch('/api/admin/shops/ban', {
        method: 'POST',
        body: JSON.stringify({ shop_id: shop.id, banned: 0 })
      })
      showToast?.(`Shop "${shop.shop_name}" unbanned and restored!`, 'success', 'Shop Restored')
      triggerHaptic('success')
      clearApiCache()
      onDataChanged?.()
      loadShops()
    } catch (e) {
      showToast?.(`Failed to unban: ${e.message}`, 'error')
    }
  }

  const confirmBanSubmit = async () => {
    if (!banTargetShop) return
    try {
      await apiFetch('/api/admin/shops/ban', {
        method: 'POST',
        body: JSON.stringify({
          shop_id: banTargetShop.id,
          banned: 1,
          reason: banReason.trim() || 'Violating local policies',
          duration_days: banDays
        })
      })
      showToast?.(
        `Shop "${banTargetShop.shop_name}" has been banned${banDays ? ` for ${banDays} days` : ' permanently'}. Items are kept and auto-restore after expiry.`,
        'success',
        'Shop Banned'
      )
      triggerHaptic('warning')
      clearApiCache()
      onDataChanged?.()
      setBanTargetShop(null)
      loadShops()
    } catch (e) {
      showToast?.(`Failed to ban shop: ${e.message}`, 'error')
    }
  }

  const [heroPendingId, setHeroPendingId] = useState(null)

  const handleToggleHero = async (shop) => {
    if (heroPendingId) return // one hero request at a time: no grant+revoke race
    const newHeroState = !Boolean(shop.is_hero_shop)
    setHeroPendingId(shop.id)
    try {
      // Server recomputes the level (hero needs 200 five-stars) and returns it —
      // use that truth instead of hardcoding Level 5, so grant and revoke both
      // land on the correct level even if a refetch interleaves.
      const res = await apiFetch('/api/admin/hero-shop', {
        method: 'POST',
        body: JSON.stringify({ shop_id: shop.id, is_hero: newHeroState })
      })
      const serverBadge = res?.badge
      showToast?.(
        newHeroState
          ? `Shop "${shop.shop_name}" granted verified Hero Shop status! ✅`
          : `Hero Shop status removed from "${shop.shop_name}".`,
        'success',
        newHeroState ? 'Hero Shop Granted' : 'Status Updated'
      )
      triggerHaptic('success')
      clearApiCache()
      onDataChanged?.()
      setShops((prev) =>
        prev.map((item) =>
          item.id === shop.id
            ? {
                ...item,
                is_hero_shop: res?.is_hero_shop ? 1 : 0,
                badge_level: serverBadge?.level ?? item.badge_level ?? 1,
                five_star_reviews_count: serverBadge?.fiveStarCount ?? item.five_star_reviews_count
              }
            : item
        )
      )
    } catch (e) {
      showToast?.(`Failed to update Hero status: ${e.message}`, 'error')
    } finally {
      setHeroPendingId(null)
    }
  }

  const handleDeleteShop = async () => {
    if (!confirmDeleteShop) return
    try {
      await apiFetch(`/api/admin/shops?id=${confirmDeleteShop.id}`, { method: 'DELETE' })
      showToast?.(`Shop "${confirmDeleteShop.shop_name}" and its products were permanently deleted.`, 'success', 'Shop Deleted')
      triggerHaptic('success')
      clearApiCache()
      onDataChanged?.()
      setConfirmDeleteShop(null)
      loadShops()
    } catch (e) {
      showToast?.(`Failed to delete shop: ${e.message}`, 'error')
    }
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by shop name, owner, or address..." />
        <div className="bg-surface-container-high/80 dark:bg-zinc-800/80 p-1 rounded-full border border-surface-variant/50 inline-flex items-center gap-1 self-start sm:self-auto">
          {['all', 'active', 'banned'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all capitalize ${
                filter === f
                  ? 'bg-surface text-primary shadow-crisp-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Shops List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-on-surface-variant font-medium">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
          Loading stores...
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl p-10 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/60">store</span>
          <p className="text-xs font-semibold">No shops found matching your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {shops.map((s) => {
            const isBanned = isShopBanned(s)
            // Hero is a pure admin override: the flag alone earns the tick
            const isHero = Boolean(s.is_hero_shop)

            return (
              <div
                key={s.id}
                className={`bg-surface-container-lowest dark:bg-zinc-900 border rounded-2xl p-4 sm:p-5 shadow-crisp-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  isBanned
                    ? 'border-error/30 bg-error/5'
                    : isHero
                    ? 'border-emerald-500/40 ring-1 ring-emerald-500/20 hover:border-emerald-500/60'
                    : 'border-surface-variant/60 dark:border-zinc-800 hover:border-surface-variant'
                }`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-headline-lg text-base font-bold text-on-surface truncate flex items-center gap-1.5">
                      <span>{s.shop_name}</span>
                      {isHero && <HeroShopBadge size="sm" />}
                    </h4>

                    {/* Milestone Trust Badge Pill */}
                    <ShopBadgePill shop={s} size="xs" />

                    {isBanned ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-error/15 text-error border border-error/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">block</span> Banned · {banRemainingText(s)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">check_circle</span> Active
                      </span>
                    )}
                    {s.product_count > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container-high text-on-surface-variant border border-surface-variant/50">
                        {s.product_count} products
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-on-surface-variant flex items-center gap-1 flex-wrap">
                    <span>Owner: <strong>{s.owner_name || 'Store Owner'}</strong></span>
                    <span>•</span>
                    {s.owner_email ? (
                      <a
                        href={`mailto:${s.owner_email}`}
                        className="text-primary hover:underline font-semibold break-all"
                      >
                        {s.owner_email}
                      </a>
                    ) : (
                      <span className="opacity-60">no email on file</span>
                    )}
                    <span>•</span>
                    <a
                      href={`https://wa.me/91${s.whatsapp_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-semibold"
                    >
                      +91 {s.whatsapp_number}
                    </a>
                  </p>

                  {s.address_text && (
                    <p className="text-[11px] text-on-surface-variant/80 flex items-center gap-1 truncate">
                      <span className="material-symbols-outlined text-xs text-primary shrink-0">location_on</span>
                      <span className="truncate">{s.address_text}</span>
                    </p>
                  )}

                  {isBanned && s.ban_reason && (
                    <p className="text-[11px] text-error font-medium">Reason: {s.ban_reason}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                  {/* Hero Shop Admin Toggle */}
                  <button
                    onClick={() => handleToggleHero(s)}
                    disabled={heroPendingId !== null}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
                      isHero
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-emerald-600 dark:hover:text-emerald-400 border-surface-variant/60 hover:border-emerald-500/40'
                    }`}
                    title={isHero ? 'Click to revoke Hero Shop badge' : 'Click to grant verified Hero Shop badge (Level 5)'}
                  >
                    <span className="material-symbols-outlined text-sm text-emerald-500 fill-1">verified</span>
                    <span>{isHero ? 'Hero Shop ✅' : 'Make Hero'}</span>
                  </button>

                  <button
                    onClick={() => handleToggleBan(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 flex items-center gap-1 cursor-pointer ${
                      isBanned
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{isBanned ? 'check' : 'block'}</span>
                    <span>{isBanned ? 'Unban' : 'Ban'}</span>
                  </button>

                  <button
                    onClick={() => setConfirmDeleteShop(s)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-error/10 hover:bg-error/20 text-error border border-error/20 transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Shop Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteShop)}
        title="Delete Shop & All Products?"
        message={`Are you sure you want to permanently delete "${confirmDeleteShop?.shop_name}"? All of its listed products and reviews will also be removed immediately.`}
        confirmText="Delete Store"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleDeleteShop}
        onCancel={() => setConfirmDeleteShop(null)}
      />

      {/* Ban Reason Prompt Modal */}
      {banTargetShop && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-surface-variant flex flex-col gap-3 text-on-surface">
            <div className="flex items-center gap-2 text-amber-600">
              <span className="material-symbols-outlined text-2xl">block</span>
              <h3 className="font-headline-lg text-base font-bold">Ban "{banTargetShop.shop_name}"</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              This shop will be hidden from the public explore map and product search. Its items are kept and come back automatically when the ban ends. Please enter a brief reason:
            </p>
            <input
              type="text"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="e.g. Misleading pricing / fake items"
              className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div>
              <span className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                Ban Duration
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '7 days', value: 7 },
                  { label: '15 days', value: 15 },
                  { label: '30 days', value: 30 },
                  { label: 'Permanent', value: null }
                ].map((opt) => {
                  const active = banDays === opt.value
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setBanDays(opt.value)}
                      className={`px-2 py-2 rounded-xl text-[11px] font-bold transition-all border active:scale-95 ${
                        active
                          ? 'bg-amber-600 text-white border-amber-700 shadow-crisp-xs'
                          : 'bg-surface-container-high text-on-surface border-surface-variant/60 hover:border-amber-600/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setBanTargetShop(null)}
                className="w-full bg-surface-container-high text-on-surface py-2 rounded-xl text-xs font-semibold border border-surface-variant"
              >
                Cancel
              </button>
              <button
                onClick={confirmBanSubmit}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-xl text-xs font-bold shadow-crisp-xs"
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB 3: Products Management
   ──────────────────────────────────────────── */
function ProductsTab({ onDataChanged, showToast }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null)

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch(`/api/admin/products?category=${category}&search=${encodeURIComponent(search)}`, { bustCache: true })
      setProducts(data?.products || [])
    } catch (e) {
      showToast?.(`Failed to load products: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [category, search, showToast])

  useEffect(() => {
    const t = setTimeout(loadProducts, 250)
    return () => clearTimeout(t)
  }, [loadProducts])

  const handleDelete = async () => {
    if (!confirmDeleteProduct) return
    try {
      await apiFetch(`/api/admin/products?id=${confirmDeleteProduct.id}`, { method: 'DELETE' })
      showToast?.(`Product "${confirmDeleteProduct.name}" deleted.`, 'success', 'Product Removed')
      triggerHaptic('success')
      clearApiCache()
      onDataChanged?.()
      setConfirmDeleteProduct(null)
      loadProducts()
    } catch (e) {
      showToast?.(`Failed to delete product: ${e.message}`, 'error')
    }
  }

  const CATEGORIES = ['All', 'General', 'Grocery', 'Fashion', 'Electronics', 'Home', 'Beauty', 'Food']

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Search and Category Filter */}
      <div className="space-y-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products or shop name..." />
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                category === c
                  ? 'bg-primary text-on-primary shadow-crisp-xs'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-surface-variant/40'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Product List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-on-surface-variant font-medium">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl p-10 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/60">inventory_2</span>
          <p className="text-xs font-semibold">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl p-3.5 shadow-crisp-xs flex flex-col justify-between gap-3 transition-all hover:border-surface-variant"
            >
              <div className="flex items-start gap-3">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-14 h-14 rounded-xl object-cover border border-surface-variant/60 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-surface-container-high border border-surface-variant/60 flex items-center justify-center text-on-surface-variant/50 shrink-0">
                    <span className="material-symbols-outlined text-xl">image</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-headline-lg text-sm font-bold text-on-surface truncate">{p.name}</h4>
                  <div className="text-xs font-extrabold text-primary">₹{p.price}</div>
                  <div className="text-[11px] text-on-surface-variant truncate mt-0.5">
                    Store: <strong>{p.shop_name}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-surface-variant/40">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container-high text-on-surface-variant">
                  {p.category || 'General'}
                </span>

                <button
                  onClick={() => setConfirmDeleteProduct(p)}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-error/10 hover:bg-error/20 text-error border border-error/20 transition-all active:scale-95 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Product Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteProduct)}
        title="Delete Product?"
        message={`Are you sure you want to delete "${confirmDeleteProduct?.name}"? It will be immediately removed from the store catalog.`}
        confirmText="Delete Product"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteProduct(null)}
      />
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB 4: Reviews Management
   ──────────────────────────────────────────── */
function ReviewsTab({ onDataChanged, showToast }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDeleteReview, setConfirmDeleteReview] = useState(null)

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/api/admin/reviews', { bustCache: true })
      setReviews(data?.reviews || [])
    } catch (e) {
      showToast?.(`Failed to load reviews: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  const handleDeleteReview = async () => {
    if (!confirmDeleteReview) return
    try {
      await apiFetch(`/api/admin/reviews?id=${confirmDeleteReview.id}`, { method: 'DELETE' })
      showToast?.('Review removed successfully.', 'success', 'Review Deleted')
      triggerHaptic('success')
      clearApiCache()
      onDataChanged?.()
      setConfirmDeleteReview(null)
      loadReviews()
    } catch (e) {
      showToast?.(`Failed to delete review: ${e.message}`, 'error')
    }
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {loading ? (
        <div className="p-12 text-center text-xs text-on-surface-variant font-medium">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
          Loading reviews...
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl p-10 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/60">rate_review</span>
          <p className="text-xs font-semibold">No reviews published yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl p-4 shadow-crisp-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-headline-lg text-sm font-bold text-on-surface">{r.user_name || 'Customer'}</span>
                  <ReviewStars rating={r.rating} size="sm" />
                  <span className="text-[11px] text-on-surface-variant">on <strong>{r.shop_name}</strong></span>
                </div>
                {r.comment && <p className="text-xs text-on-surface leading-relaxed">"{r.comment}"</p>}
                <p className="text-[10px] text-on-surface-variant">{new Date(r.updated_at || r.created_at).toLocaleDateString()}</p>
              </div>

              <button
                onClick={() => setConfirmDeleteReview(r)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-error/10 hover:bg-error/20 text-error border border-error/20 transition-all active:scale-95 flex items-center gap-1 self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete Review Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteReview)}
        title="Delete Customer Review?"
        message={`Delete review by ${confirmDeleteReview?.user_name} on "${confirmDeleteReview?.shop_name}"?`}
        confirmText="Delete Review"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleDeleteReview}
        onCancel={() => setConfirmDeleteReview(null)}
      />
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB 5: Audit Log Tab
   ──────────────────────────────────────────── */
function AuditTab({ showToast }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/api/admin/audit-log', { bustCache: true })
      setLogs(data?.logs || [])
    } catch (e) {
      showToast?.(`Failed to load audit logs: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  return (
    <div className="space-y-4 animate-fadeIn">
      {loading ? (
        <div className="p-12 text-center text-xs text-on-surface-variant font-medium">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
          Loading audit diary...
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl p-10 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/60">history</span>
          <p className="text-xs font-semibold">No audit records recorded yet</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-crisp-xs divide-y divide-surface-variant/40 dark:divide-zinc-800">
          {logs.map((l) => (
            <div key={l.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                    {l.action}
                  </span>
                  <span className="font-semibold text-on-surface">{l.target_type}: {l.target_id || 'general'}</span>
                </div>
                {l.details && <p className="text-[11px] text-on-surface-variant font-mono">{l.details}</p>}
              </div>
              <span className="text-[10px] text-on-surface-variant shrink-0">
                {new Date(l.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB 6: Security & Password Tab
   ──────────────────────────────────────────── */
function SecurityTab({ onLock, showToast }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      showToast?.('New password must be at least 6 characters long.', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast?.('New passwords do not match.', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      })
      if (res?.success) {
        showToast?.('Admin master password updated successfully!', 'success', 'Password Changed')
        triggerHaptic('success')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (e) {
      showToast?.(e.message || 'Failed to update password', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
      <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-crisp-xs">
        <h3 className="font-headline-lg text-base font-bold text-on-surface mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">key</span>
          <span>Change Master Admin Password</span>
        </h3>
        <p className="text-xs text-on-surface-variant mb-5">
          Update the password required by the gatekeeper modal to access the admin panel.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">Current Password *</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password..."
              required
              className="w-full px-3.5 py-2.5 bg-surface-container-high border border-surface-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">New Password (min 6 chars) *</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new strong password..."
              required
              className="w-full px-3.5 py-2.5 bg-surface-container-high border border-surface-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">Confirm New Password *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password..."
              required
              className="w-full px-3.5 py-2.5 bg-surface-container-high border border-surface-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-xl text-xs shadow-crisp-xs transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save New Password'}
          </button>
        </form>
      </div>

      <div className="bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-2xl p-5 shadow-crisp-xs flex items-center justify-between">
        <div>
          <h4 className="font-headline-lg text-sm font-bold text-on-surface">Lock Admin Session</h4>
          <p className="text-xs text-on-surface-variant">Log out and require password on next open.</p>
        </div>
        <button
          onClick={onLock}
          className="px-4 py-2 bg-error/10 hover:bg-error/20 text-error border border-error/20 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">lock</span>
          <span>Lock Session</span>
        </button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   MAIN: Admin Dashboard Container
   ──────────────────────────────────────────── */
const TABS = [
  { id: 'overview', label: 'Overview', icon: 'analytics' },
  { id: 'shops', label: 'Shops', icon: 'storefront' },
  { id: 'products', label: 'Products', icon: 'inventory_2' },
  { id: 'reviews', label: 'Reviews', icon: 'reviews' },
  { id: 'audit', label: 'Audit Log', icon: 'history' },
  { id: 'security', label: 'Security', icon: 'shield' },
]

export function AdminDashboard({ onClose, onLock, onDataChanged }) {
  const [tab, setTab] = useState('overview')
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'info', title = '') => {
    setToast({ message, type, title })
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleLockAndClose = () => {
    onLock?.()
    onClose?.()
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-body-sm pb-24 animate-fadeIn">
      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* 💻 Apple-Frosted Sticky Header matching LocalFind TopBar */}
      <header className="apple-frosted bg-surface/90 sticky top-0 z-30 border-b border-surface-variant/40 px-4 md:px-8 py-3 flex items-center justify-between">
        {/* Left: Brand Shield & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-crisp-xs">
            <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
          </div>
          <div>
            <h1 className="font-headline-lg text-base md:text-lg font-bold text-on-surface tracking-tight flex items-center gap-2">
              <span>LocalFind Admin</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                Live
              </span>
            </h1>
          </div>
        </div>

        {/* Center / Navigation Segmented Control */}
        <div className="hidden lg:flex items-center bg-surface-container-high/80 dark:bg-zinc-800/80 p-1 rounded-full border border-surface-variant/50">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                triggerHaptic('selection')
                setTab(t.id)
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tab === t.id
                  ? 'bg-surface text-primary font-bold shadow-crisp-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Right: Lock & Close Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLockAndClose}
            title="Lock Admin Session"
            className="px-3 py-1.5 rounded-full bg-error/10 hover:bg-error/20 text-error border border-error/20 flex items-center gap-1.5 text-xs font-semibold transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            <span className="hidden sm:inline">Lock</span>
          </button>
          <button
            onClick={onClose}
            title="Return to Main App"
            className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Mobile Scrollable Segmented Control Tab Bar */}
      <div className="lg:hidden px-4 py-2 border-b border-surface-variant/40 bg-surface/70 apple-frosted overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                triggerHaptic('selection')
                setTab(t.id)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tab === t.id
                  ? 'bg-primary text-on-primary font-bold shadow-crisp-xs'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-surface-variant/40'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="max-w-5xl w-full mx-auto px-4 py-5 md:py-6 flex-1">
        {tab === 'overview' && <OverviewTab onDataChanged={onDataChanged} showToast={showToast} />}
        {tab === 'shops' && <ShopsTab onDataChanged={onDataChanged} showToast={showToast} />}
        {tab === 'products' && <ProductsTab onDataChanged={onDataChanged} showToast={showToast} />}
        {tab === 'reviews' && <ReviewsTab onDataChanged={onDataChanged} showToast={showToast} />}
        {tab === 'audit' && <AuditTab showToast={showToast} />}
        {tab === 'security' && <SecurityTab onLock={handleLockAndClose} showToast={showToast} />}
      </main>
    </div>
  )
}
