CREATE TABLE IF NOT EXISTS shops (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL,
  shop_name       TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,
  address_text    TEXT,
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
  version              INTEGER NOT NULL DEFAULT 1,
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
