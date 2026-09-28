/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  LOCALFIND — SHOP BADGE & MILESTONE SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  PURPOSE:
 *  This file defines the entire shop trust & progression system for LocalFind.
 *  Shops earn badges automatically based on the number of 5-star reviews they
 *  receive. The system works like a video game level-up — shops progress from
 *  "Unverified" all the way to "Hero Shop" (admin-granted).
 *
 *  HOW IT WORKS:
 *  - Each shop starts at Level 1 (Unverified) with no requirements.
 *  - As buyers leave 5-star reviews, the shop moves up levels.
 *  - Levels 1–4 are AUTOMATIC — the backend counts 5-star reviews and
 *    compares against the thresholds below.
 *  - Level 5 ("Hero Shop") is MANUAL — only an Admin can grant it.
 *
 *  DATA SOURCE:
 *  The `reviews` table in D1 has: rating INTEGER (1–5).
 *  The query to count 5-star reviews:
 *    SELECT COUNT(*) AS five_star_count FROM reviews WHERE shop_id = ? AND rating = 5
 *
 *  This file exists so any AI agent can read it and implement the badge UI,
 *  backend logic, or admin panel updates without guessing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  AI AGENT INSTRUCTIONS:
 *  - To get a shop's badge, call `getShopBadge(fiveStarCount, isHeroShop)`.
 *  - To get all badges for display, use `SHOP_BADGES` array.
 *  - Each badge has: id, level, name, tagline, icon (Material Symbols name),
 *    bgColor (Tailwind classes), textColor, borderColor, requirements, perks.
 *  - The `isHeroShop` field on the `shops` table (to be added) is a boolean
 *    that only admins can toggle.
 * ═══════════════════════════════════════════════════════════════════════════
 */


// ─── BADGE DEFINITIONS ──────────────────────────────────────────────────────

