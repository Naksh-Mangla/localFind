-- Migration: Add subscription tier system to shops
-- Run with: npx wrangler d1 execute localfind-db --file=./migration_subscription.sql

-- Subscription tier field (free/starter/pro/hero)
-- Defaults to 'free' — all existing merchants are grandfathered into free tier.
ALTER TABLE shops ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free'
  CHECK(subscription_tier IN ('free', 'starter', 'pro', 'hero'));

-- When the current subscription period expires (NULL = never expires / free tier)
ALTER TABLE shops ADD COLUMN subscription_expires_at TEXT;

-- Number of flash deals used in the current billing cycle (resets monthly)
ALTER TABLE shops ADD COLUMN flash_deals_used_this_month INTEGER NOT NULL DEFAULT 0;

-- Timestamp of last flash deal counter reset (for monthly cycle tracking)
ALTER TABLE shops ADD COLUMN flash_deals_reset_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- Index for quick tier lookups (admin stats, tier-filtered queries)
CREATE INDEX IF NOT EXISTS idx_shops_subscription ON shops(subscription_tier);
