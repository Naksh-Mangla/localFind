-- Migration: Shopkeeper analytics (YouTube-Studio style) event log
-- Run with: npx wrangler d1 execute localfind-db --file=./migration_analytics.sql
-- Logged-in buyers only. No PII. Owner self-views excluded at write time.
-- One row per user/product/event/day (UNIQUE) = free anti-spam dedupe.

CREATE TABLE IF NOT EXISTS product_events (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK(event_type IN ('impression','detail_open','whatsapp_click','directions_click','share','wishlist','review')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  event_date TEXT GENERATED ALWAYS AS (substr(created_at, 1, 10)) STORED,
  UNIQUE(user_id, product_id, event_type, event_date)
);

CREATE INDEX IF NOT EXISTS idx_events_shop_date ON product_events(shop_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_product_date ON product_events(product_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_shop_type_date ON product_events(shop_id, event_type, event_date);
