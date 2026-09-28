// Subscription tier definitions — mirrors server-side TIER_LIMITS.
// Frontend uses these for instant UX feedback; server remains the source of truth.

export const TIERS = {
  free: {
    id: 'free',
    label: 'Free',
    price: 0,
    priceLabel: '₹0',
    color: 'zinc',
    icon: 'storefront',
    maxProducts: 10,
    maxFlashDealsPerMonth: 0,
    allowImageUpload: false,
    allowR2Upload: false,
    maxBadgeLevel: 2,
    features: [
      'Up to 10 product listings',
      'Appear on buyer map & feed',
      'WhatsApp order link',
      'Receive & display reviews',
      'Badge Level 1–2'
    ],
    lockedFeatures: [
      'Flash Deals',
      'Photo upload from phone',
      'QR Standee generation',
      'Badge Level 3+'
    ]
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    price: 149,
    priceLabel: '₹149/mo',
    color: 'blue',
    icon: 'bolt',
    maxProducts: 50,
    maxFlashDealsPerMonth: 5,
    allowImageUpload: true,
    allowR2Upload: false,
    maxBadgeLevel: 3,
    features: [
      'Up to 50 product listings',
      '5 Flash Deals per month',
      'Photo upload from phone',
      'QR Standee generation',
      'Badge Level 1–3',
      'Store hours display',
      'Priority in "New" feed'
    ],
    lockedFeatures: [
      'Unlimited products',
      'Unlimited Flash Deals',
      'High-quality R2 images',
      'Hero Shop eligibility'
    ]
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    price: 299,
    priceLabel: '₹299/mo',
    color: 'purple',
    icon: 'workspace_premium',
    maxProducts: Infinity,
    maxFlashDealsPerMonth: Infinity,
    allowImageUpload: true,
    allowR2Upload: true,
    maxBadgeLevel: 4,
    features: [
      'Unlimited product listings',
      'Unlimited Flash Deals',
      'High-quality R2 image hosting',
      'Badge Level 1–4 + Hero eligible',
      'Featured shop placement',
      'Affiliate fallback links',
      'Store analytics (coming soon)'
    ],
    lockedFeatures: [
      'Verified Hero badge',
      'Top search placement'
    ]
  },
  hero: {
    id: 'hero',
    label: 'Hero',
    price: 499,
    priceLabel: '₹499/mo',
    color: 'amber',
    icon: 'diamond',
    maxProducts: Infinity,
    maxFlashDealsPerMonth: Infinity,
    allowImageUpload: true,
    allowR2Upload: true,
    maxBadgeLevel: 5,
    features: [
      'Everything in Pro',
      'Verified Hero Shop badge (Level 5)',
      'Top placement in search',
      'Premium hero glow effect',
      'Dedicated support',
      'Early access to new features',
      'Custom 500-char description'
    ],
    lockedFeatures: []
  }
}

export const TIER_ORDER = ['free', 'starter', 'pro', 'hero']

// Check if current tier has access to a feature
export function canUseTier(currentTier, requiredTier) {
  const currentIdx = TIER_ORDER.indexOf(currentTier || 'free')
  const requiredIdx = TIER_ORDER.indexOf(requiredTier || 'free')
  return currentIdx >= requiredIdx
}

// Get the next upgrade tier from the current one
export function getNextTier(currentTier) {
  const idx = TIER_ORDER.indexOf(currentTier || 'free')
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null
  return TIERS[TIER_ORDER[idx + 1]]
}

// Check if product limit is reached
export function isProductLimitReached(currentTier, productCount) {
  const tier = TIERS[currentTier || 'free']
  if (!tier) return false
  return productCount >= tier.maxProducts
}

// Check if flash deal limit is reached
export function isFlashDealLimitReached(currentTier, flashDealsUsed) {
  const tier = TIERS[currentTier || 'free']
  if (!tier) return false
  if (tier.maxFlashDealsPerMonth === 0) return true
  if (tier.maxFlashDealsPerMonth === Infinity) return false
  return flashDealsUsed >= tier.maxFlashDealsPerMonth
}
