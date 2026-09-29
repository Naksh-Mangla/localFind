-- Migration v2: covering index for the per-track dedupe lookup
-- Run with: npx wrangler d1 execute localfind-db --remote --file=./migration_analytics_v2.sql
-- Every POST /api/analytics/track runs a SELECT on (user_id, event_type,
-- event_date, shop_id); without a user_id-led index that scan grows with the table.

CREATE INDEX IF NOT EXISTS idx_events_user_type_date ON product_events(user_id, event_type, event_date, shop_id);
