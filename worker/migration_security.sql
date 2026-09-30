-- Migration: admin login brute-force protection (rate limiting / lockout)
-- Run with: npx wrangler d1 execute localfind-db --remote --file=./migration_security.sql
-- One row per lowercase admin email: failed attempts + lock expiry.
-- Tracked for unknown emails too, so lockouts never reveal whether an
-- address is a real admin account (anti-enumeration).

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  email_key    TEXT PRIMARY KEY,
  attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
