-- Migration v4: atomic NULL-safe daily-dedupe guard.
-- Run with: npx wrangler d1 execute localfind-db --remote --file=./migration_analytics_v4.sql
--
-- SQLite treats NULLs as distinct inside UNIQUE constraints, so the v1
-- UNIQUE(user_id, product_id, event_type, event_date) never fires for
-- shop-only / search_view rows (product_id NULL): concurrent inserts could
-- both pass the worker's SELECT guard and duplicate. COALESCE turns NULLs
-- into '' so the constraint actually bites. The worker uses bare
-- ON CONFLICT DO NOTHING, which catches violations of ANY unique index.

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe_once
  ON product_events(user_id, shop_id, event_type, event_date,
    COALESCE(product_id, ''), COALESCE(search_query, ''));
