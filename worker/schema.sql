CREATE TABLE IF NOT EXISTS shops (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL,
  shop_name       TEXT NOT NULL,
  owner_name      TEXT,
  description     TEXT,
  opening_time    TEXT DEFAULT '09:00',
  closing_time    TEXT DEFAULT '21:00',
  whatsapp_number TEXT NOT NULL,
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,
  address_text    TEXT,
  is_banned       INTEGER NOT NULL DEFAULT 0,
  ban_reason      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS products (
  id                   TEXT PRIMARY KEY,
  shop_id              TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  price                REAL NOT NULL,
  category             TEXT NOT NULL,
  image_url            TEXT,
  is_affiliate_fallback INTEGER NOT NULL DEFAULT 0,
  affiliate_link       TEXT,
  is_flash_deal        INTEGER NOT NULL DEFAULT 0,
  flash_deal_discount  INTEGER NOT NULL DEFAULT 0,
  flash_deal_ends_at   TEXT,
  version              INTEGER NOT NULL DEFAULT 1,
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  shop_id     TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, shop_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_coords ON shops(lat, lng);
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_shop_created ON products(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_flash ON products(is_flash_deal, flash_deal_ends_at);
CREATE TABLE IF NOT EXISTS admin_users (
  uid         TEXT PRIMARY KEY,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'admin',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          TEXT PRIMARY KEY,
  admin_uid   TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_shop ON reviews(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_log(admin_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_shops_banned ON shops(is_banned);