export const SHOP_BADGES = [

  // ──────────────── LEVEL 1: UNVERIFIED ────────────────
  {
    id: 'unverified',
    level: 1,
    name: 'Unverified',
    tagline: 'Just getting started',
    description: 'This shop just joined LocalFind and hasn\'t earned any reputation yet.',

    // Visual Design
    icon: 'storefront',           // Material Symbols icon name
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    textColor: 'text-slate-500 dark:text-slate-400',
    borderColor: 'border-slate-300 dark:border-slate-600',
    badgeGradient: null,          // No gradient for unverified
    glowEffect: false,

    // Requirements
    requirements: {
      fiveStarReviews: 0,         // No reviews needed — this is the default
      adminApproval: false,
    },

    // Perks — what this shop gets at this level
    perks: [
      'Basic shop listing on LocalFind',
      'Can list up to 10 products',
      'Standard search visibility',
    ],

    // Restrictions — what this shop CANNOT do
    restrictions: [
      'No trust badge shown to buyers',
      'Lower priority in search results',
      'No access to Flash Deals feature',
    ],
  },

  // ──────────────── LEVEL 2: RISING STAR ⭐ ────────────────
  {
    id: 'rising_star',
    level: 2,
    name: 'Rising Star',
    tagline: 'CAT SPOTTED! 🐱 — First paws of trust',
    description: 'This shop has its first happy customers! Buyers are starting to notice.',

    // Visual Design
    icon: 'kid_star',             // A playful star icon
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    textColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-300 dark:border-amber-700',
    badgeGradient: 'from-amber-400 to-orange-400',
    glowEffect: false,

    // Requirements
    requirements: {
      fiveStarReviews: 5,         // 5 five-star reviews to unlock
      adminApproval: false,       // Automatic — no admin action needed
    },

    // Perks
    perks: [
      '⭐ "Rising Star" badge shown on shop profile',
      'Can list up to 20 products',
      'Slightly higher priority in search results',
      'Unlock: Flash Deals feature (can create 1 active deal at a time)',
    ],

    restrictions: [
      'Still not "verified" — no green tick',
      'Limited flash deal slots',
    ],
  },

  // ──────────────── LEVEL 3: COMMUNITY FAVORITE 🏆 ────────────────
  {
    id: 'community_favorite',
    level: 3,
    name: 'Community Favorite',
    tagline: 'NEIGHBORHOOD HERO! 🏘️ — The locals love you',
    description: 'This shop has built serious trust in the community. 50 five-star reviews is no joke!',

    // Visual Design
    icon: 'workspace_premium',    // A trophy/medal icon
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-300 dark:border-blue-700',
    badgeGradient: 'from-blue-400 to-indigo-500',
    glowEffect: true,             // Subtle glow on the badge

    // Requirements
    requirements: {
      fiveStarReviews: 50,        // 50 five-star reviews to unlock
      adminApproval: false,       // Still automatic
    },

    // Perks
    perks: [
      '🏆 "Community Favorite" badge with glow effect',
      'Can list up to 50 products',
      'Higher search ranking boost',
      'Unlock: Up to 3 simultaneous Flash Deals',
      'Shop appears in "Top Rated" section on Discover page',
    ],

    restrictions: [
      'Still not officially "verified" — no green tick',
    ],
  },

  // ──────────────── LEVEL 4: TRUSTED MERCHANT 💎 ────────────────
  {
    id: 'trusted_merchant',
    level: 4,
    name: 'Trusted Merchant',
    tagline: 'DIAMOND STATUS! 💎 — Proven & beloved',
    description: 'This shop has earned 200 five-star reviews. It\'s a certified local legend.',

    // Visual Design
    icon: 'diamond',              // Diamond icon
    bgColor: 'bg-purple-50 dark:bg-purple-950/40',
    textColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-300 dark:border-purple-700',
    badgeGradient: 'from-purple-500 to-pink-500',
    glowEffect: true,

    // Requirements
    requirements: {
      fiveStarReviews: 200,       // 200 five-star reviews to unlock
      adminApproval: false,       // Still automatic
    },

    // Perks
    perks: [
      '💎 "Trusted Merchant" diamond badge with glow',
      'Unlimited products listing',
      'Top-tier search ranking',
      'Unlock: Unlimited Flash Deals',
      'Featured spot in "Trusted Shops" carousel on home page',
      'Special "Trusted" label on all products in search results',
      'Priority customer support from LocalFind team',
    ],

    restrictions: [
      'No green tick (that\'s reserved for Hero Shop)',
    ],
  },

  // ──────────────── LEVEL 5: HERO SHOP ✅ ────────────────
  {
    id: 'hero_shop',
    level: 5,
    name: 'Hero Shop',
    tagline: 'THE LEGEND! ✅ — Admin-verified excellence',
    description: 'This shop has been personally verified by the LocalFind team. The green tick means this business is 100% legit and trusted.',

    // Visual Design
    icon: 'verified',             // The green tick icon
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-400 dark:border-emerald-600',
    badgeGradient: 'from-emerald-400 to-teal-500',
    glowEffect: true,

    // Requirements
    requirements: {
      fiveStarReviews: 200,       // Must already be Trusted Merchant level
      adminApproval: true,        // ⚠️ ONLY given by admin — not automatic!
    },

    // Perks — everything from Level 4, PLUS:
    perks: [
      '✅ GREEN TICK — the ultimate trust signal',
      'All Trusted Merchant perks included',
      '"Hero Shop" golden frame around shop card on Discover page',
      'Pinned at top of search results in their area',
      'Exclusive "Hero Shop" section on home page',
      'Access to LocalFind promotional features (coming soon)',
      'Direct line to LocalFind admin support',
    ],

    restrictions: [],
  },
]


// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Determine the badge for a shop based on its 5-star review count
 * and whether admin has granted Hero status.
 *
 * @param {number} fiveStarCount - Total number of 5-star reviews the shop has
 * @param {boolean} isHeroShop   - Whether admin has granted Hero Shop status
 * @returns {object}             - The matching badge object from SHOP_BADGES
 *
 * USAGE EXAMPLE:
 *   const badge = getShopBadge(75, false)
 *   // Returns the "Community Favorite" badge (level 3)
 *
 *   const badge = getShopBadge(300, true)
 *   // Returns the "Hero Shop" badge (level 5)
 */
export function getShopBadgeByLevel(level = 1) {
  const num = Number(level) || 1
  const index = Math.max(0, Math.min(SHOP_BADGES.length - 1, num - 1))
  return SHOP_BADGES[index] || SHOP_BADGES[0]
}

