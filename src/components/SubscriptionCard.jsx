import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { TIERS, TIER_ORDER, getNextTier } from '../utils/subscriptionTiers'

const TIER_STYLES = {
  free:    { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', text: 'text-zinc-600 dark:text-zinc-400', badge: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30', glow: '' },
  starter: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30', glow: '' },
  pro:     { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30', glow: 'ring-1 ring-purple-500/20' },
  hero:    { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40', glow: 'ring-2 ring-amber-500/20 shadow-amber-500/10 shadow-lg' }
}

function UsageBar({ label, used, max, icon }) {
  const isUnlimited = max === null || max === undefined
  const pct = isUnlimited ? 15 : Math.min(100, Math.round((used / max) * 100))
  const isNearLimit = !isUnlimited && pct >= 80
  const isAtLimit = !isUnlimited && used >= max

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">{icon}</span>
          {label}
        </span>
        <span className={`text-[11px] font-bold ${isAtLimit ? 'text-error' : isNearLimit ? 'text-amber-600 dark:text-amber-400' : 'text-on-surface'}`}>
          {used}{isUnlimited ? '' : ` / ${max}`}
          {isUnlimited && <span className="text-[9px] text-on-surface-variant ml-1">Unlimited</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-variant/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isAtLimit ? 'bg-error' : isNearLimit ? 'bg-amber-500' : 'bg-primary'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function TierComparisonCard({ tier, isCurrent, isUpgrade, onUpgrade }) {
  const config = TIERS[tier]
  const styles = TIER_STYLES[tier]
  if (!config) return null

  return (
    <div className={`relative rounded-2xl border p-4 sm:p-5 transition-all ${
      isCurrent ? `${styles.border} ${styles.bg} ${styles.glow}` : 'border-surface-variant/40 bg-surface-container-lowest hover:border-surface-variant'
    }`}>
      {isCurrent && (
        <span className={`absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${styles.badge}`}>
          Current Plan
        </span>
      )}

      <div className="flex items-start justify-between mb-3 mt-1">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${styles.bg} border ${styles.border}`}>
            <span className={`material-symbols-outlined text-base ${styles.text}`}>{config.icon}</span>
          </div>
          <div>
            <h4 className="font-bold text-sm text-on-surface">{config.label}</h4>
            <span className={`text-xs font-black ${styles.text}`}>{config.priceLabel}</span>
          </div>
        </div>
      </div>

      <ul className="space-y-1.5 mb-4">
        {config.features.map((f, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] text-on-surface">
            <span className="material-symbols-outlined text-xs text-emerald-500 flex-shrink-0 mt-0.5">check_circle</span>
            <span>{f}</span>
          </li>
        ))}
        {config.lockedFeatures.map((f, i) => (
          <li key={`locked-${i}`} className="flex items-start gap-1.5 text-[11px] text-on-surface-variant/60">
            <span className="material-symbols-outlined text-xs text-on-surface-variant/40 flex-shrink-0 mt-0.5">lock</span>
            <span className="line-through">{f}</span>
          </li>
        ))}
      </ul>

      {isUpgrade && (
        <button
          onClick={() => onUpgrade?.(tier)}
          className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
            tier === 'hero'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400/40 shadow-crisp-xs'
              : tier === 'pro'
                ? 'bg-purple-600 text-white border-purple-500/40 shadow-crisp-xs'
                : 'bg-primary text-on-primary border-primary/40 shadow-crisp-xs'
          }`}
        >
          Upgrade to {config.label} — {config.priceLabel}
        </button>
      )}
    </div>
  )
}

export function SubscriptionCard({ shop, products, onShowToast }) {
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPlans, setShowPlans] = useState(false)

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/api/subscription')
      setSubscription(data?.subscription || null)
    } catch (err) {
      console.warn('Could not fetch subscription info:', err)
      // Fallback: construct from local shop data
      setSubscription({
        current_tier: 'free',
        tier_label: 'Free',
        limits: { max_products: 10, max_flash_deals_per_month: 0 },
        usage: { product_count: products?.length || 0, flash_deals_used_this_month: 0 }
      })
    } finally {
      setLoading(false)
    }
  }, [products])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  if (loading || !subscription) {
    return (
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-variant/50 shadow-crisp-xs animate-pulse">
        <div className="h-4 w-32 bg-surface-variant/40 rounded-full mb-3" />
        <div className="h-3 w-48 bg-surface-variant/30 rounded-full" />
      </div>
    )
  }

  const tier = subscription.current_tier || 'free'
  const config = TIERS[tier] || TIERS.free
  const styles = TIER_STYLES[tier]
  const nextTier = getNextTier(tier)
  const productCount = subscription.usage?.product_count || products?.length || 0
  const flashUsed = subscription.usage?.flash_deals_used_this_month || 0

  const handleUpgrade = (targetTier) => {
    if (onShowToast) {
      onShowToast(
        `To upgrade to ${TIERS[targetTier].label}, contact admin@localfind.app or call us. Payment integration coming soon!`,
        'info',
        `Upgrade to ${TIERS[targetTier].label}`
      )
    }
  }

  return (
    <div className={`bg-surface-container-lowest rounded-3xl border ${styles.border} shadow-crisp-xs overflow-hidden ${styles.glow}`}>
      {/* Plan Header */}
      <div className={`px-5 sm:px-6 pt-5 sm:pt-6 pb-4 ${styles.bg}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${styles.border} bg-surface-container-lowest/80`}>
              <span className={`material-symbols-outlined text-xl ${styles.text}`}>{config.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-on-surface">{config.label} Plan</h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${styles.badge}`}>
                  Active
                </span>
              </div>
              <span className={`text-xs font-black ${styles.text}`}>{config.priceLabel}</span>
            </div>
          </div>
          <button
            onClick={() => setShowPlans(!showPlans)}
            className="bg-surface-container-high hover:bg-surface-variant px-3.5 py-2 rounded-full text-[11px] font-bold text-on-surface border border-surface-variant/60 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm text-primary">upgrade</span>
            <span>{showPlans ? 'Hide Plans' : 'View Plans'}</span>
          </button>
        </div>

        {/* Subscription expiry notice */}
        {subscription.expires_at && (
          <div className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-xs">schedule</span>
            <span>Renews: {new Date(subscription.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        )}

        {/* Expired plan warning */}
        {subscription.is_expired && (
          <div className="mt-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>Your {subscription.stored_tier} plan has expired. You're on the Free plan now. Renew to restore features.</span>
          </div>
        )}
      </div>

      {/* Usage Stats */}
      <div className="px-5 sm:px-6 py-4 space-y-3">
        <UsageBar
          label="Products Listed"
          used={productCount}
          max={subscription.limits?.max_products}
          icon="inventory_2"
        />
        <UsageBar
          label="Flash Deals This Month"
          used={flashUsed}
          max={subscription.limits?.max_flash_deals_per_month}
          icon="bolt"
        />

        {/* Quick Feature Tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
            config.allowImageUpload
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-surface-variant/30 text-on-surface-variant/50 border-surface-variant/40'
          }`}>
            <span className="material-symbols-outlined text-[10px]">{config.allowImageUpload ? 'check' : 'lock'}</span>
            Photo Upload
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
            config.maxFlashDealsPerMonth > 0
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
              : 'bg-surface-variant/30 text-on-surface-variant/50 border-surface-variant/40'
          }`}>
            <span className="material-symbols-outlined text-[10px]">{config.maxFlashDealsPerMonth > 0 ? 'check' : 'lock'}</span>
            Flash Deals
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
            config.allowR2Upload
              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
              : 'bg-surface-variant/30 text-on-surface-variant/50 border-surface-variant/40'
          }`}>
            <span className="material-symbols-outlined text-[10px]">{config.allowR2Upload ? 'check' : 'lock'}</span>
            HD Images
          </span>
        </div>

        {/* Upgrade CTA for non-max tiers */}
        {nextTier && !showPlans && (
          <button
            onClick={() => handleUpgrade(nextTier.id)}
            className={`w-full mt-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 border ${
              nextTier.id === 'hero'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400/40 shadow-crisp-xs'
                : nextTier.id === 'pro'
                  ? 'bg-purple-600 text-white border-purple-500/40 shadow-crisp-xs'
                  : 'bg-primary text-on-primary border-primary/40 shadow-crisp-xs'
            }`}
          >
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            <span>Upgrade to {nextTier.label} — {nextTier.priceLabel}</span>
          </button>
        )}
      </div>

      {/* Expandable Plans Comparison */}
      {showPlans && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-2 border-t border-surface-variant/30 animate-fadeIn">
          <h4 className="font-bold text-xs text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-primary">compare</span>
            Compare All Plans
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TIER_ORDER.map((t) => (
              <TierComparisonCard
                key={t}
                tier={t}
                isCurrent={t === tier}
                isUpgrade={TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(tier)}
                onUpgrade={handleUpgrade}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
