import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'

/* ────────────────────────────────────────────
   Reusable tiny components used inside tabs
   ──────────────────────────────────────────── */

function StatCard({ icon, label, value, accent = 'blue', sub }) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/20',
    green: 'from-emerald-500/20 to-emerald-600/10 text-emerald-400 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/20',
    red: 'from-red-500/20 to-red-600/10 text-red-400 border-red-500/20',
    purple: 'from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/20',
    cyan: 'from-cyan-500/20 to-cyan-600/10 text-cyan-400 border-cyan-500/20',
  }
  return (
    <div className={`bg-gradient-to-br ${colors[accent]} border rounded-2xl p-4 sm:p-5 flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-xs opacity-70 uppercase tracking-wider font-medium">{icon} {label}</div>
      <div className="text-3xl sm:text-4xl font-bold tracking-tight">{value ?? '—'}</div>
      {sub && <div className="text-[11px] opacity-60 mt-0.5">{sub}</div>}
    </div>
  )
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
      />
    </div>
  )
}

function ActionBtn({ onClick, color = 'red', children, disabled, small }) {
  const styles = {
    red: 'bg-red-500/15 text-red-400 hover:bg-red-500/30 border-red-500/20',
    amber: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/30 border-amber-500/20',
    green: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/20',
    blue: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/30 border-blue-500/20',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${styles[color]} border rounded-lg font-medium transition-all active:scale-95 disabled:opacity-40 ${small ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}
    >
      {children}
    </button>
  )
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="bg-[#1c1c1e] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/60 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-xl bg-white/10 text-white/70 hover:bg-white/15 transition">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition active:scale-95">Confirm</button>
        </div>
      </div>
    </div>
  )
}

function Badge({ text, color = 'green' }) {
  const styles = {
    green: 'bg-emerald-500/20 text-emerald-400',
    red: 'bg-red-500/20 text-red-400',
    amber: 'bg-amber-500/20 text-amber-400',
    blue: 'bg-blue-500/20 text-blue-400',
    gray: 'bg-white/10 text-white/50',
  }
  return <span className={`${styles[color]} text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full`}>{text}</span>
}

function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-white/30">
      <span className="text-4xl mb-3">{icon}</span>
      <span className="text-sm">{text}</span>
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB: Overview
   ──────────────────────────────────────────── */
function OverviewTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/admin/stats')
      .then(setStats)
      .catch(err => console.error('Stats error:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20 text-white/40"><div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon="🏪" label="Total Shops" value={stats?.totalShops} accent="blue" sub={stats?.newShopsThisWeek ? `+${stats.newShopsThisWeek} this week` : null} />
        <StatCard icon="📦" label="Products" value={stats?.totalProducts} accent="green" sub={stats?.newProductsThisWeek ? `+${stats.newProductsThisWeek} this week` : null} />
        <StatCard icon="⭐" label="Reviews" value={stats?.totalReviews} accent="amber" />
        <StatCard icon="🚫" label="Banned" value={stats?.bannedShops} accent="red" />
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB: Shops Management
   ──────────────────────────────────────────── */
function ShopsTab() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [confirm, setConfirm] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const fetchShops = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ filter })
    if (search) params.set('search', search)
    apiFetch(`/api/admin/shops?${params}`)
      .then(d => setShops(d.shops || []))
      .catch(err => console.error('Shops error:', err))
      .finally(() => setLoading(false))
  }, [search, filter])

  useEffect(() => { fetchShops() }, [fetchShops])

  const banShop = async (shopId, banned, reason) => {
    setActionLoading(shopId)
    try {
      await apiFetch('/api/admin/shops/ban', {
        method: 'POST',
        body: JSON.stringify({ shop_id: shopId, banned, reason })
      })
      fetchShops()
    } catch (err) { console.error(err) }
    finally { setActionLoading(null); setConfirm(null) }
  }

  const deleteShop = async (shopId) => {
    setActionLoading(shopId)
    try {
      await apiFetch(`/api/admin/shops?id=${shopId}`, { method: 'DELETE' })
      fetchShops()
    } catch (err) { console.error(err) }
    finally { setActionLoading(null); setConfirm(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search shops..." /></div>
        <div className="flex gap-2">
          {['all', 'active', 'banned'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs rounded-xl border font-medium capitalize transition-all ${filter === f ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : shops.length === 0 ? (
        <EmptyState icon="🏪" text="No shops found" />
      ) : (
        <div className="space-y-2">
          {shops.map(shop => (
            <div key={shop.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.06] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-white text-sm truncate">{shop.shop_name}</h4>
                    {shop.is_banned ? <Badge text="Banned" color="red" /> : <Badge text="Active" color="green" />}
                  </div>
                  <p className="text-xs text-white/40 mt-1 truncate">
                    👤 {shop.owner_name || 'Unknown'} • 📦 {shop.product_count || 0} products • ⭐ {shop.avg_rating || '—'} ({shop.review_count || 0})
                  </p>
                  <p className="text-[11px] text-white/25 mt-0.5 truncate">📍 {shop.address_text || 'No address'} • 📞 {shop.whatsapp_number}</p>
                  {shop.ban_reason && <p className="text-[11px] text-red-400/70 mt-1">Ban reason: {shop.ban_reason}</p>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {shop.is_banned ? (
                    <ActionBtn color="green" small onClick={() => banShop(shop.id, false)} disabled={actionLoading === shop.id}>Unban</ActionBtn>
                  ) : (
                    <ActionBtn color="amber" small onClick={() => {
                      const reason = prompt('Ban reason (optional):')
                      banShop(shop.id, true, reason)
                    }} disabled={actionLoading === shop.id}>Ban</ActionBtn>
                  )}
                  <ActionBtn color="red" small onClick={() => setConfirm({ type: 'delete_shop', id: shop.id, name: shop.shop_name })} disabled={actionLoading === shop.id}>Delete</ActionBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm?.type === 'delete_shop'}
        title="Delete Shop?"
        message={`This will permanently delete "${confirm?.name}" and ALL its products and reviews. This cannot be undone.`}
        onConfirm={() => deleteShop(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB: Products Management
   ──────────────────────────────────────────── */
function ProductsTab() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const fetchProducts = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    apiFetch(`/api/admin/products?${params}`)
      .then(d => setProducts(d.products || []))
      .catch(err => console.error('Products error:', err))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const deleteProduct = async (id) => {
    setActionLoading(id)
    try {
      await apiFetch(`/api/admin/products?id=${id}`, { method: 'DELETE' })
      fetchProducts()
    } catch (err) { console.error(err) }
    finally { setActionLoading(null); setConfirm(null) }
  }

  return (
    <div className="space-y-4">
      <SearchBar value={search} onChange={setSearch} placeholder="Search products or shop names..." />

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : products.length === 0 ? (
        <EmptyState icon="📦" text="No products found" />
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <div key={p.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.06] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {p.image_url && !p.image_url.startsWith('data:') ? (
                    <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-white/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-lg flex-shrink-0">📦</div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-white text-sm truncate">{p.name}</h4>
                      <Badge text={p.category} color="blue" />
                      {p.is_flash_deal ? <Badge text={`${p.flash_deal_discount}% OFF`} color="amber" /> : null}
                      {p.shop_banned ? <Badge text="Shop Banned" color="red" /> : null}
                    </div>
                    <p className="text-xs text-white/40 mt-1 truncate">₹{p.price} • 🏪 {p.shop_name || 'Unknown Shop'}</p>
                  </div>
                </div>
                <ActionBtn color="red" small onClick={() => setConfirm({ type: 'delete_product', id: p.id, name: p.name })} disabled={actionLoading === p.id}>Delete</ActionBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm?.type === 'delete_product'}
        title="Delete Product?"
        message={`Permanently delete "${confirm?.name}"? This cannot be undone.`}
        onConfirm={() => deleteProduct(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB: Reviews Management
   ──────────────────────────────────────────── */
function ReviewsTab() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const fetchReviews = useCallback(() => {
    setLoading(true)
    apiFetch('/api/admin/reviews')
      .then(d => setReviews(d.reviews || []))
      .catch(err => console.error('Reviews error:', err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const deleteReview = async (id) => {
    setActionLoading(id)
    try {
      await apiFetch(`/api/admin/reviews?id=${id}`, { method: 'DELETE' })
      fetchReviews()
    } catch (err) { console.error(err) }
    finally { setActionLoading(null); setConfirm(null) }
  }

  const starDisplay = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating)

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : reviews.length === 0 ? (
        <EmptyState icon="⭐" text="No reviews yet" />
      ) : (
        <div className="space-y-2">
          {reviews.map(r => (
            <div key={r.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.06] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-amber-400 text-xs tracking-wider">{starDisplay(r.rating)}</span>
                    <span className="text-white text-sm font-medium">{r.user_name}</span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">{r.comment || '(no comment)'}</p>
                  <p className="text-[11px] text-white/25 mt-1">🏪 {r.shop_name} • {new Date(r.updated_at).toLocaleDateString()}</p>
                </div>
                <ActionBtn color="red" small onClick={() => setConfirm({ type: 'delete_review', id: r.id, name: `${r.user_name}'s ${r.rating}★ review` })} disabled={actionLoading === r.id}>Delete</ActionBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm?.type === 'delete_review'}
        title="Delete Review?"
        message={`Remove ${confirm?.name}? This cannot be undone.`}
        onConfirm={() => deleteReview(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB: Audit Log
   ──────────────────────────────────────────── */
function AuditTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/admin/audit-log')
      .then(d => setLogs(d.logs || []))
      .catch(err => console.error('Audit error:', err))
      .finally(() => setLoading(false))
  }, [])

  const actionIcons = {
    ban_shop: '🚫', unban_shop: '✅', delete_shop: '🗑️',
    delete_product: '📦', delete_review: '⭐'
  }

  const actionColors = {
    ban_shop: 'text-red-400', unban_shop: 'text-emerald-400', delete_shop: 'text-red-400',
    delete_product: 'text-amber-400', delete_review: 'text-amber-400'
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : logs.length === 0 ? (
        <EmptyState icon="📋" text="No admin actions yet" />
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            let details = null
            try { details = JSON.parse(log.details) } catch {}
            return (
              <div key={log.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{actionIcons[log.action] || '⚡'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${actionColors[log.action] || 'text-white'}`}>
                      {log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                    <p className="text-[11px] text-white/40 truncate">
                      {log.target_type}: {details?.shop_name || details?.name || log.target_id}
                      {details?.reason ? ` — "${details.reason}"` : ''}
                    </p>
                    <p className="text-[10px] text-white/20 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
   TAB: Settings / Security
   ──────────────────────────────────────────── */
function SettingsTab({ onLock }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setMsg(null)
    setErr(null)

    if (newPassword.length < 6) {
      setErr('New password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErr('New passwords do not match.')
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
        setMsg('Password updated successfully! Next time you log in, use your new password.')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (e) {
      setErr(e.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">
        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
          <span>🔒</span> Change Admin Password
        </h3>
        <p className="text-xs text-white/50 mb-5">
          Update the master password required to access this admin panel.
        </p>

        {msg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <span>✅</span> <span>{msg}</span>
          </div>
        )}

        {err && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <span>⚠️</span> <span>{err}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Enter current password..."
              required
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 6 characters..."
              required
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password..."
              required
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Lock Admin Session</h4>
          <p className="text-xs text-white/50">Log out of the admin panel and require password to re-enter.</p>
        </div>
        <button
          onClick={onLock}
          className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95"
        >
          🔒 Lock Now
        </button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   MAIN: Admin Dashboard
   ──────────────────────────────────────────── */
const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'shops', label: 'Shops', icon: '🏪' },
  { id: 'products', label: 'Products', icon: '📦' },
  { id: 'reviews', label: 'Reviews', icon: '⭐' },
  { id: 'audit', label: 'Audit Log', icon: '📋' },
  { id: 'settings', label: 'Security', icon: '🔐' },
]

export function AdminDashboard({ onClose, onLock }) {
  const [tab, setTab] = useState('overview')

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleLockAndClose = () => {
    onLock?.()
    onClose?.()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pb-safe">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🛡️</span>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Admin Panel
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLockAndClose}
              title="Lock Admin Session"
              className="px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center gap-1.5 text-xs font-semibold transition-all active:scale-95"
            >
              <span>🔒</span>
              <span className="hidden sm:inline">Lock</span>
            </button>
            <button
              onClick={onClose}
              title="Close Dashboard"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  tab === t.id
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-sm">{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-4 py-5">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'shops' && <ShopsTab />}
        {tab === 'products' && <ProductsTab />}
        {tab === 'reviews' && <ReviewsTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'settings' && <SettingsTab onLock={handleLockAndClose} />}
      </div>
    </div>
  )
}