/**
 * Determine the badge for a shop based on its 5-star review count
 * and whether admin has granted Hero status.
 *
 * @param {number|object} fiveStarCountOrShop - Total 5-star reviews OR shop object
 * @param {boolean} isHeroShop                - Whether admin granted Hero Shop status
 * @returns {object}                          - The matching badge object from SHOP_BADGES
 */
export function getShopBadge(fiveStarCountOrShop = 0, isHeroShop = false) {
  let count = 0
  let isHero = Boolean(isHeroShop)
  let directLevel = null

  if (typeof fiveStarCountOrShop === 'object' && fiveStarCountOrShop !== null) {
    count = Number(fiveStarCountOrShop.five_star_count ?? fiveStarCountOrShop.five_star_reviews_count ?? fiveStarCountOrShop.stars_5 ?? 0)
    isHero = Boolean(fiveStarCountOrShop.is_hero_shop || fiveStarCountOrShop.isHeroShop)
    if (fiveStarCountOrShop.badge_level) directLevel = Number(fiveStarCountOrShop.badge_level)
  } else {
    count = Number(fiveStarCountOrShop) || 0
  }

  // Hero Shop is a pure admin override: the flag alone grants Level 5, no review
  // threshold (mirrors worker calculateBadgeLevel). Admin word is final.
  if (isHero) {
    return SHOP_BADGES[4] // Level 5: Hero Shop
  }

  // Server-persisted level wins when present (source of truth for auto levels).
  if (directLevel && directLevel >= 1 && directLevel <= 5) {
    return getShopBadgeByLevel(directLevel)
  }

  // Walk backwards from highest auto-level (Level 4) to find the right badge
  if (count >= 200) return SHOP_BADGES[3] // Level 4: Trusted Merchant
  if (count >= 50)  return SHOP_BADGES[2] // Level 3: Community Favorite
  if (count >= 5)   return SHOP_BADGES[1] // Level 2: Rising Star
  return SHOP_BADGES[0]                  // Level 1: Unverified
}


/**
 * Get the NEXT badge a shop can earn (for progress bar UI).
 * Returns null if the shop is already at the highest auto-level or Hero.
 *
 * @param {number} fiveStarCount - Current 5-star review count
 * @param {boolean} isHeroShop   - Whether admin has granted Hero status
 * @returns {object|null}        - The next badge, or null if maxed out
 *
 * USAGE EXAMPLE:
 *   const next = getNextBadge(12, false)
 *   // Returns "Community Favorite" (need 50 five-stars, has 12)
 */
export function getNextBadge(fiveStarCountOrShop = 0, isHeroShop = false) {
  const current = getShopBadge(fiveStarCountOrShop, isHeroShop)
  if (current.level >= 5) return null   // Already at max
  return SHOP_BADGES[current.level]     // Next badge is at index = current level
}

/**
 * Calculate progress percentage toward the next badge.
 *
 * @param {number|object} fiveStarCountOrShop - Current 5-star review count OR shop object
 * @param {boolean} isHeroShop                - Whether admin has granted Hero status
 * @returns {object}                          - { percent, current, needed, remaining }
 */
export function getBadgeProgress(fiveStarCountOrShop = 0, isHeroShop = false) {
  let count = 0
  if (typeof fiveStarCountOrShop === 'object' && fiveStarCountOrShop !== null) {
    count = Number(fiveStarCountOrShop.five_star_count ?? fiveStarCountOrShop.five_star_reviews_count ?? fiveStarCountOrShop.stars_5 ?? 0)
  } else {
    count = Number(fiveStarCountOrShop) || 0
  }

  const currentBadge = getShopBadge(fiveStarCountOrShop, isHeroShop)
  const nextBadge = getNextBadge(fiveStarCountOrShop, isHeroShop)

  if (!nextBadge) {
    return { percent: 100, current: count, needed: 0, remaining: 0 }
  }

  const prevThreshold = currentBadge.requirements.fiveStarReviews
  const nextThreshold = nextBadge.requirements.fiveStarReviews
  const range = nextThreshold - prevThreshold
  const progress = Math.max(0, count - prevThreshold)
  const percent = range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 100

  return {
    percent,
    current: count,
    needed: nextThreshold,
    remaining: Math.max(0, nextThreshold - count),
  }
}


