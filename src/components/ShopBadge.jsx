import React, { useState } from 'react'
import { SHOP_BADGES, getShopBadge, getNextBadge, getBadgeProgress, MILESTONE_MESSAGES } from '../utils/shopBadges'
import { triggerHaptic } from '../utils/haptics'
import { fireMilestoneConfetti } from '../utils/confetti'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. ShopBadgePill — Compact badge pill for cards, lists, and headers
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ShopBadgePill({
  shop = null,
  fiveStarCount = null,
  isHeroShop = false,
  badgeLevel = null,
  size = 'sm',
  showIcon = true,
  showName = true,
  showGlow = true,
  interactive = false,
  onClick = null,
  className = ''
}) {
  // Resolve badge definition: explicitly-passed fresher props win over a
  // possibly-stale shop object (e.g. live review breakdown vs loaded shop row).
  // fiveStarCount is tri-state: null/undefined = not provided (keep shop value),
  // any number (including 0) = authoritative live count, so the persisted
  // badge_level is dropped and the level is recomputed from live data.
  const mergedShop = shop
    ? {
        ...shop,
        ...(fiveStarCount != null
          ? { five_star_reviews_count: fiveStarCount, badge_level: undefined }
          : {}),
        ...(isHeroShop ? { is_hero_shop: 1 } : {}),
        ...(badgeLevel != null ? { badge_level: badgeLevel } : {})
      }
    : null
  const badge = mergedShop
    ? getShopBadge(mergedShop)
    : badgeLevel
    ? getShopBadge({ badge_level: badgeLevel, is_hero_shop: isHeroShop })
    : getShopBadge(fiveStarCount, isHeroShop)

  const sizeClasses = {
    xs: {
      pill: 'text-[9px] px-1.5 py-0.5 gap-0.5 rounded-md font-semibold',
      icon: 'text-[11px]',
    },
    sm: {
      pill: 'text-[10px] sm:text-[11px] px-2 py-0.5 gap-1 rounded-full font-bold',
      icon: 'text-[13px]',
    },
    md: {
      pill: 'text-xs px-2.5 py-1 gap-1.5 rounded-full font-bold',
      icon: 'text-sm',
    },
    lg: {
      pill: 'text-sm px-3.5 py-1.5 gap-2 rounded-xl font-bold',
      icon: 'text-base',
    }
  }

  const currentSize = sizeClasses[size] || sizeClasses.sm
  const hasGlow = showGlow && badge.glowEffect

  return (
    <span
      onClick={(e) => {
        if (interactive && onClick) {
          e.stopPropagation()
          triggerHaptic('selection')
          onClick(badge)
        }
      }}
      title={`${badge.name} (Level ${badge.level}): ${badge.tagline}`}
      className={`inline-flex items-center border transition-all duration-200 select-none ${badge.bgColor} ${badge.textColor} ${badge.borderColor} ${currentSize.pill} ${
        hasGlow ? 'badge-glow shadow-crisp-xs' : ''
      } ${interactive ? 'cursor-pointer hover:scale-105 active:scale-95' : ''} ${className}`}
    >
      {showIcon && (
        <span
          className={`material-symbols-outlined flex-shrink-0 ${currentSize.icon} ${
            badge.level === 5 ? 'text-emerald-500 fill-1 animate-pulse' : ''
          }`}
        >
          {badge.icon}
        </span>
      )}
      {showName && <span className="truncate">{badge.name}</span>}
    </span>
  )
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. HeroShopBadge — Dedicated Verified Checkmark Badge
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function HeroShopBadge({ size = 'sm', className = '' }) {
  const sizeMap = {
    xs: 'text-xs w-3.5 h-3.5',
    sm: 'text-sm w-4 h-4',
    md: 'text-base w-5 h-5',
    lg: 'text-xl w-6 h-6',
  }

  return (
    <span
      className={`inline-flex items-center justify-center text-emerald-500 dark:text-emerald-400 fill-1 ${sizeMap[size] || sizeMap.sm} ${className}`}
      title="Verified Hero Shop — Admin Approved Excellence"
    >
      <span className="material-symbols-outlined text-[inherit] fill-1">verified</span>
    </span>
  )
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. ShopMilestoneCard — Full milestone progress card for Merchant Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ShopMilestoneCard({
  shop,
  reviewStats = null,
  onOpenAllTiers = null,
  className = ''
}) {
  const [showTiersModal, setShowTiersModal] = useState(false)

  // Use review stats from API if passed, else shop fields
  const fiveStarCount = Number(
    reviewStats?.breakdown?.[5] ??
    reviewStats?.five_star_count ??
    shop?.five_star_count ??
    shop?.five_star_reviews_count ??
    0
  )

  const isHero = Boolean(shop?.is_hero_shop)
  const currentBadge = getShopBadge(fiveStarCount, isHero)
  const nextBadge = getNextBadge(fiveStarCount, isHero)
  const progress = getBadgeProgress(fiveStarCount, isHero)
  // Level 4 shops at 200+ reviews can't earn Hero automatically — it needs an
  // admin grant. Don't render "Need 0 more reviews"; show the admin step instead.
  const awaitingAdminGrant = Boolean(
    nextBadge && nextBadge.level === 5 && fiveStarCount >= (nextBadge.requirements?.fiveStarReviews || 0)
  )

  return (
    <>
      <div className={`bg-surface-container-lowest p-5 sm:p-6 rounded-3xl border border-surface-variant/60 shadow-crisp-xs ${className}`}>
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${currentBadge.bgColor} ${currentBadge.textColor} ${currentBadge.borderColor} ${
              currentBadge.glowEffect ? 'badge-glow' : ''
            }`}>
              <span className="material-symbols-outlined text-2xl fill-1">
                {currentBadge.icon}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-headline-lg text-lg sm:text-xl font-bold text-on-surface tracking-tight">
                  {currentBadge.name}
                </h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant border border-surface-variant/50">
                  Level {currentBadge.level} of 5
                </span>
                {currentBadge.level === 5 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs fill-1">verified</span>
                    <span>Admin Verified</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                {currentBadge.tagline}
              </p>
            </div>
          </div>

          {/* All Tiers Trigger */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection')
              if (onOpenAllTiers) onOpenAllTiers()
              else setShowTiersModal(true)
            }}
            className="self-start sm:self-auto text-xs font-bold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 border border-primary/20 px-3 py-1.5 rounded-xl transition-all active:scale-95 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">military_tech</span>
            <span>View All Perks</span>
          </button>
        </div>

        {/* Progress Bar Row */}
        {nextBadge ? (
          <div className="bg-surface-container-high/60 rounded-2xl p-4 border border-surface-variant/40 mb-4">
            {awaitingAdminGrant ? (
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-base text-emerald-500 fill-1 shrink-0 mt-0.5">verified</span>
                <p className="text-xs text-on-surface font-medium leading-relaxed">
                  Eligible for <strong>Hero Shop</strong>! The green tick needs a one-time
                  verification by the LocalFind admin — contact support to get verified.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs mb-1.5 flex-wrap gap-1">
                  <span className="font-semibold text-on-surface flex items-center gap-1">
                    <span>Next Milestone:</span>
                    <strong className={nextBadge.textColor}>{nextBadge.name}</strong>
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {fiveStarCount} / {nextBadge.requirements.fiveStarReviews} Five-Star Reviews ({progress.percent}%)
                  </span>
                </div>

                {/* Custom Smooth Progress Bar */}
                <div className="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden border border-surface-variant/50 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                      currentBadge.badgeGradient || 'from-primary to-amber-500'
                    }`}
                    style={{ width: `${Math.max(5, progress.percent)}%` }}
                  />
                </div>

                <p className="text-[11px] text-on-surface-variant mt-2 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-amber-500">star</span>
                  <span>
                    Need <strong>{progress.remaining}</strong> more 5-star {progress.remaining === 1 ? 'review' : 'reviews'} to unlock <strong>{nextBadge.name}</strong> perks!
                  </span>
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/30 mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg fill-1">verified</span>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Maximum Trust Level Reached!
              </p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Your shop holds top neighborhood trust. All platform perks and priority placement are unlocked.
              </p>
            </div>
          </div>
        )}

        {/* Perks Grid */}
        <div>
          <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
            Your Active Perks:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {currentBadge.perks.map((perk, i) => (
              <div
                key={i}
                className="flex items-start gap-2 bg-surface-container-high/40 p-2.5 rounded-xl border border-surface-variant/30 text-xs text-on-surface"
              >
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-base shrink-0 mt-0.5">
                  check_circle
                </span>
                <span className="font-medium leading-tight">{perk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Internal Modal for All Tiers if not controlled externally */}
      {showTiersModal && (
        <AllTiersModal
          currentLevel={currentBadge.level}
          onClose={() => setShowTiersModal(false)}
        />
      )}
    </>
  )
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. MilestoneCelebrationModal — Confetti Level-Up Popup
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function MilestoneCelebrationModal({
  badgeId = 'rising_star',
  onClose
}) {
  const badge = SHOP_BADGES.find((b) => b.id === badgeId) || SHOP_BADGES[1]
  const milestone = MILESTONE_MESSAGES[badgeId] || MILESTONE_MESSAGES.rising_star

  React.useEffect(() => {
    fireMilestoneConfetti(3000)
    triggerHaptic('success')
  }, [badgeId])

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="bg-surface-container-lowest max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-surface-variant/80 text-center relative overflow-hidden animate-scaleUp">
        {/* Glow backdrop ring */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        {/* Milestone Icon */}
        <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center border-2 mb-4 ${badge.bgColor} ${badge.textColor} ${badge.borderColor} badge-glow`}>
          <span className="material-symbols-outlined text-4xl fill-1 animate-bounce">
            {badge.icon}
          </span>
        </div>

        {/* Milestone Title */}
        <div className="text-xl sm:text-2xl font-black text-on-surface tracking-tight mb-1">
          {milestone.title}
        </div>
        <div className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
          Level {badge.level} Unlocked · {badge.name}
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed mb-6 font-medium">
          {milestone.message}
        </p>

        {/* Unlocked Perks List */}
        <div className="bg-surface-container-high/60 rounded-2xl p-4 text-left border border-surface-variant/40 mb-6">
          <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
            New Perks Unlocked:
          </div>
          <ul className="space-y-1.5 text-xs text-on-surface">
            {badge.perks.map((p, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500 text-sm">
                  verified
                </span>
                <span className="font-semibold">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection')
            onClose?.()
          }}
          className="w-full py-3 rounded-2xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm transition-all shadow-crisp-xs active:scale-95"
        >
          Awesome! Keep Growing 🚀
        </button>
      </div>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 5. AllTiersModal — Visual Guide to All 5 Trust Levels & Milestones
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function AllTiersModal({ currentLevel = 1, onClose }) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest max-w-2xl w-full max-h-[85vh] rounded-3xl p-5 sm:p-7 shadow-2xl border border-surface-variant flex flex-col overscroll-contain">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-variant/40">
          <div>
            <h3 className="font-headline-lg text-lg sm:text-xl font-bold text-on-surface tracking-tight">
              Shop Trust Levels & Badges
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Earn 5-star reviews from happy neighborhood buyers to level up your store.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-variant flex items-center justify-center text-on-surface transition-all active:scale-90"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Tier Cards List */}
        <div className="overflow-y-auto py-4 space-y-3.5 pr-1">
          {SHOP_BADGES.map((tier) => {
            const isCurrent = tier.level === currentLevel
            const isUnlocked = tier.level <= currentLevel

            return (
              <div
                key={tier.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isCurrent
                    ? `${tier.bgColor} ${tier.borderColor} ring-2 ring-primary/40 shadow-crisp-xs`
                    : isUnlocked
                    ? 'bg-surface-container-low border-surface-variant/60'
                    : 'bg-surface-container-lowest/50 border-surface-variant/30 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${tier.bgColor} ${tier.textColor} ${tier.borderColor}`}>
                      <span className="material-symbols-outlined text-lg fill-1">
                        {tier.icon}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-on-surface">
                          Level {tier.level}: {tier.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary text-on-primary">
                            Current Tier
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        {tier.tagline}
                      </span>
                    </div>
                  </div>

                  {/* Requirements Pill */}
                  <div className="text-right">
                    {tier.level === 5 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                        Admin Verified
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant border border-surface-variant/50">
                        {tier.requirements.fiveStarReviews} ⭐ Reviews
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-on-surface-variant mb-2.5">
                  {tier.description}
                </p>

                {/* Perks Checklist */}
                <div className="space-y-1 pt-2 border-t border-surface-variant/25">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Perks:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                    {tier.perks.map((perk, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-on-surface">
                        <span className={`material-symbols-outlined text-xs ${isUnlocked ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {isUnlocked ? 'check_circle' : 'lock'}
                        </span>
                        <span>{perk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-surface-variant/40 text-center">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface font-bold text-xs transition-all active:scale-95"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  )
}
