-- Migration: Shop badge & milestone system (timed-ban sibling)
-- Run ONCE against the existing production DB with:
--   npx wrangler d1 execute localfind-db --file=./worker/migration_badges.sql --remote
-- Do NOT run against fresh databases (worker/schema.sql already includes these
-- columns) and do NOT re-run: duplicate ADD COLUMN statements will error.
--
-- Levels mirror src/utils/shopBadges.js: 1 Unverified (0), 2 Rising Star (5),
-- 3 Community Favorite (50), 4 Trusted Merchant (200 five-star reviews).
-- Level 5 (Hero Shop) is granted manually by admins via POST /api/admin/hero-shop.

ALTER TABLE shops ADD COLUMN is_hero_shop INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shops ADD COLUMN badge_level INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_shops_badge ON shops(badge_level);
CREATE INDEX IF NOT EXISTS idx_shops_hero ON shops(is_hero_shop);
CREATE INDEX IF NOT EXISTS idx_reviews_shop_rating ON reviews(shop_id, rating);

-- Backfill earned levels from existing reviews. Hero is a pure admin override:
-- any shop already carrying the flag lands on Level 5 regardless of reviews.
UPDATE shops SET badge_level = (
  CASE
    WHEN is_hero_shop = 1 THEN 5
    WHEN (SELECT COUNT(*) FROM reviews WHERE reviews.shop_id = shops.id AND reviews.rating = 5) >= 200 THEN 4
    WHEN (SELECT COUNT(*) FROM reviews WHERE reviews.shop_id = shops.id AND reviews.rating = 5) >= 50 THEN 3
    WHEN (SELECT COUNT(*) FROM reviews WHERE reviews.shop_id = shops.id AND reviews.rating = 5) >= 5 THEN 2
    ELSE 1
  END
);
