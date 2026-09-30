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
  banned_until    TEXT,
  owner_email     TEXT,
  is_hero_shop    INTEGER NOT NULL DEFAULT 0,
  badge_level     INTEGER NOT NULL DEFAULT 1,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  subscription_expires_at TEXT,
  flash_deals_used_this_month INTEGER NOT NULL DEFAULT 0,
  flash_deals_reset_at TEXT,
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
CREATE INDEX IF NOT EXISTS idx_reviews_shop_rating ON reviews(shop_id, rating);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_log(admin_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_shops_banned ON shops(is_banned);
CREATE INDEX IF NOT EXISTS idx_shops_ban_expiry ON shops(is_banned, banned_until);
CREATE INDEX IF NOT EXISTS idx_shops_badge ON shops(badge_level);
CREATE INDEX IF NOT EXISTS idx_shops_hero ON shops(is_hero_shop);
CREATE INDEX IF NOT EXISTS idx_shops_subscription ON shops(subscription_tier);
CREATE TABLE IF NOT EXISTS product_events (
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
CREATE INDEX IF NOT EXISTS idx_events_shop_date ON product_events(shop_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_product_date ON product_events(product_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_shop_type_date ON product_events(shop_id, event_type, event_date);
CREATE INDEX IF NOT EXISTS idx_events_user_type_date ON product_events(user_id, event_type, event_date, shop_id);
CREATE INDEX IF NOT EXISTS idx_events_shop_hour ON product_events(shop_id, hour_of_day, event_date);
CREATE INDEX IF NOT EXISTS idx_events_shop_search ON product_events(shop_id, search_query, event_date);
CREATE INDEX IF NOT EXISTS idx_events_shop_pincode ON product_events(shop_id, buyer_pincode, event_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe_once
  ON product_events(user_id, shop_id, event_type, event_date,
    COALESCE(product_id, ''), COALESCE(search_query, ''));
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  email_key    TEXT PRIMARY KEY,
  attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
