-- Migration: Add Admin Dashboard tables + shop banning
-- Run with: npx wrangler d1 execute localfind-db --file=./worker/migration_admin.sql --remote

-- Admin users registry
CREATE TABLE IF NOT EXISTS admin_users (
  uid         TEXT PRIMARY KEY,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'admin',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Audit log for admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          TEXT PRIMARY KEY,
  admin_uid   TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_log(admin_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_type, target_id);

-- Add banning columns to shops (safe: uses ALTER TABLE ADD COLUMN)
ALTER TABLE shops ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shops ADD COLUMN ban_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_shops_banned ON shops(is_banned);
