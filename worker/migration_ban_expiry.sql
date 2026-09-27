-- Migration: Timed bans (banned_until) + owner email on shops
-- Run ONCE against the existing production DB with:
--   npx wrangler d1 execute localfind-db --file=./worker/migration_ban_expiry.sql --remote
-- Do NOT run against fresh databases (worker/schema.sql already includes these
-- columns) and do NOT re-run: duplicate ADD COLUMN statements will error.
--
-- Behaviour: bans NEVER delete products. banned_until NULL = indefinite ban.
-- Expired bans auto-restore in every worker check — no backfill needed.
-- owner_email backfills on next shop save (from verified Firebase token).

ALTER TABLE shops ADD COLUMN banned_until TEXT;
ALTER TABLE shops ADD COLUMN owner_email TEXT;

CREATE INDEX IF NOT EXISTS idx_shops_ban_expiry ON shops(is_banned, banned_until);