// ─── MILESTONE NOTIFICATIONS ─────────────────────────────────────────────────
// When a shop crosses a threshold, show a celebratory toast/modal.

export const MILESTONE_MESSAGES = {
  rising_star: {
    title: '🐱 CAT SPOTTED!',
    message: 'You earned 5 five-star reviews! Your shop is now a Rising Star! ⭐',
    confetti: true,
  },
  community_favorite: {
    title: '🏘️ NEIGHBORHOOD HERO!',
    message: 'Incredible! 50 five-star reviews! You\'re now a Community Favorite! 🏆',
    confetti: true,
  },
  trusted_merchant: {
    title: '💎 DIAMOND STATUS!',
    message: 'LEGENDARY! 200 five-star reviews! You are now a Trusted Merchant! 💎',
    confetti: true,
  },
  hero_shop: {
    title: '✅ HERO SHOP!',
    message: 'The LocalFind team has verified your shop. You earned the green tick! 🎉',
    confetti: true,
  },
}


// ═══════════════════════════════════════════════════════════════════════════════
//  TEAM DIVISION OF WORK (AI AGENT ROLES)
// ═══════════════════════════════════════════════════════════════════════════════
//
//  🤖 MUSE SPARK 1.3 -> BACKEND, DATABASE & BUSINESS LOGIC
//  🎨 GEMINI          -> FRONTEND, UI COMPONENTS, STYLING & ANIMATIONS
//
// ═══════════════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────────────
//  PART A: MUSE SPARK 1.3 (Backend & Database Tasks)
// ─────────────────────────────────────────────────────────────────────────────
//
//  TASK 1: DATABASE MIGRATION (worker/schema.sql + migration_badges.sql)
//  - Add `is_hero_shop INTEGER NOT NULL DEFAULT 0` to `shops` table.
//  - Add `badge_level INTEGER NOT NULL DEFAULT 1` to `shops` table.
//  - Create index on `shops(badge_level)` and `shops(is_hero_shop)` for fast lookups.
//
//  TASK 2: RATING RECALCULATION & BADGE LOGIC (worker/src/index.js)
//  - Write a helper `calculateBadgeLevel(fiveStarCount, isHeroShop)` in the worker.
//  - In `handleSaveReview()`:
//      * Count total 5-star reviews for the shop:
//        `SELECT COUNT(*) as count FROM reviews WHERE shop_id = ? AND rating = 5`
//      * Determine new badge level.
//      * Run `UPDATE shops SET badge_level = ? WHERE id = ?`.
//      * Return `new_badge_level` and `milestone_unlocked` in the response JSON.
//  - In `handleDeleteReview()`:
//      * Run the same recalculation so badge downgrades if 5-star reviews are deleted.
//
//  TASK 3: UPDATE LISTING ENDPOINTS (worker/src/index.js)
//  - In `handleListProducts()`:
//      * Add `s.badge_level`, `s.is_hero_shop`, and count of 5-star reviews to SELECT query.
//  - In `handleListShops()`:
//      * Include `badge_level` and `is_hero_shop` in the shop list output.
//  - In `handleGetMyShop()`:
//      * Return current `badge_level`, `is_hero_shop`, and `five_star_reviews_count`.
//
//  TASK 4: ADMIN ENDPOINT FOR HERO SHOP (worker/src/index.js)
//  - Create `POST /api/admin/hero-shop`:
//      * Requires verified admin auth token (`verifyAdminToken`).
//      * Body: `{ shop_id: string, is_hero: boolean }`.
//      * Updates `is_hero_shop = 1` and `badge_level = 5` (or reverts if false).
//      * Logs action in `admin_audit_log` with details.
//
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
//  PART B: GEMINI (Frontend, Design & Animation Tasks)
// ─────────────────────────────────────────────────────────────────────────────
//
//  TASK 1: REUSABLE BADGE UI COMPONENTS (src/components/ShopBadge.jsx)
//  - Create `<ShopBadgePill level={...} size="sm|md|lg" showIcon showName />`
//      * Renders badge with icon, custom background, text color, and border.
//      * Includes smooth pulsing glow effect for Level 3 (Community) and Level 4 (Diamond).
//  - Create `<HeroShopBadge />`
//      * Dedicated green tick badge with sparkling emerald border ring.
//
//  TASK 2: BUYER DISCOVER INTEGRATION (src/components/BuyerDiscover.jsx)
//  - Display the shop's badge next to the shop name on product cards.
//  - Show glowing border around product cards from "Hero Shop" sellers.
//  - Add filter chip on Discover: "⭐ Top Rated & Trusted Shops".
//
//  TASK 3: MERCHANT DASHBOARD PROGRESS & PERKS (src/components/MerchantDashboard.jsx)
//  - Add a "Shop Trust & Milestone Level" card in the merchant dashboard:
//      * Shows current badge (icon, name, tagline).
//      * Shows progress bar toward next badge (e.g., "12 / 50 five-star reviews").
//      * Shows unlocked perks and perks to unlock next.
//  - Milestone Celebration Modal:
//      * When a shop reaches a new badge, fire a celebratory modal with canvas confetti.
//      * Uses `MILESTONE_MESSAGES` from this file.
//
//  TASK 4: ADMIN DASHBOARD HERO TOGGLE (src/components/AdminDashboard.jsx)
//  - In the Admin "Shops" tab:
//      * Show the badge icon and level pill next to each shop row.
//      * Add a "Grant Hero Shop ✅" toggle button for verified merchants.
//      * Trigger a success toast and haptic feedback when toggled.
//
//  TASK 5: STYLING & ANIMATIONS (src/index.css & Tailwind)
//  - Add `@keyframes badgeGlow` for pulsating badge glow.
//  - Add `.hero-shop-ring` gradient border animation for Hero shops.
//  - Ensure high contrast in both light and dark mode.
//
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
//  PARALLEL EXECUTION PLAN (HOW BOTH WORK AT THE SAME TIME)
// ─────────────────────────────────────────────────────────────────────────────
//
//  CAN THEY WORK IN PARALLEL? YES, 100%!
//  Because each AI works in completely separate folders and files, there are
//  ZERO merge conflicts.
//
//  STRICT FILE BOUNDARIES:
//  ┌─────────────────────────┬───────────────────────────────────────────────┐
//  │ AI AGENT                │ FILES THEY ARE ALLOWED TO EDIT                │
//  ├─────────────────────────┼───────────────────────────────────────────────┤
//  │ 🤖 MUSE SPARK 1.3       │ worker/schema.sql                             │
//  │    (Backend Only)       │ worker/migration_badges.sql (new)             │
//  │                         │ worker/src/index.js                           │
//  ├─────────────────────────┼───────────────────────────────────────────────┤
//  │ 🎨 GEMINI               │ src/components/ShopBadge.jsx (new)            │
//  │    (Frontend Only)      │ src/components/BuyerDiscover.jsx              │
//  │                         │ src/components/MerchantDashboard.jsx          │
//  │                         │ src/components/AdminDashboard.jsx             │
//  │                         │ src/index.css                                 │
//  └─────────────────────────┴───────────────────────────────────────────────┘
//
//  SHARED CONTRACT (API SHAPE):
//  Both AIs follow the exact data contract defined in `src/utils/shopBadges.js`:
//
//  1. Product object from `/api/products` has:
//     - `badge_level`: number (1 to 5, default 1)
//     - `is_hero_shop`: number (0 or 1, default 0)
//     - `five_star_reviews_count`: number (default 0)
//
//  2. Shop object from `/api/shops` and `/api/my-shop` has:
//     - `badge_level`: number (1 to 5, default 1)
//     - `is_hero_shop`: number (0 or 1, default 0)
//     - `five_star_reviews_count`: number (default 0)
//
//  3. Admin hero endpoint:
//     - POST `/api/admin/hero-shop` with body `{ shop_id: string, is_hero: boolean }`
//
//  WHY FRONTEND CAN RUN SAFELY BEFORE BACKEND FINISHES:
//  The helper function `getShopBadge(fiveStarCount, isHeroShop)` in this file
//  already handles undefined/null values safely with default fallbacks (Level 1: Unverified).
//  So frontend UI can be built and tested with mock or real data immediately.
// ─────────────────────────────────────────────────────────────────────────────


