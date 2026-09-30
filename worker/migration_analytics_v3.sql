-- Migration v3: advanced analytics (peak hours, search keywords, area reach,
-- call + flash-claim funnel steps).
-- Run with: npx wrangler d1 execute localfind-db --remote --file=./migration_analytics_v3.sql
--
-- ONE-SHOT, only for DBs holding the v1/v2 product_events table. Fresh DBs
-- get the final shape from schema.sql and must SKIP this file (the copy
-- SELECT would fail with no source table). Re-running nulls search_query /
-- buyer_pincode, so don't.
-- Cleans up a leftover swap table from any interrupted previous attempt.
DROP TABLE IF EXISTS product_events_new;
--
-- GUARDS: either SELECT raises (aborting the batch before any DROP/COPY),
-- so a wrong-target run fails safely with zero data touched.
-- 1. Fresh DBs have no product_events (they use schema.sql) — stop here.
SELECT CASE WHEN COUNT(*) = 0
  THEN RAISE(ABORT, 'v3 needs the v1/v2 product_events table')
  ELSE 0 END
FROM sqlite_master WHERE type = 'table' AND name = 'product_events';
-- 2. Already-migrated DBs have search_query — re-running would null it.
SELECT CASE WHEN COUNT(*) > 0
  THEN RAISE(ABORT, 'v3 already applied')
  ELSE 0 END
FROM pragma_table_info('product_events') WHERE name = 'search_query';
-- NOTE: RAISE() outside triggers is illegal SQLite, so a tripped guard
-- surfaces as a generic "SQLITE_ERROR / RAISE() may only be used within a
-- trigger-program" abort — the custom text is documentation only. Either
-- way the batch stops before any DROP/COPY, so nothing is modified.
--
-- hour_of_day is GENERATED from created_at (UTC) so historical rows qualify.
-- search_query / buyer_pincode stay NULL unless that event carries them.

-- NOTE: SQLite forbids ADD COLUMN for STORED generated columns, so we go
-- straight to the recreate dance (works on v1 and v2 tables alike):
-- new table carries the widened CHECK + all new columns, rows are copied.
--    Step 1: new table with widened constraint + all v1/v2/v3 columns/indexes.
CREATE TABLE IF NOT EXISTS product_events_new (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK(event_type IN ('impression','detail_open','whatsapp_click','directions_click','share','wishlist','review','call_click','flash_claim','search_view')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  event_date TEXT GENERATED ALWAYS AS (substr(created_at, 1, 10)) STORED,
  hour_of_day INTEGER GENERATED ALWAYS AS (CAST(substr(created_at, 12, 2) AS INTEGER)) STORED,
  search_query TEXT,
  buyer_pincode TEXT,
  UNIQUE(user_id, product_id, event_type, event_date)
);

-- Step 2: copy rows (new nullable columns default correctly; v1 tables
-- lack search_query/buyer_pincode — SELECT them only if present is not
-- possible in plain SQL, so copy the shared columns and leave new ones NULL).
INSERT OR IGNORE INTO product_events_new
  (id, shop_id, product_id, user_id, event_type, created_at)
  SELECT id, shop_id, product_id, user_id, event_type, created_at
  FROM product_events;

-- Step 3: swap.
DROP TABLE product_events;
ALTER TABLE product_events_new RENAME TO product_events;

-- Step 4: re-create all indexes (v1 + v2 + v3).
CREATE INDEX IF NOT EXISTS idx_events_shop_date ON product_events(shop_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_product_date ON product_events(product_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_shop_type_date ON product_events(shop_id, event_type, event_date);
CREATE INDEX IF NOT EXISTS idx_events_user_type_date ON product_events(user_id, event_type, event_date, shop_id);
CREATE INDEX IF NOT EXISTS idx_events_shop_hour ON product_events(shop_id, hour_of_day, event_date);
CREATE INDEX IF NOT EXISTS idx_events_shop_search ON product_events(shop_id, search_query, event_date);
CREATE INDEX IF NOT EXISTS idx_events_shop_pincode ON product_events(shop_id, buyer_pincode, event_date);
