-- Migration: Database Capacity & Query Optimization
-- Adds denormalized review stats + updated_at to shops table (eliminates
-- subqueries on list endpoints and powers correct ETag invalidation).
-- Drops redundant indexes on product_events to speed up event inserts.
--
-- EXISTING DBs ONLY — skip on fresh installs (schema.sql already includes
-- these columns; bare ALTER TABLE fails with "duplicate column" there).
-- ONE-SHOT: do not re-run (second run fails loudly on duplicate column;
-- the failure is harmless — ALTERs run before any data change — but the
-- backfill UPDATEs below would needlessly rewrite every row).
-- Run with:
--   npx wrangler d1 execute localfind-db --file=./worker/migration_optimize_db.sql --remote
--
-- NOTE (verified 2026-10-02): the three review-stat columns below already
-- exist in prod (applied directly earlier), so only the updated_at ALTER
-- remains runnable there. Kept the others as documentation of full shape.

-- 1. Add denormalized review stats directly on shops table
-- (already applied in prod — left for DBs that never got them)
-- ALTER TABLE shops ADD COLUMN five_star_reviews_count INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE shops ADD COLUMN avg_rating REAL;
-- ALTER TABLE shops ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0;
-- ETag source for the shops feed: bumped on every mutation (edits, bans,
-- hero flips, review badge refreshes). Backfilled from created_at below.
ALTER TABLE shops ADD COLUMN updated_at TEXT;

-- 2. Backfill review stats from existing reviews
UPDATE shops SET
  review_count = (SELECT COUNT(*) FROM reviews WHERE reviews.shop_id = shops.id),
  avg_rating = (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE reviews.shop_id = shops.id),
  five_star_reviews_count = (SELECT COUNT(*) FROM reviews WHERE reviews.shop_id = shops.id AND reviews.rating = 5);
UPDATE shops SET updated_at = created_at WHERE updated_at IS NULL;

-- 3. Drop redundant indexes on product_events to reduce write amplification
DROP INDEX IF EXISTS idx_events_user_type_date;
DROP INDEX IF EXISTS idx_events_shop_hour;
DROP INDEX IF EXISTS idx_events_shop_search;
DROP INDEX IF EXISTS idx_events_shop_pincode;
