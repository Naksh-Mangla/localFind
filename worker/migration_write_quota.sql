-- Migration: per-user daily write quotas (anti-spam / anti-bot backstop).
-- Run with: npx wrangler d1 execute localfind-db --remote --file=./migration_write_quota.sql
-- One row per user per scope per UTC day. Stale days accumulate slowly
-- (one small row per active writer per day); safe to prune occasionally:
--   DELETE FROM write_quota WHERE day < substr(strftime('%Y-%m-%dT%H:%M:%fZ','now'),1,10);

CREATE TABLE IF NOT EXISTS write_quota (
  user_id TEXT NOT NULL,
  scope   TEXT NOT NULL,
  day     TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, scope, day)
);
